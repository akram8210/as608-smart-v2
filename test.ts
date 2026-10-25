/**
 * AS608 Smart compilation smoke test.
 * This function is intentionally NOT called: fingerprint operations
 * require a connected sensor and may change its stored templates.
 */
function as608SmartCompileTest(): void {
    AS608SmartV2.connect(SerialPin.P14, SerialPin.P13)
    AS608SmartV2.connectAndStart(SerialPin.P14, SerialPin.P13)
    AS608SmartV2.onRecognized(function () { basic.showIcon(IconNames.Yes) })
    AS608SmartV2.onRejected(function () { basic.showIcon(IconNames.No) })
    AS608SmartV2.enrollNewFingerEasy()
    let count = AS608SmartV2.fingerprintCount()
    let exists = AS608SmartV2.fingerprintExists(0)
    AS608SmartV2.deleteAllFingerprints()
    // Keep the values referenced for type checking.
    if (count > 0 && exists == 1) basic.showNumber(count)
}
