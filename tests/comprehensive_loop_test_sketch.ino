// Comprehensive Loop Test Sketch
// Tests all three loop types with 100 iterations each

int ledPin = 9;
int brightness = 0;

void setup() {
  Serial.begin(9600);
}

void loop() {
  // Test 1: FOR LOOP (100 iterations)
  for (int i = 0; i < 100; i++) {
    brightness = i;
    analogWrite(ledPin, brightness);
  }

  // Test 2: WHILE LOOP (100 iterations)
  int j = 0;
  while (j < 100) {
    brightness = j;
    analogWrite(ledPin, brightness);
    j++;
  }

  // Test 3: DO-WHILE LOOP (100 iterations)
  int k = 0;
  do {
    brightness = k;
    analogWrite(ledPin, brightness);
    k++;
  } while (k < 100);
}
