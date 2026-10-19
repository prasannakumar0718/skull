# Agent App Forge

> AI coding-agent infrastructure connecting reverse engineering investigation with declarative web application generation and autonomous self-repair.

---

## 🌟 Overview

Agent App Forge integrates:
* **Investigation Engine (REA):** Deep reverse engineering across codebases, Prisma/SQL schemas, and API routes.
* **Synthesis Engine (Wasp & Full-Stack Node):** Declarative generation of full-stack web applications with persistent storage.
* **Verification & Self-Repair:** Automated verification testing, error diagnosis, and focused repairs before preview.
* **Dual Interface:** Accessible as a **Model Context Protocol (MCP)** server for AI agents and as an interactive **CLI tool** for developers.

---

## 🚀 Quick Start

### 1. Installation & Build
```bash
cd agent-app-forge
npm install
npm run build
npm test
```

### 2. Using the CLI

#### Create an Application from Natural Language
```bash
node bin/forge.js create "Build a task manager with persistent storage" --output ../my-task-app
```

#### Inspect an Existing Codebase for Patterns
```bash
node bin/forge.js inspect ../wasp/examples/kitchen-sink
```

#### Verify & Self-Repair an Application
```bash
node bin/forge.js verify ../my-task-app
```

### 3. Using as an MCP Server
Add Agent App Forge to your AI agent's configuration (`mcpServers` in Claude, Cursor, Antigravity, or Codex):

```json
{
  "mcpServers": {
    "agent-app-forge": {
      "command": "node",
      "args": ["d:/git hub/agent-app-forge/bin/mcp.js"]
    }
  }
}
```

Available MCP Tools:
- `forge_inspect_reference`: Reverse-engineers schemas and route endpoints from a reference project.
- `forge_create_spec`: Converts natural language prompts into strongly validated `ForgeSpec` JSON.
- `forge_generate_app`: Scaffolds full-stack applications into target directories.
- `forge_verify_app`: Runs automated unit/structural checks and applies self-healing repairs.

---

## 📁 Repository Structure

```
agent-app-forge/
├── bin/
│   ├── forge.js           # CLI executable
│   └── mcp.js             # MCP server executable
├── docs/
│   ├── ARCHITECTURE.md    # System architecture & data flow
│   ├── INTEGRATION_PLAN.md# Wasp & REA integration strategy
│   ├── SECURITY_MODEL.md  # Threat boundaries & path sanitization
│   └── research/
│       └── SOURCE_ANALYSIS.md # Deep analysis of Wasp & REA source trees
├── src/
│   ├── cli/               # Commander-based CLI commands
│   ├── engines/           # WaspEngine & UniversalNodeEngine orchestrator
│   ├── investigation/     # REA inspection bridge with fallback
│   ├── mcp/               # Model Context Protocol stdio server
│   ├── spec/              # Zod validation schemas & prompt parser
│   └── verifier/          # Autonomous test runner & self-repair loop
└── tests/
    └── forge.test.ts      # Vitest test suite
```

---

## 📜 License
MIT © Agent App Forge Contributors.
Third-party notices preserved for Wasp (MIT) and REA (MIT).
