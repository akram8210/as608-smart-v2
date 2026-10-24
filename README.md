# AS608 Smart v2.0.0-beta.6 — Diagnostic GetImage bypass

**Diagnostic pre-release; not hardware verified.** No changes to UART packet construction, wiring, baud rate, or v1.1.

This release permits `identify finger once` to send **GetImage (0x01)** even if the initial ReadSysPara (0x0F) probe failed and `ready=false`. Only the GetImage command bypasses the ready guard; enrollment, auto-scanning, other commands remain guarded. If GetImage succeeds, subsequent Img2Tz/Search still require `ready=true`, so this is strictly a transport diagnostic, **not a full identification fix**.

Test: `on start` → connect RX P13 TX P14 → pause 1000ms → `identify finger once` → show `UART transmitted bytes` → show `UART received bytes` → show `last sensor status` (with pauses between displays). Place finger on scanner during test.

Expected: GetImage command TX length **12**; RX > 0 indicates some response. If RX=0 and status=-2, GetImage also timed out. If RX>0, report the values, even if identification returns -2.

> **Beta 5 test:** Removes two pre-command `serial.readBuffer(0)` drains to align the UART send sequence with the working v1.1 driver. This is a hypothesis, not a confirmed hardware fix. Keep v1.1 unchanged.

# AS608 Smart Fingerprint v2.0.0-beta.5

Independent MakeCode extension for micro:bit V2 and AS608-compatible UART fingerprint readers.

## Beta 4 changes
- `connect fingerprint scanner` now sends AS608 **Read System Parameters (0x0F)** after UART initialization and waits for a validated acknowledgment, following the successful v1.1 connection sequence conceptually (implementation is independent).
- `fingerprint sensor connected?` reports the outcome of that initialization, without overwriting the UART diagnostic counters.
- If connection fails, the sensor is marked disconnected; `last sensor status` and UART diagnostics retain the failed initial probe.
- On success, the reported sensor library capacity is used for searches.
- All Beta 3 blocks and diagnostics are retained.

## One hardware test (Blocks)
In `on start`:
1. `connect fingerprint scanner RX P13 TX P14`
2. `pause 1000 ms`
3. `show number UART transmitted bytes`
4. `pause 1000 ms`
5. `show number UART received bytes`
6. `pause 1000 ms`
7. `show number last sensor status`

Expected outgoing packet size for the 0x0F command: **12** bytes. Success requires a valid response and `last sensor status = 0`. A result of `12, 0, -2` means the initial probe still timed out without receiving bytes. This build has **not been tested on physical hardware**.

## GitHub release
Create tag `v2.0.0-beta.5` targeting the commit that contains these files. Mark it **pre-release**. Tagging makes versions reproducible but does not guarantee MakeCode cache refresh.

## Notes
- Do not replace the known-working v1.1 project.
- `icon.png` is included but visibility in MakeCode's extension gallery is not guaranteed for unapproved extensions.
- MIT licensed.
