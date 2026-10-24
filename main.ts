/**
 * AS608 Smart Fingerprint v2 — independently written MakeCode driver.
 * AS608/ZFM-compatible 0xEF01 UART protocol, default 57600 baud.
 * MIT License. Not tested on physical hardware yet.
 */
//% color=#25858C icon="\uf2c2" weight=90 block="AS608 Smart · v2.0.0-beta.6"
namespace AS608Smart {
    const BAUD = BaudRate.BaudRate57600
    const NO_FINGER = -3
    const IO_ERROR = -2
    const BUSY = -4
    const REJECTED = -9
    let ready = false
    let busy = false
    let autoEnabled = false
    let autoGeneration = 0
    let fingerPresent = false
    let lastStatus = -1
    let lastId = -1
    let lastScore = 0
    let successCount = 0
    let rejectionCount = 0
    let librarySize = 256
    let recognizedHandler: () => void = null
    let rejectedHandler: () => void = null
    let errorHandler: () => void = null
    let enrollStepHandler: () => void = null
    let enrollStep = 0
    // UART diagnostics, reset on each transaction.
    let diagnosticBytes = 0
    let diagnosticFirstByte = -1
    let diagnosticLastByte = -1
    let diagnosticPacketStage = 0 // 0=no data, 1=EF, 2=EF01, 3=header, 4=complete
    let diagnosticExpectedBytes = 0
    let diagnosticTxBytes = 0

    function transmit(data: number[]): void {
        const payloadLength = data.length + 2
        const packet = pins.createBuffer(9 + payloadLength)
        packet[0] = 0xEF; packet[1] = 0x01
        packet[2] = 0xFF; packet[3] = 0xFF; packet[4] = 0xFF; packet[5] = 0xFF
        packet[6] = 0x01
        packet[7] = (payloadLength >> 8) & 255
        packet[8] = payloadLength & 255
        let checksum = 0x01 + packet[7] + packet[8]
        for (let i = 0; i < data.length; i++) {
            packet[9 + i] = data[i] & 255
            checksum += data[i] & 255
        }
        packet[9 + data.length] = (checksum >> 8) & 255
        packet[10 + data.length] = checksum & 255
        diagnosticTxBytes = packet.length
        serial.writeBuffer(packet)
    }

    // Receive a complete AS608 acknowledgment using a deadline for the whole frame.
    // Parse incrementally, including when UART chunks arrive split across reads.
    // Avoid blocking readBuffer(1): an incomplete frame must not freeze micro:bit.
    function readAck(timeoutMs: number): number[] {
        let bytes: number[] = []
        let expected = 0
        const deadline = input.runningTime() + timeoutMs
        while (input.runningTime() < deadline) {
            const chunk = serial.readBuffer(0)
            for (let i = 0; i < chunk.length; i++) {
                const b = chunk[i]
                diagnosticBytes++
                if (diagnosticFirstByte < 0) diagnosticFirstByte = b
                diagnosticLastByte = b
                if (bytes.length === 0 && b !== 0xEF) continue
                if (bytes.length === 1 && b !== 0x01) {
                    bytes = []
                    if (b === 0xEF) bytes.push(b)
                    continue
                }
                bytes.push(b)
                if (bytes.length === 1) diagnosticPacketStage = 1
                if (bytes.length === 2) diagnosticPacketStage = 2
                if (bytes.length === 9) {
                    const payloadSize = bytes[7] * 256 + bytes[8]
                    if (payloadSize < 3 || payloadSize > 256) {
                        lastStatus = -12 // invalid frame length
                        return null
                    }
                    expected = 9 + payloadSize
                    diagnosticExpectedBytes = expected
                    diagnosticPacketStage = 3
                }
                if (expected > 0 && bytes.length === expected) {
                    if (bytes[2] !== 255 || bytes[3] !== 255 || bytes[4] !== 255 || bytes[5] !== 255 || bytes[6] !== 7) {
                        lastStatus = -13 // unexpected packet address/type
                        return null
                    }
                    let checksum = 0
                    for (let j = 6; j < expected - 2; j++) checksum += bytes[j]
                    const received = bytes[expected - 2] * 256 + bytes[expected - 1]
                    if ((checksum & 65535) !== received) {
                        lastStatus = -14 // checksum mismatch
                        return null
                    }
                    diagnosticPacketStage = 4
                    const payload: number[] = []
                    for (let j = 9; j < expected - 2; j++) payload.push(bytes[j])
                    return payload
                }
            }
            basic.pause(2)
        }
        lastStatus = -2 // no complete acknowledgment within timeout
        return null
    }

