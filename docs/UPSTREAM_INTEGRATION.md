# Upstream Integration Architecture (Phase 12 Audit)

## 1. REA Integration: Complete 207-Tool Upstream Delegation

### A. Architectural Reality vs. Hardcoded Assumptions
In early integration phases, only a 5-tool subset (`inspect_artifact`, `analyze_function`, `compare_artifacts`, `get_call_graph`, `get_evidence_bundle`) was exposed. As established in Phase 12:
- Upstream REA v6.7.0 publishes **207 distinct tools** defined across 36 contract modules.
- Agent App Forge now exposes all 207 tools over standard MCP and provides direct pass-through via CLI.
- No upstream tool is omitted, simplified, or pruned.

### B. Upstream Discovery & Version Synchronization
- Upstream inventory is discovered directly via MCP `tools/list` from the live REA runtime (`rea-agents@6.7.0`).
- Inventory metadata and schemas are captured in `src/investigation/reaCatalog.json` and `docs/audits/rea_upstream_tools_catalog.json`.
- When Forge MCP server initializes, it dynamically maps all 207 tools to collision-safe names (`rea_${tool.name}`) while preserving descriptions and input schemas.

### C. Execution Paths
1. **Direct Collision-Safe MCP Call (`rea_<name>`):**
   - The MCP client calls e.g. `rea_inspect_sqlite_database` with `{ path: "...", schema_scope: "database" }`.
   - Forge strips `rea_` to obtain `inspect_sqlite_database`.
   - Forge spawns a live StdioClientTransport connected to REA (`npx --yes rea-agents@6.7.0 --mcp`).
   - REA executes the tool, calculates SHA-256 digests, extracts schemas, and returns structured evidence (`evidence_id`, `normalized_result`, `limitations`).
   - Forge faithfully returns this output to the client.
2. **Universal MCP Proxy Call (`forge_rea_tool`):**
   - The client invokes `forge_rea_tool` with `{ toolName: "...", toolArguments: { ... } }`.
   - Forge forwards the request to the upstream REA MCP server and returns the structured result.
3. **CLI Pass-Through (`forge rea <args...>`):**
   - Developer or terminal agent runs `forge rea --version` or `forge rea scan ...`.
   - Forge forwards arguments directly to the REA CLI runtime. Tested and verified (`forge rea --version` outputs `6.7.0`).

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
