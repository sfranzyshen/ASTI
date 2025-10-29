const examplesFiles = [
  {
    name: "blink.ino",
    content: "void setup() {\n  pinMode(LED_BUILTIN, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(LED_BUILTIN, HIGH);\n  delay(1000);\n  digitalWrite(LED_BUILTIN, LOW);\n  delay(1000);\n}"
  },
  {
    name: "fade.ino",
    content: "int led = LED_BUILTIN;\nint brightness = 0;\nint fadeAmount = 5;\n\nvoid setup() {\n  pinMode(led, OUTPUT);\n}\n\nvoid loop() {\n  analogWrite(led, brightness);\n  brightness = brightness + fadeAmount;\n\n  if (brightness <= 0 || brightness >= 255) {\n    fadeAmount = -fadeAmount;\n  }\n  delay(30);\n}"
  },
  {
    name: "rainbow.ino",
    content: "const int redPin = 14;\nconst int greenPin = 16;\nconst int bluePin = 15;\nint speed = 1;\nint steps = 2;\n\nvoid setup() {\n  pinMode(redPin, OUTPUT);\n  pinMode(greenPin, OUTPUT);\n  pinMode(bluePin, OUTPUT);\n}\n\nvoid loop() {\n  fade(255, 0, 0, 255, 255, 0);\n  fade(255, 255, 0, 0, 255, 0);\n  fade(0, 255, 0, 0, 255, 255);\n  fade(0, 255, 255, 0, 0, 255);\n  fade(0, 0, 255, 255, 0, 255);\n  fade(255, 0, 255, 255, 0, 0);\n}\n\nvoid fade(int r1, int g1, int b1, int r2, int g2, int b2) {\n  for (int i = 0; i <= 255; i += steps) {\n    int r = map(i, 0, 255, r1, r2);\n    int g = map(i, 0, 255, g1, g2);\n    int b = map(i, 0, 255, b1, b2);\n    \n    analogWrite(redPin, r);\n    analogWrite(greenPin, g);\n    analogWrite(bluePin, b);\n    \n    delay(speed);\n  }\n}"
  },
  {
    name: "rgb.ino",
    content: "void setup() {\n  pinMode(14, OUTPUT);\n  pinMode(15, OUTPUT);\n  pinMode(16, OUTPUT);\n  pinMode(13, OUTPUT);\n}\n\nvoid loop() {\n  digitalWrite(14, LOW);\n  digitalWrite(15, HIGH);\n  digitalWrite(16, HIGH);\n  digitalWrite(13, HIGH);\n  delay(500);\n\n  digitalWrite(14, HIGH);\n  digitalWrite(15, LOW);\n  digitalWrite(16, HIGH);\n  delay(500);\n\n  digitalWrite(14,HIGH );\n  digitalWrite(15, HIGH);\n  digitalWrite(16, LOW);\n  digitalWrite(13, LOW);\n  delay(500);\n}"
  }
];