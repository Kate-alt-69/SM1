//,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,
// json.check.js — Validate JSON Files Used by KERNEL                     |
// Updated: 2025-08                                                        |
//------------------------------------------------------------------------//

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Resolve paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../..'); // KERNEL.js level
const logsDir = path.join(projectRoot, 'logs');

// JSON files to check
const jsonFiles = {
  token: path.join(projectRoot, 'defined/token.json'),
  commands: path.join(projectRoot, 'defined/commands.json'),
  animatedEmojis: path.join(projectRoot, 'Bcode/data/animated_emojis.json'),
  emojiData: path.join(projectRoot, 'Bcode/data/emoji_data.json'),
  staticEmojis: path.join(projectRoot, 'Bcode/data/static_emojis.json')
};

// Ensure logs folder exists
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const results = {
  totalFiles: 0,
  errors: [],
  warnings: [],
  passed: []
};

// ✅ Helper to safely parse JSON
function safeParseJSON(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    return { parseError: err.message };
  }
}

// ✅ Validate token.json
function validateTokenJson(data) {
  const requiredKeys = ['temp', 'save', 'loadtokensave', 'loadtokentemp'];
  const missing = requiredKeys.filter(k => !(k in data));
  if (missing.length > 0) {
    return `Missing keys: ${missing.join(', ')}`;
  }
  return null;
}

// ✅ Validate commands.json
function validateCommandsJson(data) {
  if (typeof data !== 'object') return 'Commands JSON should be an object';
  return null;
}

// ✅ Validate animated_emojis.json
function validateAnimatedEmojisJson(data) {
  if (data.type !== 'animated') return `Expected type "animated", got "${data.type}"`;
  if (typeof data.count !== 'number') return 'Missing or invalid "count"';
  const actualCount = Object.keys(data.emojis || {}).length;
  if (actualCount !== data.count) return `Count mismatch: expected ${data.count}, got ${actualCount}`;
  return null;
}

// ✅ Validate static_emojis.json
function validateStaticEmojisJson(data) {
  if (data.type !== 'static') return `Expected type "static", got "${data.type}"`;
  if (typeof data.count !== 'number') return 'Missing or invalid "count"';
  const actualCount = Object.keys(data.emojis || {}).length;
  if (actualCount !== data.count) return `Count mismatch: expected ${data.count}, got ${actualCount}`;
  return null;
}

// ✅ Validate emoji_data.json
function validateEmojiDataJson(data) {
  if (!Array.isArray(data.emojis)) return 'Expected "emojis" to be an array';
  for (const emoji of data.emojis) {
    const required = ['id', 'name', 'animated', 'format', 'imageUrl'];
    const missing = required.filter(k => !(k in emoji));
    if (missing.length > 0) return `Emoji entry missing keys: ${missing.join(', ')}`;
  }
  return null;
}

// ✅ Run all checks
function runJsonChecks() {
  console.log(`[JSON CHECK] 🔍 Validating ${Object.keys(jsonFiles).length} JSON files...\n`);
  results.totalFiles = Object.keys(jsonFiles).length;

  for (const [key, filePath] of Object.entries(jsonFiles)) {
    const fileName = path.relative(projectRoot, filePath);

    if (!fs.existsSync(filePath)) {
      results.errors.push({ file: fileName, issue: 'File not found' });
      continue;
    }

    const parsed = safeParseJSON(filePath);
    if (parsed.parseError) {
      results.errors.push({ file: fileName, issue: `Parse Error: ${parsed.parseError}` });
      continue;
    }

    let validationError = null;
    switch (key) {
      case 'token':
        validationError = validateTokenJson(parsed);
        break;
      case 'commands':
        validationError = validateCommandsJson(parsed);
        break;
      case 'animatedEmojis':
        validationError = validateAnimatedEmojisJson(parsed);
        break;
      case 'emojiData':
        validationError = validateEmojiDataJson(parsed);
        break;
      case 'staticEmojis':
        validationError = validateStaticEmojisJson(parsed);
        break;
    }

    if (validationError) {
      results.errors.push({ file: fileName, issue: validationError });
    } else {
      results.passed.push(fileName);
    }
  }

  saveReport();
  printSummary();
}

// ✅ Save report
function saveReport() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logFile = path.join(logsDir, `json_check_${timestamp}.txt`);

  let report = '=== JSON Validation Report ===\n';
  report += `Date: ${new Date().toLocaleString()}\n`;
  report += `Total Files Checked: ${results.totalFiles}\n`;
  report += `--------------------------------\n`;

  if (results.errors.length > 0) {
    report += '\n--- ERRORS ---\n';
    results.errors.forEach(item => {
      report += `File: ${item.file}\nIssue: ${item.issue}\n\n`;
    });
  } else {
    report += '\nNo JSON errors found.\n';
  }

  if (results.passed.length > 0) {
    report += '\n--- PASSED FILES ---\n';
    results.passed.forEach(file => {
      report += `${file}\n`;
    });
  }

  fs.writeFileSync(logFile, report, 'utf-8');
  console.log(`[LOG] ✅ JSON check report saved: ${logFile}`);
}

// ✅ Print summary to console
function printSummary() {
  console.log('\n[JSON CHECK SUMMARY]');
  console.log(`Total Files: ${results.totalFiles}`);
  console.log(`Errors: ${results.errors.length}`);
  console.log(`Passed: ${results.passed.length}`);
  console.log('\n[INFO] Detailed report saved in /logs folder.\n');
}

runJsonChecks();