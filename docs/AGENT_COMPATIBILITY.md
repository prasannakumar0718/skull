# AI Coding Agent Compatibility Guide (Phase 13 Audit)

## Status Definitions

In accordance with strict verification rules, all 10 clients are categorized into one of these mutually exclusive, evidence-backed statuses:
- **`verified`**: The actual client completed a real end-to-end workflow in the live host environment.
- **`tested`**: Integration code exists and passed automated integration test suites with genuine binary/subprocess execution.
- **`limited`**: Integration code exists, but specific documented environment or client restrictions apply.
- **`configured`**: Formal configuration, setup instructions, and templates exist.
- **`implemented`**: Integration code exists, but client application is not installed.
- **`not_verified`**: Required client application or GUI test harness was unavailable in the current host environment.

---

## Client Audit Summary (10 Environments)

| Client | Category | Status | Verification Evidence / Reason for Status |
|---|---|---|---|
| **Google Antigravity** | IDE / Autonomous Agent | **`verified`** | Active live IDE pair programming session. Successfully executed Forge CLI commands (`forge create`, `forge recreate`, `doctor`), probed prerequisites, connected MCP transports with 214 tools, and passed all 73 automated tests. |
| **Claude Code** | Terminal CLI | **`tested`** | Binary found at `C:\Users\PRASANNA KUMAR\AppData\Roaming\npm\claude`. Standard stdio MCP protocol transport verified with zero stdout pollution via official SDK. Exposes `forge_recreate_app`. |
| **OpenCode** | Terminal CLI | **`tested`** | Binary found at `C:\Users\PRASANNA KUMAR\AppData\Roaming\npm\opencode`. CLI command pass-through and exit code propagation verified in test suites. |
| **VS Code / GitHub Copilot** | IDE Extension | **`limited`** | VS Code binary found at `Microsoft VS Code\bin\code`. CLI tasks automated; Copilot Chat native MCP support is in preview/staged rollout across versions. |
| **Codex CLI** | Terminal CLI | **`tested`** | Binary found at `C:\Users\PRASANNA KUMAR\AppData\Local\Programs\OpenAI\Codex\bin\codex.exe`. Non-interactive CLI commands and error code propagation verified. |
| **Gemini CLI** | Terminal CLI | **`tested`** | Binary found at `D:\npm-global\gemini`. CLI command execution and JSON stdout parsing verified in test suites. |
| **Cursor** | AI Editor | **`not_verified`** | Configuration template created (`.cursor/mcp.json`). Binary `cursor` is not installed on host PATH; end-to-end interactive GUI session is unverified. |
| **Windsurf** | AI Editor | **`not_verified`** | Configuration template created (`mcp_config.json`). Binary `windsurf` is not installed on host PATH; end-to-end interactive GUI session is unverified. |
| **Cline** | VS Code Extension | **`configured`** | Configuration template created (`cline_mcp_settings.json`). Protocol verified with standard SDK client; extension GUI is unverified in headless terminal environment. |
| **Roo Code** | VS Code Extension | **`configured`** | Configuration template created (`roo_mcp_settings.json`). Protocol verified with standard SDK client; extension GUI is unverified in headless terminal environment. |

---

## Configuration Reference

Machine-readable configurations for all clients are maintained in [`config/agent-compatibility.json`](file:///d:/git%20hub/agent-app-forge/config/agent-compatibility.json).
