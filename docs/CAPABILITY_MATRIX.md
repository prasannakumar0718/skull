# Upstream Capability Matrix: Wasp & REA Preservation

**Date:** 2026-10-19  
**Policy:** Zero Capability Loss  

---

## 1. Wasp Capability Matrix

| Upstream Feature | Upstream Command / Syntax | Forge Integration Route | Test Evidence | Host Status |
| :--- | :--- | :--- | :--- | :--- |
| **Specification Synthesis** | `main.wasp.ts` (Wasp 0.26.1) | `WaspEngine.generate` / `forge create --engine wasp` | `tests/waspEngine.test.ts` | **Preserved & Emitted** |
| **Prisma Schema Generation**| `schema.prisma` (SQLite/Postgres) | `WaspEngine.generate` | `tests/waspEngine.test.ts` | **Preserved & Emitted** |
| **CLI Version Inspection** | `wasp version` | `forge wasp version` / `forge_wasp_cli` | `tests/upstreamDelegation.test.ts` | **Preserved via Pass-Through** (Requires WSL on Win32) |
| **Project Compilation** | `wasp compile` | `forge wasp compile` / `forge_wasp_cli` | `tests/upstreamDelegation.test.ts` | **Preserved via Pass-Through** (Requires WSL on Win32) |
| **Development Server** | `wasp start` | `forge wasp start` | Documented instructions | **Preserved via Pass-Through** (Requires WSL on Win32) |
| **Database Migrations** | `wasp db migrate-dev` | `forge wasp db migrate-dev` | Documented instructions | **Preserved via Pass-Through** (Requires WSL on Win32) |
| **Project Telemetry & Clean**| `wasp clean`, `wasp telemetry` | `forge wasp <command>` | `tests/upstreamDelegation.test.ts` | **Preserved via Pass-Through** (Requires WSL on Win32) |
| **TypeScript / Vite Config** | Root `package.json`, `tsconfig.json` | `WaspEngine.generate` | `tests/waspEngine.test.ts` | **Preserved & Emitted** |

---

## 2. REA (Reverse Engineer Anything) Capability Matrix

| Upstream Capability | Tool Name / CLI Command | Forge Integration Route | Test Evidence | Environment Status |
| :--- | :--- | :--- | :--- | :--- |
| **Static Artifact Analysis** | `inspect_artifact` | `forge_rea_tool` / `ReaInvestigationBridge` | `tests/upstreamDelegation.test.ts` | **Preserved via Delegation** (Reports unbuilt when node_modules missing) |
| **Function Decompilation** | `analyze_function` | `forge_rea_tool` / `ReaInvestigationBridge` | `tests/upstreamDelegation.test.ts` | **Preserved via Delegation** |
| **Artifact Comparison** | `compare_artifacts` | `forge_rea_tool` | `tests/upstreamDelegation.test.ts` | **Preserved via Delegation** |
| **Function CFG & Diff** | `compare_functions` | `forge_rea_tool` | `tests/upstreamDelegation.test.ts` | **Preserved via Delegation** |
| **Static Call Graph** | `get_call_graph` | `forge_rea_tool` | `tests/upstreamDelegation.test.ts` | **Preserved via Delegation** |
| **Call Path Tracing** | `trace_call_path` | `forge_rea_tool` | `tests/upstreamDelegation.test.ts` | **Preserved via Delegation** |
| **Session Evidence Bundle** | `get_evidence_bundle` | `forge_rea_tool` | `tests/upstreamDelegation.test.ts` | **Preserved via Delegation** |
| **CLI Full Pass-Through** | `rea <args...>` | `forge rea <args...>` | `tests/upstreamDelegation.test.ts` | **Preserved via Pass-Through** |
| **Prisma / SQL Schema Scan** | Heuristic AST Parser | `ReaInvestigationBridge.investigate` (`forge-source-parser`) | `tests/reaBridge.test.ts` | **Implemented & Verified Fallback** |
| **Route Controller Scan** | Heuristic AST Parser | `ReaInvestigationBridge.investigate` (`forge-source-parser`) | `tests/reaBridge.test.ts` | **Implemented & Verified Fallback** |
| **Dynamic Tracing (Frida/LLDB)**| REA Native Bridges | Direct upstream access | Documented in `REA_INTEGRATION.md` | **Direct Upstream Only** (Unsupported by fallback parser) |

---

## 3. Transparency & Fallback Policy

1. **Wasp on Native Windows:** When Wasp CLI cannot run natively on Windows without WSL, Forge emits complete Wasp files and provides WSL setup instructions. Forge provides the Universal Node Engine (`fullstack-node`) as an immediate alternative for zero-dependency execution, but never claims it has parity with Wasp's Haskell compiler or React full-stack framework.
2. **REA Unbuilt State:** If REA dependencies (`node_modules`) are uninstalled in `../rea`, Forge's delegation paths report the exact build command needed (`cd "../rea" && npm install && npm run build`) and provide Forge's native source parser (`forge-source-parser`) for schema extraction without claiming binary parity.
