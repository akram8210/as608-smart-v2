//% color=#25858C icon="\uf2c2" weight=90 block="AS608 Smart"
//% subcategories='["1. Setup", "2. Recognition", "3. Enrollment", "4. Management", "5. Developer"]'
namespace AS608SmartV2 {
    let lastResponse: number[] = []
    let lastRxBytes = 0
    let lastRxExpected = 0
    let lastRxError = 0
    let autoRunning = false
    let autoGeneration = 0
    let fingerPresent = false
    let noFingerCount = 0
    let lastFingerID = -1
    let lastEnrolledID = -1
    let scannerBusy = false
    let lastEnrollmentResult = -10
    let recognizedHandler: () => void = null
    let rejectedHandler: () => void = null
    let errorHandler: () => void = null
    let firstScanHandler: () => void = null
    let removeFingerHandler: () => void = null
    let secondScanHandler: () => void = null
    let enrollmentSuccessHandler: () => void = null
    let enrollmentFailedHandler: () => void = null





    // Returns the sensor's confirmation byte, or -2 (timeout),
    // -3 (malformed packet). Validates full ACK and checksum.
    function sendCommand(data: number[], timeout: number = 3000): number {
        serial.readBuffer(0)
        lastResponse = []
        lastRxBytes = 0
        lastRxExpected = 0
        lastRxError = 0
        let packet = pins.createBuffer(11 + data.length)
        packet.setNumber(NumberFormat.UInt16BE, 0, 0xEF01)
        packet.setNumber(NumberFormat.UInt32BE, 2, 0xFFFFFFFF)
        packet[6] = 0x01
        packet.setNumber(NumberFormat.UInt16BE, 7, data.length + 2)
        let checksum = 0x01 + data.length + 2
        for (let i = 0; i < data.length; i++) {
            packet[9 + i] = data[i]
            checksum += data[i]
        }
        packet.setNumber(NumberFormat.UInt16BE, 9 + data.length, checksum & 0xFFFF)
        serial.writeBuffer(packet)
        let received: number[] = []
        let expected = 0
        let deadline = input.runningTime() + timeout
        while (input.runningTime() < deadline) {
            let chunk = serial.readBuffer(0)
            for (let i = 0; i < chunk.length; i++) {
                let b = chunk[i]
                if (received.length == 0 && b != 0xEF) continue
                if (received.length == 1 && b != 0x01) {
                    received = []
                    if (b == 0xEF) received.push(b)
                    continue
                }
                received.push(b)
                lastRxBytes = received.length
                if (received.length == 9) {
                    let payloadLength = received[7] * 256 + received[8]
                    if (payloadLength < 3 || payloadLength > 256) {
                        lastRxError = -3
                        return -3
                    }
                    expected = 9 + payloadLength
                    lastRxExpected = expected
                }
                if (expected > 0 && received.length == expected) {
                    if (received[2] != 0xFF || received[3] != 0xFF ||
                        received[4] != 0xFF || received[5] != 0xFF || received[6] != 0x07) {
                        lastRxError = -3
                        return -3
                    }
                    let sum = 0
                    for (let j = 6; j < expected - 2; j++) sum += received[j]
                    let actual = received[expected - 2] * 256 + received[expected - 1]
                    if ((sum & 0xFFFF) != actual) {
                        lastRxError = -3
                        return -3
                    }
                    lastResponse = received
                    return received[9]
                }
            }
            basic.pause(2)
        }
        lastRxError = -2
        return -2
    }

    // Pause auto scan and wait for any in-flight UART command.
    // Returns 1 if scanning was on, 0 otherwise, or -10 if busy.
    function beginExclusive(): number {
        let resume = autoRunning ? 1 : 0
        stopAutomatic()
        let deadline = input.runningTime() + 4500
        while (scannerBusy && input.runningTime() < deadline) basic.pause(20)
        if (scannerBusy) {
            if (resume == 1) startAutomatic()
            return -10
        }
        scannerBusy = true
        return resume
    }

    function endExclusive(resume: number): void {
        scannerBusy = false
        if (resume == 1) startAutomatic()
    }





