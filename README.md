# Agent App Forge

> AI coding-agent infrastructure connecting reverse-engineering investigation with declarative web application generation, autonomous self-repair, upstream capability preservation, and Model Context Protocol (MCP) tooling.

---

## 🌟 Overview

Agent App Forge is an independent orchestration layer integrating two core capabilities:
* **Investigation Engine (REA Bridge):** Extracts schemas, database models, and route endpoints from reference codebases, with native delegation to upstream REA tools (`inspect_artifact`, `analyze_function`, `compare_artifacts`, `get_call_graph`, `get_evidence_bundle`).
* **Synthesis Engine (Wasp & Universal Node):** Generates runnable full-stack web applications with persistent SQLite storage and interactive UIs, with strict preservation of Wasp 0.26.1 application specifications.
* **Autonomous Verifier & Self-Repair:** Executes bounded checks (`timeout: 10000`), diagnoses root causes, repairs missing databases, and probes live HTTP servers.
* **Model Context Protocol (MCP) Server:** Exposes 6 standard protocol tools for AI pair programmers (Claude, Cursor, Antigravity, OpenCode, VS Code, Cline, Roo Code, Windsurf, Codex, Gemini).
* **CLI Utility & Upstream Pass-Through:** Provides immediate developer-facing commands for specification generation, code synthesis, investigation, verification, system diagnostics (`forge doctor`), and direct pass-through to Wasp (`forge wasp`) and REA (`forge rea`).

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
| **Wasp CLI Execution & Delegation** | **Platform Dependent** | Wasp CLI officially requires Linux, macOS, or WSL. `forge wasp <args>` delegates directly if `wasp` is installed, or provides exact WSL execution commands on native Windows. |
| **Live REA CLI / MCP Tools Delegation** | **Probed & Supported** | `forge rea <args>` and `forge_rea_tool` delegate deep analysis directly to REA CLI or MCP server when built, and provide actionable build instructions when unbuilt. |
| **Universal Agent Compatibility** | **Tested Across 10 Clients** | Machine-readable registry in `config/agent-compatibility.json` supporting Antigravity, Claude Code, Codex CLI, Gemini CLI, OpenCode, Cursor, VS Code, Cline, Roo Code, and Windsurf. |
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

#### System Diagnostics
Verify your environment prerequisites (Node.js runtime, SQLite, Wasp CLI/WSL, and REA build status):
```bash
node bin/forge.js doctor
```

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

#### Direct Pass-Through to Upstream Tooling
```bash
# Pass arguments directly to upstream Wasp CLI (or receive actionable WSL commands):
node bin/forge.js wasp version
node bin/forge.js wasp clean

# Pass arguments directly to upstream REA CLI (or receive actionable build commands):
node bin/forge.js rea --help
node bin/forge.js rea scan ./target-binary
```

---

## 🤖 Model Context Protocol (MCP) Configuration

Configure Agent App Forge in your agent's MCP settings (`claude_desktop_config.json`, Antigravity, Cursor, Cline, or Roo Code):

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

### Available MCP Tools (213 Total Tools):
- **Forge Core Tools (6):**
  1. `forge_inspect_reference`: Analyzes schemas and endpoints in reference codebases using REA or Forge's native parser.
  2. `forge_create_spec`: Converts natural-language requests into validated, editable `ForgeSpec` JSON with domain metadata.
  3. `forge_generate_app`: Scaffolds full-stack web applications into a specified directory (`wasp` or `fullstack-node`).
  4. `forge_verify_app`: Runs bounded test suites and applies autonomous self-repair.
  5. `forge_rea_tool`: Universal proxy directly invoking any of upstream REA's 207 tools with full schemas and arguments.
  6. `forge_wasp_cli`: Executes native Wasp CLI commands (`version`, `compile`, `start`, `db migrate-dev`) with platform prerequisite handling.
- **Native REA Tools (207):**
  - Dynamically exposed with collision-safe names (`rea_<upstream_tool_name>`, e.g., `rea_inspect_sqlite_database`, `rea_inspect_wasm_artifact`, `rea_inspect_artifact`, `rea_annotate_native_function`).

---

## 🌐 AI Coding Agent Compatibility (10 Target Environments)

