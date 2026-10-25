# AS608 Smart — micro:bit MakeCode extension

AS608 Smart is a MakeCode extension for the AS608 UART fingerprint sensor and BBC micro:bit. The block category shown to users is **AS608 Smart**.

## Install

1. Create a public GitHub repository (suggested name: `as608-smart-v2`).
2. Upload **the files in this folder to the repository root** (`main.ts`, `pxt.json`, `icon.png`, `LICENSE`, `README.md`). Do not upload the ZIP as a single file.
3. In the Microsoft MakeCode editor for micro:bit, open **Extensions** and paste the GitHub repository URL, e.g. `https://github.com/akram8210/as608-smart-v2` (replace with the actual published URL).
4. Select the extension when MakeCode finds it. Publishing on GitHub does not guarantee inclusion in the extension search catalog.

The repository URL above is an example, **not a claim that the repository is already published**. The micro:bit iPad app may have different extension import capabilities; check the actual app before planning a lesson.

## Wiring — verify your AS608 module pinout

| AS608 lead | micro:bit |
| --- | --- |
| Red (power) | 3V (only if module is rated for this supply) |
| Black (ground) | GND |
| White (sensor TX) | P13 (micro:bit RX) |
| Yellow (sensor RX) | P14 (micro:bit TX) |

Use the actual module datasheet to confirm wire colors, operating voltage and logic levels. Do not power a module that requires more current than the micro:bit can safely provide.

## Main classroom blocks

- **1. Setup**: connect scanner / start automatic recognition.
- **2. Recognition**: recognized and rejected events.
- **3. Enrollment**: register a new fingerprint (for authorized demonstrations only).
- **4. Management**: fingerprint count, deletion by ID, automatic deletion, and **delete all fingerprints**.
- **5. Developer**: diagnostics and low-level operations.

### Clear the sensor after an authorized demonstration

Run **delete all fingerprints** under Management. The extension sends AS608 `Empty (0x0D)`, checks the acknowledgment, reads the remaining template count, and displays a check and `0` only when the reported count is zero. It displays an error otherwise. Keep the sensor powered until the operation finishes. This clears the sensor's template database; it does not constitute a forensic secure-erasure guarantee.

## Privacy and classroom safety

Fingerprint templates used to identify a person are biometric personal data. **Do not enroll pupils' fingerprints without approval from the school's data controller and data protection officer and a lawful basis under GDPR.** Prefer simulation or an approved teacher demonstration. Erasing fingerprints after class is good data minimization but does not by itself make collection lawful. This project is an educational prototype, not a certified security or access-control product.

## Testing and status

The user reported that the **delete-all operation erased the fingerprints on the physical sensor**. Independent build verification of this release against the MakeCode toolchain has **not** been performed here. Before broad release, import the repository into MakeCode, compile and test every essential block and the zero-count/previous-fingerprint rejection checks.

## License

MIT. See `LICENSE`.
