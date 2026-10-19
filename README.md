# Agent App Forge

> AI coding-agent infrastructure connecting reverse-engineering investigation with declarative web application generation, autonomous self-repair, and Model Context Protocol (MCP) tooling.

---

## 🌟 Overview

Agent App Forge is an independent orchestration layer integrating two core capabilities:
* **Investigation Engine (REA Bridge):** Extracts schemas, database models, and route endpoints from reference codebases.
* **Synthesis Engine (Wasp & Universal Node):** Generates runnable full-stack web applications with persistent SQLite storage and interactive UIs.
* **Autonomous Verifier & Self-Repair:** Executes bounded checks (`timeout: 10000`), diagnoses root causes, repairs missing databases, and probes live HTTP servers.
* **Model Context Protocol (MCP) Server:** Exposes standard protocol tools for AI pair programmers (Claude, Cursor, Antigravity, OpenCode).
* **CLI Utility:** Provides immediate developer-facing commands for specification generation, code synthesis, investigation, and verification.

---

## 📊 Capability & Verification Status

In accordance with strict verification rules, all capabilities are classified with their genuine implementation and environment status:

| Feature / Subsystem | Status | Description & Prerequisites |
| :--- | :--- | :--- |
| **Model Context Protocol (MCP)** | **Implemented & Verified** | Full MCP lifecycle, capability negotiation, tool listing, schema checks, and Stdio transport purity tested via `@modelcontextprotocol/sdk`. |
| **Universal Node Engine** | **Implemented & Verified** | Generates zero-dependency Node.js HTTP servers with native SQLite (`node:sqlite` WAL mode) and responsive web frontends. Runs on Windows, macOS, and Linux without `npm install`. |
| **Autonomous Verifier** | **Implemented & Verified** | Bounded test execution (`execFile`), error classification, automatic SQLite schema self-repair, and live HTTP health check probes (`GET /api/health`). |
| **Specification Engine** | **Implemented & Verified** | Parses natural-language prompts across Task, Financial, E-Commerce, Blog, and Generic domains with inferred assumptions metadata and strict Zod validation. |
| **Native Source Parser** | **Implemented & Verified** | Forge's built-in heuristic AST parser extracts Prisma models, SQL `CREATE TABLE` DDL, and controller route functions. |
| **Wasp Application Generation** | **Emitted & Conforming** | Emits complete Wasp 0.26.1 file hierarchy (`main.wasp.ts`, `schema.prisma`, `package.json`, `tsconfig.json`, `.env.server`, React pages, operations). |
| **Wasp CLI Execution** | **Platform Dependent** | Wasp CLI officially requires Linux, macOS, or WSL. On native Windows without WSL, Forge automatically selects Universal Node Engine and provides clear WSL instructions for Wasp. |
| **Live REA CLI / MCP Tools** | **Probed & Supported** | If REA CLI is installed in PATH or repository is built, Forge delegates deep analysis to REA. If unbuilt, Forge gracefully degrades to `forge-source-parser`. |
| **Native Binary Disassembly** | **Unsupported in Fallback** | Disassembly of Mach-O/ELF/PE binaries requires native REA providers (Hopper, Ghidra, Cutter). The fallback parser truthfully reports this as unavailable. |

---

## 🚀 Quick Start

### 1. Installation & Build
```bash
cd agent-app-forge
npm install
npm run build
npm test
```

### 2. Using the CLI

#### Create an Application from a Prompt
```bash
node bin/forge.js create "Build a task manager with persistent storage" --output ./my-task-app
```

#### Inspect an Existing Codebase for Schemas & Endpoints
```bash
node bin/forge.js inspect ./reference-project
```

#### Verify & Self-Repair an Application
```bash
node bin/forge.js verify ./my-task-app
```

---

## 🤖 Model Context Protocol (MCP) Configuration

Configure Agent App Forge in your agent's MCP settings (`claude_desktop_config.json`, Antigravity, or Cursor):

```json
{
  "mcpServers": {
    "agent-app-forge": {
      "command": "node",
      "args": ["d:/git hub/agent-app-forge/bin/mcp.js"]
    }
  }
}
```

