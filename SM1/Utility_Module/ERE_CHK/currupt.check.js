//,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,
// currupt.check.js — Scan Bcode/ for Corrupted Files or Data             |
// Updated: 2025-08                                                        |
//------------------------------------------------------------------------//

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../'); // where KERNEL.js is
const bcodePath = path.join(projectRoot, 'Bcode');
const logsDir = path.join(projectRoot, 'logs');

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const results = {
  totalFiles: 0,
  jsonIssues: [],
  jsIssues: [],
  emptyFiles: [],
  binaryFiles: [],
  passed: []
};

// ✅ Check if text file contains binary characters
function isBinaryContent(content) {
  return /[\x00-\x08\x0E-\x1F]/.test(content);
}

// ✅ Validate JSON content
function validateJsonContent(filePath, content) {
  try {
    const parsed = JSON.parse(content);

    // Additional corruption checks
    if (parsed === null) return 'JSON root is null';
    if (typeof parsed === 'object') {
      const keys = Object.keys(parsed);
      if (keys.some(k => k.trim() === '')) return 'Empty key in JSON object';
    }
    return null;
  } catch (err) {
    return `Parse Error: ${err.message}`;
  }
}

// ✅ Validate JS syntax using VM
function validateJsSyntax(content) {
  try {
    new vm.Script(content);
    return null;
  } catch (err) {
    return `Syntax Error: ${err.message}`;
  }
}

// ✅ Recursively scan Bcode folder
function scanDirectory(dirPath) {
  const entries = fs.readdirSync(dirPath);
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      scanDirectory(fullPath);
    } else {
      results.totalFiles++;
      const ext = path.extname(entry);
      const relativePath = path.relative(projectRoot, fullPath);
      const size = stat.size;

      if (size === 0) {
        results.emptyFiles.push(relativePath);
        continue;
      }

      const content = fs.readFileSync(fullPath, 'utf-8');

      if (isBinaryContent(content)) {
        results.binaryFiles.push(relativePath);
        continue;
      }

      if (ext === '.json') {
        const error = validateJsonContent(fullPath, content);
        if (error) {
          results.jsonIssues.push({ file: relativePath, issue: error });
          continue;
        }
        results.passed.push(relativePath);
      } else if (ext === '.js') {
        const error = validateJsSyntax(content);
        if (error) {
          results.jsIssues.push({ file: relativePath, issue: error });
          continue;
        }
        results.passed.push(relativePath);
      } else {
        results.passed.push(relativePath);
      }
    }
  }
}

// ✅ Save results to log file
function saveReport() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logFile = path.join(logsDir, `corrupt_check_${timestamp}.txt`);

  let report = '=== CORRUPTION CHECK REPORT ===\n';
  report += `Date: ${new Date().toLocaleString()}\n`;
  report += `Total Files Scanned: ${results.totalFiles}\n`;
  report += '--------------------------------\n';

  if (results.emptyFiles.length > 0) {
    report += '\n--- EMPTY FILES ---\n';
    results.emptyFiles.forEach(file => {
      report += `File: ${file}\n`;
    });
  }

  if (results.binaryFiles.length > 0) {
    report += '\n--- BINARY CONTENT DETECTED ---\n';
    results.binaryFiles.forEach(file => {
      report += `File: ${file}\n`;
    });
  }

  if (results.jsonIssues.length > 0) {
    report += '\n--- JSON ISSUES ---\n';
    results.jsonIssues.forEach(item => {
      report += `File: ${item.file}\nIssue: ${item.issue}\n\n`;
    });
  }

  if (results.jsIssues.length > 0) {
    report += '\n--- JS SYNTAX ISSUES ---\n';
    results.jsIssues.forEach(item => {
      report += `File: ${item.file}\nIssue: ${item.issue}\n\n`;
    });
  }

  if (results.passed.length > 0) {
    report += '\n--- PASSED FILES ---\n';
    results.passed.forEach(file => {
      report += `${file}\n`;
    });
  }

  fs.writeFileSync(logFile, report, 'utf-8');
  console.log(`[LOG] ✅ Corruption check report saved: ${logFile}`);
}

// ✅ Print summary in console
function printSummary() {
  console.log('\n[CORRUPTION CHECK SUMMARY]');
  console.log(`Total Files: ${results.totalFiles}`);
  console.log(`Empty Files: ${results.emptyFiles.length}`);
  console.log(`Binary Files: ${results.binaryFiles.length}`);
  console.log(`JSON Issues: ${results.jsonIssues.length}`);
  console.log(`JS Issues: ${results.jsIssues.length}`);
  console.log(`Passed: ${results.passed.length}`);
  console.log('\n[INFO] Detailed report saved in /logs folder.\n');
}

// Run the check
console.log(`[CHECK] 🔍 Scanning ${bcodePath} for corruption...`);
scanDirectory(bcodePath);
saveReport();
printSummary();