    // Serial transaction lock shared by automatic scanning and enrollment.
    function command(data: number[], timeoutMs: number, diagnosticBypass: boolean = false): number[] {
        if ((!ready && !diagnosticBypass) || busy) { lastStatus = BUSY; return null }
        busy = true
        diagnosticBytes = 0
        diagnosticFirstByte = -1
        diagnosticLastByte = -1
        diagnosticPacketStage = 0
        diagnosticExpectedBytes = 0
        diagnosticTxBytes = 0
        // No pre-transmission UART drain: match the stable v1.1 send sequence.
        transmit(data)
        const response = readAck(timeoutMs)
        busy = false
        if (response && response.length > 0) lastStatus = response[0]
        return response
    }

    function captured(diagnosticBypass: boolean = false): number {
        const r = command([0x01], 1200, diagnosticBypass)
        return r ? r[0] : IO_ERROR
    }

    function convert(bufferId: number): number {
        const r = command([0x02, bufferId], 1200)
        return r ? r[0] : IO_ERROR
    }

    function findMatch(): number {
        const r = command([0x04, 0x01, 0, 0, (librarySize >> 8) & 255, librarySize & 255], 1600)
        if (!r) return IO_ERROR
        if (r[0] === 9) return REJECTED
        if (r[0] !== 0 || r.length < 5) return IO_ERROR
        lastId = r[1] * 256 + r[2]
        lastScore = r[3] * 256 + r[4]
        return lastId
    }

    function identifyCore(diagnosticBypass: boolean = false): number {
        const image = captured(diagnosticBypass)
        if (image === 2) return NO_FINGER
        if (image !== 0) return IO_ERROR
        if (convert(1) !== 0) return IO_ERROR
        return findMatch()
    }

    function waitFingerState(present: boolean, timeoutMs: number): boolean {
        const until = input.runningTime() + timeoutMs
        while (input.runningTime() < until) {
            const status = captured()
            if (present && status === 0) return true
            if (!present && status === 2) return true
            if (status !== 0 && status !== 2) return false
            basic.pause(120)
        }
        lastStatus = -5
        return false
    }

    /** Connect AS608 TX -> micro:bit RX; AS608 RX -> micro:bit TX. */
    //% blockId=as608_v2_connect block="connect fingerprint scanner RX $rx TX $tx"
    //% rx.defl=SerialPin.P13 tx.defl=SerialPin.P14
    //% weight=100 group="Connection"
    export function connect(rx: SerialPin, tx: SerialPin): void {
        autoEnabled = false
        autoGeneration++
        if (busy) { lastStatus = BUSY; return }
        serial.redirect(tx, rx, BAUD)
        basic.pause(500) // allow the UART redirect and sensor to settle
        // No pre-probe UART drain: match the stable v1.1 initialization.
        ready = true // enable the command transaction for the initial probe
        lastStatus = -1
        fingerPresent = false
        lastId = -1
        // Unlike beta.3, perform a real AS608 system-parameters request (0x0F)
        // during connection, as the verified v1.1 initialization sequence does.
        // Preserve UART diagnostics from this probe for troubleshooting.
        const response = command([0x0F], 2000)
        if (!response || response.length < 17 || response[0] !== 0) {
            ready = false
            if (response && response[0] === 0 && response.length < 17) lastStatus = -15
            return
        }
        // System parameters response: confirmation, status(2), system ID(2),
        // library capacity(2), security(2), address(4), packet length(2), baud(2).
        const capacity = response[5] * 256 + response[6]
        if (capacity > 0) librarySize = capacity
    }

    /** Ping sensor with a template count request. */
    //% blockId=as608_v2_check block="fingerprint sensor connected?"
    //% weight=95 group="Connection"
    export function isConnected(): boolean {
        return ready
    }

