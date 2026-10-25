# AS608 Smart

### Fingerprint Sensor Extension for BBC micro:bit

**AS608 Smart** is a Microsoft MakeCode extension that enables the BBC micro:bit to communicate with an AS608 UART fingerprint sensor.

It provides beginner-friendly blocks for fingerprint recognition, enrollment, deletion, and sensor diagnostics.

The extension is designed primarily for educational demonstrations, technology lessons, and electronics projects.

**Platform:** BBC micro:bit
**Programming environment:** Microsoft MakeCode
**Sensor:** AS608 UART Fingerprint Sensor
**Version:** 2.0.1
**License:** MIT

---

## Features

* Connect an AS608 fingerprint sensor to the BBC micro:bit.
* Automatically recognize registered fingerprints.
* Respond to successful or unsuccessful recognition.
* Register new fingerprints.
* Help prevent duplicate fingerprint enrollment.
* Count stored fingerprints.
* Delete fingerprints by ID.
* Automatically delete a fingerprint.
* Delete all stored fingerprints.
* Check sensor communication.
* Access diagnostic and low-level sensor functions.

## Installation

1. Open the Microsoft MakeCode editor for BBC micro:bit.

2. Create a new project.

3. Select **Extensions**.

4. Paste the following GitHub repository address into the search field:

   `https://github.com/akram8210/as608-smart-v2`

5. Select **AS608 Smart** to install the extension.

The extension can be installed directly from GitHub. Inclusion in the official MakeCode extension gallery requires a separate approval process.

## Hardware Connections

Connect the AS608 fingerprint sensor to the BBC micro:bit using the following wiring configuration.

| AS608 sensor wire | BBC micro:bit pin | Function                 |
| ----------------- | ----------------- | ------------------------ |
| Red               | 3V                | Power                    |
| Black             | GND               | Ground                   |
| White             | P13               | Sensor TX → micro:bit RX |
| Yellow            | P14               | Sensor RX ← micro:bit TX |

**Important:** Wire colors may differ between AS608 modules. Always verify the pinout and electrical specifications of your particular sensor. Use the micro:bit 3V supply only when the module's voltage and current requirements are compatible.

In MakeCode, configure the extension using:

**RX = P14, TX = P13**

The labels above refer to the sensor connection configuration used in the tested project. Follow the block labels and the physical wiring carefully.

## Block Categories

AS608 Smart organizes its blocks into five categories.

### 1. Setup

Configure communication between the BBC micro:bit and the fingerprint sensor.

Available functionality includes connecting the sensor and starting or stopping automatic recognition.

### 2. Recognition

Recognize fingerprints already registered in the sensor.

Recognition events allow a program to respond when a fingerprint is accepted or rejected.

The extension can also report the ID of the most recently recognized fingerprint.

### 3. Enrollment

Register new fingerprints in the AS608 sensor database.

The extension includes simplified enrollment functions and events for reporting enrollment success or failure.

Enrollment should be used only for authorized demonstrations.

### 4. Management

Manage fingerprints stored in the sensor.

Functions include:

* Counting registered fingerprints.
* Checking whether a fingerprint ID exists.
* Deleting a fingerprint by ID.
* Automatically deleting a fingerprint.
* Deleting all registered fingerprints.
* Checking whether the fingerprint memory is full.

### 5. Developer

Access additional functions for testing, diagnostics, and advanced projects.

These functions include communication testing, fingerprint capture, identification, memory diagnostics, and low-level enrollment or deletion operations.

## Classroom Examples

### Example 1 — Automatic Fingerprint Recognition

**Objective:** Recognize a previously registered fingerprint.

1. Connect the AS608 sensor.
2. Start automatic recognition.
3. Add a recognized-fingerprint event.
4. Display a check mark when a registered fingerprint is recognized.
5. Add a rejected-fingerprint event.
6. Display a cross when recognition fails.

**Expected result:** The micro:bit responds to fingerprint recognition events.

### Example 2 — Enroll a New Fingerprint

**Objective:** Register a fingerprint using button A.

1. Connect the fingerprint sensor.
2. Add a **button A pressed** event.
3. Inside the event, use the simplified enrollment block.
4. Follow the enrollment procedure shown by the program and sensor.
5. Use the enrollment success or failure events to display feedback.

**Expected result:** A successfully registered fingerprint is assigned an ID and stored in the sensor.

### Example 3 — Delete Fingerprints

**Objective:** Demonstrate fingerprint management.

1. Connect the sensor.
2. Use **button B** to trigger automatic fingerprint deletion.
3. Use the micro:bit logo touch event to trigger **delete all fingerprints**.
4. Check the remaining fingerprint count.

**Expected result:** The selected deletion operation removes the corresponding fingerprint templates from the sensor database.

The logo touch event requires a compatible micro:bit model, such as micro:bit V2.

## Delete All Fingerprints

The **delete all fingerprints** block clears the sensor's stored fingerprint template database.

The extension:

1. Sends the AS608 `Empty (0x0D)` command.
2. Checks the sensor acknowledgment.
3. Reads the remaining fingerprint count.
4. Displays a check mark and zero only when the reported count is zero.
5. Displays an error if the operation fails or the reported count is not zero.

Keep the sensor powered until the deletion process finishes.

**Note:** Clearing the template database is not equivalent to a verified forensic secure-erasure procedure.

## Privacy and Data Protection

Fingerprint templates used to identify individuals are biometric personal data.

For classroom use:

* Do not register students' fingerprints without appropriate authorization.
* Obtain approval from the school's data controller and data protection officer where required.
* Establish an appropriate lawful basis and satisfy applicable GDPR requirements before collecting biometric data.
* Prefer simulated activities or an authorized teacher demonstration.
* Delete demonstration fingerprints when they are no longer required.

Deleting fingerprints after a lesson does not, by itself, make their original collection lawful.

AS608 Smart is an educational extension and is **not a certified security or access-control system**.

## Testing

The extension has been tested by the project developer using a physical AS608 fingerprint sensor connected to a BBC micro:bit.

The developer reported successful operation of the following functionality:

* Sensor communication.
* Fingerprint enrollment.
* Fingerprint recognition.
* Duplicate enrollment prevention.
* Fingerprint deletion.
* Automatic fingerprint deletion.
* Deletion of all stored fingerprints.

The delete-all function was also checked against the remaining fingerprint count.

These are developer-reported hardware tests. Independent compilation of the complete release and its `test.ts` file against the MakeCode toolchain remains to be verified.

## Repository Structure

```text
as608-smart-v2/
├── main.ts
├── pxt.json
├── test.ts
├── icon.png
├── README.md
├── LICENSE
├── TEST_CHECKLIST.md
├── examples/
└── _locales/
```

## License

This project is distributed under the MIT License.

See the `LICENSE` file for details.

## Project Status

**AS608 Smart v2.0.0** is available as a GitHub-hosted MakeCode extension.

The project is being prepared for submission to the official Microsoft MakeCode extension gallery.

---

for PXT/microbit
