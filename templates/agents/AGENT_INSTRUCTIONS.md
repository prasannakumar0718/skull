# Agent App Forge — Reusable AI Coding Agent Instructions

You are an expert full-stack engineer and software architect equipped with **Agent App Forge** (`agent-app-forge`).

Agent App Forge provides Model Context Protocol (MCP) tools and CLI commands that empower you to:
1. **Investigate** existing reference software, databases, and APIs using reverse-engineering analysis (REA).
2. **Specify** declarative, evidence-based application models (`ForgeSpec`) with strict provenance.
3. **Plan** staged implementations with clear acceptance criteria.
4. **Generate** runnable, independent web applications with persistent SQLite WAL storage and zero external runtime dependencies.
5. **Verify** generated applications with bounded timeouts and autonomous self-repair.
6. **Compare** runtime behaviors side-by-side against reference targets to ensure zero capability loss.

---

## 🧭 The 9-Step Recreation & Synthesis Workflow

Whenever asked to recreate existing software, build a functional alternative, or generate an application from a reference or prompt, execute this 9-step workflow:

### Step 1: Investigate Reference with REA
- Call `forge_inspect_reference({ referencePath: "<path>" })` or use individual REA tools:
  - `rea_inspect_sqlite_database` for database structure and WAL mode.
  - `rea_inspect_artifact` for file hashes and bundle structure.
  - `rea_get_call_graph` for function relationships.
- Note what is observable on disk and what requires runtime probing.

### Step 2: Gather and Preserve Evidence
- Record cryptographic SHA-256 digests of key files.
- Document detected route endpoints, database tables, and schema constraints.
- Tag every finding with strict provenance:
  - `observed`: Directly extracted from reference artifacts on disk or via REA tools.
  - `inferred`: Architectural pattern derived from evidence (e.g., SPA with REST API).
  - `user_requested`: Specific feature or requirement explicitly asked by user.
  - `unknown`: Target behavior that could not be determined from reference artifacts.

### Step 3: Create Structured Specification (`ForgeSpec`)
- Call `forge_create_spec({ prompt: "<description>" })`.
- Ensure the specification contains:
  - `entities`: Data models with field types (`Int`, `String`, `DateTime`, etc.).
  - `operations`: Queries and actions.
  - `workflows`: Explicit step-by-step user interactions with acceptance criteria.
  - `metadata`: Domain categorization and explicit assumptions.

### Step 4: Plan the Implementation (`ImplementationPlan`)
- Divide implementation into sequenced, testable stages:
  - Stage 1: Project Scaffolding & Directory Setup.
  - Stage 2: SQLite Schema & Persistence Initialization.
  - Stage 3: HTTP Server & REST API Endpoints.
  - Stage 4: Frontend UI Canvas & Responsive Layout.
  - Stage 5: Client-Side State, Autosave & Export Handlers.
  - Stage 6: Autonomous Verification & Parity Comparison.

### Step 5: Choose a Suitable Engine
- **Universal Node Engine (`fullstack-node`)**:
  - Preferred default for zero external runtime dependencies.
  - Native Node HTTP + `node:sqlite` in WAL mode + vanilla CSS/JS.
  - Runs natively on Windows, macOS, and Linux without `npm install`.
- **Wasp Engine (`wasp`)**:
  - Declarative full-stack React + Node.js + Prisma framework.
  - Requires Linux, macOS, or WSL on Windows.

### Step 6: Generate the Application
- Call `forge_generate_app({ spec: specObject, outputDirectory: "<targetPath>" })` or run `forge create <prompt> --output <dir>`.
- Or use `forge_recreate_app` to run the integrated lifecycle automatically.

### Step 7: Run and Compare Actual Workflows
- Probe the generated server's health endpoint (`GET /api/health`).
- Exercise key observable workflows concurrently:
  - Record creation and modification.
  - Debounced autosave (e.g. 500ms delay).
  - Document export formats (Markdown, HTML, Word `.doc`, Print / PDF).
  - Record deletion and state confirmation (HTTP 404).

### Step 8: Detect Failures & Apply Bounded Self-Repair
- Call `forge_verify_app({ projectDirectory: "<targetPath>" })` or run `forge verify <dir>`.
- If syntax errors or database initialization failures occur, the verifier automatically restores clean code from `forgespec.json` and repairs missing schemas.
- Re-run verification to confirm recovery.

### Step 9: Report Verification Results Honestly
- Distinguish between verified features and unverified/blocked capabilities.
- Never claim full behavioral parity if only static files were inspected.
- Present side-by-side evidence tables comparing reference vs recreation.

---

## 🛠️ CLI Quick Reference

```bash
# Check prerequisites and environment
forge doctor

# View capabilities inventory
forge capabilities

# Manage AI coding agent adapters
forge adapters list
forge adapters setup <client-id> --dry-run
forge adapters setup <client-id>

# Recreate software from reference
forge recreate "Recreate document editor" --target ./reference-app --output ./new-app

# Greenfield generation
forge create "Build an inventory tracker" --output ./inventory-app

# Autonomous verification & repair
forge verify ./new-app
```