    function identifyInternal(): number {
        let r = sendCommand([0x01])
        if (r == 0x02) return -3
        if (r != 0) return r < 0 ? r : -5
        basic.pause(100)
        r = sendCommand([0x02, 0x01])
        if (r != 0) return r < 0 ? r : -5
        basic.pause(100)
        r = sendCommand([0x04, 0x01, 0x00, 0x00, 0x01, 0x00])
        if (r == 0x09) return -9
        if (r != 0) return r < 0 ? r : -5
        if (lastResponse.length < 14) return -5
        return lastResponse[10] * 256 + lastResponse[11]
    }













    function countInternal(): number {
        let r = sendCommand([0x1D])
        if (r != 0) return r < 0 ? r : -5
        if (lastResponse.length < 14) return -5
        return lastResponse[10] * 256 + lastResponse[11]
    }



    // Index table ACK: header 9, confirmation 1, bitmap 32, checksum 2.
    function readIndexInternal(): number[] {
        let r = sendCommand([0x1F, 0x00], 5000)
        if (r != 0 || lastResponse.length < 44) return []
        let bitmap: number[] = []
        for (let i = 0; i < 32; i++) bitmap.push(lastResponse[10 + i])
        return bitmap
    }

    function firstFreeInternal(): number {
        let bitmap = readIndexInternal()
        if (bitmap.length != 32) return lastRxError < 0 ? lastRxError : -5
        for (let id = 0; id < 256; id++) {
            if ((bitmap[Math.idiv(id, 8)] & (1 << (id % 8))) == 0) return id
        }
        return -1
    }





    function waitForFinger(timeout: number): number {
        let deadline = input.runningTime() + timeout
        while (input.runningTime() < deadline) {
            let r = sendCommand([0x01])
            if (r == 0) return 1
            if (r < 0) return r
            if (r != 0x02) return -5
            basic.pause(200)
        }
        return -4
    }

    function waitForRemoval(timeout: number): number {
        let deadline = input.runningTime() + timeout
        let absent = 0
        while (input.runningTime() < deadline) {
            let r = sendCommand([0x01])
            if (r == 0x02) {
                absent++
                if (absent >= 2) return 1
            } else if (r == 0) {
                absent = 0
            } else {
                return r < 0 ? r : -5
            }
            basic.pause(200)
        }
        return -4
    }

    // Returns ID >= 0 on success; negative error on failure.
    // -1 full, -2 timeout UART, -3 invalid ACK, -4 finger timeout,
    // -5 sensor/image error, -6 mismatch, -7 storage, -9 duplicate,
    // -10 busy.




    function enrollCore(showUI: boolean): number {
        let mode = beginExclusive()
        if (mode < 0) {
            lastEnrollmentResult = mode
            if (showUI) { basic.showIcon(IconNames.No); basic.showString("ERR") }
            return mode
        }
        let result = firstFreeInternal()
        if (result >= 0) {
            let id = result
            if (showUI) basic.showString("F1")
            if (firstScanHandler) control.runInParallel(function () { firstScanHandler() })
            result = waitForFinger(15000)
            if (result == 1) {
                result = sendCommand([0x02, 0x01])
                if (result == 0) {
                    // Prevent enrolling a finger that is already registered.
                    let search = sendCommand([0x04, 0x01, 0x00, 0x00, 0x01, 0x00])
                    if (search == 0) result = -9
                    else if (search != 0x09) result = search < 0 ? search : -5
                    else {
                        if (showUI) basic.showString("OFF")
                        if (removeFingerHandler) control.runInParallel(function () { removeFingerHandler() })
                        result = waitForRemoval(15000)
                        if (result == 1) {
                            if (showUI) basic.showString("F2")
                            if (secondScanHandler) control.runInParallel(function () { secondScanHandler() })
                            result = waitForFinger(15000)
                            if (result == 1) {
                                result = sendCommand([0x02, 0x02])
                                if (result == 0) {
                                    result = sendCommand([0x05])
                                    if (result == 0) {
                                        result = sendCommand([0x06, 0x01, (id >> 8) & 0xFF, id & 0xFF])
                                        if (result == 0) {
                                            lastEnrolledID = id
                                            result = id
                                        } else if (result > 0) result = -7
                                    } else if (result > 0) result = -6
                                } else if (result > 0) result = -5
                            }
                        }
                    }
                } else if (result > 0) result = -5
            }
        }
        endExclusive(mode)
        lastEnrollmentResult = result
        if (showUI) {
            if (result >= 0) {
                basic.showIcon(IconNames.Yes)
                basic.showString("ID")
                basic.showNumber(result)
            } else {
                basic.showIcon(IconNames.No)
                basic.showString("ERR")
                basic.showNumber(result)
            }
        }
        if (result >= 0) {
            if (enrollmentSuccessHandler) control.runInParallel(function () { enrollmentSuccessHandler() })
        } else {
            if (enrollmentFailedHandler) control.runInParallel(function () { enrollmentFailedHandler() })
        }
        return result
    }





























