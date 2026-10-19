# Agent App Forge — Recreation Architecture

**Module:** `src/recreation`  
**Status:** Implemented & Formally Verified  
**Package:** `agent-app-forge` (Phase 13)

---

## 1. Architectural Overview

The Recreation System is structured into modular, decoupled components adhering to single-responsibility and evidence-based design principles.

```
src/recreation/
├── investigator.ts    # Evidence extraction, REA tool delegation, static parsing, digest capture
├── planner.ts         # Staged implementation planning, dependency mapping, acceptance criteria
├── comparator.ts      # Dual-server probing, behavioral comparison, feature status evaluation
├── orchestrator.ts    # End-to-end pipeline coordination: investigate -> specify -> plan -> build -> verify -> compare
└── types.ts           # Type definitions for investigation, planning, and comparison reports
```

---

## 2. Component Design

### 2.1 RecreationInvestigator (`src/recreation/investigator.ts`)
- **Purpose:** Analyze targets (reference directory, SQLite database, binary fixture, or natural language prompts).
- **Core Capabilities:**
  - **SHA-256 Digest Extraction:** Computes exact cryptographic hashes of all analyzed files.
  - **SQLite Introspection:** Invokes REA's native `inspect_sqlite_database` MCP tool (falling back gracefully to native `node:sqlite` introspection when needed) to extract exact table definitions, primary keys, and column types.
  - **Source Code Parsing:** Analyzes JavaScript/TypeScript route files, HTTP method signatures, and Prisma schemas.
  - **Binary Extraction:** Scans binary files for embedded strings, headers, and signatures.
  - **Feature-Driven Synthesis:** Infers domain models and capabilities when no physical reference target is provided.

### 2.2 ImplementationPlanner (`src/recreation/planner.ts`)
- **Purpose:** Transform an evidence-based `ForgeSpec` into a machine-readable `ImplementationPlan`.
- **Core Elements:**
  - **Architectural Specification:** Documents the frontend technology, backend endpoints, storage mechanism, and export pipelines.
  - **Staged Implementation Tasks:** Deconstructs the build into discrete stages:
    1. Relational SQLite Storage & Schemas
    2. REST API Operations & Handlers
    3. Interactive UI & User Workflows
    4. Autosave & Document Recovery
    5. Multi-Format Document Export Pipeline
    6. Automated Verification & Self-Testing
  - **Acceptance Criteria:** Translates every workflow and requirement into verifiable test conditions.
  - **Known Unknowns & Limitations:** Explicitly documents assumptions and upstream toolchain boundaries.

### 2.3 Universal Node Engine Document Studio (`src/engines/universalNodeEngine.ts`)
- **Purpose:** Full-stack native generation for rich interactive document applications.
- **Key Modules Generated:**
  - `server.js`: Zero-dependency Node.js HTTP server + native SQLite (`node:sqlite`) in WAL mode.
    - Endpoints: `GET/POST /api/documents`, `GET/PATCH/DELETE /api/documents/:id`, `GET /api/documents/:id/export?format=html|markdown|text|json`, `GET /api/health`.
  - `public/index.html`: Studio canvas with formatting toolbar (headings, bold, italic, underline, quotes, lists), document management drawer, and word counter.
  - `public/style.css`: Clean, modern UI styling.
  - `public/app.js`: Interactive client controller with debounced 500ms background autosave, visual status indicator, and dynamic document switching.
  - `test.js`: Structural unit and persistence test suite validating database initialization, row insertions, and deletions.
  - `workflow.test.js`: End-to-end acceptance test suite verifying document creation, autosave, and export formatting.

### 2.4 RecreationComparator (`src/recreation/comparator.ts`)
- **Purpose:** Verify behavioral parity between generated application and reference implementation.
- **Mechanism:**
  - Identifies available TCP ports dynamically.
  - Spawns the generated application in an isolated child process.
  - Executes live HTTP requests against `/api/health`, `/api/documents`, and `/api/documents/:id/export`.
  - Classifies each capability as `pass`, `partial`, `fail`, `blocked`, or `not_tested`.
  - Guarantees clean process termination and zero leaked sockets upon completion.

### 2.5 RecreationOrchestrator (`src/recreation/orchestrator.ts`)
- **Purpose:** Single coordination facade unifying all lifecycle stages.
- **Execution Matrix:**
  1. Calls `RecreationInvestigator.investigate()`.
  2. Synthesizes `ForgeSpec` with provenance metadata via `createSpecFromInvestigation()`.
  3. Validates specification against `ForgeSpecSchema`.
  4. Calls `ImplementationPlanner.plan()`.
  5. If `planOnly === true`, returns early with plan artifact.
  6. Delegates code generation to `EngineOrchestrator.generateProject()`.
  7. Runs bounded self-repair verification via `ForgeVerifier.verify()`.
  8. Runs behavioral comparison via `RecreationComparator.compare()`.
  9. Emits comprehensive `RecreationResult`.