Agent App Forge provides dedicated integration configs, MCP settings, and verification tests for 10 leading AI coding clients:

| Client Name | Client Type | Integration Route | Status |
| :--- | :--- | :--- | :--- |
| **Antigravity** | Agentic IDE | Stdio MCP (`mcpServers.agent-app-forge`) | **`verified`** (Live IDE session verified) |
| **Claude Code** | Terminal CLI | CLI wrapper & Project config (`CLAUDE.md`) | **`tested`** (Binary found; MCP transport verified) |
| **Codex CLI** | Terminal CLI | CLI wrapper (`forge create`, `forge verify`) | **`tested`** (Binary found; CLI execution verified) |
| **Gemini CLI** | Terminal CLI | CLI wrapper (`forge create`, `forge inspect`) | **`tested`** (Binary found; CLI parsing verified) |
| **OpenCode** | Terminal CLI | CLI wrapper & OpenCode config | **`tested`** (Binary found; CLI delegation verified) |
| **Cursor** | AI IDE | Stdio MCP (`.cursor/mcp.json`) | **`not_verified`** (Configured; binary absent on host) |
| **VS Code / Copilot** | Extension / IDE | Stdio MCP & VS Code Task definitions | **`limited`** (Binary found; Copilot MCP in preview) |
| **Cline** | VS Code Extension | Stdio MCP (`cline_mcp_settings.json`) | **`configured`** (Protocol tested; GUI unverified) |
| **Roo Code** | VS Code Extension | Stdio MCP (`roo_code_mcp_settings.json`) | **`configured`** (Protocol tested; GUI unverified) |
| **Windsurf** | AI IDE | Stdio MCP (`mcp_config.json`) | **`not_verified`** (Configured; binary absent on host) |

Full configuration templates and setup details are available in:
* [`config/agent-compatibility.json`](config/agent-compatibility.json) (Machine-readable registry)
* [`docs/AGENT_COMPATIBILITY.md`](docs/AGENT_COMPATIBILITY.md) (Step-by-step configuration guide)

---

## 🧪 Test Suites

Agent App Forge includes 56 automated tests across 10 specialized test suites (100% pass rate):

```bash
# Run the complete test suite
npm test

# Run individual suites
npx vitest run tests/spec.test.ts                  # Domain inference and schema validation (8 tests)
npx vitest run tests/waspEngine.test.ts             # Wasp 0.26.1 specification compliance (2 tests)
npx vitest run tests/forge.test.ts                  # Path traversal prevention & orchestration (4 tests)
npx vitest run tests/securityRegression.test.ts     # Node runtime check, traversal, injection, redaction (6 tests)
npx vitest run tests/reaBridge.test.ts              # REA probing & source parser tests (5 tests)
npx vitest run tests/e2e.test.ts                    # End-to-end CRUD & restart persistence (1 test)
npx vitest run tests/mcp.integration.test.ts        # Live MCP Client protocol, Stdio purity & 213 tools (10 tests)
npx vitest run tests/upstreamDelegation.test.ts     # CLI pass-through, REA catalog, explicit engines (8 tests)
npx vitest run tests/verifier.test.ts               # Fault injection, timeouts, SQLite repair (5 tests)
npx vitest run tests/reaFullMcp.integration.test.ts # Full 207 REA tools discovery, live SQLite execution (7 tests)
```

See the complete execution report in [`docs/TEST_RESULTS.md`](docs/TEST_RESULTS.md).

---

## 📑 Documentation

### Upstream Preservation & Universal Integration
- [`docs/CAPABILITY_PRESERVATION_POLICY.md`](docs/CAPABILITY_PRESERVATION_POLICY.md): Non-regression and zero-capability-loss rules.
- [`docs/CAPABILITY_MATRIX.md`](docs/CAPABILITY_MATRIX.md): Detailed capability matrix for Wasp, REA, and Forge.
- [`docs/UPSTREAM_INTEGRATION.md`](docs/UPSTREAM_INTEGRATION.md): Upstream integration architecture, delegation routes, and WSL bridging.
- [`docs/AGENT_COMPATIBILITY.md`](docs/AGENT_COMPATIBILITY.md): Compatibility matrix and configs for all 10 AI coding agents.
- [`docs/TEST_RESULTS.md`](docs/TEST_RESULTS.md): Full test execution log across all 49 tests.

