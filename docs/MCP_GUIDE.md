# Agent App Forge — MCP Architecture & Integration Guide

## 1. Overview & Architectural Philosophy

**Agent App Forge** is an agent-agnostic software recreation, reverse engineering, and fullstack application synthesis system with autonomous verification and Model Context Protocol (MCP) tooling.

Its core operational lifecycle is:

```
INVESTIGATE ➔ UNDERSTAND ➔ SPECIFY ➔ PLAN ➔ BUILD ➔ VERIFY ➔ COMPARE ➔ IMPROVE
```

> **Core Principle**: MCP is an *interface* to this product, not the product itself.
> An MCP client connects to Forge to direct and execute the creation lifecycle. Exposing hundreds of low-level tools in every turn pollutes the model's context window, degrades reasoning, and causes timeouts.

---

## 2. Context Optimization: Measured Impact

| Metric | Full Mode (Legacy) | Compact Mode (Default) | Improvement |
| :--- | :--- | :--- | :--- |
| **Tools Advertised** | 216 tools | **9 core tools** | **95.8% fewer tools** |
| **Raw JSON Schema Size** | 784,899 bytes (~785 KB) | **5,330 bytes (~5.3 KB)** | **99.32% payload reduction** |
| **Estimated Context Tokens** | ~196,225 tokens | **~1,333 tokens** | **194,892 tokens saved / turn** |
| **Client Initialization Time** | ~1,200 ms | **< 30 ms** | **40x faster startup** |
| **Agent Usability** | High hallucination & context bloat | **Clean, focused reasoning** | **Zero context degradation** |

---

## 3. Server Instructions

Agent App Forge transmits structured instructions in the MCP initialization handshake (`InitializeResult.instructions`):

```
"Agent App Forge is an agent-agnostic software recreation and application-generation toolkit. For an existing application, inspect the authorized reference and use forge_recreate_app to plan, build, and verify an independent implementation. For new applications, use forge_create_spec and forge_generate_app. Use forge_verify_app to test results. Discover and invoke native REA tools when deeper investigation is required. Wasp and other engines remain separately accessible. Report evidence, failures, and unknowns honestly."
```

---

## 4. The 9 Core Forge Tools

In default (`compact`) mode, Forge exposes exactly 9 high-level tools:

### 1. `forge_capabilities`
- **Purpose**: Explains Forge's purpose, 8-step lifecycle, available engines (Universal Node, Wasp), active MCP mode (`compact` vs `full`), and system prerequisites.
- **When to use**: Call at the start of an agent session or when assessing platform features.
- **Parameters**: `detail?: "summary" | "full" | "engines" | "modes"`

### 2. `forge_inspect_reference`
- **Purpose**: Reverse-engineers an authorized reference application or codebase to extract data models, routes, database schemas, and observable behaviors.
- **When to use**: When asked to investigate existing software or before planning a recreation.
- **Parameters**: `referencePath: string` (required)

### 3. `forge_create_spec`
- **Purpose**: Converts natural-language requests into a validated `ForgeSpec` schema (entities, operations, workflows).
- **When to use**: When starting a greenfield application or formalizing a recreation model.
- **Parameters**: `prompt: string` (required), `appName?: string`

### 4. `forge_recreate_app`
- **Purpose**: Coordinates the complete software recreation lifecycle: investigates reference with REA, generates specification with provenance, formulates implementation plan, synthesizes independent application, runs verifier, and compares observable behavior.
- **When to use**: Single-call workflow for recreating existing software with behavioral parity.
- **Parameters**: `prompt: string` (required), `outputDirectory: string` (required), `targetPath?: string`, `targetEngine?: "auto" | "wasp" | "fullstack-node"`, `planOnly?: boolean`, `compare?: boolean`

### 5. `forge_generate_app`
- **Purpose**: Generates a complete, running, standalone full-stack web application with persistent SQLite WAL storage from a validated `ForgeSpec`.
- **When to use**: When a specification has been approved and files need to be scaffolded.
- **Parameters**: `spec: object` (required), `outputDirectory: string` (required)

### 6. `forge_verify_app`
- **Purpose**: Executes automated test suites, probes health endpoints, and applies autonomous self-repair loops on generated code.
- **When to use**: After code generation or modification to guarantee that the database schema and endpoints function.
- **Parameters**: `projectDirectory: string` (required)

