// Examples Test Suite Version: 1

const neopixelFiles = [
	{ "name": "strandtest.ino", "content": "#include <Adafruit_NeoPixel.h>\n#ifdef __AVR__\n #include <avr/power.h> // Required for 16 MHz Adafruit Trinket\n#endif\n\n// Which pin on the Arduino is connected to the NeoPixels?\n// On a Trinket or Gemma we suggest changing this to 1:\n#define LED_PIN    6\n\n// How many NeoPixels are attached to the Arduino?\n#define LED_COUNT 60\n\n// Declare our NeoPixel strip object:\nAdafruit_NeoPixel strip(LED_COUNT, LED_PIN, NEO_GRB + NEO_KHZ800);\n// Argument 1 = Number of pixels in NeoPixel strip\n// Argument 2 = Arduino pin number (most are valid)\n// Argument 3 = Pixel type flags, add together as needed:\n//   NEO_KHZ800  800 KHz bitstream (most NeoPixel products w/WS2812 LEDs)\n//   NEO_KHZ400  400 KHz (classic 'v1' (not v2) FLORA pixels, WS2811 drivers)\n//   NEO_GRB     Pixels are wired for GRB bitstream (most NeoPixel products)\n//   NEO_RGB     Pixels are wired for RGB bitstream (v1 FLORA pixels, not v2)\n//   NEO_RGBW    Pixels are wired for RGBW bitstream (NeoPixel RGBW products)\n\n\n// setup() function -- runs once at startup --------------------------------\n\nvoid setup() {\n  // These lines are specifically to support the Adafruit Trinket 5V 16 MHz.\n  // Any other board, you can remove this part (but no harm leaving it):\n#if defined(__AVR_ATtiny85__) && (F_CPU == 16000000)\n  clock_prescale_set(clock_div_1);\n#endif\n  // END of Trinket-specific code.\n\n  strip.begin();           // INITIALIZE NeoPixel strip object (REQUIRED)\n  strip.show();            // Turn OFF all pixels ASAP\n  strip.setBrightness(50); // Set BRIGHTNESS to about 1/5 (max = 255)\n}\n\n\n// loop() function -- runs repeatedly as long as board is on ---------------\n\nvoid loop() {\n  // Fill along the length of the strip in various colors...\n  colorWipe(strip.Color(255,   0,   0), 50); // Red\n  colorWipe(strip.Color(  0, 255,   0), 50); // Green\n  colorWipe(strip.Color(  0,   0, 255), 50); // Blue\n\n  // Do a theater marquee effect in various colors...\n  theaterChase(strip.Color(127, 127, 127), 50); // White, half brightness\n  theaterChase(strip.Color(127,   0,   0), 50); // Red, half brightness\n  theaterChase(strip.Color(  0,   0, 127), 50); // Blue, half brightness\n\n  rainbow(10);             // Flowing rainbow cycle along the whole strip\n  theaterChaseRainbow(50); // Rainbow-enhanced theaterChase variant\n}\n\n\n// Some functions of our own for creating animated effects -----------------\n\n// Fill strip pixels one after another with a color. Strip is NOT cleared\n// first; anything there will be covered pixel by pixel. Pass in color\n// (as a single 'packed' 32-bit value, which you can get by calling\n// strip.Color(red, green, blue) as shown in the loop() function above),\n// and a delay time (in milliseconds) between pixels.\nvoid colorWipe(uint32_t color, int wait) {\n  for(int i=0; i<strip.numPixels(); i++) { // For each pixel in strip...\n    strip.setPixelColor(i, color);         //  Set pixel's color (in RAM)\n    strip.show();                          //  Update strip to match\n    delay(wait);                           //  Pause for a moment\n  }\n}\n\n// Theater-marquee-style chasing lights. Pass in a color (32-bit value,\n// a la strip.Color(r,g,b) as mentioned above), and a delay time (in ms)\n// between frames.\nvoid theaterChase(uint32_t color, int wait) {\n  for(int a=0; a<10; a++) {  // Repeat 10 times...\n    for(int b=0; b<3; b++) { //  'b' counts from 0 to 2...\n      strip.clear();         //   Set all pixels in RAM to 0 (off)\n      // 'c' counts up from 'b' to end of strip in steps of 3...\n      for(int c=b; c<strip.numPixels(); c += 3) {\n        strip.setPixelColor(c, color); // Set pixel 'c' to value 'color'\n      }\n      strip.show(); // Update strip with new contents\n      delay(wait);  // Pause for a moment\n    }\n  }\n}\n\n// Rainbow cycle along whole strip. Pass delay time (in ms) between frames.\nvoid rainbow(int wait) {\n  // Hue of first pixel runs 5 complete loops through the color wheel.\n  // Color wheel has a range of 65536 but it's OK if we roll over, so\n  // just count from 0 to 5*65536. Adding 256 to firstPixelHue each time\n  // means we'll make 5*65536/256 = 1280 passes through this loop:\n  for(long firstPixelHue = 0; firstPixelHue < 5*65536; firstPixelHue += 256) {\n    // strip.rainbow() can take a single argument (first pixel hue) or\n    // optionally a few extras: number of rainbow repetitions (default 1),\n    // saturation and value (brightness) (both 0-255, similar to the\n    // ColorHSV() function, default 255), and a true/false flag for whether\n    // to apply gamma correction to provide 'truer' colors (default true).\n    strip.rainbow(firstPixelHue);\n    // Above line is equivalent to:\n    // strip.rainbow(firstPixelHue, 1, 255, 255, true);\n    strip.show(); // Update strip with new contents\n    delay(wait);  // Pause for a moment\n  }\n}\n\n// Rainbow-enhanced theater marquee. Pass delay time (in ms) between frames.\nvoid theaterChaseRainbow(int wait) {\n  int firstPixelHue = 0;     // First pixel starts at red (hue 0)\n  for(int a=0; a<30; a++) {  // Repeat 30 times...\n    for(int b=0; b<3; b++) { //  'b' counts from 0 to 2...\n      strip.clear();         //   Set all pixels in RAM to 0 (off)\n      // 'c' counts up from 'b' to end of strip in increments of 3...\n      for(int c=b; c<strip.numPixels(); c += 3) {\n        // hue of pixel 'c' is offset by an amount to make one full\n        // revolution of the color wheel (range 65536) along the length\n        // of the strip (strip.numPixels() steps):\n        int      hue   = firstPixelHue + c * 65536L / strip.numPixels();\n        uint32_t color = strip.gamma32(strip.ColorHSV(hue)); // hue -> RGB\n        strip.setPixelColor(c, color); // Set pixel 'c' to value 'color'\n      }\n      strip.show();                // Update strip with new contents\n      delay(wait);                 // Pause for a moment\n      firstPixelHue += 65536 / 90; // One cycle of color wheel over 90 frames\n    }\n  }\n}\n"},
	{ "name": "strandtest_nodelay.ino", "content": "#include <Adafruit_NeoPixel.h>\n#ifdef __AVR__\n #include <avr/power.h> // Required for 16 MHz Adafruit Trinket\n#endif\n\n// Which pin on the Arduino is connected to the NeoPixels?\n// On a Trinket or Gemma we suggest changing this to 1:\n#ifdef ESP32\n// Cannot use 6 as output for ESP. Pins 6-11 are connected to SPI flash. Use 16 instead.\n#define LED_PIN    16\n#else\n#define LED_PIN    6\n#endif\n\n// How many NeoPixels are attached to the Arduino?\n#define LED_COUNT 60\n\n// Declare our NeoPixel strip object:\nAdafruit_NeoPixel strip(LED_COUNT, LED_PIN, NEO_GRB + NEO_KHZ800);\n// Argument 1 = Number of pixels in NeoPixel strip\n// Argument 2 = Arduino pin number (most are valid)\n// Argument 3 = Pixel type flags, add together as needed:\n//   NEO_KHZ800  800 KHz bitstream (most NeoPixel products w/WS2812 LEDs)\n//   NEO_KHZ400  400 KHz (classic 'v1' (not v2) FLORA pixels, WS2811 drivers)\n//   NEO_GRB     Pixels are wired for GRB bitstream (most NeoPixel products)\n//   NEO_RGB     Pixels are wired for RGB bitstream (v1 FLORA pixels, not v2)\n//   NEO_RGBW    Pixels are wired for RGBW bitstream (NeoPixel RGBW products)\n\nunsigned long pixelPrevious = 0;       // Previous Pixel Millis\nunsigned long patternPrevious = 0;     // Previous Pattern Millis\nint           patternCurrent = 0;      // Current Pattern Number\nint           patternInterval = 5000;  // Pattern Interval (ms)\nbool          patternComplete = false;\n\nint           pixelInterval = 50;      // Pixel Interval (ms)\nint           pixelQueue = 0;          // Pattern Pixel Queue\nint           pixelCycle = 0;          // Pattern Pixel Cycle\nuint16_t      pixelNumber = LED_COUNT; // Total Number of Pixels\n\n// setup() function -- runs once at startup --------------------------------\nvoid setup() {\n  // These lines are specifically to support the Adafruit Trinket 5V 16 MHz.\n  // Any other board, you can remove this part (but no harm leaving it):\n#if defined(__AVR_ATtiny85__) && (F_CPU == 16000000)\n  clock_prescale_set(clock_div_1);\n#endif\n  // END of Trinket-specific code.\n\n  strip.begin();           // INITIALIZE NeoPixel strip object (REQUIRED)\n  strip.show();            // Turn OFF all pixels ASAP\n  strip.setBrightness(50); // Set BRIGHTNESS to about 1/5 (max = 255)\n}\n\n// loop() function -- runs repeatedly as long as board is on ---------------\nvoid loop() {\n  unsigned long currentMillis = millis();                     //  Update current time\n  if( patternComplete || (currentMillis - patternPrevious) >= patternInterval) {  //  Check for expired time\n    patternComplete = false;\n    patternPrevious = currentMillis;\n    patternCurrent++;                                         //  Advance to next pattern\n    if(patternCurrent >= 7)\n      patternCurrent = 0;\n  }\n\n  if(currentMillis - pixelPrevious >= pixelInterval) {      //  Check for expired time\n    pixelPrevious = currentMillis;                            //  Run current frame\n    switch (patternCurrent) {\n      case 7:\n        theaterChaseRainbow(50); // Rainbow-enhanced theaterChase variant\n        break;\n      case 6:\n        rainbow(10); // Flowing rainbow cycle along the whole strip\n        break;      \n      case 5:\n        theaterChase(strip.Color(0, 0, 127), 50); // Blue\n        break;\n      case 4:\n        theaterChase(strip.Color(127, 0, 0), 50); // Red\n        break;\n      case 3:\n        theaterChase(strip.Color(127, 127, 127), 50); // White\n        break;\n      case 2:\n        colorWipe(strip.Color(0, 0, 255), 50); // Blue\n        break;\n      case 1:\n        colorWipe(strip.Color(0, 255, 0), 50); // Green\n        break;        \n      default:\n        colorWipe(strip.Color(255, 0, 0), 50); // Red\n        break;\n    }\n  }\n}\n\n// Some functions of our own for creating animated effects -----------------\n\n// Fill strip pixels one after another with a color. Strip is NOT cleared\n// first; anything there will be covered pixel by pixel. Pass in color\n// (as a single 'packed' 32-bit value, which you can get by calling\n// strip.Color(red, green, blue) as shown in the loop() function above),\n// and a delay time (in milliseconds) between pixels.\nvoid colorWipe(uint32_t color, int wait) {\n  static uint16_t current_pixel = 0;\n  pixelInterval = wait;                      //  Update delay time\n  strip.setPixelColor(current_pixel++, color); //  Set pixel's color (in RAM)\n  strip.show();                              //  Update strip to match\n  if(current_pixel >= pixelNumber) {         //  Loop the pattern from the first LED\n    current_pixel = 0;\n    patternComplete = true;\n  }\n}\n\n// Theater-marquee-style chasing lights. Pass in a color (32-bit value,\n// a la strip.Color(r,g,b) as mentioned above), and a delay time (in ms)\n// between frames.\nvoid theaterChase(uint32_t color, int wait) {\n  static uint32_t loop_count = 0;\n  static uint16_t current_pixel = 0;\n\n  pixelInterval = wait;                      //  Update delay time\n\n  strip.clear();\n\n  for(int c=current_pixel; c < pixelNumber; c += 3) {\n    strip.setPixelColor(c, color);\n  }\n  strip.show();\n\n  current_pixel++;\n  if (current_pixel >= 3) {\n    current_pixel = 0;\n    loop_count++;\n  }\n\n  if (loop_count >= 10) {\n    current_pixel = 0;\n    loop_count = 0;\n    patternComplete = true;\n  }\n}\n\n// Rainbow cycle along whole strip. Pass delay time (in ms) between frames.\nvoid rainbow(uint8_t wait) {\n  if(pixelInterval != wait)\n    pixelInterval = wait;                \n  for(uint16_t i=0; i < pixelNumber; i++) {\n    strip.setPixelColor(i, Wheel((i + pixelCycle) & 255)); //  Update delay time  \n  }\n  strip.show();                              //  Update strip to match\n  pixelCycle++;                              //  Advance current cycle\n  if(pixelCycle >= 256)\n    pixelCycle = 0;                          //  Loop the cycle back to the begining\n}\n\n//Theatre-style crawling lights with rainbow effect\nvoid theaterChaseRainbow(uint8_t wait) {\n  if(pixelInterval != wait)\n    pixelInterval = wait;                      //  Update delay time  \n  for(int i=0; i < pixelNumber; i+=3) {\n    strip.setPixelColor(i + pixelQueue, Wheel((i + pixelCycle) % 255)); //  Update delay time  \n  }\n  strip.show();\n  for(int i=0; i < pixelNumber; i+=3) {\n    strip.setPixelColor(i + pixelQueue, strip.Color(0, 0, 0)); //  Update delay time  \n  }      \n  pixelQueue++;                              //  Advance current queue  \n  pixelCycle++;                              //  Advance current cycle\n  if(pixelQueue >= 3)\n    pixelQueue = 0;                          //  Loop\n  if(pixelCycle >= 256)\n    pixelCycle = 0;                          //  Loop\n}\n\n// Input a value 0 to 255 to get a color value.\n// The colours are a transition r - g - b - back to r.\nuint32_t Wheel(byte WheelPos) {\n  WheelPos = 255 - WheelPos;\n  if(WheelPos < 85) {\n    return strip.Color(255 - WheelPos * 3, 0, WheelPos * 3);\n  }\n  if(WheelPos < 170) {\n    WheelPos -= 85;\n    return strip.Color(0, WheelPos * 3, 255 - WheelPos * 3);\n  }\n  WheelPos -= 170;\n  return strip.Color(WheelPos * 3, 255 - WheelPos * 3, 0);\n}\n"}
];

