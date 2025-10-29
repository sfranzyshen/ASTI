
void setup() {
  pinMode(14, OUTPUT);
  pinMode(15, OUTPUT);
  pinMode(16, OUTPUT);
  pinMode(13, OUTPUT);
}

void loop() {
  digitalWrite(14, LOW);
  digitalWrite(15, HIGH);
  digitalWrite(16, HIGH);
  digitalWrite(13, HIGH);
  delay(500);

  digitalWrite(14, HIGH);
  digitalWrite(15, LOW);
  digitalWrite(16, HIGH);
  delay(500);

  digitalWrite(14,HIGH );
  digitalWrite(15, HIGH);
  digitalWrite(16, LOW);
  digitalWrite(13, LOW);
  delay(500);
}

