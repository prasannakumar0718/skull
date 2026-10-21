import { describe, it, expect } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { listAdapters, setupAdapter, resolveClientConfigPath } from "../src/adapters/index.js";

describe("Phase 14: Universal Distribution & Agent Adapters Suite", () => {
  const cliPath = path.resolve("./bin/forge.js");

  it("exposes 'forge capabilities' and returns comprehensive inventory", () => {
    const res = spawnSync(process.execPath, [cliPath, "capabilities"], { encoding: "utf-8" });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("Agent App Forge Capabilities Inventory");
    expect(res.stdout).toContain("214 tools exposed");
    expect(res.stdout).toContain("universal-node");
    expect(res.stdout).toContain("wasp");
    expect(res.stdout).toContain("207 tools declared");
  });

  it("exposes 'forge capabilities --json' with machine-readable schema", () => {
    const res = spawnSync(process.execPath, [cliPath, "capabilities", "--json"], { encoding: "utf-8" });
    expect(res.status).toBe(0);
    const parsed = JSON.parse(res.stdout);
    expect(parsed.name).toBe("agent-app-forge");
    expect(parsed.mcp.totalTools).toBe(214);
    expect(parsed.mcp.reaTools).toBe(207);
    expect(parsed.mcp.coreTools).toBe(7);
    expect(parsed.engines["universal-node"].supported).toBe(true);
    expect(parsed.adapters.supportedClients).toBe(10);
  });

  it("lists all 10 supported AI coding agents via adapter module and CLI", () => {
    const adapters = listAdapters();
    expect(adapters.length).toBe(10);

    const ids = adapters.map((a) => a.id);
    expect(ids).toContain("antigravity");
    expect(ids).toContain("claude-code");
    expect(ids).toContain("cursor");
    expect(ids).toContain("opencode");
    expect(ids).toContain("vscode-copilot");
    expect(ids).toContain("cline");
    expect(ids).toContain("roo-code");
    expect(ids).toContain("windsurf");
    expect(ids).toContain("gemini-cli");
    expect(ids).toContain("codex-cli");

    const cliRes = spawnSync(process.execPath, [cliPath, "adapters", "list", "--json"], { encoding: "utf-8" });
    expect(cliRes.status).toBe(0);
    const cliParsed = JSON.parse(cliRes.stdout);
    expect(cliParsed.length).toBe(10);
  });

  it("executes 'forge adapters doctor' and reports configuration file states", () => {
    const res = spawnSync(process.execPath, [cliPath, "adapters", "doctor"], { encoding: "utf-8" });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain("AI Agent Adapter Health Check");
    expect(res.stdout).toContain("Google Antigravity");
  });

  it("performs dry-run adapter setup without modifying configuration files", async () => {
    const res = await setupAdapter("claude-code", { dryRun: true });
    expect(res.dryRun).toBe(true);
    expect(res.success).toBe(true);
    expect(res.actionTaken).toBe("dry_run_preview");
    expect(res.diff).toContain("agent-app-forge");
  });

  it("merges adapter configuration safely, creates a backup, and preserves unrelated MCP servers", async () => {
    const tempDir = path.join(os.tmpdir(), `forge_adapter_test_${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    const dummyConfigFile = path.join(tempDir, "test_mcp_config.json");

    try {
      // Create existing config with an unrelated existing server
      const initialConfig = {
        mcpServers: {
          "unrelated-server": {
            command: "npx",
            args: ["unrelated-tool"]
          }
        }
      };
      fs.writeFileSync(dummyConfigFile, JSON.stringify(initialConfig, null, 2), "utf-8");

      // Setup adapter with customPath
      const result = await setupAdapter("claude-code", {
        customPath: dummyConfigFile
      });

      expect(result.success).toBe(true);
      expect(result.actionTaken).toBe("merged");
      expect(result.backupPath).toBeDefined();
      expect(fs.existsSync(result.backupPath!)).toBe(true);

      // Verify merged content
      const updated = JSON.parse(fs.readFileSync(dummyConfigFile, "utf-8"));
      expect(updated.mcpServers["unrelated-server"]).toBeDefined();
      expect(updated.mcpServers["agent-app-forge"]).toBeDefined();
      expect(updated.mcpServers["agent-app-forge"].command).toBe("npx");
    } finally {
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch {}
    }
  });

  it("validates package.json distribution properties and binary aliases", () => {
    const pkg = JSON.parse(fs.readFileSync(path.resolve("./package.json"), "utf-8"));
    expect(pkg.bin.forge).toBe("bin/forge.js");
    expect(pkg.bin["agent-app-forge"]).toBe("bin/forge.js");
    expect(pkg.files).toContain("dist");
    expect(pkg.files).toContain("bin");
    expect(pkg.files).toContain("config");
    expect(pkg.files).toContain("templates");
    expect(pkg.engines.node).toBeDefined();
  });

  it("confirms distribution templates contain zero hardcoded local Windows paths", () => {
    const templatesDir = path.resolve("./templates");
    function checkDir(dir: string) {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const ent of entries) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) {
          checkDir(full);
        } else {
          const content = fs.readFileSync(full, "utf-8");
          expect(content).not.toContain("D:\\git hub\\agent-app-forge");
          expect(content).not.toContain("C:\\Users\\PRASANNA KUMAR");
        }
      }
    }
    checkDir(templatesDir);
  });

  it("programmatically confirms upstream repositories (wasp and rea) remain 100% pristine", () => {
    const waspPath = path.resolve("../wasp");
    const reaPath = path.resolve("../rea");

    if (fs.existsSync(waspPath)) {
      const waspStatus = execFileSync("git", ["-C", waspPath, "status", "--porcelain"], { encoding: "utf-8" });
      expect(waspStatus.trim()).toBe("");
    }

    if (fs.existsSync(reaPath)) {
      const reaStatus = execFileSync("git", ["-C", reaPath, "status", "--porcelain"], { encoding: "utf-8" });
      expect(reaStatus.trim()).toBe("");
    }
  });
});
