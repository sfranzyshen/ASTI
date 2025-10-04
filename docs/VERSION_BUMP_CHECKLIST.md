# Version Bump Checklist

**Quick Reference Guide for Updating Version Numbers Across the Project**

This document provides a systematic checklist for bumping version numbers across the Arduino AST Interpreter project to avoid redoing the investigation process.

---

## 📋 Version Bump Decision Matrix

### When to Bump Versions

**ASTInterpreter Core** (Semantic Versioning: MAJOR.MINOR.PATCH)
- **MAJOR**: Breaking changes to command protocol, API changes, architecture overhaul
- **MINOR**: New features, significant enhancements (e.g., new operators, language features)
- **PATCH**: Bug fixes, small improvements, documentation updates

**CompactAST Library** (Check git log for changes since last bump)
- Bump if ANY commits modified `libs/CompactAST/src/` since last version
- Check: `git log --oneline --since="YYYY-MM-DD" -- libs/CompactAST/`

**ArduinoParser Library** (Check git log for changes since last bump)
- Bump if ANY commits modified `libs/ArduinoParser/src/` since last version
- Check: `git log --oneline --since="YYYY-MM-DD" -- libs/ArduinoParser/`

---

## 🎯 File Update Checklist

### Phase 1: ASTInterpreter Core Version Bump

When bumping from `X.Y.Z` → `X2.Y2.Z2`:

- [ ] **CMakeLists.txt** (line 12)
  ```cmake
  VERSION X2.Y2.Z2
  ```

- [ ] **library.properties** (line 2)
  ```
  version=X2.Y2.Z2
  ```

- [ ] **src/javascript/ASTInterpreter.js** (line 30)
  ```javascript
  const INTERPRETER_VERSION = "X2.Y2.Z2";
  ```

- [ ] **src/javascript/WasmASTInterpreter.js**
  - Line 7: `* Version: X2.Y2.Z2`
  - Line 8: `* Compatible with: ASTInterpreter.js vX2.Y2.Z2`
  - Line 28: `this.version = "X2.Y2.Z2";`

- [ ] **src/cpp/ASTInterpreter.hpp**
  - Line 8: `* Version: X2.Y2.Z2`
  - Line 9: `* Compatible with: ASTInterpreter.js vX2.Y2.Z2`
  - Line 59: `std::string version = "X2.Y2.Z2";`

- [ ] **src/cpp/ASTInterpreter.cpp**
  - Line 7: `* Version: X2.Y2.Z2`
  - Line ~264: `emitVersionInfo("interpreter", "X2.Y2.Z2", "started");`

- [ ] **src/cpp/wasm_bridge.cpp**
  - Line 7: `* Version: X2.Y2.Z2`
  - Line ~252: `return "X2.Y2.Z2";`

- [ ] **src/cpp/PlatformAbstraction.hpp** (line 10)
  ```cpp
  * Compatible with: ASTInterpreter vX2.Y2.Z2
  ```

- [ ] **src/cpp/TemplateInstantiations.cpp** (line 11)
  ```cpp
  * Compatible with: ASTInterpreter vX2.Y2.Z2
  ```

- [ ] **src/ArduinoASTInterpreter.h**
  - Line 15: `* Version: X2.Y2.Z2`
  - Line 37: `#define ARDUINO_AST_INTERPRETER_VERSION "X2.Y2.Z2"`
  - Line 38: `#define ARDUINO_AST_INTERPRETER_VERSION_MAJOR X2`
  - Line 39: `#define ARDUINO_AST_INTERPRETER_VERSION_MINOR Y2`
  - Line 40: `#define ARDUINO_AST_INTERPRETER_VERSION_PATCH Z2`

**Total: 17 files for ASTInterpreter Core**

---

### Phase 2: CompactAST Library Version Bump

When bumping from `A.B.C` → `A2.B2.C2`:

- [ ] **libs/CompactAST/package.json** (line 3)
  ```json
  "version": "A2.B2.C2",
  ```

- [ ] **libs/CompactAST/src/CompactAST.hpp**
  - Line 7: `* Version: A2.B2.C2`
  - Line 9: `* Format: Compact AST Binary Format Specification vA2.B2.C2`

- [ ] **libs/CompactAST/src/CompactAST.js** (line 16)
  ```javascript
  * @version A2.B2.C2
  ```

**Total: 3 files for CompactAST**

---

### Phase 3: ArduinoParser Library Version Bump

When bumping from `M.N.P` → `M2.N2.P2`:

- [ ] **libs/ArduinoParser/package.json** (line 3)
  ```json
  "version": "M2.N2.P2",
  ```

- [ ] **libs/ArduinoParser/src/ArduinoParser.js** (line 65)
  ```javascript
  const PARSER_VERSION = "M2.N2.P2";
  ```

**Total: 2 files for ArduinoParser**

---

### Phase 4: Critical Dependency Alignment

**🚨 IMPORTANT**: Ensure library dependencies match actual versions!

- [ ] **libs/ArduinoParser/package.json** (line 25)
  ```json
  "@arduino-ast-interpreter/compact-ast": "^A2.0.0"
  ```
  *(Where A2 is CompactAST MAJOR version)*

