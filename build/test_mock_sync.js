// Test mock value synchronization patterns
console.log("Testing mock value patterns...");

// Current C++ pattern: pin % 2
function cppPattern(pin) {
    return pin % 2;
}

// Alternative patterns to try
function pattern1(pin) {
    // Pin-based: even = 0, odd = 1
    return pin % 2;
}

function pattern2(pin) {
    // Inverted: even = 1, odd = 0
    return (pin + 1) % 2;
}

function pattern3(pin) {
    // Hash-based deterministic
    return Math.abs(pin * 31) % 2;
}

console.log("Pin patterns:");
for (let pin = 0; pin <= 13; pin++) {
    console.log(`Pin ${pin}: cpp=${cppPattern(pin)}, p1=${pattern1(pin)}, p2=${pattern2(pin)}, p3=${pattern3(pin)}`);
}

// Test case analysis
console.log("\nTest case analysis:");
console.log("Test 7 uses pin 2:");
console.log(`C++ current: ${cppPattern(2)} (should match JS value: 1)`);
console.log(`Pattern2: ${pattern2(2)} (inverted pattern)`);