### Available MCP Tools:
- `forge_inspect_reference`: Analyzes schemas and endpoints in reference codebases using REA or Forge's native parser.
- `forge_create_spec`: Converts natural-language requests into validated, editable `ForgeSpec` JSON with domain metadata.
- `forge_generate_app`: Scaffolds full-stack web applications into a specified directory.
- `forge_verify_app`: Runs bounded test suites and applies autonomous self-repair.

---

## 🧪 Test Suites

Agent App Forge contains 32 automated tests across 7 specialized suites:

```bash
# Run the complete test suite
npm test

# Run individual suites
npx vitest run tests/spec.test.ts            # Domain inference and schema validation
npx vitest run tests/mcp.integration.test.ts  # Real MCP Client protocol & Stdio purity
npx vitest run tests/reaBridge.test.ts        # REA status probing & graceful degradation
npx vitest run tests/waspEngine.test.ts       # Wasp 0.26.1 specification compliance
npx vitest run tests/verifier.test.ts         # Fault injection, timeouts, SQLite repair
npx vitest run tests/e2e.test.ts              # End-to-end CRUD & restart persistence
npx vitest run tests/forge.test.ts            # Path traversal prevention & orchestration
```

---

## 📑 Formal Audit Reports

Comprehensive architectural audits are available in `docs/audits/`:
- [`docs/audits/BASELINE.md`](docs/audits/BASELINE.md): Repository baseline, git remotes, and initial environment state.
- [`docs/audits/MCP_COMPATIBILITY.md`](docs/audits/MCP_COMPATIBILITY.md): Protocol verification via `@modelcontextprotocol/sdk`.
- [`docs/audits/REA_INTEGRATION.md`](docs/audits/REA_INTEGRATION.md): REA capability probing and provenance guarantees.
- [`docs/audits/WASP_GENERATION.md`](docs/audits/WASP_GENERATION.md): Wasp 0.26.1 specification and platform prerequisites.
- [`docs/audits/SECURITY_REVIEW.md`](docs/audits/SECURITY_REVIEW.md): Sandbox boundaries, path traversal, and shell injection mitigations.
- [`docs/audits/END_TO_END_RESULTS.md`](docs/audits/END_TO_END_RESULTS.md): Step-by-step transcript of MVP synthesis, verification, and persistence across cold restart.
- [`docs/audits/EXECUTIVE_SUMMARY.md`](docs/audits/EXECUTIVE_SUMMARY.md): Executive summary of findings and remediations.

---

## 📁 Repository Structure

```text
agent-app-forge/
├── bin/
│   ├── forge.js           # Developer CLI executable
│   └── mcp.js             # Stdio MCP server executable
├── docs/
│   ├── ARCHITECTURE.md    # System architecture & orchestrator design
│   ├── INTEGRATION_PLAN.md# Wasp & REA integration strategy
│   ├── SECURITY_MODEL.md  # Security boundary specification
│   ├── audits/            # 7 Phase-by-phase formal audit reports
│   └── research/
│       └── SOURCE_ANALYSIS.md # Upstream source analysis of Wasp and REA
├── src/
│   ├── cli/               # Commander CLI implementation
│   ├── engines/           # WaspEngine & UniversalNodeEngine orchestrator
│   ├── investigation/     # REA investigation bridge & native source parser
│   ├── mcp/               # Model Context Protocol stdio server implementation
│   ├── spec/              # Zod validation schemas & prompt parser
│   └── verifier/          # Autonomous test runner, self-repair & HTTP probe
└── tests/
    ├── e2e.test.ts        # End-to-end MVP persistence verification
    ├── forge.test.ts      # Core orchestration & security boundaries
    ├── mcp.integration.test.ts # Real MCP protocol tests
    ├── reaBridge.test.ts  # REA probing & source parser tests
    ├── spec.test.ts       # Domain inference & schema validation tests
    ├── verifier.test.ts   # Fault injection & timeout verification
    └── waspEngine.test.ts # Wasp 0.26.1 specification compliance tests
```

---

## 📜 License
MIT © Agent App Forge Contributors.  
Upstream notices preserved for Wasp (MIT) and REA (MIT).
