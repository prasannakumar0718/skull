# Upstream Integration Architecture (Phase 12.1 Acceptance Audit)

## 1. REA Integration: Complete 207-Tool Upstream Parity & Zero Capability Loss

### A. Architectural Reality vs. Hardcoded Assumptions
In early integration phases, only a 5-tool subset was exposed. Phase 12.1 enforces full capability parity:
- Upstream REA v6.7.0 (`rea-agents@6.7.0`) publishes **207 distinct tools** defined across 36 contract modules.
- Agent App Forge exposes all 207 tools over standard MCP and provides direct pass-through via CLI.
- No upstream tool is omitted, simplified, or pruned.

### B. Upstream Discovery, Version Synchronization & Schema Parity
- **Runtime Discovery:** `ReaInvestigationBridge.discoverLiveReaTools()` connects over stdio to the live REA MCP runtime and queries `client.listTools()`.
- **Dynamic Parity Audit:** `ReaInvestigationBridge.validateParityWithLiveRea()` compares live discovered tools with the catalog, verifying tool count, missing tools, and exact JSON Schema structures.
- **Offline Catalog Fallback:** `src/investigation/reaCatalog.json` (with metadata `catalogVersion: "6.7.0"`, `sourcePackage: "rea-agents"`, `toolCount: 207`) serves as a validated offline fallback when REA is not connected, preventing runtime tool omission.
- **Parity Audit Results:**
  - Live tools: **207**
  - Catalog tools: **207**
  - Missing in Catalog: **0**
  - Missing in Live: **0**
  - Schema Mismatches: **0**
  - Version Mismatch: **false**

### C. Execution Paths & Cancellation Handling
1. **Direct Collision-Safe MCP Call (`rea_<name>`):**
   - The MCP client calls e.g. `rea_inspect_sqlite_database` with `{ path: "...", schema_scope: "database" }`.
   - Forge strips `rea_` to obtain `inspect_sqlite_database`.
   - Forge spawns a live StdioClientTransport connected to REA (`npx --yes rea-agents@6.7.0 --mcp`).
   - REA executes the tool, calculates SHA-256 digests, extracts schemas, and returns structured evidence (`evidence_id`, `normalized_result`, `limitations`).
   - Forge faithfully returns this output to the client.
2. **Universal MCP Proxy Call (`forge_rea_tool`):**
   - The client invokes `forge_rea_tool` with `{ toolName: "...", toolArguments: { ... } }`.
   - Forge forwards the request to the upstream REA MCP server and returns the structured result.
3. **Cancellation via AbortSignal:**
   - Both direct `rea_*` tools and `forge_rea_tool` accept an optional `AbortSignal`.
   - Pre-flight aborts immediately return `{ isError: true, isCancelled: true }` without opening a child process or transport connection.
   - In-flight aborts trigger `client.close()` and cleanly terminate the MCP transport.
4. **CLI Pass-Through (`forge rea <args...>`):**
   - Developer or terminal agent runs `forge rea --version` or `forge rea scan ...`.
   - Forge forwards arguments directly to the REA CLI runtime (`forge rea --version` outputs `6.7.0`).

### D. Truthful Error Handling & Missing Provider Diagnostics
- When a native provider is missing (e.g., Hopper, Ghidra, Cutter, Frida) or a session is required (e.g. `rea_annotate_native_function` without an active Ghidra session), Forge does **not** fabricate mock data.
- It returns REA's authentic diagnostic error explaining that the provider or session is absent, with exitCode/isError set appropriately.

---

## 2. Wasp Integration: Specification Compliance & Platform Bridging

### A. Wasp Specification Conformance
- `WaspEngine` generates conforming Wasp 0.26.1 project trees:
  - `main.wasp.ts`: Declarative application root.
  - `schema.prisma`: Relational database schema with models and relations.
  - `package.json` & `tsconfig.json`: Modern TypeScript configurations.
  - `.env.server`: Environment variables.
  - React frontend components (`MainPage.tsx`, `Layout.tsx`).
  - Backend operation handlers (`queries.ts`, `actions.ts`).

### B. Prohibition of Silent Engine Substitution
- When `--engine wasp` is requested in the CLI or specification JSON, Forge **strictly** generates Wasp files.
- Forge **never** silently substitutes the Universal Node engine when Wasp is requested.

### C. Native Platform Prerequisites & WSL Bridging
- Official Wasp tooling requires Linux, macOS, or WSL.
- On the current Windows host, WSL is not installed (`wsl --status` reports WSL is not installed).
- Therefore:
  - Wasp specification generation is **Emitted & Conforming**.
  - Local compilation and builds are truthfully marked **Unverified (WSL absent)**.
  - `forge wasp` provides clear, actionable instructions:
    ```bash
    wsl.exe --install
    wsl curl -sSL https://get.wasp.sh/installer.sh | sh
    ```

---

## 3. Upstream Repositories Immutability Guarantee

Both upstream repositories remain 100% pristine and unmodified:
- `D:\git hub\wasp` (`origin/main`)
- `D:\git hub\rea` (`origin/main`)
Verified by Git porcelain checks during build and in automated tests (`tests/phase12ParityAudit.test.ts`).
