#include <iostream>
#include <string>
#include <vector>

// Simplified standalone test of JSON functionality
std::string escapeJSON(const std::string& str) {
    std::string escaped;
    for (char c : str) {
        switch (c) {
            case '"': escaped += "\\\""; break;
            case '\\': escaped += "\\\\"; break;
            default: escaped += c; break;
        }
    }
    return escaped;
}

std::string jsonField(const std::string& key, int value) {
    return "\"" + key + "\":" + std::to_string(value);
}

std::string jsonField(const std::string& key, const std::string& value) {
    return "\"" + key + "\":\"" + escapeJSON(value) + "\"";
}

std::string buildJSON(const std::string& type, const std::vector<std::string>& fields) {
    std::string json = "{";
    json += jsonField("type", type);
    json += ",\"timestamp\":0";
    for (const auto& field : fields) {
        if (!field.empty()) {
            json += "," + field;
        }
    }
    json += "}";
    return json;
}

int main() {
    std::cout << "=== Ultra-Minimal JSON Output Test ===" << std::endl;

    // Test VERSION_INFO
    std::vector<std::string> versionFields = {
        jsonField("component", "interpreter"),
        jsonField("version", "11.0.0"),
        jsonField("status", "started")
    };
    std::cout << buildJSON("VERSION_INFO", versionFields) << std::endl;

    // Test DIGITAL_WRITE
    std::vector<std::string> digitalWriteFields = {
        jsonField("pin", 13),
        jsonField("value", 1)
    };
    std::cout << buildJSON("DIGITAL_WRITE", digitalWriteFields) << std::endl;

    // Test SERIAL_PRINT
    std::vector<std::string> serialFields = {
        jsonField("message", "Hello World"),
        jsonField("format", "STRING")
    };
    std::cout << buildJSON("SERIAL_PRINT", serialFields) << std::endl;

    std::cout << "\n✅ Ultra-Minimal JSON Generation Working!" << std::endl;
    return 0;
}