# Claude Code Instructions for Agent App Forge

When working with or generating applications using **Agent App Forge**:

1. **Tool Invocation via MCP (Compact-by-Default)**:
   - Agent App Forge provides 9 core tools (<6 KB schema, saving >194,000 tokens of context per turn):
     - `forge_capabilities`: Check Forge purpose, workflow, engines, and prerequisites.
     - `forge_inspect_reference`: Reverse-engineering reference codebases.
     - `forge_create_spec`: Converting user requests to `ForgeSpec` JSON.
     - `forge_recreate_app`: Autonomous investigation -> spec -> plan -> build -> verify -> compare loop.
     - `forge_generate_app`: Scaffolding full-stack applications with persistent SQLite storage.
     - `forge_verify_app`: Bounded verification and autonomous self-repair.
     - `forge_rea_discover`: Search and discover any of REA's 207 native analysis tools by query or category.
     - `forge_rea_tool`: Universal executor for all 207 upstream REA tools (accepts objects or serialized JSON strings).
     - `forge_wasp_cli`: Direct delegation to Wasp CLI.
   - All 207 REA tools can also be called directly via `rea_<tool_name>` or pre-exposed using `--mode full`.

2. **Dynamic REA Investigation Pattern**:
   - For specialized investigation (e.g. SQLite databases, binary structures, or web bundles):
     1. Search for tools: `forge_rea_discover({ query: "sqlite" })` or `forge_rea_discover({ category: "web" })`.
     2. Call the tool: `forge_rea_tool({ toolName: "inspect_sqlite_database", toolArguments: { path: "...", schema_scope: "database" } })`.

3. **CLI Commands**:
   - System diagnosis: `forge doctor`
   - Capability inventory: `forge capabilities --json`
   - Agent adapters: `forge adapters list` and `forge adapters setup <client>`
   - Recreation: `forge recreate "<prompt>" --target <dir> --output <dir>`
   - Verification: `forge verify <dir>`

4. **Application Synthesis Standards**:
   - Universal Node Engine apps have zero runtime `npm` dependencies.
   - Use built-in `node:http` and `node:sqlite` in WAL mode (`journal_mode = WAL`).
   - All client UIs must include active document/item selection, real-time status indicators, and responsive CSS.
   - Preserve strict provenance tags (`observed`, `inferred`, `user_requested`, `unknown`).
