# Agent App Forge — Architecture Specification

## 1. Vision & Purpose
**Agent App Forge** is an open, client-independent agentic developer toolchain combining:
1. **Investigation & Reverse Engineering (via REA):** Inspect reference code, extract architectural patterns, parse Prisma/SQL schemas, and gather verified evidence.
2. **Declarative Application Generation (via Wasp & Universal Node):** Synthesize full-stack web applications, databases, routes, and state from strictly validated specifications.
3. **Autonomous Validation & Self-Healing Loop:** Execute bounded test scripts (`timeout: 10000`), diagnose errors, apply focused database/schema repairs, and probe live HTTP endpoints.
4. **Upstream Capability Preservation (Zero Capability Loss):** Preserves native access to both Wasp and REA binaries via direct pass-through commands (`forge wasp`, `forge rea`) and MCP gateways (`forge_rea_tool`, `forge_wasp_cli`).

```text
       ┌────────────────────────────────────────────────────────┐
       │                 AI Coding Agent / User                 │
       │ (Claude, Cursor, Antigravity, OpenCode, VS Code, CLI)  │
       └───────────────────────────┬────────────────────────────┘
                                   │ MCP Stdio / Standalone CLI
       ┌───────────────────────────▼────────────────────────────┐
       │                   AGENT APP FORGE                      │
       │                                                        │
       │  ┌──────────────────┐  ┌─────────────────────────────┐ │
       │  │  Specification   │  │    Investigation Bridge     │ │
       │  │  Engine          │  │    - REA MCP Pass-Through   │ │
       │  │  (ForgeSpec)     │  │    - Native Source Parser   │ │
       │  └─────────┬────────┘  └──────────────┬──────────────┘ │
       │            │                          │                │
       │  ┌─────────▼──────────────────────────▼──────────────┐ │
       │  │              Synthesis Orchestrator               │ │
       │  │  - WaspEngine (Wasp 0.26.1 specs + Prisma)        │ │
       │  │  - UniversalNodeEngine (Node.js + node:sqlite)    │ │
       │  └─────────────────────┬─────────────────────────────┘ │
       │                        │                               │
       │  ┌─────────────────────▼─────────────────────────────┐ │
       │  │          Test, Verify & Self-Repair Loop          │ │
       │  │   (Bounded execFile, SQLite repair, HTTP probe)   │ │
       │  └─────────────────────┬─────────────────────────────┘ │
       │                        │                               │
       │  ┌─────────────────────▼─────────────────────────────┐ │
       │  │             Upstream Delegation Gateway           │ │
       │  │   `forge wasp <args>`  │  `forge rea <args>`      │ │
       │  └─────────────────────┬─────────────────────────────┘ │
       └────────────────────────┼───────────────────────────────┘
                                │ Pass-Through
            ┌───────────────────┴───────────────────┐
            ▼                                       ▼
 ┌──────────────────────────────┐       ┌──────────────────────────────┐
 │     Original Wasp Source     │       │     Original REA Source      │
 │     (`D:\git hub\wasp`)      │       │     (`D:\git hub\rea`)       │
 │     (100% Untouched)         │       │     (100% Untouched)         │
 └──────────────────────────────┘       └──────────────────────────────┘
```

---

## 2. Core Subsystems

### 2.1 Specification Engine (`ForgeSpec`)
- Converts natural-language requests into validated, editable JSON schemas with domain assumptions.
- Multi-domain inference:
  - **Task Manager**: Entities with completion flags (`Task.isDone`).
  - **Financial / Fee Tracker**: Entities with float amounts and payment flags (`Expense.amount`, `Expense.isPaid`).
  - **E-Commerce Inventory**: Entities with SKU and stock counts (`Product.stockQuantity`, `Product.price`).
  - **Blog with Comments**: Relational posts and comments linked by `postId`.
  - **Generic Record**: Fallback data entity with notes and timestamps.
- Explicit Metadata: records `inferredAssumptions` detailing default architectural decisions.

