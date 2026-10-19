# GitHub Copilot Instructions for Agent App Forge (.github/copilot-instructions.md)

This project integrates with **Agent App Forge** (`agent-app-forge`) for AI-driven software recreation and declarative application synthesis.

When generating or refactoring code:
- Check system prerequisites with `forge doctor`.
- Review capabilities with `forge capabilities`.
- For application synthesis, use `forge create "<prompt>" --output <dir>` or the Universal Node Engine (`fullstack-node`).
- Always verify generated apps with `forge verify <dir>`.
- Keep generated full-stack apps free of external runtime npm dependencies using native `node:http` and `node:sqlite`.
