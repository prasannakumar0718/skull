# Claude Code Instructions for Agent App Forge

When working with or generating applications using **Agent App Forge**:

1. **Tool Invocation via MCP**:
   - Agent App Forge provides 7 orchestration tools:
     - `forge_recreate_app`: Autonomous investigation -> spec -> plan -> build -> verify -> compare loop.
     - `forge_inspect_reference`: Reverse-engineering reference codebases.
     - `forge_create_spec`: Converting user requests to `ForgeSpec` JSON.
     - `forge_generate_app`: Scaffolding full-stack applications.
     - `forge_verify_app`: Bounded verification and autonomous self-repair.
     - `forge_wasp_cli`: Direct delegation to Wasp CLI.
     - `forge_rea_tool`: Universal proxy for all 207 upstream REA tools.
   - All 207 REA tools are also available directly as `rea_<tool_name>`.

2. **CLI Commands**:
   - System diagnosis: `forge doctor`
   - Capability inventory: `forge capabilities --json`
   - Agent adapters: `forge adapters list` and `forge adapters setup <client>`
   - Recreation: `forge recreate "<prompt>" --target <dir> --output <dir>`
   - Verification: `forge verify <dir>`

3. **Application Synthesis Standards**:
   - Universal Node Engine apps have zero runtime `npm` dependencies.
   - Use built-in `node:http` and `node:sqlite` in WAL mode (`journal_mode = WAL`).
   - All client UIs must include active document/item selection, real-time status indicators, and responsive CSS.
   - Preserve strict provenance tags (`observed`, `inferred`, `user_requested`, `unknown`).