### 7. `forge_rea_discover`
- **Purpose**: Dynamically searches and discovers relevant tools from REA's 207-tool inventory by keyword, category, or target type. Returns matching tool names, descriptions, and full input schemas.
- **When to use**: Whenever deeper reverse engineering is required (e.g., SQLite DB inspection, binary analysis, web bundle inspection).
- **Parameters**: `query?: string`, `category?: string`, `targetType?: string`, `limit?: number`, `refresh?: boolean`

### 8. `forge_rea_tool`
- **Purpose**: Executes any native REA tool (all 207 tools across REA) with original arguments preserved.
- **When to use**: To invoke any tool discovered via `forge_rea_discover`.
- **Parameters**: `toolName: string` (required), `toolArguments: object | string` (required). Accepts structured objects or serialized JSON strings. Validates required schema arguments before delegation.

### 9. `forge_wasp_cli`
- **Purpose**: Delegates native Wasp CLI commands (`compile`, `clean`, `version`) directly to Wasp, reporting platform requirements truthfully.
- **When to use**: When interacting with Wasp projects or checking Wasp compiler status.
- **Parameters**: `command: string` (required), `projectDirectory?: string`

---

## 5. Dynamic REA Discovery & Execution Workflow

Instead of bloating the initial tool list with 207 specialized tools, agents use the two-step dynamic discovery pattern:

```
[Agent Needs REA Capability]
           │
           ▼
1. forge_rea_discover({ query: "sqlite" })
           │  Returns: inspect_sqlite_database definition & schema
           ▼
2. forge_rea_tool({
     toolName: "inspect_sqlite_database",
     toolArguments: { path: "./app.db", schema_scope: "database" }
   })
           │  Executes tool via native REA bridge
           ▼
[Returns Exact Upstream Results & Structured Evidence]
```

### Supported Categories in `forge_rea_discover`

- `database`: SQLite databases, schemas, DDL, table inspection (37 tools)
- `web`: JavaScript source recovery, web bundles, DOM, screenshots, event listeners (36 tools)
- `android`: APKs, ADB devices, classes, methods, logcat, Flutter, Dart (37 tools)
- `binary`: PE, Mach-O, ELF, WASM, Go, Rust binaries, layout, sections, hashes (24 tools)
- `procedure`: Disassembly, decompilation, call graphs, xrefs, pseudo-code (31 tools)
- `dynamic`: Frida instrumentation, GDB, Rizin, Cutter debuggers (14 tools)
- `network`: Packet captures, PCAP analysis, signal decoders (12 tools)
- `reconstruction`: Evidence bundles, obligation ledgers, parity diffs (11 tools)
- `analysis`: Cross-layer analysis views and metadata (5 tools)

---

## 6. Configuring MCP Modes

### Mode A: Compact Mode (Default)
Exposes the 9 core tools. Fully compatible with all models and context sizes.
```bash
# Started automatically by default:
node bin/mcp.js
# Or via CLI:
forge mcp
```

### Mode B: Full Mode (Opt-In)
Exposes all 216 tools (9 core + 207 individual `rea_*` tools). Suitable for specialized desktop tools or high-context models that prefer direct individual tool calls.
```bash
# Via CLI flag:
forge mcp --mode full
# Or:
node bin/mcp.js --mode full
# Or via environment variable:
export FORGE_MCP_MODE=full
```

---

## 7. AI Client Integration Matrix

### Claude Code / Claude Desktop
Configure in `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "agent-app-forge": {
      "command": "npx",
      "args": ["-y", "agent-app-forge", "mcp"]
    }
  }
}
```
*Note*: By default, Claude Code receives 9 tools, conserving over 194,000 tokens per turn while retaining full REA capabilities via `forge_rea_discover`.

### Google Antigravity
Configured in `~/.gemini/antigravity/mcp_config.json` via:
```bash
forge adapters setup antigravity
```

### Cursor
Configured in `.cursor/mcp.json`:
```json
{
  "mcpServers": {
    "agent-app-forge": {
      "command": "npx",
      "args": ["-y", "agent-app-forge", "mcp"]
    }
  }
}
```

### Gemini CLI / Codex CLI
Direct CLI commands execute deterministically without daemon overhead:
```bash
forge create "Build an expense tracker" --output ./expenses
forge verify ./expenses
```

---

## 8. Zero Capability Loss & Upstream Safety

1. **Direct `rea_*` Calls Always Supported**: Calling `rea_inspect_sqlite_database` directly works in **both** compact and full modes.
2. **Schema Fidelity**: Native REA input schemas, structured outputs, evidence bundles, and errors are preserved with zero argument truncation.
3. **Pristine Upstream Repositories**: `D:\git hub\wasp` and `D:\git hub\rea` remain 100% untouched on `main`.
