# Source Code Analysis: Wasp & REA

## Executive Summary
This document provides an architectural and functional comparison of the two upstream repositories:
1. **Wasp** (`https://github.com/wasp-lang/wasp.git`, Tag/Version `0.26.1`)
2. **REA — Reverse Engineer Anything** (`https://github.com/morluto/rea.git`, Version `6.7.0`)

---

## 1. Wasp Architecture & Capabilities

### 1.1 Overview & Tech Stack
- **Languages:** Haskell (GHC 9.6.7, Cabal 3.16.1), TypeScript, Node.js (v24+).
- **Core Role:** Full-stack web application compiler and runtime generator.
- **Entry Points:**
  - CLI: `waspc/cli/exe/Main.hs`
  - Core Analysis: `waspc/src/Wasp/Project/Analyze.hs`
  - TypeScript Spec Evaluator: `waspc/src/Wasp/Project/WaspFile/TypeScript.hs` + `waspc/data/packages/spec`
  - Code Generator: `waspc/src/Wasp/Generator.hs`

### 1.2 Pipeline & AST Evaluation
- User writes `main.wasp.ts` with ECMAScript import attributes:
  ```typescript
  import { HomePage } from "./src/pages/HomePage" with { type: "ref" };
  ```
- Spec evaluation uses a Node subprocess (`waspc/data/packages/spec/src/run.ts`) with Rolldown/unrun transforms that convert `{ type: "ref" }` into symbolic object representations without executing browser/React runtime code.
- Output specification (`spec-result.json`) is decoded by Aeson into Haskell `AppSpec.Decl` types.
- Prisma schema (`schema.prisma`) is parsed via Megaparsec into AST blocks.
- Generators (`ServerGenerator`, `SdkGenerator`, `DbGenerator`) produce a list of `FileDraft` instructions written incrementally to disk using `.waspchecksums`.
- Post-generation setup executes `npm install`, Prisma generation, and SDK TypeScript build via npm workspaces (`.wasp/out/*`).

### 1.3 Key Strengths & Constraints
- **Strengths:** High level of declarative abstraction for full-stack React + Express + Prisma applications; automated auth, route, query/action, and background job generation.
- **Constraints:** The CLI build toolchain is heavily oriented toward Linux/macOS/WSL environments due to shell script build wrappers (`./run`), though generated Node/React artifacts run universally.

---

## 2. REA (Reverse Engineer Anything) Architecture & Capabilities

### 2.1 Overview & Tech Stack
- **Languages:** TypeScript / Node.js (ESNext / Node 20+).
- **Core Role:** Comprehensive reverse engineering platform offering Model Context Protocol (MCP) server endpoints and a unified CLI for inspecting binaries, bytecode, web bundles, runtime behavior, and memory.
- **Entry Points:**
  - CLI: `src/cli.ts`, `src/main.ts`
  - MCP Server: `src/server/registerOfficialTools.ts`, `src/server/registerInvestigationTools.ts`
  - Server Schema: `server.json` (MCP schema 2025-12-11)

### 2.2 Tool Catalogue & Contracts
REA provides an extensible suite of investigative tools partitioned into domain providers:
1. **Static Analysis Providers:**
   - Native Disassembly: Hopper, Ghidra, IDA Pro, Cutter, Rizin, Objdump (`src/hopper`, `src/ghidra`, `src/rizin`).
   - Managed Runtimes: .NET IL (`src/dotnet`), JVM/Android APK (`src/android`, `src/apktool`), WebAssembly (`src/wasm`), EVM bytecode (`src/evm`).
   - JavaScript/Web Recovery: Webpack/Rollup unbundling, sourcemap extraction, AST deobfuscation (`src/javascript`, `src/web`).
2. **Dynamic & Runtime Providers:**
   - Frida dynamic instrumentation & hook generation (`src/frida`).
   - GDB debugging and core dump analysis (`src/gdb`).
   - Browser & Network scenarios: Headless Chromium tracing, PCAP capture (`src/browser`, `src/pcap`).
3. **Investigation & Correlation Domain:**
   - `find_changed_behavior`: Differential analysis across binary/source versions.
   - `build_call_path`: Traces cross-boundary control flow from API entry to database/native calls.
   - `correlate_static_and_runtime`: Connects static disassemblies with live dynamic hook telemetry.
   - `verify_reconstruction`: Verifies reconstructed code against reference binary behavior with cryptographic evidence records.

---

## 3. Integration Matrix & Synergy for Agent App Forge

| Dimension | Wasp Capability | REA Capability | Agent App Forge Synthesis |
| :--- | :--- | :--- | :--- |
| **Primary Domain** | Forward Synthesis (Code Gen) | Reverse Analysis (Investigation) | Bidirectional Engineering Loop |
| **Interface** | CLI (`wasp start/build/compile`) | MCP + CLI (`rea-agents mcp`) | Dual Unified MCP Server + Forge CLI |
| **Data Representation** | `AppSpec` Declarative IR | Evidence Graphs & Signatures | `ForgeSpec` (Intent + Architecture + Evidence) |
| **Target Runtime** | Node.js + React + Prisma | Multi-target (Native, JS, .NET, APK) | Target-agnostic engine plugin architecture |
| **Error Handling** | Compiler Diagnostics / Logs | Root-Cause Trace & Memory Probe | Autonomous Diagnose-and-Repair Engine |
