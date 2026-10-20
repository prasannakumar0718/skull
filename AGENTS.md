# AGENTS.md — Agent App Forge Developer & Runtime Guide

## Project Identity & Primary Purpose

**Agent App Forge** is an agent-agnostic software recreation, reverse engineering, and fullstack application synthesis system with autonomous verification and Model Context Protocol (MCP) tooling.

**Core Workflow**:
```
INVESTIGATE ➔ UNDERSTAND ➔ SPECIFY ➔ PLAN ➔ BUILD ➔ VERIFY ➔ COMPARE ➔ IMPROVE
```

MCP is an interface to this product, not the product itself.

---

## MCP Architecture: Compact-by-Default

To protect AI agent context windows from catastrophic bloat (saving **194,892 tokens / 99.32% per turn**), Forge registers a compact 9-tool catalog by default, backed by on-demand dynamic REA tool discovery and execution.

### The 9 Core Tools

| Tool | When to Use |
| :--- | :--- |
| `forge_capabilities` | Call first to understand Forge's available engines, active mode (`compact` vs `full`), workflow, and system prerequisites. |
| `forge_inspect_reference` | Call to investigate an authorized reference codebase, directory, or SQLite DB using REA reverse engineering. |
| `forge_create_spec` | Call to convert a natural language request into a validated `ForgeSpec` schema (entities, operations, workflows). |
| `forge_recreate_app` | Call to run the integrated recreation lifecycle: investigate reference, plan, build, verify, and compare behavior. |
| `forge_generate_app` | Call to synthesize an independent full-stack web application with persistent SQLite WAL storage from an approved spec. |
| `forge_verify_app` | Call to execute automated test suites, probe health endpoints, and apply self-repair loops on generated code. |
| `forge_rea_discover` | Call to search and discover any of REA's 207 native analysis tools by query (e.g. `'sqlite'`, `'web'`) or category. |
| `forge_rea_tool` | Call to execute any native REA tool with original arguments preserved (accepts objects or serialized JSON strings). |
| `forge_wasp_cli` | Call to delegate supported native Wasp CLI commands (`version`, `clean`, `compile`), reporting platform diagnostics honestly. |

### Dynamic REA Discovery & Execution Workflow

When deeper investigation is needed (e.g. analyzing an SQLite database or decompiling a binary):
1. **Discover**: Call `forge_rea_discover({ query: "sqlite" })` or `forge_rea_discover({ category: "database" })`.
2. **Review Schema**: Inspect the returned exact tool name, parameters, and input schema.
3. **Execute**: Call `forge_rea_tool({ toolName: "inspect_sqlite_database", toolArguments: { path: "app.db", schema_scope: "database" } })`.
4. *Direct Access*: Direct calls to `rea_<tool_name>` (e.g. `rea_inspect_sqlite_database`) are also fully supported even in compact mode.

---

## MCP Modes

- **`compact` (Default)**: 9 core tools exposed (<6 KB payload, ~1,333 tokens). Full 207 REA tools accessible via `forge_rea_discover` and `forge_rea_tool`.
- **`full` (Opt-In)**: All 216 tools exposed directly (9 core + 207 `rea_*` tools, ~785 KB payload, ~196,000 tokens). Activated via `--mode full`, `--full`, or `FORGE_MCP_MODE=full`.

---

## Development Workflows

- **Build**: `npm run build` (compiles TypeScript to `dist/` and syncs REA catalog)
- **Run Full Test Suite**: `npm test`
- **Run Standalone CLI**: `node bin/forge.js --help`
- **Start MCP Server (Compact)**: `node bin/mcp.js`
- **Start MCP Server (Full)**: `node bin/mcp.js --mode full`