### 2.2 Investigation Bridge (`ReaInvestigationBridge`)
- **REA CLI Delegation:** Forwards command-line arguments to native `rea` executable or `scripts/rea.mjs`.
- **REA MCP Tool Pass-Through:** Forwards structured tool calls (`inspect_artifact`, `analyze_function`, `compare_artifacts`, `get_call_graph`, `get_evidence_bundle`).
- **Native Source Parser Fallback (`forge-source-parser`):** Built-in heuristic AST parser for Prisma models, SQL `CREATE TABLE` DDL, and controller route functions.
- **Strict Provenance:** Transparently labels results by provider (`forge-source-parser`, `rea-cli`, `rea-mcp`, `test-fixture`) and reports environment diagnostics when REA is unbuilt.

### 2.3 Synthesis Engine & Dual Engine Architecture
- **Wasp Engine (`WaspEngine`):**
  - Generates full Wasp 0.26.1 workspaces: `main.wasp.ts`, `schema.prisma`, `package.json`, `tsconfig.json`, `.env.server`, `.gitignore`, React page components, and backend operations.
  - Probes host platform for Wasp CLI. If running on native Windows without WSL, provides explicit instructions for running inside WSL.
  - **Prohibition on Silent Substitution:** When `targetEngine === "wasp"`, Forge never silently switches to Node.
- **Universal Node Engine (`UniversalNodeEngine`):**
  - High-performance, zero-dependency stack using Node 22+ built-in `node:http` and native `node:sqlite` (`DatabaseSync` in WAL mode).
  - Eliminates external `node_modules` install overhead in generated apps, allowing immediate execution across Windows, macOS, and Linux.

### 2.4 Autonomous Verifier & Self-Repair (`ForgeVerifier`)
- **Shell-Free Bounded Process Execution:** Executes test suites using `execFile(process.execPath, ["test.js"])` with strict 10-second bounds (`timeout: 10000`) and 1 MB buffers.
- **Error Classification:** Categorizes failures into `MISSING_FILE`, `MISSING_STORAGE`, `SYNTAX_ERROR`, `TEST_FAILURE`, `TIMEOUT`.
- **Automated Self-Repair:** If `app.db` is uninitialized or corrupted, initializes the SQLite database schema and re-runs checks (bounded to 2 cycles) to confirm resolution.
- **Live HTTP Health Probe (`probeLiveServer`):** Spawns the server on an ephemeral port, verifies `GET /api/health` returns status 200, and terminates cleanly with zero process leaks.

### 2.5 Security & Sandbox Boundaries
- **Path Traversal Prevention:** Uses `path.relative(resolvedOut, targetFile)` to block directory escapes, `..`, absolute paths, and Windows drive root hops.
- **Secret Redaction:** Redacts credentials, tokens, and authorization keys (`[REDACTED]`) from logs and reports.
- **Shell Injection Prevention:** Eliminates shell strings; passes argument arrays directly to OS process APIs.

---

## 3. Communication Interfaces

- **Model Context Protocol (MCP):** Exposes 6 tools over stdio:
  - `forge_inspect_reference`: Inspect reference codebases.
  - `forge_create_spec`: Generate and validate specifications.
  - `forge_generate_app`: Scaffold full-stack projects.
  - `forge_verify_app`: Execute bounded verification and self-repair.
  - `forge_rea_tool`: Delegate to native REA MCP tools.
  - `forge_wasp_cli`: Delegate to native Wasp CLI.
- **Developer CLI (`bin/forge.js`):**
  - `forge create <prompt-or-spec> -o <dir> [-e <engine>]`
  - `forge spec <prompt> [-o <file>]`
  - `forge verify <dir>`
  - `forge inspect <path>`
  - `forge wasp <args...>` (native pass-through)
  - `forge rea <args...>` (native pass-through)
  - `forge doctor` (system health and runtime check)
- **Universal Agent Instructions:** Standard `AGENTS.md` and configuration files for Claude, Cursor, Antigravity, OpenCode, and VS Code.
