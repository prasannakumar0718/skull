# Agent App Forge — Capability Preservation Policy

**Policy Enforcement:** NON-NEGOTIABLE  
**Scope:** Agent App Forge (`D:\git hub\agent-app-forge`) and upstream repositories (`../wasp`, `../rea`)  

---

## 1. Core Principle: Zero Capability Loss

Agent App Forge is an **additive integration and orchestration layer**, not a replacement or fork of Wasp or REA. 
Under no circumstances may upstream functionality be removed, simplified, reduced into a weaker subset, or silently substituted.

Compatibility across AI agents and IDEs must never be achieved by downgrading upstream capabilities. If a specific client or platform lacks the prerequisites to execute an upstream tool, Forge must state the exact limitation transparently and provide native delegation and fallback options without sacrificing the original capability.

---

## 2. Upstream Repository Protection

1. **Pristine Source Integrity:**
   - `D:\git hub\wasp` and `D:\git hub\rea` must never be modified, deleted, reformatted, or overwritten.
   - Their Git histories, branches (`main`), remotes, licenses, dependencies, and build scripts must remain 100% untouched.
2. **Independent Usability:**
   - Both Wasp and REA must remain independently runnable by developers outside of Agent App Forge.
   - Forge wraps and delegates; it never monopolizes or hides upstream tooling.

---

## 3. Delegation & Pass-Through by Default

Whenever an operation is supported upstream, Forge delegates directly to the native upstream interface:
- **Wasp CLI Delegation (`forge wasp <args...>`):** Direct pass-through of commands and arguments to the official Wasp compiler and CLI (`wasp start`, `wasp compile`, `wasp db migrate-dev`, `wasp clean`).
- **REA CLI Delegation (`forge rea <args...>`):** Direct pass-through of commands and options to the official REA CLI (`rea <target>`, `rea mcp`, `rea inspect`).
- **REA MCP Tool Gateway (`forge_rea_tool`):** Dynamic pass-through exposing native REA tools (`inspect_artifact`, `analyze_function`, `compare_artifacts`, `get_call_graph`, `get_evidence_bundle`) to AI agents.

---

## 4. Prohibition on Silent Engine Substitution

1. **Explicit Request Rule:**
   - If a user or agent requests `--engine wasp` (or `targetEngine: "wasp"`), Forge **MUST** generate a compliant Wasp project structure.
   - Forge is strictly forbidden from silently substituting `fullstack-node` when `wasp` is explicitly requested.
2. **Platform Diagnostics:**
   - If Wasp cannot run natively on the current operating system (e.g. native Windows without WSL), Forge must report the exact platform limitation and provide WSL instructions. It must not claim Universal Node Engine has complete feature parity with Wasp.
3. **Auto-Resolution Transparency:**
   - Only when `targetEngine: "auto"` is specified may the orchestrator select the most suitable engine, and it must record the rationale explicitly in the result metadata.

---

## 5. REA Provenance & Fallback Truthfulness

1. **Strict Provenance Labeling:**
   - Operations performed by Forge's built-in AST parser must be labeled `forge-source-parser`.
   - Operations performed by the real REA CLI must be labeled `rea-cli`.
   - Operations performed by the real REA MCP server must be labeled `rea-mcp`.
   - Deterministic test fixtures must be labeled `test-fixture`.
2. **No False Parity Claims:**
   - The native `forge-source-parser` provides schema and route extraction for common text formats (Prisma, SQL, JS/TS). It does not provide binary decompilation, assembly CFGs, or dynamic execution tracing. Forge will never claim its fallback parser is an equivalent substitute for REA's binary disassemblers.

---

## 6. Zero-Regression Change Policy

Before any change is committed:
1. All existing test suites must be executed and verified passing.
2. New upstream delegation features must include automated regression tests.
3. Upstream repository git statuses must be verified clean (`git status` exits with no changes).
4. Full Git diff must be reviewed for accidental deletions or reduced implementations.
