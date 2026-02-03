# claw-deps

## Install

```bash
git clone https://github.com/julianthorne2jz/claw-deps
cd claw-deps
npm link
```

Now you can use `claw-deps` from anywhere.


Dependency checker for AI agents. Check for outdated and vulnerable packages across multiple ecosystems.

## Features

- **Multi-ecosystem support**: npm, yarn, pnpm, bun, pip, pipenv, poetry, go, cargo
- **Security audits**: Check for known vulnerabilities
- **Quick summaries**: Emoji status indicators (✅/⚠️) for fast scanning
- **JSON output**: Perfect for automation and CI pipelines
- **Exit codes**: 0=ok, 1=outdated, 2=vulnerabilities

## Installation

```bash
npm install -g claw-deps
# or
npx claw-deps
```

## Usage

```bash
# Check current directory
claw-deps

# Check specific project
claw-deps check ./my-project

# List outdated packages only
claw-deps outdated

# Security audit only
claw-deps audit

# JSON output (for scripts)
claw-deps --json

# Get project info
claw-deps info
```

## Commands

| Command | Description |
|---------|-------------|
| `check` | Check outdated + vulnerabilities (default) |
| `outdated` | List only outdated packages |
| `audit` | Security audit only |
| `info` | Show project dependency info |

## Options

| Option | Description |
|--------|-------------|
| `-j, --json` | Output as JSON |
| `-h, --help` | Show help |

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All dependencies up to date and secure |
| 1 | Outdated packages found |
| 2 | Security vulnerabilities found |

## Example Output

```
📦 Checking npm dependencies in /home/user/project

⚠️  3 outdated, 1 vulnerabilities

📋 Outdated packages:
   lodash: 4.17.20 → 4.17.21
   express: 4.17.1 → 4.18.2
   axios: 0.21.1 → 1.6.0

🔒 Security: 1 vulnerabilities found
   High: 1
```

## JSON Output

```json
{
  "manager": "npm",
  "outdated": [
    { "name": "lodash", "current": "4.17.20", "latest": "4.17.21" }
  ],
  "vulnerable": 1,
  "vulnerabilities": { "high": 1 },
  "summary": "⚠️  1 outdated, 1 vulnerabilities",
  "path": "/home/user/project"
}
```

## Supported Package Managers

| Ecosystem | Managers | Outdated | Security |
|-----------|----------|----------|----------|
| Node.js | npm, yarn, pnpm, bun | ✅ | ✅ `npm audit` |
| Python | pip, pipenv, poetry | ✅ | ✅ `pip-audit` |
| Go | go mod | ✅ | ❌ |
| Rust | cargo | ✅ | ✅ `cargo audit` |

## Use Cases

### CI Pipeline
```bash
claw-deps --json || exit 1
```

### Cron Job
```bash
claw-deps check /path/to/project | grep -q "⚠️" && notify "Dependencies need attention"
```

### Agent Automation
```javascript
const { execSync } = require('child_process');
const result = JSON.parse(execSync('claw-deps --json').toString());
if (result.vulnerable > 0) {
  console.log('Security issues detected!');
}
```

## License

MIT
