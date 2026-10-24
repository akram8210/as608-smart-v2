# AS608 Smart Fingerprint v2 (alpha 1)

An independently written MakeCode extension for micro:bit V2 and AS608-style UART fingerprint readers.

## Scope of this build

Only four blocks are implemented: connect, check connection, last sensor status, and stored template count. **Enrollment, automatic scanning, recognition events, and deletion are not yet implemented.** This is intentional: the working v1.1 repository remains untouched while the new protocol layer is tested.

## Wiring

- Scanner TX -> micro:bit P13 (RX)
- Scanner RX -> micro:bit P14 (TX)
- Scanner GND -> micro:bit GND
- Scanner power -> suitable regulated supply per its datasheet; common GND required

Default UART: 57600 baud, device address 0xFFFFFFFF. The connection test sends ReadTemplateCount (0x1D) and validates an ACK frame including checksum.

## First MakeCode Blocks test

In `on start`: connect fingerprint scanner RX P13 TX P14; pause 2000 ms; if fingerprint sensor connected? then show icon check, show number stored fingerprints (last check), else show icon cross.

No buttons or forever loop required for this phase.

## Important

- Source code is independently authored; do not copy files from v1.1 into this repository.
- The alpha has been checked for JSON validity and source structure, **not compiled in MakeCode or tested on hardware**.
- The AS608 command protocol is not proprietary source code. Verify protocol compatibility for each new reader model.
- Do not overwrite the stable v1.1 GitHub repository.

## License

MIT (see LICENSE).