    /** Read actual count, or -1 on communication error. */
    //% blockId=as608_v2_count block="stored fingerprints"
    //% weight=90 group="Fingerprints"
    export function storedFingerprints(): number {
        const r = command([0x1D], 2000)
        return r && r[0] === 0 && r.length >= 3 ? r[1] * 256 + r[2] : -1
    }

    /** Identify one finger: ID >= 0; -3 no finger; -9 unknown; -2 error. */
    //% blockId=as608_v2_identify block="identify finger once"
    //% weight=85 group="Recognition"
    export function identifyOnce(): number {
        if (autoEnabled || busy) { lastStatus = BUSY; return BUSY }
        lastId = -1
        // Diagnostic-only: permit GetImage (0x01) even if initial 0x0F probe failed.
        // If image capture succeeds, subsequent conversion/search use normal readiness checks.
        return identifyCore(true)
    }

    /** Begin continuous recognition. Only one event is sent per finger placement. */
    //% blockId=as608_v2_start block="start automatic fingerprint scanning"
    //% weight=100 group="Recognition"
    export function startAutomatic(): void {
        if (!ready || autoEnabled) return
        autoEnabled = true
        autoGeneration++
        const generation = autoGeneration
        control.inBackground(function () {
            let consecutiveErrors = 0
            while (autoEnabled && generation === autoGeneration) {
                if (busy) { basic.pause(100); continue }
                const result = identifyCore()
                if (result === NO_FINGER) {
                    fingerPresent = false
                    consecutiveErrors = 0
                    basic.pause(130)
                    continue
                }
                if (result === BUSY) { basic.pause(100); continue }
                if (result === IO_ERROR) {
                    consecutiveErrors++
                    if (consecutiveErrors === 1 && errorHandler) control.runInParallel(function () { errorHandler() })
                    basic.pause(400)
                    continue
                }
                consecutiveErrors = 0
                if (!fingerPresent) {
                    fingerPresent = true
                    if (result >= 0) {
                        successCount++
                        if (recognizedHandler) control.runInParallel(function () { recognizedHandler() })
                    } else if (result === REJECTED) {
                        rejectionCount++
                        if (rejectedHandler) control.runInParallel(function () { rejectedHandler() })
                    } else {
                        if (errorHandler) control.runInParallel(function () { errorHandler() })
                    }
                }
                // Do not scan same held finger again. Poll for removal only.
                while (autoEnabled && generation === autoGeneration && fingerPresent) {
                    if (!busy) {
                        const state = captured()
                        if (state === 2) fingerPresent = false
                    }
                    basic.pause(160)
                }
                basic.pause(120)
            }
        })
    }

    /** Stop scanning; current UART command finishes within its timeout. */
    //% blockId=as608_v2_stop block="stop automatic fingerprint scanning"
    //% weight=95 group="Recognition"
    export function stopAutomatic(): void {
        autoEnabled = false
        autoGeneration++
    }

    //% blockId=as608_v2_recognized block="on fingerprint recognized"
    //% weight=90 group="Events" draggableParameters=false
    export function onRecognized(handler: () => void): void { recognizedHandler = handler }

    //% blockId=as608_v2_rejected block="on fingerprint rejected"
    //% weight=85 group="Events"
    export function onRejected(handler: () => void): void { rejectedHandler = handler }

    //% blockId=as608_v2_error block="on fingerprint communication error"
    //% weight=80 group="Events"
    export function onError(handler: () => void): void { errorHandler = handler }

    /** Finger ID from most recent successful recognition. */
    //% blockId=as608_v2_lastid block="last fingerprint ID"
    //% weight=80 group="Recognition"
    export function lastFingerprintId(): number { return lastId }

    //% blockId=as608_v2_score block="last match confidence"
    //% weight=65 group="Recognition" advanced=true
    export function lastConfidence(): number { return lastScore }

    /** Enrollment stages: 1 first placement, 2 remove, 3 second placement, 4 saved. */
    //% blockId=as608_v2_enrollstep block="enrollment step"
    //% weight=80 group="Fingerprints"
    export function enrollmentStep(): number { return enrollStep }

    //% blockId=as608_v2_enroll_event block="on enrollment step changed"
    //% weight=75 group="Events"
    export function onEnrollmentStep(handler: () => void): void { enrollStepHandler = handler }

    function updateStep(step: number): void {
        enrollStep = step
        if (enrollStepHandler) control.runInParallel(function () { enrollStepHandler() })
    }