    // Student-facing blocks first; developer diagnostics last.

    //% block="connect AS608 RX $rx TX $tx"
    //% rx.defl=SerialPin.P14 tx.defl=SerialPin.P13
    //% subcategory="1. Setup" weight=100
    export function connect(rx: SerialPin, tx: SerialPin): void {
        stopAutomatic()
        // The 0x1F template-index ACK is 44 bytes: the default UART
        // receive buffer can be too small and silently drop bytes.
        serial.setRxBufferSize(128)
        serial.redirect(tx, rx, BaudRate.BaudRate57600)
        basic.pause(500)
    }

    //% block="connect scanner and start recognition RX $rx TX $tx"
    //% rx.defl=SerialPin.P14 tx.defl=SerialPin.P13
    //% subcategory="1. Setup" weight=99
    //% tooltip="Connects AS608 and starts automatic recognition. Use only once in on start."
    export function connectAndStart(rx: SerialPin, tx: SerialPin): void {
        connect(rx, tx)
        let ok = testConnection()
        if (ok == 1) {
            basic.showIcon(IconNames.Yes)
            startAutomatic()
        } else {
            basic.showIcon(IconNames.No)
            basic.showString("ERR")
        }
    }

    //% block="start automatic fingerprint scanning"
    //% subcategory="2. Recognition" weight=90
    export function startAutomatic(): void {
        if (autoRunning) return
        autoRunning = true
        let generation = ++autoGeneration
        fingerPresent = false
        noFingerCount = 0
        control.inBackground(function () {
            while (autoRunning && generation == autoGeneration) {
                if (scannerBusy) {
                    basic.pause(100)
                    continue
                }
                scannerBusy = true
                let r = identifyInternal()
                scannerBusy = false
                if (!autoRunning || generation != autoGeneration) break
                if (r >= 0) {
                    noFingerCount = 0
                    if (!fingerPresent) {
                        fingerPresent = true
                        lastFingerID = r
                        if (recognizedHandler) control.runInParallel(function () { recognizedHandler() })
                    }
                } else if (r == -3) {
                    noFingerCount++
                    if (noFingerCount >= 2) fingerPresent = false
                } else if (r == -9) {
                    noFingerCount = 0
                    if (!fingerPresent) {
                        fingerPresent = true
                        if (rejectedHandler) control.runInParallel(function () { rejectedHandler() })
                    }
                } else if (r == -2) {
                    if (errorHandler) control.runInParallel(function () { errorHandler() })
                } else {
                    noFingerCount = 0
                }
                basic.pause(150)
            }
        })
    }

    //% block="stop automatic fingerprint scanning"
    //% subcategory="2. Recognition" weight=89
    export function stopAutomatic(): void {
        autoRunning = false
        autoGeneration++
    }

    //% block="on fingerprint recognized"
    //% subcategory="2. Recognition" weight=88
    export function onRecognized(handler: () => void): void { recognizedHandler = handler }

    //% block="on fingerprint rejected"
    //% subcategory="2. Recognition" weight=87
    export function onRejected(handler: () => void): void { rejectedHandler = handler }

    //% block="last recognized fingerprint ID"
    //% subcategory="2. Recognition" weight=86
    export function lastID(): number { return lastFingerID }

    //% block="enroll new fingerprint automatically"
    //% subcategory="3. Enrollment" weight=80
    export function enrollNewFinger(): number {
        return enrollCore(true)
    }

