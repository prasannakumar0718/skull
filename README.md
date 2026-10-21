# Agent App Forge

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D22.13.0-brightgreen.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![MCP Protocol](https://img.shields.io/badge/MCP-1.6.1-blue.svg)](https://modelcontextprotocol.io/)
[![Release](https://img.shields.io/badge/Release-v0.1.1-blue.svg)](https://github.com/prasannakumar0718/skull)
[![REA Parity](https://img.shields.io/badge/REA%20Tools-207%2F207%20Parity-success.svg)](https://github.com/prasannakumar0718/skull)
[![Tests](https://img.shields.io/badge/Tests-143%2F143%20Passing-brightgreen.svg)](https://github.com/prasannakumar0718/skull)

> **Agent-agnostic software recreation, reverse-engineering analysis, and declarative full-stack application synthesis system with autonomous verification and Model Context Protocol (MCP) tooling.**

---

## 🌟 What is Agent App Forge?

Agent App Forge is an open-source orchestration layer that connects:
1. **Reverse-Engineering Analysis ([REA](https://github.com/agent-app-forge)):** Deeply investigates existing software, binaries, APIs, and databases across 207 native REA analysis tools.
2. **Declarative Synthesis Engine ([Wasp](https://wasp.sh) & Universal Node):** Generates clean, independent full-stack web applications with high-performance SQLite WAL storage, responsive UIs, and zero external runtime npm dependencies.
3. **Autonomous Verification & Bounded Self-Repair:** Executes isolated test pipelines, detects syntax and database failures, and automatically reconstructs corrupted code from the specification model.
4. **Context-Optimized MCP Interface:** Exposes **9 high-level core orchestration and discovery tools** by default (<6 KB schema, saving over 194,000 tokens / 99.32% per turn), with on-demand dynamic discovery across all 207 REA analysis tools. Full individual-tool exposure remains available via `--mode full`.

---

## 🚀 Quick Start

### Prerequisites
- **Node.js**: `v22.13.0` or higher (`v24.19.0` recommended) with native `node:sqlite`.
- **Git**: Recent version.
- **Operating System**: Windows, macOS, or Linux.

### Installation Options

#### Option A: Run Instantly via `npx` (No Global Install)
```bash
# Check system health
npx agent-app-forge doctor

# View complete capabilities inventory
npx agent-app-forge capabilities

# Start MCP server
npx agent-app-forge mcp
```

#### Option B: Install Globally via `npm`
```bash
npm install -g agent-app-forge
forge doctor
forge capabilities
```

#### Option C: Install from Source
```bash
git clone https://github.com/prasannakumar0718/skull.git
cd agent-app-forge
npm install
npm run build
npm test
npm link
```

---

## 🛠️ Standalone CLI Commands

Agent App Forge provides an intuitive, robust CLI that works independently of any specific editor or IDE:

```bash
# 1. Check system prerequisites & runtime readiness
forge doctor

# 2. View comprehensive capabilities, engines, and tool inventories
forge capabilities
forge capabilities --json

# 3. Manage AI coding agent adapters
forge adapters list
forge adapters doctor
forge adapters setup claude-code --dry-run
forge adapters setup cursor

# 4. Recreate software from an existing reference target
forge recreate "Recreate Document Studio with rich-text editing, autosave, and export" \
  --target ./fixtures/reference-document-app \
  --output ./my-recreated-app \
  --engine fullstack-node

# 5. Greenfield application generation from natural language
forge create "Build an inventory tracker with tags and quantities" --output ./my-inventory-app

# 6. Inspect an existing codebase or SQLite database
forge inspect ./fixtures/reference-document-app

# 7. Autonomous verification & self-repair loop
forge verify ./my-recreated-app

# 8. Native upstream CLI delegation
forge wasp --version
forge rea --help
```

---

## 🤖 Model Context Protocol (MCP) Server

Agent App Forge includes a standard-compliant MCP server that connects seamlessly to any MCP-compatible coding agent.

### Setup Your Preferred Agent

Run the automated adapter setup:
```bash
forge adapters setup claude-code
forge adapters setup cursor
forge adapters setup cline
forge adapters setup roo-code
forge adapters setup windsurf
forge adapters setup opencode
```

Or configure manually in your agent's MCP settings:

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

### Core MCP Tools (Compact Default)

Forge exposes 9 high-level tools designed to guide AI agents through the creation lifecycle without consuming context:

| Tool Name | Type | Purpose |
| :--- | :--- | :--- |
| `forge_capabilities` | Diagnostics | Explains Forge's purpose, 8-step workflow, engines, modes, and system prerequisites. |
| `forge_inspect_reference` | Investigation | Probes codebases for database schemas, route endpoints, and cryptographic file hashes. |
| `forge_create_spec` | Specification | Converts natural language requests into validated `ForgeSpec` models. |
| `forge_recreate_app` | Orchestration | Executes the complete Investigate $\rightarrow$ Specify $\rightarrow$ Plan $\rightarrow$ Build $\rightarrow$ Run $\rightarrow$ Compare $\rightarrow$ Repair lifecycle. |
| `forge_generate_app` | Synthesis | Scaffolds running full-stack applications with persistent SQLite WAL storage. |
| `forge_verify_app` | Verification | Executes bounded test suites and applies autonomous self-repairs. |
| `forge_rea_discover` | Discovery | Searches and discovers any of REA's 207 native tools by keyword or category. |
| `forge_rea_tool` | Execution | Universal executor for any native REA tool (accepts objects or serialized JSON strings). |
| `forge_wasp_cli` | Delegation | Direct pass-through to Wasp CLI with platform guidance. |

### Dynamic REA Discovery vs. Full Mode

- **Default (`compact`) Mode**: The agent receives the 9 tools above (~1,333 tokens). When it needs deep reverse engineering, it calls `forge_rea_discover({ query: "sqlite" })` to retrieve the exact schema and invokes it via `forge_rea_tool`.
- **Advanced (`full`) Mode**: Exposes all 216 tools (9 core + 207 individual `rea_<tool_name>` tools) directly in the tool list. Run with:
  ```bash
  forge mcp --mode full
  # or set FORGE_MCP_MODE=full
  ```

---

## 🌐 AI Model & Provider Independence

Agent App Forge is **model-agnostic** and **vendor-neutral**:
- **Decoupled Reasoning**: The reasoning loop lives in your AI coding client; Forge provides deterministic tools and local execution.
- **Zero API Key Requirements in Forge**: No model API keys are required by Agent App Forge.
- **OpenRouter Supported**: Compatible with any model routed through OpenRouter (Claude 3.7, DeepSeek R1, GPT-4o, Llama 3.3). See [docs/MODEL_PROVIDERS.md](docs/MODEL_PROVIDERS.md).

---

## 📱 AI Coding Client Compatibility Matrix

| Client | Category | Status | Supported Interface |
| :--- | :--- | :--- | :--- |
| **Google Antigravity** | IDE / Autonomous Agent | **end-to-end verified** | MCP stdio + CLI execution + Skills |
| **Claude Code / Desktop** | CLI / Desktop Agent | **protocol-tested** | MCP stdio transport |
| **Cursor** | AI Editor | **protocol-tested** | `.cursor/mcp.json` / Features MCP |
| **OpenCode** | Terminal Agent | **protocol-tested** | MCP stdio + Direct CLI execution |
| **VS Code / Copilot** | IDE Extension | **limited** | CLI task execution + Copilot MCP |
| **Cline** | Autonomous Agent | **configured** | `cline_mcp_settings.json` |
| **Roo Code** | Autonomous Agent | **configured** | `roo_mcp_settings.json` |
| **Windsurf** | AI Editor | **protocol-tested** | Cascade `mcp_config.json` |
| **Gemini CLI** | Terminal Agent | **protocol-tested** | Direct CLI + JSON stdout |
| **Codex CLI** | Terminal Agent | **protocol-tested** | Direct CLI subprocess invocation |

See [config/agent-compatibility.json](config/agent-compatibility.json) for machine-readable schemas.

---

## 🏛️ Architecture & Core Engines

```
┌─────────────────────────────────────────────────────────────┐
│                    AI CODING ASSISTANT                      │
│     (Antigravity, Claude Code, Cursor, Cline, Roo Code)     │
└──────────────┬───────────────────────────────▲──────────────┘
               │                               │
               │ MCP JSON-RPC (stdio)          │ Structured
               │ or CLI subprocess invocation   │ Evidence & AST
               ▼                               │
┌─────────────────────────────────────────────────────────────┐
│                      AGENT APP FORGE                        │
│                                                             │
│  ┌────────────────────────┐     ┌────────────────────────┐  │
│  │   Investigation & REA  │     │   Specification Engine │  │
│  │    (207 REA Tools)     │────►│   (ForgeSpec Schema)   │  │
│  └────────────────────────┘     └───────────┬────────────┘  │
│                                             │               │
│  ┌────────────────────────┐                 ▼               │
│  │  Autonomous Verifier   │     ┌────────────────────────┐  │
│  │   & Bounded Repair     │◄────│   Synthesis Engines    │  │
│  │ (node --check, tests)  │     │ (Universal Node, Wasp) │  │
│  └────────────────────────┘     └────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 1. Universal Node Full-Stack Engine
- Generates zero-dependency Node.js HTTP servers (`server.js`) with responsive web frontends.
- High-performance SQLite storage via native built-in `node:sqlite` in WAL mode.
- Built-in Document Studio with rich-text editing, debounced autosave, title renaming, Word `.doc` HTML export, and `@media print` PDF support.
- Runs natively on Windows, macOS, and Linux without `npm install`.

### 2. Wasp Engine
- Emits complete Wasp 0.26.1 file hierarchies (`main.wasp.ts`, `schema.prisma`, React pages, queries, actions).
- Preserves 100% upstream Wasp specification compliance.

---

## 📄 Documentation

- [**Beginner's Quick-Start Guide**](docs/USER_QUICKSTART.md) ⭐
- [Release Notes v0.1.1](docs/releases/v0.1.1.md)
- [Capabilities & Inventory](docs/CAPABILITY_MATRIX.md)
- [Architecture & Design](docs/ARCHITECTURE.md)
- [Software Recreation Architecture](docs/RECREATION_ARCHITECTURE.md)
- [Controlled Recreation Acceptance Results](docs/RECREATION_ACCEPTANCE_RESULTS.md)
- [AI Model Providers & OpenRouter](docs/MODEL_PROVIDERS.md)
- [Release Readiness & Packaging Guide](docs/RELEASE_GUIDE.md)
- [Security Policy & Sandboxing](SECURITY.md)
- [Contributing Guidelines](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)

---

## 📜 License

Distributed under the [MIT License](LICENSE).
Upstream Wasp and REA repositories remain independent projects under their respective open-source licenses.
