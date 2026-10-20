import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { createForgeMcpServer, FORGE_SERVER_INSTRUCTIONS } from "../src/mcp/server.js";
import { ReaInvestigationBridge } from "../src/investigation/reaBridge.js";
import { DatabaseSync } from "node:sqlite";
import * as path from "node:path";
import * as fs from "node:fs";

describe("MCP Architecture Correction: Compact-by-Default & Dynamic REA Discovery Suite", () => {
  const tempDbPath = path.resolve("./temp_mcp_compact_test.db");

  beforeAll(() => {
    if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
    const db = new DatabaseSync(tempDbPath);
    db.exec("CREATE TABLE compact_audit (id INTEGER PRIMARY KEY, metric TEXT, value TEXT);");
    db.exec("INSERT INTO compact_audit (metric, value) VALUES ('context_optimization', 'verified');");
    db.close();
  });

  afterAll(() => {
    if (fs.existsSync(tempDbPath)) {
      try {
        fs.unlinkSync(tempDbPath);
      } catch {}
    }
  });

  describe("1. Default Compact Mode & Server Initialization", () => {
    let client: Client;
    let clientTransport: InMemoryTransport;
    let serverTransport: InMemoryTransport;
    let server: ReturnType<typeof createForgeMcpServer>;

    beforeAll(async () => {
      [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
      server = createForgeMcpServer(); // Default compact mode
      await server.connect(serverTransport);

      client = new Client({ name: "compact-auditor", version: "1.0.0" }, { capabilities: {} });
      await client.connect(clientTransport);
    });

    afterAll(async () => {
      await client.close();
      await server.close();
    });

    it("advertises server instructions in initialization response explaining Forge's core job", () => {
      const instructions = client.getInstructions ? client.getInstructions() : "";
      expect(instructions).toBeTruthy();
      expect(instructions).toContain("Agent App Forge is an agent-agnostic software recreation");
      expect(instructions).toContain("forge_recreate_app");
      expect(instructions).toContain("forge_create_spec");
      expect(instructions).toContain("forge_generate_app");
      expect(instructions).toContain("forge_verify_app");
      expect(instructions).toContain("Discover and invoke native REA tools");
      expect(instructions).toContain("Report evidence, failures, and unknowns honestly");
    });

    it("exposes exactly 9 core Forge tools in default compact mode", async () => {
      const result = await client.listTools();
      expect(result.tools.length).toBe(9);

      const toolNames = result.tools.map((t) => t.name);
      expect(toolNames).toEqual([
        "forge_capabilities",
        "forge_inspect_reference",
        "forge_create_spec",
        "forge_recreate_app",
        "forge_generate_app",
        "forge_verify_app",
        "forge_rea_discover",
        "forge_rea_tool",
        "forge_wasp_cli"
      ]);

      // Every core tool has an informative description and valid schema
      for (const tool of result.tools) {
        expect(tool.description).toBeTruthy();
        expect(tool.description.length).toBeGreaterThan(20);
        expect(tool.inputSchema.type).toBe("object");
      }
    });

    it("measures compact mode schema payload size proving >99% context token reduction", async () => {
      const result = await client.listTools();
      const compactJson = JSON.stringify(result.tools);
      const compactBytes = compactJson.length;
      const compactTokens = Math.round(compactBytes / 4);

      // Verify compact schema is lightweight (< 8 KB, < 2,000 tokens)
      expect(compactBytes).toBeLessThan(8000);
      expect(compactTokens).toBeLessThan(2000);

      // Compare against full REA catalog size (773 KB, ~193,000 tokens)
      const bridge = new ReaInvestigationBridge();
      const allRea = bridge.listSupportedReaTools();
      const fullBytes = JSON.stringify(allRea).length;
      const fullTokens = Math.round(fullBytes / 4);

      const tokenSavingsPercent = ((fullTokens - compactTokens) / fullTokens) * 100;
      expect(tokenSavingsPercent).toBeGreaterThan(99.0);
    });

    it("invokes forge_capabilities and returns purpose, workflow, and engine status", async () => {
      const res = await client.callTool({
        name: "forge_capabilities",
        arguments: {}
      });

      expect(res.isError).toBeFalsy();
      const content = JSON.parse((res.content[0] as any).text);
      expect(content.name).toBe("agent-app-forge");
      expect(content.workflow).toBe("INVESTIGATE -> UNDERSTAND -> SPECIFY -> PLAN -> BUILD -> VERIFY -> COMPARE -> IMPROVE");
      expect(content.mcp.activeMode).toBe("compact");
      expect(content.mcp.toolsAdvertisedInSession).toBe(9);
      expect(content.mcp.totalReaToolsAvailable).toBe(207);
      expect(content.engines["universal-node"].supported).toBe(true);
      expect(content.prerequisites.node.isSupported).toBe(true);
    });

    it("invokes forge_rea_discover to search REA tools by keyword", async () => {
      const res = await client.callTool({
        name: "forge_rea_discover",
        arguments: { query: "sqlite" }
      });

      expect(res.isError).toBeFalsy();
      const data = JSON.parse((res.content[0] as any).text);
      expect(data.totalMatched).toBeGreaterThanOrEqual(1);
      expect(data.matches.some((m: any) => m.name === "inspect_sqlite_database")).toBe(true);

      const sqliteTool = data.matches.find((m: any) => m.name === "inspect_sqlite_database");
      expect(sqliteTool.description).toBeTruthy();
      expect(sqliteTool.inputSchema).toBeDefined();
      expect(sqliteTool.category).toBe("database");
    });

    it("invokes forge_rea_discover to filter REA tools by category", async () => {
      const res = await client.callTool({
        name: "forge_rea_discover",
        arguments: { category: "web", limit: 5 }
      });

      expect(res.isError).toBeFalsy();
      const data = JSON.parse((res.content[0] as any).text);
      expect(data.totalMatched).toBe(36);
      expect(data.matches.length).toBe(5);
      for (const m of data.matches) {
        expect(m.category).toBe("web");
      }
    });

    it("invokes forge_rea_discover with refresh: true to detect live REA runtime", async () => {
      const res = await client.callTool({
        name: "forge_rea_discover",
        arguments: { refresh: true, limit: 3 }
      });

      expect(res.isError).toBeFalsy();
      const data = JSON.parse((res.content[0] as any).text);
      expect(data.totalAvailable).toBe(207);
      expect(data.reaVersion).toBeTruthy();
      expect(data.availableCategories.length).toBeGreaterThanOrEqual(8);
    });

    it("executes forge_rea_tool with structured object arguments", async () => {
      const res = await client.callTool({
        name: "forge_rea_tool",
        arguments: {
          toolName: "inspect_sqlite_database",
          toolArguments: {
            path: tempDbPath.replace(/\\/g, "/"),
            schema_scope: "database"
          }
        }
      });

      expect(res.content).toBeDefined();
      const text = (res.content[0] as any).text;
      expect(text).toContain("compact_audit");
    });

    it("executes forge_rea_tool with serialized JSON string arguments (Requirement 6)", async () => {
      const serializedArgs = JSON.stringify({
        path: tempDbPath.replace(/\\/g, "/"),
        schema_scope: "database"
      });

      const res = await client.callTool({
        name: "forge_rea_tool",
        arguments: {
          toolName: "inspect_sqlite_database",
          toolArguments: serializedArgs
        }
      });

      expect(res.content).toBeDefined();
      const text = (res.content[0] as any).text;
      expect(text).toContain("compact_audit");
    });

    it("validates missing required arguments before delegation and returns helpful error", async () => {
      const res = await client.callTool({
        name: "forge_rea_tool",
        arguments: {
          toolName: "inspect_sqlite_database",
          toolArguments: {} // Missing required 'path'
        }
      });

      expect(res.isError).toBe(true);
      const text = (res.content[0] as any).text;
      expect(text).toContain("Schema validation error");
      expect(text).toContain("path");
    });

    it("allows direct execution of rea_<name> tools even in compact mode for full compatibility", async () => {
      const res = await client.callTool({
        name: "rea_inspect_sqlite_database",
        arguments: {
          path: tempDbPath.replace(/\\/g, "/"),
          schema_scope: "database"
        }
      });

      expect(res.isError).toBeFalsy();
      const text = (res.content[0] as any).text;
      expect(text).toContain("compact_audit");
    });
  });

  describe("2. Full Mode Opt-In Verification", () => {
    let client: Client;
    let clientTransport: InMemoryTransport;
    let serverTransport: InMemoryTransport;
    let server: ReturnType<typeof createForgeMcpServer>;

    beforeAll(async () => {
      [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
      server = createForgeMcpServer({ mode: "full" });
      await server.connect(serverTransport);

      client = new Client({ name: "full-mode-auditor", version: "1.0.0" }, { capabilities: {} });
      await client.connect(clientTransport);
    });

    afterAll(async () => {
      await client.close();
      await server.close();
    });

    it("exposes all 216 tools (9 core + 207 native REA tools) in full mode", async () => {
      const result = await client.listTools();
      expect(result.tools.length).toBe(216);

      const names = result.tools.map((t) => t.name);
      expect(names).toContain("forge_capabilities");
      expect(names).toContain("forge_rea_discover");
      expect(names).toContain("rea_inspect_sqlite_database");
      expect(names).toContain("rea_inspect_artifact");
      expect(names).toContain("rea_inspect_wasm_artifact");
    });
  });

  describe("3. Stdio Server CLI Flags & Transport Verification", () => {
    it("starts stdio MCP server in default compact mode over CLI", async () => {
      const mcpBin = path.resolve("./bin/mcp.js");
      const transport = new StdioClientTransport({
        command: process.execPath,
        args: [mcpBin]
      });

      const client = new Client({ name: "stdio-compact-test", version: "1.0.0" }, { capabilities: {} });
      try {
        await client.connect(transport);
        const tools = await client.listTools();
        expect(tools.tools.length).toBe(9);
      } finally {
        await client.close();
      }
    });

    it("starts stdio MCP server in full mode via --mode full argument", async () => {
      const mcpBin = path.resolve("./bin/mcp.js");
      const transport = new StdioClientTransport({
        command: process.execPath,
        args: [mcpBin, "--mode", "full"]
      });

      const client = new Client({ name: "stdio-full-test", version: "1.0.0" }, { capabilities: {} });
      try {
        await client.connect(transport);
        const tools = await client.listTools();
        expect(tools.tools.length).toBe(216);
      } finally {
        await client.close();
      }
    });
  });
});
