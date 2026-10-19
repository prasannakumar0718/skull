---
name: agent-app-forge
description: AI coding-agent infrastructure connecting reverse-engineering investigation with declarative web application generation, autonomous self-repair, and Model Context Protocol (MCP) tooling.
---

# Agent App Forge Skill

Use this skill when you need to:
1. Reverse-engineer an existing software reference, database, or API (`forge_inspect_reference` or `forge inspect <path>`).
2. Generate a full-stack web application from a prompt (`forge_create_spec` + `forge_generate_app` or `forge create <prompt>`).
3. Recreate an entire reference application with behavioral comparison (`forge_recreate_app` or `forge recreate <prompt> --target <path>`).
4. Perform bounded verification and autonomous self-repair on an application (`forge_verify_app` or `forge verify <path>`).
5. Access the 207 upstream REA analysis tools (`rea_<tool>` or `forge_rea_tool`).

## Core Principles
- Universal Node applications must run with zero runtime dependencies on native Node.js 22+.
- Databases use native `node:sqlite` in WAL journal mode.
- Verification is strictly bounded (timeout: 10000ms).
- Findings are tagged with strict provenance (`observed`, `inferred`, `user_requested`, `unknown`).
