# Agent App Forge — Beginner's Quick-Start Guide

Welcome to **Agent App Forge**! This guide takes you step-by-step from cloning the repository to connecting it to your AI coding assistant (like Google Antigravity) and generating your first full-stack application.

---

## 1. What is Agent App Forge?

Agent App Forge is an AI-powered coding and recreation toolkit. It allows you to describe any web application in plain English or provide a website URL, and it will:
1. **Investigate:** Deeply inspect the reference website or understand your request.
2. **Specify & Plan:** Define clean data models, REST endpoints, and workflows.
3. **Build:** Generate complete, runnable full-stack applications with built-in SQLite database storage.
4. **Verify & Repair:** Automatically test that the server starts, test routes, and repair syntax errors if any occur.
5. **Report:** Deliver a running application and a transparent verification report.

You do **not** need to understand reverse-engineering internals, ASTs, Playwright scripts, or MCP schemas to use Forge.

---

## 2. Prerequisites

Before starting, ensure your system has:
- **Node.js**: **Version 22.13.0 or higher** (Run `node -v` to check; Node.js 24 is also supported). Forge uses built-in SQLite (`node:sqlite`), so no extra database server is needed!
- **Git**: Installed and available in your terminal (`git --version`).
- **Operating System**: Windows, macOS, or Linux.

---

## 3. Install and Build Locally

Because Agent App Forge v0.1.1 is being released, you can install and build it directly from this local repository:

```bash
# 1. Clone the repository (if you have not already)
git clone https://github.com/prasannakumar0718/skull.git
cd skull/agent-app-forge

# 2. Install dependencies
npm install

# 3. Build the project
npm run build

# 4. Verify system readiness with the built-in doctor command
node bin/forge.js doctor
```

> **Note on npm Registry:** If you see documentation mentioning `npm install -g agent-app-forge`, note that npm global installation will become active once published to the npm registry. For now, running `node bin/forge.js` or `node bin/mcp.js` from this repository is the official local entry point.

---

## 4. Connecting to Google Antigravity MCP

Agent App Forge exposes an interactive **Model Context Protocol (MCP)** server over standard input/output (stdio). This allows Google Antigravity (and other assistants like Claude Code or Cursor) to call Forge tools autonomously.

### The Exact Antigravity MCP Configuration

In Antigravity, MCP servers are configured in your agent configuration. Add `agent-app-forge` using the absolute path to your local `bin/mcp.js`:

#### On Windows:
```json
{
  "mcpServers": {
    "agent-app-forge": {
      "command": "node",
      "args": ["D:\\git hub\\agent-app-forge\\bin\\mcp.js"]
    }
  }
}
```

#### On macOS / Linux:
```json
{
  "mcpServers": {
    "agent-app-forge": {
      "command": "node",
      "args": ["/absolute/path/to/skull/agent-app-forge/bin/mcp.js"]
    }
  }
}
```

---

## 5. Merging with Existing MCP Servers

If you already have other MCP servers configured (such as Firebase, GitHub, or Python servers), **do not overwrite** your entire config file. Simply add `agent-app-forge` as an additional entry under `"mcpServers"`:

```json
{
  "mcpServers": {
    "existing-server-1": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-everything"]
    },
    "agent-app-forge": {
      "command": "node",
      "args": ["D:\\git hub\\agent-app-forge\\bin\\mcp.js"]
    }
  }
}
```

---

## 6. Reloading & Verifying the MCP Server

1. **Reload MCP:** Restart your Antigravity session or reload MCP servers in your editor settings.
2. **Check Available Tools:** Ask your assistant:
   > *"What tools does Agent App Forge provide?"*
3. **Verify Response:** Your assistant should see the 9 core Forge tools:
   - `forge_capabilities`: Check system features and supported engines.
   - `forge_recreate_app`: Autonomous recreation and greenfield generation pipeline.
   - `forge_create_spec`: Converts requirements into specification models.
   - `forge_generate_app`: Scaffolds full-stack code with SQLite storage.
   - `forge_verify_app`: Runs automated verification and bounded repair.
   - `forge_inspect_reference`: Probes existing codebases and schemas.
   - `forge_rea_discover`: Discovers deep reverse-engineering capabilities.
   - `forge_rea_tool`: Universal executor for analysis tools.
   - `forge_wasp_cli`: Upstream Wasp CLI delegation.

---

## 7. Copy-and-Paste First Prompts

Once connected, you can simply talk to your AI assistant. Here are two ready-to-use prompts:

### Prompt 1: Recreate an Existing Website
```text
Recreate https://example.com in ./output/example-app and verify fidelity.
```

### Prompt 2: Build a New Application from Scratch
```text
Build a student management application with a dashboard, student records, attendance tracking, and fee tracking in ./output/student-app. Use persistent storage, include useful validation, and make the interface easy to use.
```

---

## 8. How to Find and Run Your Generated Project

When Forge completes generation, it reports the directory where your application was built (e.g. `./output/student-app`).

To run your new application:
```bash
# 1. Navigate to the generated project directory
cd output/student-app

# 2. Start the application server
node server.js
```

Open your browser to:
```text
http://localhost:3000
```
*(If port 3000 is occupied, Forge will automatically bind to another available port and print it in the console).*

Your application is completely self-contained:
- Built with zero runtime npm dependencies.
- Persistent data is stored in `app.db` via Node.js native SQLite (WAL mode).
- Refreshing the browser or restarting `node server.js` will keep your saved data!

---

## 9. Inspecting Verification Results & Limitations

Every generated project includes automated verification files:
- `forgespec.json`: The formal specification of entities, endpoints, and workflows.
- `implementation-plan.json`: The 6-stage engineering plan executed.
- `test.js` & `workflow.test.js`: Integration tests verifying endpoints and persistence.
- `browser-comparison.json` (for reference recreations): Contains side-by-side scores:
  - **Application Quality Score:** Whether the server boots, routes respond, and SQLite WAL persistence succeeds.
  - **Reference Fidelity Score:** How faithfully the recreation preserves the headings, links, and controls of the reference.

---

## 10. Common Errors & Troubleshooting

| Error / Symptom | Cause | Solution |
| :--- | :--- | :--- |
| `Cannot find module 'node:sqlite'` | Node.js version is older than `22.13.0`. | Upgrade Node.js to `v22.13.0` or higher (`node -v`). |
| `MCP stdio connection timed out` | Invalid path in MCP configuration args. | Verify the absolute path to `bin/mcp.js`. In Windows JSON strings, remember to use double backslashes (`D:\\path\\to\\bin\\mcp.js`). |
| `Cannot inspect live website` | Reference URL is offline, down, or blocked. | Verify the URL is reachable in your browser. Forge will honestly report when a reference is offline and fall back to your prompt description. |
| `Wasp engine unavailable` | Wasp CLI requires Linux or WSL on Windows. | By default, Forge automatically selects the Universal Node engine, which runs natively on Windows, macOS, and Linux without WSL. |
| Port in use error | Another process is using port 3000. | Set the `PORT` environment variable before running: `PORT=3001 node server.js`. |
