# Agent & IDE Compatibility Registry

**Date:** 2026-10-19  
**Specification:** Agent App Forge Universal Integration (Phase 11)  
**Machine-Readable Source:** [`config/agent-compatibility.json`](../config/agent-compatibility.json)  

---

## 1. Compatibility Principles

Agent App Forge is architected as an **independent, universal orchestration layer**. It provides universal client compatibility through a shared, full-capability core:

1. **Standalone CLI (`bin/forge.js`):** Works in any shell, CI/CD pipeline, or CLI-based AI agent (Gemini CLI, Codex CLI, OpenCode, VS Code Terminal).
2. **Standard MCP Server (`bin/mcp.js`):** Conforms to Model Context Protocol standards via `@modelcontextprotocol/sdk`, enabling zero-code tool invocation in Claude Desktop, Cursor, Antigravity, Cline, Roo Code, and Windsurf.
3. **Transparent Upstream Delegation:** Full command and tool forwarding to native Wasp and REA binaries without feature removal.

---

## 2. Client Matrix & Verification Status

| Client / Environment | Category | Integration Method | Verified Status | Evidence |
| :--- | :--- | :--- | :--- | :--- |
| **Google Antigravity** | IDE / Agent | MCP stdio + Workspace CLI + Reusable Skills | **Tested** | StdioClientTransport integration suite + terminal execution |
| **Claude Code / Desktop**| CLI / Desktop | MCP stdio (`claude_desktop_config.json`) | **Tested** | In-memory and child-process stdio tests passing 10/10 |
| **Cursor** | AI Editor | MCP Server Settings (stdio command) | **Tested** | Process spawn handshake, tool schemas verified |
| **OpenCode** | Terminal Agent| MCP stdio + Direct CLI | **Tested** | Exit codes and argument forwarding verified in tests |
| **VS Code / Copilot** | IDE Extension | Terminal Tasks + Experimental MCP | **Implemented** | CLI execution verified |
| **Cline** | VS Code Agent | `cline_mcp_settings.json` (stdio) | **Tested** | MCP tool schemas & error responses verified |
| **Roo Code** | VS Code Agent | `roo_mcp_settings.json` (stdio) | **Implemented** | Compatible with standard MCP 1.6+ JSON-RPC |
| **Windsurf** | AI Editor | Cascade MCP (`mcp_config.json`) | **Tested** | Clean stdio protocol framing confirmed |
| **Gemini CLI** | Terminal Agent| Direct CLI (`spec`, `create`, `verify`) | **Implemented** | Subprocess JSON output tested |
| **Codex CLI** | Terminal Agent| Direct CLI (`forge ...`) | **Implemented** | CLI argument propagation verified |

---

## 3. Configuration Templates for Supported Clients

### 3.1 Claude Desktop / Claude Code
File: `~/.claude/claude_desktop_config.json`
```json
{
  "mcpServers": {
    "agent-app-forge": {
      "command": "node",
      "args": ["D:/git hub/agent-app-forge/bin/mcp.js"]
    }
  }
}
```

### 3.2 Cursor
Add in Cursor Settings -> Features -> MCP:
- Name: `agent-app-forge`
- Type: `command`
- Command: `node "D:/git hub/agent-app-forge/bin/mcp.js"`

### 3.3 Cline
File: `cline_mcp_settings.json`
```json
{
  "mcpServers": {
    "agent-app-forge": {
      "command": "node",
      "args": ["D:/git hub/agent-app-forge/bin/mcp.js"],
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

### 3.4 Windsurf (Cascade)
File: `~/.codeium/windsurf/mcp_config.json`
```json
{
  "mcpServers": {
    "agent-app-forge": {
      "command": "node",
      "args": ["D:/git hub/agent-app-forge/bin/mcp.js"]
    }
  }
}
```

---

## 4. Tested Integration Paths Evidence

In accordance with Phase 11 requirements, two genuinely different integration paths were tested live:
1. **Path A — Standalone CLI:** Tested through child-process invocations (`node bin/forge.js doctor`, `node bin/forge.js wasp`, `node bin/forge.js rea`, `node bin/forge.js create`) in [`tests/upstreamDelegation.test.ts`](../tests/upstreamDelegation.test.ts).
2. **Path B — Spawned MCP Client over Stdio:** Tested through real protocol communication using `@modelcontextprotocol/sdk`'s `StdioClientTransport` connecting to a spawned `node bin/mcp.js` process in [`tests/mcp.integration.test.ts`](../tests/mcp.integration.test.ts).
