/**
 * AS608 Smart Fingerprint v2 — independent protocol implementation.
 * Phase 1: UART connection and device response verification.
 * Copyright (c) 2026 AS608 Smart contributors. MIT License.
 */
//% color=#246B73 icon="\uf2c2" weight=90 block="AS608 Smart"
namespace AS608Smart {
    const START_HI = 0xEF
    const START_LO = 0x01
    const DEVICE_ADDRESS = 0xFFFFFFFF
    const COMMAND_PACKET = 0x01
    const ACK_PACKET = 0x07
    const READ_TEMPLATE_COUNT = 0x1D
    const UART_BAUD = BaudRate.BaudRate57600

    let configured = false
    let inTransaction = false
    let lastStatus = -1
    let templateCount = -1

    // No assumptions about the internal receive-buffer length or packet alignment.
    // All reads use readBuffer(0), which drains currently available bytes.
    function sendCommand(command: number): void {
        const frame = pins.createBuffer(12)
        frame[0] = START_HI
        frame[1] = START_LO
        frame[2] = 0xFF
        frame[3] = 0xFF
        frame[4] = 0xFF
        frame[5] = 0xFF
        frame[6] = COMMAND_PACKET
        frame[7] = 0
        frame[8] = 3 // command byte plus two checksum bytes
        frame[9] = command
        const checksum = COMMAND_PACKET + 3 + command
        frame[10] = (checksum >> 8) & 255
        frame[11] = checksum & 255
        serial.writeBuffer(frame)
    }

    // Returns ACK payload or null on malformed packet / timeout.
    function receiveAck(timeoutMs: number): number[] {
        const stream: number[] = []
        const end = input.runningTime() + timeoutMs
        while (input.runningTime() < end) {
            const incoming = serial.readBuffer(0)
            for (let i = 0; i < incoming.length; i++) stream.push(incoming[i])
            // Synchronize on packet header; discard unrelated UART bytes.
            while (stream.length >= 2 && (stream[0] !== START_HI || stream[1] !== START_LO)) {
                stream.shift()
            }
            if (stream.length >= 9) {
                const length = stream[7] * 256 + stream[8]
                if (length < 3 || length > 128) return null
                const fullLength = 9 + length
                if (stream.length >= fullLength) {
                    if (stream[2] !== 255 || stream[3] !== 255 || stream[4] !== 255 || stream[5] !== 255 || stream[6] !== ACK_PACKET) return null
                    let sum = stream[6] + stream[7] + stream[8]
                    for (let i = 9; i < fullLength - 2; i++) sum += stream[i]
                    const receivedSum = stream[fullLength - 2] * 256 + stream[fullLength - 1]
                    if ((sum & 65535) !== receivedSum) return null
                    const payload: number[] = []
                    for (let i = 9; i < fullLength - 2; i++) payload.push(stream[i])
                    return payload
                }
            }
            basic.pause(5)
        }
        return null
    }

    /**
     * Configure serial communication with the fingerprint scanner.
     * Connect scanner TX to the micro:bit RX pin and scanner RX to the TX pin.
     */
    //% blockId=as608smart_connect block="connect fingerprint scanner RX $rx TX $tx"
    //% rx.defl=SerialPin.P13 tx.defl=SerialPin.P14
    //% weight=100 group="Connection"
    export function connect(rx: SerialPin, tx: SerialPin): void {
        configured = false
        if (inTransaction) return
        serial.redirect(tx, rx, UART_BAUD)
        serial.setRxBufferSize(128)
        serial.setTxBufferSize(64)
        serial.readBuffer(0)
        templateCount = -1
        lastStatus = -1
        configured = true
    }

    /** Check the sensor by requesting its stored fingerprint count. */
    //% blockId=as608smart_check block="fingerprint sensor connected?"
    //% weight=90 group="Connection"
    export function isConnected(): boolean {
        if (!configured || inTransaction) return false
        inTransaction = true
        lastStatus = -1
        templateCount = -1
        // Discard stale bytes from an earlier operation before sending a new command.
        serial.readBuffer(0)
        sendCommand(READ_TEMPLATE_COUNT)
        const answer = receiveAck(1200)
        inTransaction = false
        if (!answer || answer.length < 3) return false
        lastStatus = answer[0]
        if (lastStatus !== 0) return false
        templateCount = answer[1] * 256 + answer[2]
        return true
    }

    /** Most recent sensor response code; -1 means no valid response. */
    //% blockId=as608smart_status block="last sensor status"
    //% weight=80 group="Connection" advanced=true
    export function lastSensorStatus(): number {
        return lastStatus
    }

    /** Number of stored fingerprints from the last successful connection check. */
    //% blockId=as608smart_count block="stored fingerprints (last check)"
    //% weight=70 group="Connection"
    export function storedFingerprints(): number {
        return templateCount
    }
}
