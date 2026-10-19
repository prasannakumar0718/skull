import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ReaInvestigationBridge } from "../src/investigation/reaBridge.js";
import { DatabaseSync } from "node:sqlite";
import * as path from "node:path";
import * as fs from "node:fs";

describe("Phase 12: Complete Upstream REA MCP Integration & Capability Verification", () => {
  let client: Client;
  let transport: StdioClientTransport;
  const tempDbPath = path.resolve("./temp_phase12_test.db");

  beforeAll(async () => {
    // 1. Create lawful test SQLite database fixture
    if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
    const db = new DatabaseSync(tempDbPath);
    db.exec("CREATE TABLE audit_records (id INTEGER PRIMARY KEY, action TEXT, timestamp TEXT);");
    db.exec("INSERT INTO audit_records (action, timestamp) VALUES ('VERIFY_PHASE_12', '2026-10-19T20:30:00Z');");
    db.close();

    // 2. Connect live StdioClientTransport to Forge MCP server
    const serverScript = path.resolve("./bin/mcp.js");
    transport = new StdioClientTransport({
      command: process.execPath,
      args: [serverScript]
    });

    client = new Client(
      {
        name: "phase12-rea-full-auditor",
        version: "1.0.0"
      },
      {
        capabilities: {}
      }
    );

    await client.connect(transport);
  });

  afterAll(async () => {
    try {
      await client.close();
    } catch {}
    if (fs.existsSync(tempDbPath)) {
      try {
        fs.unlinkSync(tempDbPath);
      } catch {}
    }
  });

  it("retrieves the complete upstream REA tool inventory (all 207 tools)", () => {
    const bridge = new ReaInvestigationBridge();
    const tools = bridge.listSupportedReaTools();
    expect(tools.length).toBe(207);

    // Verify tools across distinct functional categories
    const toolNames = new Set(tools.map((t) => t.name));
    expect(toolNames.has("inspect_artifact")).toBe(true);
    expect(toolNames.has("inspect_sqlite_database")).toBe(true);
    expect(toolNames.has("inspect_wasm_artifact")).toBe(true);
    expect(toolNames.has("inspect_evm_interface")).toBe(true);
    expect(toolNames.has("inspect_go_binary")).toBe(true);
    expect(toolNames.has("inspect_rust_binary")).toBe(true);
    expect(toolNames.has("annotate_native_function")).toBe(true);
    expect(toolNames.has("trace_dylib_resolution")).toBe(true);
    expect(toolNames.has("list_frida_devices")).toBe(true);
  });

  it("exposes all 207 REA tools plus 7 Forge tools (214 total) over Forge MCP protocol", async () => {
    const result = await client.listTools();
    expect(result.tools.length).toBe(214);

    // 7 Forge core tools
    const toolNames = result.tools.map((t) => t.name);
    expect(toolNames).toContain("forge_inspect_reference");
    expect(toolNames).toContain("forge_create_spec");
    expect(toolNames).toContain("forge_generate_app");
    expect(toolNames).toContain("forge_verify_app");
    expect(toolNames).toContain("forge_recreate_app");
    expect(toolNames).toContain("forge_rea_tool");
    expect(toolNames).toContain("forge_wasp_cli");

    // Collision-safe REA tools
    expect(toolNames).toContain("rea_inspect_sqlite_database");
    expect(toolNames).toContain("rea_inspect_wasm_artifact");
    expect(toolNames).toContain("rea_inspect_evm_interface");
    expect(toolNames).toContain("rea_inspect_artifact");
  });

  it("invokes a tool outside the original 5 (inspect_sqlite_database) via direct collision-safe route rea_inspect_sqlite_database", async () => {
    const response = await client.callTool({
      name: "rea_inspect_sqlite_database",
      arguments: {
        path: tempDbPath.replace(/\\/g, "/"),
        schema_scope: "database"
      }
    });

    expect(response.isError).toBeFalsy();
    const content = (response.content as any)[0].text;
    expect(content).toContain("SQLite");
    expect(content).toContain("audit_records");
    expect(content).toContain("ev_");
  }, 45000);

  it("invokes the same tool through the universal proxy forge_rea_tool with full arguments", async () => {
    const response = await client.callTool({
      name: "forge_rea_tool",
      arguments: {
        toolName: "inspect_sqlite_database",
        toolArguments: {
          path: tempDbPath.replace(/\\/g, "/"),
          schema_scope: "database"
        }
      }
    });

    expect(response.isError).toBeFalsy();
    const content = (response.content as any)[0].text;
    expect(content).toContain("audit_records");
    expect(content).toContain("SQLite");
  }, 45000);

  it("truthfully returns an explicit diagnostic when a provider is unavailable rather than fabricated data", async () => {
    // annotate_native_function requires Ghidra or Hopper native provider session
    const response = await client.callTool({
      name: "rea_annotate_native_function",
      arguments: {
        procedure: "main",
        name: "renamed_main"
      }
    });

    // Should return error or diagnostic because Ghidra/Hopper session is absent
    const text = JSON.stringify(response);
    expect(text.length).toBeGreaterThan(0);
    // Either isError is true or response explicitly states missing session / unsupported provider
    const indicatesMissingProvider =
      response.isError === true ||
      text.includes("unsupported") ||
      text.includes("Missing") ||
      text.includes("session") ||
      text.includes("error");
    expect(indicatesMissingProvider).toBe(true);
  }, 45000);

  it("verifies native REA CLI pass-through functions independently of MCP", () => {
    const bridge = new ReaInvestigationBridge();
    const result = bridge.executeReaCliCommand(["--version"]);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("6.7.0");
  }, 30000);

  it("truthfully handles Wasp CLI delegation when WSL is absent without silent substitution", async () => {
    const response = await client.callTool({
      name: "forge_wasp_cli",
      arguments: {
        command: "version"
      }
    });

    expect(response.isError).toBe(true);
    const content = (response.content as any)[0].text;
    const parsed = JSON.parse(content);
    expect(parsed.status).toBe("unavailable");
    expect(parsed.remediation).toContain("curl -sSL https://get.wasp.sh | sh");
  });
});