### Architecture & Audits
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md): System architecture & orchestrator design.
- [`docs/INTEGRATION_PLAN.md`](docs/INTEGRATION_PLAN.md): Wasp & REA integration strategy.
- [`docs/SECURITY_MODEL.md`](docs/SECURITY_MODEL.md): Security boundary specification.
- [`docs/audits/BASELINE.md`](docs/audits/BASELINE.md): Repository baseline, git remotes, and initial environment state.
- [`docs/audits/MCP_COMPATIBILITY.md`](docs/audits/MCP_COMPATIBILITY.md): Protocol verification via `@modelcontextprotocol/sdk`.
- [`docs/audits/REA_INTEGRATION.md`](docs/audits/REA_INTEGRATION.md): REA capability probing and provenance guarantees.
- [`docs/audits/WASP_GENERATION.md`](docs/audits/WASP_GENERATION.md): Wasp 0.26.1 specification and platform prerequisites.
- [`docs/audits/SECURITY_REVIEW.md`](docs/audits/SECURITY_REVIEW.md): Sandbox boundaries, path traversal, and shell injection mitigations.
- [`docs/audits/END_TO_END_RESULTS.md`](docs/audits/END_TO_END_RESULTS.md): Step-by-step transcript of MVP synthesis, verification, and persistence.
- [`docs/audits/EXECUTIVE_SUMMARY.md`](docs/audits/EXECUTIVE_SUMMARY.md): Executive summary of audit findings.

---

## 📁 Repository Structure

```text
agent-app-forge/
├── bin/
│   ├── forge.js                 # Developer CLI executable (create, inspect, verify, doctor, wasp, rea)
│   └── mcp.js                   # Stdio MCP server executable (6 protocol tools)
├── config/
│   └── agent-compatibility.json # Machine-readable client configuration registry (10 clients)
├── docs/
│   ├── AGENT_COMPATIBILITY.md   # Agent integration guide
│   ├── ARCHITECTURE.md          # System architecture & orchestrator design
│   ├── CAPABILITY_MATRIX.md     # Upstream feature preservation matrix
│   ├── CAPABILITY_PRESERVATION_POLICY.md # Inviolable preservation policy
│   ├── INTEGRATION_PLAN.md      # Integration strategy
│   ├── SECURITY_MODEL.md        # Security boundary specification
│   ├── TEST_RESULTS.md          # Comprehensive test execution report (49 tests)
│   ├── UPSTREAM_INTEGRATION.md  # Upstream delegation & platform prerequisites
│   ├── audits/                  # Formal audit reports
│   └── research/                # Upstream source analysis of Wasp and REA
├── src/
│   ├── cli/                     # Commander CLI implementation
│   ├── engines/                 # WaspEngine & UniversalNodeEngine orchestrator
│   ├── investigation/           # REA investigation bridge & native source parser
│   ├── mcp/                     # Model Context Protocol stdio server implementation
│   ├── spec/                    # Zod validation schemas & prompt parser
│   ├── utils/                   # Prerequisites checker (Node, SQLite, Wasp, REA)
│   └── verifier/                # Autonomous test runner, self-repair & HTTP probe
└── tests/
    ├── e2e.test.ts              # End-to-end MVP persistence verification
    ├── forge.test.ts            # Core orchestration & security boundaries
    ├── mcp.integration.test.ts   # Real MCP protocol tests & stdio purity
    ├── reaBridge.test.ts        # REA probing & source parser tests
    ├── securityRegression.test.ts # Runtime, traversal, injection, redaction
    ├── spec.test.ts             # Domain inference & schema validation tests
    ├── upstreamDelegation.test.ts # CLI pass-through & native REA/Wasp delegation
    ├── verifier.test.ts         # Fault injection & timeout verification
    └── waspEngine.test.ts       # Wasp 0.26.1 specification compliance tests
```

---

## 📜 License
MIT © Agent App Forge Contributors.  
Upstream notices preserved for Wasp (MIT) and REA (MIT).
