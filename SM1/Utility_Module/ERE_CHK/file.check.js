// file.check.js — Full Project Diagnostic (Syntax + Var + Function Check)
// Updated: 2025-08
//------------------------------------------------------------------------//

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import * as acorn from 'acorn';

// Resolve __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Project root (parent of Utility_Module)
const projectRoot = path.resolve(__dirname, '../../'); // KERNEL.js is here
const logsDir = path.join(projectRoot, 'logs');
const bcodePath = path.join(projectRoot, 'Bcode');
const utilsPath = path.join(projectRoot, 'Utility_Module');

// Ensure logs folder exists
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

const results = {
  totalFiles: 0,
  syntaxErrors: [],
  varIssues: [],
  functionIssues: [],
  passed: []
};

// ✅ Get all JS files from given directory (recursive, excluding node_modules)
function getAllJsFiles(dir) {
  let files = [];
  for (const item of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      if (item === 'node_modules') continue; // Skip node_modules
      files = files.concat(getAllJsFiles(fullPath));
    } else if (item.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  return files;
}

// ✅ Check syntax using Node
function checkSyntax(filePath) {
  try {
    execSync(`node --check "${filePath}"`, { stdio: 'pipe' });
    return null;
  } catch (err) {
    return err.message.split('\n')[0] || 'Unknown syntax error';
  }
}

// ✅ Check for variable issues
function checkVariables(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const issues = [];

  if (/\bvar\b/.test(content)) {
    issues.push('Uses "var" (prefer let/const)');
  }

  return issues;
}

// ✅ Analyze functions using AST
function analyzeFunctions(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const issues = [];
  try {
    const ast = acorn.parse(content, { ecmaVersion: 'latest', sourceType: 'module' });

    const declaredFunctions = new Set();
    const calledFunctions = new Set();

    function walk(node) {
      if (!node || typeof node !== 'object') return;

      if (node.type === 'FunctionDeclaration') {
        declaredFunctions.add(node.id.name);
      }

      if (node.type === 'CallExpression' && node.callee.type === 'Identifier') {
        calledFunctions.add(node.callee.name);
      }

      for (const key in node) {
        if (Array.isArray(node[key])) {
          node[key].forEach(walk);
        } else {
          walk(node[key]);
        }
      }
    }

    walk(ast);

    for (const fn of calledFunctions) {
      if (!declaredFunctions.has(fn) && fn !== 'console' && fn !== 'require') {
        issues.push(`Calls undefined function "${fn}"`);
      }
    }

    const duplicates = [...declaredFunctions].filter((fn, idx, arr) => arr.indexOf(fn) !== idx);
    duplicates.forEach(fn => issues.push(`Duplicate function "${fn}"`));

  } catch (err) {
    issues.push(`AST Parse Error: ${err.message}`);
  }

  return issues;
}

// ✅ Run checks for all files
function runChecks() {
  const files = [...getAllJsFiles(bcodePath), ...getAllJsFiles(utilsPath)];
  results.totalFiles = files.length;

  console.log(`[CHECK] 🔍 Found ${files.length} JS files (excluding node_modules). Running advanced checks...\n`);

  for (const file of files) {
    const relativePath = path.relative(projectRoot, file);
    let fileStatus = { file: relativePath, syntax: 'OK', vars: 'OK', functions: 'OK' };

    const syntaxError = checkSyntax(file);
    if (syntaxError) {
      fileStatus.syntax = syntaxError;
      results.syntaxErrors.push(fileStatus);
    }

    const varIssues = checkVariables(file);
    if (varIssues.length > 0) {
      fileStatus.vars = varIssues.join('; ');
      results.varIssues.push(fileStatus);
    }

    const functionIssues = analyzeFunctions(file);
    if (functionIssues.length > 0) {
      fileStatus.functions = functionIssues.join('; ');
      results.functionIssues.push(fileStatus);
    }

    if (fileStatus.syntax === 'OK' && fileStatus.vars === 'OK' && fileStatus.functions === 'OK') {
      results.passed.push(relativePath);
    }
  }

  saveReport();
  printSummary();
}

function saveReport() {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const logFile = path.join(logsDir, `full_check_${timestamp}.txt`);

  let report = '=== Full Project Diagnostic Report ===\n';
  report += `Date: ${new Date().toLocaleString()}\n`;
  report += `Total Files Checked: ${results.totalFiles}\n`;
  report += `---------------------------------------\n`;

  if (results.syntaxErrors.length > 0) {
    report += '\n--- SYNTAX ERRORS ---\n';
    results.syntaxErrors.forEach(item => {
      report += `File: ${item.file}\nError: ${item.syntax}\n\n`;
    });
  } else {
    report += '\nNo syntax errors found.\n';
  }

  if (results.varIssues.length > 0) {
    report += '\n--- VARIABLE ISSUES ---\n';
    results.varIssues.forEach(item => {
      report += `File: ${item.file}\nIssue: ${item.vars}\n\n`;
    });
  } else {
    report += '\nNo variable issues found.\n';
  }

  if (results.functionIssues.length > 0) {
    report += '\n--- FUNCTION ISSUES ---\n';
    results.functionIssues.forEach(item => {
      report += `File: ${item.file}\nIssue: ${item.functions}\n\n`;
    });
  } else {
    report += '\nNo function issues found.\n';
  }

  report += '\n--- PASSED FILES ---\n';
  results.passed.forEach(file => {
    report += `${file}\n`;
  });

  fs.writeFileSync(logFile, report, 'utf-8');
  console.log(`[LOG] ✅ Report saved to: ${logFile}`);
}

function printSummary() {
  console.log('\n[CHECK SUMMARY]');
  console.log(`Total Files: ${results.totalFiles}`);
  console.log(`Syntax Errors: ${results.syntaxErrors.length}`);
  console.log(`Variable Issues: ${results.varIssues.length}`);
  console.log(`Function Issues: ${results.functionIssues.length}`);
  console.log(`Passed: ${results.passed.length}`);
  console.log('\n[INFO] Detailed report saved in /logs folder.\n');
}

runChecks();
