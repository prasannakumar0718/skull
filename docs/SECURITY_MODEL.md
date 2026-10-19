# Agent App Forge — Security Model & Trust Boundaries

## 1. Threat Model & Boundaries
When AI coding agents automatically investigate existing software and generate new software, strict boundaries are required to prevent data leakage, unauthorized code execution, and system tampering.

### 1.1 Source Repository Immutability
- Upstream repositories (`wasp/` and `rea/`) are treated as **strictly read-only**.
- Forge file generators and compilers are path-confined. Absolute path resolution verifies that any write target is strictly within the user's allocated project workspace (`agent-app-forge/` or designated output paths).

### 1.2 Path Traversal & Command Injection Prevention
- All user-supplied directory and file paths are sanitized and resolved using strict canonical paths (`path.resolve`, `path.normalize`).
- Path traversal sequences (`..`, hidden directory escapes) are rejected with explicit validation errors.
- External process execution (`child_process.spawn`) uses explicit argument arrays rather than raw shell strings (`shell: false`) to eliminate command injection vectors.

### 1.3 Secret & Credential Sanitization
- Neither Agent App Forge nor its generated applications log, emit, or commit API keys, database credentials, or `.env` secrets.
- Environment variables are isolated; mock or local-only configurations (e.g. `sqlite:./dev.db`) are used by default.

### 1.4 REA Analysis Permissions & Ethical Boundaries
- REA analysis is restricted to authorized local binaries, bundles, or test targets.
- Dynamic instrumentation (Frida, GDB, network capture) requires explicit user approval flags and is never triggered automatically without confirmation.

### 1.5 Licensing & Third-Party Attribution
- Wasp is licensed under MIT.
- REA is licensed under MIT.
- Generated applications retain all required open-source notices in `THIRD_PARTY_NOTICES.md` and `LICENSE`.
