#!/usr/bin/env node

/**
 * claw-deps - Dependency checker for AI agents
 * Check outdated, audit, and summarize project dependencies
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const args = process.argv.slice(2);
const flagArgs = args.filter(a => a.startsWith('-'));
const positionalArgs = args.filter(a => !a.startsWith('-'));

const jsonOutput = flagArgs.includes('--json') || flagArgs.includes('-j');
const showHelp = flagArgs.includes('--help') || flagArgs.includes('-h');

// First positional is command if it's a known command, otherwise it's a path
const knownCommands = ['check', 'outdated', 'audit', 'info', 'help'];
const command = knownCommands.includes(positionalArgs[0]) ? positionalArgs[0] : 'check';
const projectPath = knownCommands.includes(positionalArgs[0]) ? (positionalArgs[1] || process.cwd()) : (positionalArgs[0] || process.cwd());

function log(msg) {
  if (!jsonOutput) console.log(msg);
}

function detectPackageManager(dir) {
  if (fs.existsSync(path.join(dir, 'package-lock.json'))) return 'npm';
  if (fs.existsSync(path.join(dir, 'yarn.lock'))) return 'yarn';
  if (fs.existsSync(path.join(dir, 'pnpm-lock.yaml'))) return 'pnpm';
  if (fs.existsSync(path.join(dir, 'bun.lockb'))) return 'bun';
  if (fs.existsSync(path.join(dir, 'requirements.txt'))) return 'pip';
  if (fs.existsSync(path.join(dir, 'Pipfile'))) return 'pipenv';
  if (fs.existsSync(path.join(dir, 'pyproject.toml'))) return 'poetry';
  if (fs.existsSync(path.join(dir, 'go.mod'))) return 'go';
  if (fs.existsSync(path.join(dir, 'Cargo.toml'))) return 'cargo';
  if (fs.existsSync(path.join(dir, 'package.json'))) return 'npm';
  return null;
}

function runCommand(cmd, cwd) {
  try {
    return execSync(cmd, { cwd, encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (err) {
    return err.stdout || err.stderr || '';
  }
}

function checkNpm(dir) {
  const result = { manager: 'npm', outdated: [], vulnerable: 0, summary: '' };
  
  // Check outdated
  const outdatedRaw = runCommand('npm outdated --json 2>/dev/null', dir);
  try {
    const outdated = JSON.parse(outdatedRaw || '{}');
    result.outdated = Object.entries(outdated).map(([name, info]) => ({
      name,
      current: info.current,
      wanted: info.wanted,
      latest: info.latest,
      type: info.type
    }));
  } catch (e) {}
  
  // Check vulnerabilities
  const auditRaw = runCommand('npm audit --json 2>/dev/null', dir);
  try {
    const audit = JSON.parse(auditRaw || '{}');
    result.vulnerable = audit.metadata?.vulnerabilities?.total || 0;
    result.vulnerabilities = audit.metadata?.vulnerabilities || {};
  } catch (e) {}
  
  // Summary
  const outdatedCount = result.outdated.length;
  const vulnCount = result.vulnerable;
  if (outdatedCount === 0 && vulnCount === 0) {
    result.summary = '✅ All dependencies up to date and secure';
  } else {
    const parts = [];
    if (outdatedCount > 0) parts.push(`${outdatedCount} outdated`);
    if (vulnCount > 0) parts.push(`${vulnCount} vulnerabilities`);
    result.summary = `⚠️  ${parts.join(', ')}`;
  }
  
  return result;
}

function checkPip(dir) {
  const result = { manager: 'pip', outdated: [], summary: '' };
  
  // Check outdated
  const outdatedRaw = runCommand('pip list --outdated --format=json 2>/dev/null', dir);
  try {
    const outdated = JSON.parse(outdatedRaw || '[]');
    result.outdated = outdated.map(pkg => ({
      name: pkg.name,
      current: pkg.version,
      latest: pkg.latest_version,
      type: pkg.latest_filetype
    }));
  } catch (e) {}
  
  // pip-audit if available
  const auditRaw = runCommand('pip-audit --format=json 2>/dev/null', dir);
  try {
    const audit = JSON.parse(auditRaw || '[]');
    result.vulnerable = audit.length;
    result.vulnerabilities = audit;
  } catch (e) {
    result.vulnerable = 0;
  }
  
  const outdatedCount = result.outdated.length;
  const vulnCount = result.vulnerable || 0;
  if (outdatedCount === 0 && vulnCount === 0) {
    result.summary = '✅ All dependencies up to date';
  } else {
    const parts = [];
    if (outdatedCount > 0) parts.push(`${outdatedCount} outdated`);
    if (vulnCount > 0) parts.push(`${vulnCount} vulnerabilities`);
    result.summary = `⚠️  ${parts.join(', ')}`;
  }
  
  return result;
}

function checkGo(dir) {
  const result = { manager: 'go', outdated: [], summary: '' };
  
  // Check for updates
  const updatesRaw = runCommand('go list -m -u all 2>/dev/null', dir);
  const lines = updatesRaw.split('\n').filter(l => l.includes('['));
  result.outdated = lines.map(line => {
    const match = line.match(/^(\S+)\s+(\S+)\s+\[(\S+)\]/);
    if (match) {
      return { name: match[1], current: match[2], latest: match[3] };
    }
    return null;
  }).filter(Boolean);
  
  const outdatedCount = result.outdated.length;
  if (outdatedCount === 0) {
    result.summary = '✅ All dependencies up to date';
  } else {
    result.summary = `⚠️  ${outdatedCount} outdated`;
  }
  
  return result;
}

function checkCargo(dir) {
  const result = { manager: 'cargo', outdated: [], summary: '' };
  
  // cargo outdated if available
  const outdatedRaw = runCommand('cargo outdated --format=json 2>/dev/null', dir);
  try {
    const data = JSON.parse(outdatedRaw || '{}');
    result.outdated = Object.entries(data.dependencies || {}).map(([name, info]) => ({
      name,
      current: info.project,
      latest: info.latest
    }));
  } catch (e) {
    // Fallback to basic check
    const basicRaw = runCommand('cargo update --dry-run 2>&1', dir);
    const lines = basicRaw.split('\n').filter(l => l.includes('Updating'));
    result.outdated = lines.map(line => {
      const match = line.match(/Updating\s+(\S+)\s+v(\S+)\s+->\s+v(\S+)/);
      if (match) {
        return { name: match[1], current: match[2], latest: match[3] };
      }
      return null;
    }).filter(Boolean);
  }
  
  // cargo audit if available
  const auditRaw = runCommand('cargo audit --json 2>/dev/null', dir);
  try {
    const audit = JSON.parse(auditRaw || '{}');
    result.vulnerable = (audit.vulnerabilities?.list || []).length;
    result.vulnerabilities = audit.vulnerabilities?.list || [];
  } catch (e) {
    result.vulnerable = 0;
  }
  
  const outdatedCount = result.outdated.length;
  const vulnCount = result.vulnerable || 0;
  if (outdatedCount === 0 && vulnCount === 0) {
    result.summary = '✅ All dependencies up to date and secure';
  } else {
    const parts = [];
    if (outdatedCount > 0) parts.push(`${outdatedCount} outdated`);
    if (vulnCount > 0) parts.push(`${vulnCount} vulnerabilities`);
    result.summary = `⚠️  ${parts.join(', ')}`;
  }
  
  return result;
}

function showHelpText() {
  console.log(`
claw-deps - Dependency checker for AI agents

USAGE:
  claw-deps [command] [options] [path]

COMMANDS:
  check     Check for outdated and vulnerable dependencies (default)
  outdated  List only outdated packages
  audit     Security audit only
  info      Show project dependency info

OPTIONS:
  -j, --json    Output as JSON
  -h, --help    Show this help

EXAMPLES:
  claw-deps                    # Check current directory
  claw-deps check ./my-project # Check specific project
  claw-deps outdated --json    # List outdated as JSON
  claw-deps audit              # Security audit only

SUPPORTED:
  npm, yarn, pnpm, bun (Node.js)
  pip, pipenv, poetry (Python)
  go mod (Go)
  cargo (Rust)
`);
}

function main() {
  if (showHelp || command === 'help') {
    showHelpText();
    return;
  }
  
  const dir = path.resolve(projectPath.startsWith('-') ? process.cwd() : projectPath);
  
  if (!fs.existsSync(dir)) {
    console.error(`Error: Directory not found: ${dir}`);
    process.exit(1);
  }
  
  const manager = detectPackageManager(dir);
  
  if (!manager) {
    if (jsonOutput) {
      console.log(JSON.stringify({ error: 'No supported package manager detected', path: dir }));
    } else {
      console.error('❌ No supported package manager detected');
      console.error(`   Looked in: ${dir}`);
    }
    process.exit(1);
  }
  
  log(`📦 Checking ${manager} dependencies in ${dir}`);
  log('');
  
  let result;
  switch (manager) {
    case 'npm':
    case 'yarn':
    case 'pnpm':
    case 'bun':
      result = checkNpm(dir);
      break;
    case 'pip':
    case 'pipenv':
    case 'poetry':
      result = checkPip(dir);
      break;
    case 'go':
      result = checkGo(dir);
      break;
    case 'cargo':
      result = checkCargo(dir);
      break;
    default:
      result = { error: 'Unsupported package manager', manager };
  }
  
  result.path = dir;
  
  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  
  // Pretty output
  console.log(result.summary);
  console.log('');
  
  if (command === 'outdated' || command === 'check') {
    if (result.outdated && result.outdated.length > 0) {
      console.log('📋 Outdated packages:');
      result.outdated.forEach(pkg => {
        console.log(`   ${pkg.name}: ${pkg.current} → ${pkg.latest}`);
      });
      console.log('');
    }
  }
  
  if (command === 'audit' || command === 'check') {
    if (result.vulnerable > 0) {
      console.log(`🔒 Security: ${result.vulnerable} vulnerabilities found`);
      if (result.vulnerabilities) {
        const vuln = result.vulnerabilities;
        if (vuln.critical) console.log(`   Critical: ${vuln.critical}`);
        if (vuln.high) console.log(`   High: ${vuln.high}`);
        if (vuln.moderate) console.log(`   Moderate: ${vuln.moderate}`);
        if (vuln.low) console.log(`   Low: ${vuln.low}`);
      }
      console.log('');
    }
  }
  
  if (command === 'info') {
    console.log(`📦 Package manager: ${result.manager}`);
    console.log(`📁 Path: ${result.path}`);
    console.log(`📊 Outdated: ${result.outdated?.length || 0}`);
    console.log(`🔒 Vulnerabilities: ${result.vulnerable || 0}`);
  }
  
  // Exit with status
  if (result.vulnerable > 0) process.exit(2);
  if (result.outdated?.length > 0) process.exit(1);
  process.exit(0);
}

main();
