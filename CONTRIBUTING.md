# Contributing to Agent App Forge

Thank you for your interest in contributing to **Agent App Forge**!

Agent App Forge is an open-source, agent-agnostic infrastructure connecting reverse-engineering investigation (REA) with declarative full-stack web application synthesis (Wasp & Universal Node) and autonomous self-repair.

---

## 🛠️ Development Setup

### Prerequisites
- **Node.js**: `v22.13.0` or higher (`v24.19.0` recommended) with native `node:sqlite`.
- **Git**: Recent version.
- **Platform**: Windows, macOS, or Linux.

### Getting Started
```bash
# 1. Clone the repository
git clone https://github.com/prasannakumar0718/skull.git
cd agent-app-forge

# 2. Install dev dependencies
npm install

# 3. Build TypeScript
npm run build

# 4. Run automated test suite
npm test

# 5. Check environment status
node bin/forge.js doctor
```

---

## 📐 Architecture & Principles

1. **Zero Upstream Modifications**: Upstream repositories (Wasp and REA) are tracked dependencies, not embedded forks. Do not modify upstream files.
2. **Zero Capability Loss**: Preserve all greenfield generation, 207-tool REA discovery, native delegation, and 214 MCP tools.
3. **Zero External Runtime Dependencies for Universal Node**: Generated Node applications must run using native Node.js standard libraries (`node:http`, `node:sqlite`, `node:fs`).
4. **Bounded Execution**: All verifier and test child processes must have explicit timeouts (max 10 seconds).
5. **Strict Provenance**: Always tag extracted features and workflows (`observed`, `inferred`, `user_requested`, `unknown`).

---

## 🧪 Testing Guidelines

Before submitting any Pull Request:
1. Ensure all 15 test suites pass:
   ```bash
   npm test
   ```
2. Verify TypeScript compiles with zero errors:
   ```bash
   npm run build
   ```
3. If adding a new feature or command, add a corresponding integration test in `tests/`.
4. Ensure tests do not leak background child processes or leave temporary test databases uncleaned.

---

## 📜 Pull Request Process

1. Create a feature branch from `master` (`git checkout -b feat/my-feature`).
2. Make minimal, focused commits with Conventional Commit messages (`feat:`, `fix:`, `docs:`, `test:`).
3. Verify git diff to ensure no local paths or secrets are included.
4. Open a Pull Request with a clear description and reproduction steps.
