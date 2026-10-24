# AS608 Smart v2.0 Beta 3 — UART diagnostics

**Hardware testing required.** Beta 2 returned `-2` on the user's micro:bit V2; Beta 3 does not claim to fix it. Instead, it measures actual received bytes to determine whether the fault is TX, RX, framing, or a partial response.

## Test (MakeCode Blocks)

Keep the known-good wiring: sensor TX -> P13 (micro:bit RX), sensor RX -> P14 (micro:bit TX). Keep the v1.1 project unchanged.

In `on start` connect P13/P14, pause 2000 ms, call `fingerprint sensor connected?` once, then display the following values **in order** using `show number` with `pause 1000 ms` between values:

1. `last sensor status`
2. `UART received bytes`
3. `UART first byte`
4. `UART packet stage`
5. `UART expected bytes`
6. `UART transmitted bytes`

Do not run other sensor commands between the test and reading the diagnostics: every sensor command resets the diagnostic values.

### Interpretation

- Received bytes = 0: no bytes reached the parser (may be TX/RX, baud, power, or serial driver).
- Received bytes > 0, packet stage 0: received data does not begin with `EF 01`.
- Packet stage 1 or 2: partial header.
- Packet stage 3: packet header received, but full packet did not arrive.
- Packet stage 4: complete valid packet.
- Status -12 invalid length, -13 wrong address/type, -14 checksum mismatch, -2 timeout.

**Important:** `serial.readBuffer(0)` is officially documented as non-blocking and returning buffered data. This release retains it and adds evidence collection instead of guessing at another fix.

## Version display

The MakeCode category title is `AS608 Smart · v2.0.0-beta.3`, which is non-draggable. A genuinely non-draggable *fake block* in the flyout is not guaranteed by standard MakeCode extension APIs. The category title is the reliable supported alternative; check it before testing.

## Icon caveat

The `icon.png` asset is included, but MakeCode's official extension authoring documentation says custom gallery icons appear automatically **only for approved extensions**. Merely adding `icon.png` to `pxt.json` cannot force the image to appear for a user-provided unapproved extension. The repo will need to meet the approval checklist and receive approval for normal gallery icon display.

## Existing features

Recognition, enrollment, deletion, events, and counters remain present. Do not enroll/delete fingerprints until communication is validated. Beta 3 is for diagnostics.
