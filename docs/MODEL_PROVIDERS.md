# AI Model Provider Independence & OpenRouter Integration

Agent App Forge is designed to be **model-agnostic** and **vendor-neutral**.

---

## 🌐 Architectural Principle: Decoupled Reasoning

Agent App Forge provides orchestration, investigation, specification, generation, and verification tooling. It deliberately separates:
1. **The LLM Reasoning Session:** Executed inside the user's AI coding client (Antigravity, Claude Code, Cursor, Cline, Roo Code, OpenCode).
2. **The Execution & Synthesis Layer:** Handled by Agent App Forge via standard Model Context Protocol (MCP) tool calls and CLI invocations.

This architecture ensures:
- **Zero Vendor Lock-in:** Forge operates identically whether the client is driven by Anthropic (Claude 3.7 Sonnet / Opus), OpenAI (GPT-4o, o3-mini), Google (Gemini 2.5 Pro / Flash), DeepSeek, Meta (Llama 3.3), Qwen, or local models via Ollama.
- **Zero API Key Leakage:** Forge itself requires no model API keys. The client manages its own provider authentication securely.
- **Zero Redundant Inference Costs:** Forge does not spin up secondary LLM calls behind your back. The client reasoning context orchestrates Forge tools directly.

---

## 🔀 OpenRouter-Backed Workflows

[OpenRouter](https://openrouter.ai) provides a unified API gateway to hundreds of frontier and open-weight AI models.

### How OpenRouter Connects with Forge

```
┌─────────────────────────┐
│     User / Developer    │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐         API Key
│  AI Coding Client       │ ◄───────────────────── OpenRouter API
│  (Cline, Roo, OpenCode) │                       (Claude, GPT, DeepSeek, Llama)
└───────────┬─────────────┘
            │
            │  Standard MCP Protocol (stdio)
            ▼
┌─────────────────────────┐
│     Agent App Forge     │
│  (214 Tools, Verifier,  │
│   SQLite WAL, Engines)  │
└─────────────────────────┘
```

1. **OpenRouter is configured in your AI coding client**, not inside Agent App Forge.
2. The coding client receives user prompts, selects an OpenRouter-routed model (e.g. `anthropic/claude-3.7-sonnet`, `deepseek/deepseek-r1`, `openai/o3-mini`), and manages inference.
3. The model calls Agent App Forge's MCP tools (`forge_recreate_app`, `forge_create_spec`, `forge_generate_app`, `rea_*`).
4. Forge executes the deterministic investigation, synthesis, and verification steps locally, returning structured results back to the client.

### Client-Specific OpenRouter Setup Examples

#### 1. Cline / Roo Code (VS Code Extension)
1. Open Cline/Roo Settings $\rightarrow$ **API Provider** $\rightarrow$ Select **OpenRouter**.
2. Enter your OpenRouter API Key (`sk-or-v1-...`).
3. Select your model (e.g. `anthropic/claude-3.7-sonnet`).
4. In MCP Settings, configure Forge:
   ```json
   {
     "mcpServers": {
       "agent-app-forge": {
         "command": "npx",
         "args": ["-y", "agent-app-forge", "mcp"]
       }
     }
   }
   ```
5. Cline will use OpenRouter for reasoning and Forge for software generation.

#### 2. OpenCode (Terminal Agent)
1. Set the OpenRouter API key in your environment:
   ```bash
   export OPENROUTER_API_KEY="sk-or-v1-..."
   ```
2. Configure OpenCode with OpenRouter provider:
   ```json
   {
     "provider": "openrouter",
     "model": "anthropic/claude-3.7-sonnet",
     "mcpServers": {
       "agent-app-forge": {
         "command": "npx",
         "args": ["-y", "agent-app-forge", "mcp"]
       }
     }
   }
   ```

---

## 🔒 Security & Credential Hygiene

- **Never Commit API Keys:** OpenRouter API keys should reside solely in client credential stores or local environment variables.
- **Sandboxed Execution:** Generated applications use native SQLite databases with zero telemetry or network calls.
- **Redaction:** Forge's error sanitizer automatically redacts authorization headers, tokens, and file paths matching `Bearer`, `sk-`, and sensitive secrets.
