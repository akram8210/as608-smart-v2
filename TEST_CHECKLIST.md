# Release validation checklist

- [ ] Upload all files at repository root and import the GitHub URL in micro:bit MakeCode.
- [ ] Verify that the block category reads `AS608 Smart` (without v2).
- [ ] Connect the scanner and start recognition with RX P14 / TX P13 as displayed in the block, consistent with the tested wiring.
- [ ] Register one approved test fingerprint with button A; check success.
- [ ] Recognize that fingerprint and reject an unregistered fingerprint.
- [ ] Check `fingerprint count` > 0.
- [ ] Run `delete all fingerprints` and confirm check mark and 0.
- [ ] Check `fingerprint count` == 0 and the previously registered finger is rejected.
- [ ] Re-test after power cycling the sensor.
- [ ] Check the intended iPad app can import a custom GitHub extension.
- [ ] Obtain school data protection approval before enrolling any pupils.