// --- Examples Harness Runner Logic ---
// This function runs the parser against all 79 examples.

function runExamples() {
    const logElement = document.getElementById('log');
    let fullLog = '';
    let testsPassed = 0;
    
    const timestamp = new Date().toLocaleString();
    fullLog += `Parser Version: ${typeof PARSER_VERSION !== 'undefined' ? PARSER_VERSION : 'Unknown'} | Test run at: ${timestamp}\n\n`;

    neopixelFiles.forEach(testFile => {
        fullLog += `--- Running: ${testFile.name} ---\n`;
        
        try {
            const ast = parse(testFile.content);
            
            // Properly check for ErrorNodes anywhere in the AST tree
            function hasErrors(node) {
                if (!node || typeof node !== 'object') return false;
                if (node.type === 'ErrorNode') return true;
                
                for (const key in node) {
                    if (typeof node[key] === 'object' && node[key] !== null) {
                        if (Array.isArray(node[key])) {
                            for (const item of node[key]) {
                                if (hasErrors(item)) return true;
                            }
                        } else {
                            if (hasErrors(node[key])) return true;
                        }
                    }
                }
                return false;
            }
            
            function collectErrors(node, errors = []) {
                if (!node || typeof node !== 'object') return errors;
                if (node.type === 'ErrorNode') {
                    errors.push(node.value || 'Unknown error');
                    return errors;
                }
                
                for (const key in node) {
                    if (typeof node[key] === 'object' && node[key] !== null) {
                        if (Array.isArray(node[key])) {
                            for (const item of node[key]) {
                                collectErrors(item, errors);
                            }
                        } else {
                            collectErrors(node[key], errors);
                        }
                    }
                }
                return errors;
            }
            
            if (hasErrors(ast)) {
                const errors = collectErrors(ast);
                throw new Error(`ErrorNodes found in AST: ${errors.slice(0, 3).join('; ')}`);
            }
            
            fullLog += `<span class="success">[SUCCESS]</span> Parsed successfully.\n`;
            fullLog += `--- Abstract Syntax Tree ---\n`;
            fullLog += prettyPrintAST(ast);
            fullLog += `--- End of AST ---\n\n`;
            testsPassed++;
        } catch (error) {
            fullLog += `<span class="failure">[FAILURE]</span> ${error.name}: ${error.message}\n\n`;
        }
    });

    fullLog += `--- Test Summary ---\n`;
    fullLog += `${testsPassed} / ${neopixelFiles.length} examples parsed successfully.\n`;
    if (logElement) {
        logElement.innerHTML = fullLog;
    }
}

// Universal export for Node.js and browser compatibility
if (typeof window !== 'undefined') {
    // Browser environment
    window.neopixelFiles = neopixelFiles;
    window.runExamples = runExamples;
    
    // Run the tests automatically when the page loads
    window.onload = runExamples;
} else if (typeof module !== 'undefined' && module.exports) {
    // Node.js environment
    module.exports = {
        neopixelFiles,
        runExamples
    };
}

