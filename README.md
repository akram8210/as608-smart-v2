# AS608 Smart v2.0 Beta 2 — UART connection fix

**Status: hardware testing required.** The previous Beta 1 returned `-2` when checking the sensor on the user's micro:bit V2. This version improves the UART response parser, adds a 500 ms settling delay after serial redirect, removes custom UART buffer sizing, and preserves specific diagnostic error codes. The source of the failure is **not yet proven**. All existing blocks are retained.

Diagnostic codes: `-2` timeout / incomplete UART response; `-12` invalid packet length; `-13` unexpected address/type; `-14` checksum mismatch; `-4` busy. An AS608 sensor status >=0 is a sensor response.

**Hardware:** AS608 TX to micro:bit P13 (RX), AS608 RX to micro:bit P14 (TX), common GND, suitable power. Preserve the known-working v1.1 extension separately.

**Test:** connect P13/P14, pause 2000 ms, check `fingerprint sensor connected?`; show ✓ on success, else show `last sensor status`. Do not enroll or delete fingerprints until communication passes.

**Gallery:** `icon.png` is included at 300×200 pixels. Gallery image appearance can depend on MakeCode caching and repository metadata.

---

# AS608 Smart Fingerprint v2.0 — Beta 1

**Independent educational MakeCode extension for micro:bit V2.** New UART framing, bounded ACK parser, transaction lock, background recognition and two-placement enrollment. No code was copied from the previous extension. AS608 protocol command constants are hardware interface facts.

## Hardware

AS608 TX → micro:bit RX **P13**; AS608 RX → micro:bit TX **P14**; common GND; regulated compatible power. UART 57600 baud. Do not drive a loaded servo from the micro:bit 3.3 V rail; prefer a separate suitable servo supply with common GND. Servo signal can use P15.

## Block groups

Connection: connect, connection check. Recognition: start/stop, identify once, ID, confidence. Events: recognized, rejected, communication error, enrollment stage. Fingerprints: enroll, delete, count, delete all. Diagnostics: status and counters.

## Typical automatic scanning

- `on start`: connect RX P13 TX P14; pause 2000 ms; start automatic fingerprint scanning.
- `on fingerprint recognized`: show tick; play sound; servo write P15 to 90; pause 2000 ms; servo write P15 to 0.
- `on fingerprint rejected`: show cross; play rejection sound.

## Enrollment (do not run automatic scanning simultaneously)

1. `stop automatic fingerprint scanning` and `pause 1500 ms` to allow any in-flight UART command to finish.
2. `enroll fingerprint with ID 2` (returns true on success; false otherwise).
3. Place finger when step=1, remove when step=2, replace same finger when step=3, complete when step=4. Step=-1 indicates failure.
4. `start automatic fingerprint scanning` again.

**Warning:** `DELETE ALL fingerprints` is irreversible. Do not use without explicit teacher confirmation.

## Return values and status

- `identify finger once`: >=0 is matched ID; -3 no finger; -9 unrecognized; -2 communication / processing failure; -4 busy.
- `last sensor status`: 0 success, 2 no finger, 9 not found, -2 timeout/malformed packet, -4 busy, -5 enrollment wait timeout; other values are AS608 status bytes.
- `stored fingerprints`: -1 means failure.

## Important testing status

**Source implementation complete for the listed block features, but not hardware-validated.** Check compilation in MakeCode and test on AS608 + micro:bit V2 before classroom use. The earlier working v1.1 repository should remain unchanged. `on enrollment step changed` handlers run concurrently: avoid long blocking code inside them. `on fingerprint recognized` handlers can include servo delays because they run in parallel with scanning.

## Licensing

MIT. The source is an independent implementation of the publicly documented AS608/ZFM serial protocol. This does not guarantee compatibility with every similar fingerprint sensor.