---

### Phase 5: Documentation Updates

- [ ] **README.md** - Update 4 sections:
  - Line 17: `### **CompactAST Library** (vA2.B2.C2)`
  - Line 29: `### **ASTInterpreter Core** (vX2.Y2.Z2)`
  - Line 139: CompactAST version in table
  - Line 141: ASTInterpreter version + baseline success rate in table

- [ ] **CLAUDE.md** - Add new milestone section:
  ```markdown
  # 🔖 VERSION X2.Y2.Z2 - [MILESTONE TITLE] 🔖

  ## **[DATE] - [FEATURE SUMMARY]**

  ### **[ACHIEVEMENT DESCRIPTION]**

  **[TYPE] RELEASE**: [Brief description]

  **Key Changes:**
  - ✅ **[Change 1]**: [Description]
  - ✅ **[Change 2]**: [Description]
  ...
  ```

---

## 🔄 Mandatory Post-Update Procedures

### CRITICAL: These steps are NOT optional!

1. **Rebuild All C++ Tools**
   ```bash
   cd build
   make clean
   make -j4
   ```

2. **Regenerate ALL Test Data**
   ```bash
   cd /mnt/d/Devel/ASTInterpreter
   node src/javascript/generate_test_data.js
   ```

3. **Run Full Baseline Validation**
   ```bash
   cd /mnt/d/Devel/ASTInterpreter
   ./run_baseline_validation.sh 0 134
   ```

4. **Verify Zero Regressions**
   - Compare passing test count with previous baseline
   - Document any changes in CLAUDE.md
   - Update README.md success rate if changed

---

## 🚫 Files to EXCLUDE (DO NOT UPDATE)

These files contain historical version references that should NOT be changed:

- **build/** - All test output files (`.arduino`, `.json`)
- **test_data/** - Historical test data (will be regenerated)
- **.git/** - Git commit history
- **docs/*Investigation*.md** - Historical investigation documents
- **docs/*ULTRATHINK*.md** - Historical planning documents
- **trash/** - Archived/obsolete files

---

## 📝 Version Bump Template Commit Message

```
Version X2.Y2.Z2: [Brief milestone description]

- ASTInterpreter: X.Y.Z → X2.Y2.Z2
- CompactAST: A.B.C → A2.B2.C2 (if bumped)
- ArduinoParser: M.N.P → M2.N2.P2 (if bumped)

Key Changes:
- [Change 1]
- [Change 2]
- [Change 3]

Files Updated: [count] source/config files
Baseline: [success_rate]% ([passing]/135 tests)
Regressions: [zero/count]

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

---

## 🔍 Quick Search Commands

### Find all version references:
```bash
# ASTInterpreter version
grep -r "X\.Y\.Z" --include="*.js" --include="*.cpp" --include="*.hpp" --include="*.h" --include="CMakeLists.txt" --include="*.md" --exclude-dir=build --exclude-dir=node_modules --exclude-dir=.git

# CompactAST version
grep -r "A\.B\.C" libs/CompactAST/src/

# ArduinoParser version
grep -r "M\.N\.P" libs/ArduinoParser/src/
```

### Check for missed files:
```bash
# Search for old version in source (replace X.Y.Z with actual old version)
grep -r "X\.Y\.Z" --include="*.{js,cpp,hpp,h,cmake,json,properties}" --exclude-dir={build,node_modules,.git,trash}
```

---

## ✅ Final Validation Checklist

- [ ] All source files updated with new version numbers
- [ ] Library dependencies aligned correctly
- [ ] Documentation updated (README.md + CLAUDE.md)
- [ ] Test data regenerated successfully
- [ ] Full baseline validation passed
- [ ] Zero regressions confirmed
- [ ] Commit message follows template
- [ ] Changes pushed to GitHub

---

## 📚 Reference: Version History

| Date | ASTInterpreter | CompactAST | ArduinoParser | Baseline | Notes |
|------|----------------|------------|---------------|----------|-------|
| 2025-10-04 | 18.0.0 | 3.1.0 | 6.0.0 | 94.07% (127/135) | Version sync + dependency fix |
| 2025-10-04 | 17.0.0 | 3.0.0 | 6.0.0 | 94.07% (127/135) | Typedef + function pointers |
| 2025-10-03 | 17.0.0 | 3.0.0 | 6.0.0 | 92.59% (125/135) | Complete pointer support |
| 2025-10-03 | 17.0.0 | 3.0.0 | 6.0.0 | 90.37% (122/135) | Prefix/postfix operators |

---

## 💡 Tips & Best Practices

1. **Always check git log** before deciding whether to bump library versions
2. **Use semantic versioning** - be consistent with MAJOR.MINOR.PATCH meanings
3. **Test data regeneration is mandatory** - version strings must match across platforms
4. **Document everything** - future you will thank you for detailed CLAUDE.md entries
5. **Verify zero regressions** - never accept a version bump that breaks tests
6. **Keep this checklist updated** - add new files as they're created

---

**Last Updated**: October 4, 2025
**Maintained By**: Arduino AST Interpreter Project