    // Student-friendly statement block: can be placed directly inside button events.
    //% block="enroll new fingerprint"
    //% subcategory="3. Enrollment" weight=81
    //% tooltip="Enrolls a new finger with F1, OFF and F2 instructions on the micro:bit display."
    export function enrollNewFingerEasy(): void {
        enrollCore(true)
    }

    //% block="on enrollment success"
    //% subcategory="3. Enrollment" weight=79
    export function onEnrollmentSuccess(handler: () => void): void { enrollmentSuccessHandler = handler }

    //% block="on enrollment failed"
    //% subcategory="3. Enrollment" weight=78
    export function onEnrollmentFailed(handler: () => void): void { enrollmentFailedHandler = handler }

    //% block="last enrolled fingerprint ID"
    //% subcategory="3. Enrollment" weight=77
    export function lastEnrolledFingerID(): number { return lastEnrolledID }

    //% block="fingerprint count"
    //% subcategory="4. Management" weight=70
    export function fingerprintCount(): number {
        let mode = beginExclusive()
        if (mode < 0) return mode
        let r = countInternal()
        endExclusive(mode)
        return r
    }

    //% block="fingerprint ID $id exists"
    //% id.min=0 id.max=255
    //% subcategory="4. Management" weight=69
    export function fingerprintExists(id: number): number {
        if (id < 0 || id > 255 || id != Math.floor(id)) return -8
        let mode = beginExclusive()
        if (mode < 0) return mode
        let bitmap = readIndexInternal()
        let r = bitmap.length == 32
            ? ((bitmap[Math.idiv(id, 8)] & (1 << (id % 8))) != 0 ? 1 : 0)
            : (lastRxError < 0 ? lastRxError : -5)
        endExclusive(mode)
        return r
    }

    //% block="delete fingerprint $id and show result"
    //% id.min=0 id.max=255 id.defl=0
    //% subcategory="4. Management" weight=68
    //% tooltip="Deletes one stored ID. Displays success or error on micro:bit. This cannot be undone."
    export function deleteFingerEasy(id: number): void {
        let result = deleteFinger(id)
        if (result == 1) {
            basic.showIcon(IconNames.Yes)
        } else {
            basic.showIcon(IconNames.No)
            basic.showString("ERR")
            basic.showNumber(result)
        }
    }

    // Student-friendly deletion by scanning a registered finger.
    // The recognized ID is deleted only after a successful match.
    //% block="delete fingerprint automatically"
    //% subcategory="4. Management" weight=71
    //% tooltip="Place a registered finger on AS608 to delete its stored fingerprint. This cannot be undone."
    export function deleteFingerAutomatically(): void {
        let mode = beginExclusive()
        if (mode < 0) {
            basic.showIcon(IconNames.No)
            basic.showString("ERR")
            basic.showNumber(mode)
            return
        }
        basic.showString("FINGER")
        let id = -4
        let deadline = input.runningTime() + 15000
        while (input.runningTime() < deadline) {
            id = identifyInternal()
            if (id >= 0 || id != -3) break
            basic.pause(200)
        }
        let result = id
        if (id >= 0) {
            // Keep the UART exclusive throughout recognition and deletion.
            let r = sendCommand([0x0C, (id >> 8) & 0xFF, id & 0xFF, 0x00, 0x01])
            result = r == 0 ? 1 : (r < 0 ? r : -5)
        }
        endExclusive(mode)
        if (result == 1) {
            basic.showIcon(IconNames.Yes)
            basic.showString("ID")
            basic.showNumber(id)
        } else {
            basic.showIcon(IconNames.No)
            basic.showString("ERR")
            basic.showNumber(result)
        }
    }

    // Teacher maintenance: erase the complete AS608 template database.
    // AS608 Empty command (0x0D); success is confirmed by a subsequent count of zero.
    //% block="delete all fingerprints"
    //% subcategory="4. Management" weight=66
    //% tooltip="Permanently erase every stored fingerprint. Verify that the sensor reports zero remaining fingerprints."
    export function deleteAllFingerprints(): void {
        let mode = beginExclusive()
        if (mode < 0) {
            basic.showIcon(IconNames.No)
            basic.showString("ERR")
            basic.showNumber(mode)
            return
        }
        let result = sendCommand([0x0D], 5000)
        if (result == 0) {
            let remaining = countInternal()
            result = remaining == 0 ? 1 : (remaining < 0 ? remaining : -5)
        } else {
            result = result < 0 ? result : -5
        }
        endExclusive(mode)
        if (result == 1) {
            basic.showIcon(IconNames.Yes)
            basic.showNumber(0)
        } else {
            basic.showIcon(IconNames.No)
            basic.showString("ERR")
            basic.showNumber(result)
        }
    }

