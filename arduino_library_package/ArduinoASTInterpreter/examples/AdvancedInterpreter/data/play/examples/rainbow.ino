// RGB LED Rainbow with Fading
const int redPin = 14;
const int greenPin = 16;
const int bluePin = 15;
int speed = 1;
int steps = 2;

void setup() {
  pinMode(redPin, OUTPUT);
  pinMode(greenPin, OUTPUT);
  pinMode(bluePin, OUTPUT);
}

void loop() {
  // Red to Yellow (add green)
  fade(255, 0, 0, 255, 255, 0);
  
  // Yellow to Green (remove red)
  fade(255, 255, 0, 0, 255, 0);
  
  // Green to Cyan (add blue)
  fade(0, 255, 0, 0, 255, 255);
  
  // Cyan to Blue (remove green)
  fade(0, 255, 255, 0, 0, 255);
  
  // Blue to Magenta (add red)
  fade(0, 0, 255, 255, 0, 255);
  
  // Magenta to Red (remove blue)
  fade(255, 0, 255, 255, 0, 0);
}

void fade(int r1, int g1, int b1, int r2, int g2, int b2) {
  for (int i = 0; i <= 255; i += steps) {
    int r = map(i, 0, 255, r1, r2);
    int g = map(i, 0, 255, g1, g2);
    int b = map(i, 0, 255, b1, b2);
    
    analogWrite(redPin, r);
    analogWrite(greenPin, g);
    analogWrite(bluePin, b);
    
    delay(speed); // Adjust for fade speed
  }
}