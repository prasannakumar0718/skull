# Upstream Integration Architecture & Delegation Guide

**Date:** 2026-10-19  
**Scope:** Integration contracts between Agent App Forge, Wasp (`../wasp`), and REA (`../rea`)  

---

## 1. Architectural Principles

Agent App Forge is designed around **delegation and non-invasive orchestration**:
- Upstream repositories are **never modified or simplified**.
- Users and AI agents can invoke native upstream tools directly through Forge pass-through interfaces or independently in their own terminals.
- When an upstream tool is installed and available, Forge delegates execution directly rather than attempting to duplicate its compiler or decompiler.
- When an upstream tool is not installed or unbuilt, Forge reports exact environment prerequisites and provides clean, honest fallback modes without false capability claims.

```text
                  ┌────────────────────────────────────────┐
                  │         AI Coding Agent / User         │
                  └──────────────────┬─────────────────────┘
                                     │
                 ┌───────────────────┴───────────────────┐
                 │           Agent App Forge             │
                 │   (CLI `bin/forge.js` & MCP `mcp.js`) │
                 └───────┬───────────────────────┬───────┘
                         │                       │
           ┌─────────────┴────────┐    ┌─────────┴────────────┐
           ▼                      ▼    ▼                      ▼
  ┌───────────────────┐  ┌───────────┐┌───────────────────┐  ┌──────────────┐
  │ forge wasp ...    │  │WaspEngine ││ forge rea ...     │  │Forge Source  │
  │ (Native Pass-Thru)│  │Synthesis  ││ (Native Pass-Thru)│  │Parser Fallback│
  └────────┬──────────┘  └─────┬─────┘└────────┬──────────┘  └──────────────┘
           │                   │               │
           ▼                   ▼               ▼
  ┌──────────────────────────────┐    ┌───────────────────────────────────┐
  │     Original Wasp Source     │    │       Original REA Source         │
  │     (`D:\git hub\wasp`)      │    │       (`D:\git hub\rea`)          │
  └──────────────────────────────┘    └───────────────────────────────────┘
```

---

## 2. Wasp Integration & Native Pass-Through

### 2.1 File Generation Mode (`forge create --engine wasp`)
- Emits standard Wasp 0.26.1 structure: `main.wasp.ts`, `schema.prisma`, `package.json`, `tsconfig.json`, `.env.server`, `.gitignore`, React components, and operations.
- Generates valid Prisma schemas with auto-incrementing IDs, timestamps, and relational data types.

### 2.2 Native CLI Pass-Through (`forge wasp <args...>`)
- Forwards any arbitrary command directly to the installed `wasp` binary:
  ```bash
  node bin/forge.js wasp version
  node bin/forge.js wasp compile
  node bin/forge.js wasp start
  node bin/forge.js wasp db migrate-dev
  ```
- **Platform Handling:** If running on native Windows without WSL, Forge checks `checkSystemPrerequisites()` and informs the user:
  ```text
  [Agent App Forge — Native Wasp Delegation]
  Wasp CLI is not installed or not in system PATH.
  Status: Wasp CLI requires Linux, macOS, or WSL. WSL is not installed.
  To install Wasp:
  - Linux/macOS/WSL: curl -sSL https://get.wasp.sh | sh
  - To generate a Wasp project without executing Wasp CLI locally: forge create <prompt> --engine wasp
  - For native Windows execution without WSL: forge create <prompt> --engine fullstack-node
  ```

---

## 3. REA Integration & Tool Pass-Through

### 3.1 Dynamic Tool Discovery & MCP Delegation
- Exposes `forge_rea_tool` over the MCP server, enabling AI agents to call upstream REA tools directly:
  - `inspect_artifact`: Binary layout, section headers, exported symbols, web bundle manifests.
  - `analyze_function`: Function decompilation, disassembly, control flow graphs.
  - `compare_artifacts`: Structural diff between binaries or bundles.
  - `get_call_graph`: Static call graph expansion.
  - `get_evidence_bundle`: Export retained evidence session.

### 3.2 Native CLI Pass-Through (`forge rea <args...>`)
- Forwards commands to the native REA CLI binary (`rea` or `scripts/rea.mjs`):
  ```bash
  node bin/forge.js rea <targetPath> --json
  ```
- **Unbuilt Repository Detection:** If `../rea/node_modules` is not installed, Forge reports:
  ```text
  [Agent App Forge — Native REA Delegation]
  REA CLI is not installed in PATH, and the repository at '../rea' is unbuilt.
  To build REA:
    cd "D:/git hub/rea" && npm install && npm run build
  Fallback: Use 'forge inspect <path>' for native heuristic source parsing.
  ```

### 3.3 Native Source Parser Fallback
- When REA is unbuilt or not installed, `ReaInvestigationBridge` executes `forge-source-parser`:
  - Parses Prisma models (`model <Name> { ... }`).
  - Parses SQL table schemas (`CREATE TABLE ...`).
  - Parses TypeScript / JavaScript route handlers (`get*`, `post*`, `create*`, `delete*`).
  - Reports provenance truthfully as `provider: "forge-source-parser"` with `reaAvailable: false`.

---

## 4. Verification and Regression Protections

- [`tests/upstreamDelegation.test.ts`](../tests/upstreamDelegation.test.ts) automatically tests:
  1. Discovery of all native REA tools (`listSupportedReaTools`).
  2. Truthful diagnostic reporting when REA is unbuilt.
  3. Preservation of explicit Wasp engine selection (`targetEngine: "wasp"`).
  4. System health probe via `checkSystemPrerequisites()`.
  5. CLI pass-through command execution (`doctor`, `wasp`, `rea`).