    //% block="fingerprint memory full"
    //% subcategory="4. Management" weight=67
    export function memoryFull(): boolean {
        return nextFreeID() == -1
    }

    //% block="test AS608 connection"
    //% subcategory="5. Developer" weight=50
    export function testConnection(): number {
        let mode = beginExclusive()
        if (mode < 0) return mode
        let r = sendCommand([0x0F])
        endExclusive(mode)
        return r == 0 ? 1 : (r < 0 ? r : -5)
    }

    //% block="capture finger"
    //% subcategory="5. Developer" weight=49
    export function captureFinger(): number {
        let mode = beginExclusive()
        if (mode < 0) return mode
        let r = sendCommand([0x01])
        endExclusive(mode)
        if (r == 0) return 1
        if (r == 0x02) return 0
        return r < 0 ? r : -5
    }

    //% block="identify finger"
    //% subcategory="5. Developer" weight=48
    export function identifyFinger(): number {
        let mode = beginExclusive()
        if (mode < 0) return mode
        let r = identifyInternal()
        endExclusive(mode)
        return r
    }

    //% block="next free fingerprint ID"
    //% subcategory="5. Developer" weight=47
    export function nextFreeID(): number {
        let mode = beginExclusive()
        if (mode < 0) return mode
        let r = firstFreeInternal()
        endExclusive(mode)
        return r
    }

    //% block="enroll fingerprint without screen instructions"
    //% subcategory="5. Developer" weight=46
    //% tooltip="Advanced: enroll silently and handle steps with enrollment events."
    export function enrollFingerSilent(): number {
        return enrollCore(false)
    }

    //% blockHidden=true
    //% block="on enrollment first scan"
    //% subcategory="5. Developer" weight=45
    export function onFirstScan(handler: () => void): void { firstScanHandler = handler }

    //% blockHidden=true
    //% block="on enrollment remove finger"
    //% subcategory="5. Developer" weight=44
    export function onRemoveFinger(handler: () => void): void { removeFingerHandler = handler }

    //% blockHidden=true
    //% block="on enrollment second scan"
    //% subcategory="5. Developer" weight=43
    export function onSecondScan(handler: () => void): void { secondScanHandler = handler }

    //% block="delete fingerprint ID $id"
    //% id.min=0 id.max=255
    //% subcategory="5. Developer" weight=42
    export function deleteFinger(id: number): number {
        if (id < 0 || id > 255 || id != Math.floor(id)) return -8
        let mode = beginExclusive()
        if (mode < 0) return mode
        let r = sendCommand([0x0C, (id >> 8) & 0xFF, id & 0xFF, 0x00, 0x01])
        endExclusive(mode)
        return r == 0 ? 1 : (r < 0 ? r : -5)
    }

    //% block="last enrollment result"
    //% subcategory="5. Developer" weight=41
    export function enrollmentResult(): number { return lastEnrollmentResult }

    //% block="on scanner communication error"
    //% subcategory="5. Developer" weight=40
    export function onCommunicationError(handler: () => void): void { errorHandler = handler }

    //% block="diagnose fingerprint memory"
    //% subcategory="5. Developer" weight=39
    export function diagnoseMemory(): number {
        // 1 = index received, -2 = timeout, -3 = invalid packet,
        // -5 = scanner error / unexpected payload, -10 = busy.
        let mode = beginExclusive()
        if (mode < 0) return mode
        let bitmap = readIndexInternal()
        let r = bitmap.length == 32 ? 1 : (lastRxError < 0 ? lastRxError : -5)
        endExclusive(mode)
        return r
    }

    //% block="last response bytes received"
    //% subcategory="5. Developer" weight=38
    export function diagnosticReceivedBytes(): number { return lastRxBytes }

    //% block="last response expected bytes"
    //% subcategory="5. Developer" weight=37
    export function diagnosticExpectedBytes(): number { return lastRxExpected }

}