    /** Two placements with a removal in between; blocks until done (up to ~35 s). Stop automatic scanning first. */
    //% blockId=as608_v2_enroll block="enroll fingerprint with ID $id"
    //% id.min=0 id.max=255 id.defl=1
    //% weight=100 group="Fingerprints"
    export function enrollFingerprint(id: number): boolean {
        if (autoEnabled || busy || !ready || id < 0 || id > 255) { lastStatus = BUSY; return false }
        updateStep(1)
        if (!waitFingerState(true, 12000)) { updateStep(-1); return false }
        if (convert(1) !== 0) { updateStep(-1); return false }
        updateStep(2)
        if (!waitFingerState(false, 8000)) { updateStep(-1); return false }
        updateStep(3)
        if (!waitFingerState(true, 12000)) { updateStep(-1); return false }
        if (convert(2) !== 0) { updateStep(-1); return false }
        const combined = command([0x05], 2000)
        if (!combined || combined[0] !== 0) { updateStep(-1); return false }
        const stored = command([0x06, 1, (id >> 8) & 255, id & 255], 2000)
        if (!stored || stored[0] !== 0) { updateStep(-1); return false }
        updateStep(4)
        return true
    }

    /** Delete one fingerprint. Stop automatic scanning first. */
    //% blockId=as608_v2_delete block="delete fingerprint ID $id"
    //% id.min=0 id.max=255 id.defl=1
    //% weight=90 group="Fingerprints"
    export function deleteFingerprint(id: number): boolean {
        if (autoEnabled || busy || id < 0 || id > 255) { lastStatus = BUSY; return false }
        const r = command([0x0C, (id >> 8) & 255, id & 255, 0, 1], 2000)
        return !!r && r[0] === 0
    }

    /** WARNING: permanently delete all stored fingerprints. */
    //% blockId=as608_v2_clear block="DELETE ALL fingerprints"
    //% weight=60 group="Fingerprints" advanced=true
    export function deleteAllFingerprints(): boolean {
        if (autoEnabled || busy) { lastStatus = BUSY; return false }
        const r = command([0x0D], 2000)
        return !!r && r[0] === 0
    }

    //% blockId=as608_v2_status block="last sensor status"
    //% weight=75 group="Diagnostics" advanced=true
    export function lastSensorStatus(): number { return lastStatus }

    /** Number of bytes actually read from UART during the last sensor command. */
    //% blockId=as608_v2_diagbytes block="UART received bytes"
    //% weight=74 group="Diagnostics" advanced=true
    export function uartReceivedBytes(): number { return diagnosticBytes }

    /** First byte seen on UART during the last sensor command (-1 = none). */
    //% blockId=as608_v2_diagfirst block="UART first byte"
    //% weight=73 group="Diagnostics" advanced=true
    export function uartFirstByte(): number { return diagnosticFirstByte }

    /** Parser progress: 0 none, 1 EF, 2 EF01, 3 header, 4 complete. */
    //% blockId=as608_v2_diagstage block="UART packet stage"
    //% weight=72 group="Diagnostics" advanced=true
    export function uartPacketStage(): number { return diagnosticPacketStage }

    /** Expected complete packet size in bytes (0 if no valid header). */
    //% blockId=as608_v2_diagexpected block="UART expected bytes"
    //% weight=71 group="Diagnostics" advanced=true
    export function uartExpectedBytes(): number { return diagnosticExpectedBytes }

    /** Bytes in the most recent outgoing UART packet. */
    //% blockId=as608_v2_diagtx block="UART transmitted bytes"
    //% weight=70 group="Diagnostics" advanced=true
    export function uartTransmittedBytes(): number { return diagnosticTxBytes }

    //% blockId=as608_v2_success block="successful recognitions"
    //% weight=70 group="Diagnostics" advanced=true
    export function successfulRecognitions(): number { return successCount }

    //% blockId=as608_v2_failed block="rejected recognitions"
    //% weight=65 group="Diagnostics" advanced=true
    export function rejectedRecognitions(): number { return rejectionCount }

    //% blockId=as608_v2_reset block="reset recognition counters"
    //% weight=60 group="Diagnostics" advanced=true
    export function resetCounters(): void { successCount = 0; rejectionCount = 0 }
}