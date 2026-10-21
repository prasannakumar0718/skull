# Changelog

All notable changes to **Agent App Forge** will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.1] - 2026-10-21

### Added
- **Zero-Configuration Experience (Phase 15)**:
  - Natural-language request classification into generation, recreation, modification, or analysis.
  - Automatic URL and filesystem path extraction, initiating deep browser and source inspection without manual tool orchestration.
- **Dedicated Domain Synthesis Engines (Phase 16)**:
  - `contentPageTemplate`: Dedicated responsive static/informational content portal engine with SQLite WAL persistence, typographic hierarchy, and zero fabricated task controls.
  - `apiDocsTemplate`: Dedicated interactive API explorer and service documentation engine with Swagger-like HTTP method badges, dynamic request probing, and SQLite metrics tracking.
  - `studentManagementTemplate`: Academic directory, attendance tracking, and fee status management engine.
- **Dual-Track Verification Pipeline (Phase 16)**:
  - Strict decoupling of **Generated Application Quality** (server start, route responsiveness, WAL persistence, reboot survival) from **Reference Fidelity** (headings, links, control parity, responsive layout).
  - Enforced parity rule: Application Quality PASS never masks Reference Fidelity FAIL.
  - Anti-fabrication penalty (Rule 5): Penalizes synthesis of unobserved interactive controls on read-only reference pages.

### Changed
- **Brand-Neutral Generalization (Phase 17 & 17.1)**:
  - Completely removed hardcoded website names (`httpbin`, `todomvc`) from classification, engine routing, and comparator logic.
  - Structural API documentation detection using observable Swagger/OpenAPI elements (`Expand operation`, `Try it out`, `Execute`, `curl`, method badges).
  - Structural minimalist task detection and dynamic evidence-based footer generation (preserves reference links only when supported by observed evidence or explicit user requests).

### Fixed
- Fixed Swagger operation buttons and reference external links preservation on API documentation targets, raising HTTPBin reference fidelity score to 1.00.
- Fixed TodoMVC state-dependent button recall, removing 8 fabricated buttons from the default state view.
- Ensured symmetric link extraction and counting rules across reference and recreation targets.

## [0.1.0] - 2026-10-19

### Added
- **Software Recreation System (Phase 13 & 13.1)**:
  - Autonomous recreation lifecycle: Investigate $\rightarrow$ Specify $\rightarrow$ Plan $\rightarrow$ Build $\rightarrow$ Run $\rightarrow$ Compare $\rightarrow$ Detect Failure $\rightarrow$ Repair $\rightarrow$ Re-Verify.
  - Strict provenance tagging: `observed`, `inferred`, `user_requested`, and `unknown`.
  - 6-stage structured implementation planning (`ImplementationPlan`).
  - Side-by-side behavioral comparison engine (`RecreationComparator`) with dynamic ephemeral port binding.
  - Full-stack Document Studio engine with rich-text canvas, debounced autosave, title renaming, SQLite WAL persistence, Word `.doc` HTML export, and `@media print` PDF support.
- **Complete Upstream REA MCP Integration (Phase 12 & 12.1)**:
  - Discovery of all 207 native REA 6.7.0 reverse-engineering tools.
  - Direct collision-safe routes (`rea_<tool-name>`) and universal proxy (`forge_rea_tool`).
  - Real stdio MCP transport with zero stdout pollution.
  - 100% schema parity verification against live REA runtime.
  - In-flight cancellation via `AbortSignal`.
- **Wasp 0.26.1 Engine & Native Delegation (Phase 11)**:
  - Specification compliance and full file scaffolding (`main.wasp.ts`, Prisma schema, React pages, operations).
  - CLI pass-through (`forge wasp <args>`) with truthful platform instructions (WSL requirement on Windows).
- **Universal Node Engine**:
  - Full-stack web application generation with zero external runtime npm dependencies.
  - High-performance SQLite storage via native `node:sqlite` in WAL mode.
- **Autonomous Verifier & Self-Repair**:
  - Check pipeline: Directory structure, package configuration, syntax verification (`node --check`), bounded test execution (`test.js`, 10s timeout), and live HTTP health check probing.
  - Bounded self-repair: Automated SQLite schema restoration and specification-driven source code reconstruction.
- **Model Context Protocol (MCP) Server**:
  - 7 Forge orchestration tools + 207 REA native tools = 214 total tools.
  - Full handshake, tool listing, schema validation, and error reporting.
- **Universal Agent Adapters (Phase 14)**:
  - Machine-readable registry in `config/agent-compatibility.json` covering 10 AI coding agents (Antigravity, Claude Code, Cursor, OpenCode, VS Code / Copilot, Cline, Roo Code, Windsurf, Codex CLI, Gemini CLI).
  - CLI automation: `forge adapters list`, `forge adapters doctor`, and `forge adapters setup <client> [--dry-run]`.
  - Timestamped backup creation and non-destructive JSON merging.
  - Capabilities inventory command: `forge capabilities [--json]`.
- **CI & Packaging**:
  - Dual binary entry points (`forge` and `agent-app-forge`).
  - GitHub Actions matrix testing on Node.js 22 & 24 across Ubuntu, Windows, and macOS.
