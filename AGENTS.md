# AGENTS.md — Agent App Forge Developer & Runtime Guide

## Project Identity
**Agent App Forge** connects reverse-engineering investigation (via REA) with declarative web application generation (via Wasp and cross-platform full-stack engines) into a unified, agentic self-healing pipeline.

## Capabilities for AI Coding Agents
1. **Investigation (`forge inspect <target>` / `forge_inspect_reference`)**:
   - Analyzes existing software repositories, schemas (`.prisma`, `.sql`), and route patterns.
   - Extracts candidate entity models and operation signatures.
2. **Specification (`forge spec <prompt>` / `forge_create_spec`)**:
   - Converts natural language requirements into strongly-validated `ForgeSpec` schemas.
3. **Application Synthesis (`forge create <prompt-or-spec>` / `forge_generate_app`)**:
   - Automatically selects appropriate engine (`wasp` or `fullstack-node`).
   - Scaffolds complete frontend, backend, persistent storage, and tests into the designated directory.
4. **Verification & Self-Repair (`forge verify <dir>` / `forge_verify_app`)**:
   - Runs automated tests, detects structural or runtime issues, applies targeted self-healing, and verifies green status.

## Development Workflows
- **Build**: `npm run build` (runs `tsc` -> `dist/`)
- **Unit Tests**: `npm test` (Vitest test suite)
- **MCP Server**: `node bin/mcp.js` (stdio JSON-RPC transport for Claude Code, Cursor, Codex, Antigravity)
- **CLI Commands**: `node bin/forge.js --help`
