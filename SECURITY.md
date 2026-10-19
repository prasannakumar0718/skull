# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

---

## Reporting a Vulnerability

We take the security of Agent App Forge seriously. If you believe you have found a security vulnerability in Agent App Forge, please do **NOT** report it publicly on GitHub issues.

Instead, please report security concerns via:
- GitHub Private Vulnerability Reporting (Security tab $\rightarrow$ Report a vulnerability)
- Or contact maintainers directly through designated project communication channels.

Please include:
- A description of the vulnerability.
- Steps to reproduce the issue or proof-of-concept code.
- Potential impact and affected components.

We will acknowledge receipt within 48 hours and work with you to remediate and publish an advisory once resolved.

---

## Security Model & Sandboxing

Agent App Forge adheres to strict defensive security practices:
1. **Path Traversal Prevention**: Input paths are normalized, resolved, and verified to prevent arbitrary file system traversal outside active target directories.
2. **Process Sandboxing**: Generated applications are spawned in isolated child processes with strictly bounded timeouts (10,000ms max).
3. **Secret Redaction**: Verification and error logs pass through sanitization filters that redact API keys, Bearer tokens (`sk-`, `Bearer`), and sensitive authorization credentials.
4. **Clean Stdio Transport**: The MCP server guarantees 100% pure JSON-RPC transport across stdin/stdout, redirecting all diagnostic and REA logs to stderr or structured protocol notifications.
