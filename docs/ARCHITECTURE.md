# Agent App Forge — Architecture Specification

## 1. Vision & Purpose
**Agent App Forge** is an open, portable agentic developer toolchain that combines:
1. **Investigation & Reverse Engineering (via REA):** Inspect reference code, extract architectural patterns, parse API schemas, and gather verified evidence.
2. **Declarative Application Generation (via Wasp & modern web generators):** Synthesize full-stack web applications, databases, routes, auth, and state from structured specifications.
3. **Autonomous Validation & Self-Healing Loop:** Build, execute, detect compile or runtime failures, compute targeted patches, and verify the resulting deployment.

```
       ┌────────────────────────────────────────────────────────┐
       │                 AI Coding Agent / User                 │
       └───────────────────────────┬────────────────────────────┘
                                   │ MCP / CLI
       ┌───────────────────────────▼────────────────────────────┐
       │                   AGENT APP FORGE                      │
       │                                                        │
       │  ┌──────────────────┐  ┌─────────────────────────────┐ │
       │  │  Specification   │  │    Investigation Bridge     │ │
       │  │  Engine          │  │    (Optional REA Adapter)   │ │
       │  │  (ForgeSpec)     │  │                             │ │
       │  └─────────┬────────┘  └──────────────┬──────────────┘ │
       │            │                          │                │
       │  ┌─────────▼──────────────────────────▼──────────────┐ │
       │  │              Synthesis Orchestrator               │ │
       │  │   (Wasp Engine / Full-Stack Universal Engine)     │ │
       │  └─────────────────────┬─────────────────────────────┘ │
       │                        │                               │
       │  ┌─────────────────────▼─────────────────────────────┐ │
       │  │          Test, Verify & Self-Repair Loop          │ │
       │  └───────────────────────────────────────────────────┘ │
       └────────────────────────────────────────────────────────┘
```

---

## 2. Core Subsystems

### 2.1 Specification Engine (`ForgeSpec`)
- Converts user requirements (natural language or architectural prompts) into a strictly validated JSON specification.
- Fields:
  - `name`: Machine-friendly identifier.
  - `title`: Human-readable application title.
  - `description`: Domain and requirement summary.
  - `features`: Array of functional capabilities (e.g., auth, storage, realtime, background jobs).
  - `entities`: Data models with typed fields and relationships.
  - `operations`: Queries (read) and Actions (write).
  - `routes`: Page routes and navigation bindings.
  - `targetEngine`: Selected code generation target (`wasp` or `fullstack-react-node`).

### 2.2 Investigation Bridge (REA Integration)
- Optional, gracefully degrading subsystem.
- Inspects reference software, extracts endpoints, decompiles bundles, or analyzes existing schemas.
- Translates findings into `ForgeEvidence` objects ingested by `ForgeSpec`.

### 2.3 Synthesis Engine
- Modular plugin architecture implementing `AppGenerationEngine`:
  - `WaspEngine`: Generates Wasp-compliant `main.wasp.ts`, `schema.prisma`, client components, and server actions.
  - `UniversalNodeEngine`: Generates a fully autonomous React 19 + Express 5 + SQLite/Prisma stack ready for immediate local execution across all operating systems.

### 2.4 Test & Verification Loop (`ForgeVerifier`)
- Executes automated test checks:
  1. Spec Validation (`validateSpec`)
  2. Syntax & Type Verification (`tsc --noEmit`)
  3. Build Verification (`npm run build`)
  4. Runtime Health Probe (`HTTP GET /api/health` or dev server ping)
- Collects diagnostics and triggers targeted self-healing attempts when errors occur.

---

## 3. Communication Protocols
- **Model Context Protocol (MCP):** Exposes `forge_inspect`, `forge_create_spec`, `forge_generate_app`, `forge_verify_app`, and `forge_run_preview` via standard JSON-RPC 2.0 over stdio.
- **CLI Interface:** `forge create`, `forge spec`, `forge verify`, `forge run`.
- **Portable Agent Instructions:** Self-contained `AGENTS.md` and slash skill guides compatible with Claude Code, Cursor, Codex, Gemini CLI, Grok, and Antigravity.
