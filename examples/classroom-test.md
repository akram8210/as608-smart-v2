# Classroom block tests

## 1. Connection
on start: connect RX P13 TX P14; pause 2000; if fingerprint sensor connected? show tick else cross; show number stored fingerprints.

## 2. Recognition
on start: connect; pause 2000; start automatic fingerprint scanning.
on fingerprint recognized: show tick.
on fingerprint rejected: show cross.
on fingerprint communication error: show sad icon.

## 3. Enrollment
Stop automatic scanning; pause 1500; enroll fingerprint with ID 2. Observe enrollment step 1,2,3,4. Start scanning again after the operation returns.

## 4. Servo
After recognizing: show tick, play acceptance sound, write servo P15 to 90, pause 2000, write P15 to 0. Use an appropriately rated power source and shared ground.
