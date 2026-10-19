import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createForgeMcpServer } from "../src/mcp/server.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

describe("Agent App Forge - Real MCP Protocol Integration Suite", () => {
  let client: Client;
  let clientTransport: InMemoryTransport;
  let serverTransport: InMemoryTransport;
  let server: ReturnType<typeof createForgeMcpServer>;

  beforeAll(async () => {
    [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    server = createForgeMcpServer();
    await server.connect(serverTransport);

    client = new Client(
      {
        name: "test-client",
        version: "1.0.0"
      },
      {
        capabilities: {}
      }
    );

    await client.connect(clientTransport);
  });

  afterAll(async () => {
    await client.close();
    await server.close();
  });

  it("completes MCP initialization and capability negotiation", () => {
    expect(client.getServerVersion()).toEqual({
      name: "io.github.agent-app-forge/server",
      version: "0.1.0"
    });
  });

  it("discovers all registered tools with valid schemas via listTools", async () => {
    const response = await client.listTools();
    const toolNames = response.tools.map((t) => t.name);

    expect(toolNames).toContain("forge_inspect_reference");
    expect(toolNames).toContain("forge_create_spec");
    expect(toolNames).toContain("forge_generate_app");
    expect(toolNames).toContain("forge_verify_app");
    expect(toolNames).toContain("forge_rea_tool");
    expect(toolNames).toContain("forge_wasp_cli");

    for (const tool of response.tools) {
      expect(tool.description).toBeTruthy();
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe("object");
      expect(tool.inputSchema.properties).toBeDefined();
    }
  });

  it("invokes forge_create_spec and receives structured spec and validation", async () => {
    const result = await client.callTool({
      name: "forge_create_spec",
      arguments: {
        prompt: "Build a task manager with persistent storage",
        appName: "protocol-task"
      }
    });

    expect(result.isError).toBeFalsy();
    expect(result.content).toBeDefined();
    expect(Array.isArray(result.content)).toBe(true);

    const firstContent = result.content[0] as { type: string; text: string };
    expect(firstContent.type).toBe("text");

    const parsed = JSON.parse(firstContent.text);
    expect(parsed.spec).toBeDefined();
    expect(parsed.spec.name).toBe("protocol-task");
    expect(parsed.validation.valid).toBe(true);
    expect(parsed.spec.entities.some((e: any) => e.name === "Task")).toBe(true);
  });

  it("handles malformed tool arguments gracefully with structured error", async () => {
    const result = await client.callTool({
      name: "forge_create_spec",
      arguments: {
        prompt: "" // empty prompt should be rejected
      }
    });

    expect(result.isError).toBe(true);
    const content = result.content[0] as { type: string; text: string };
    expect(content.text).toContain("Invalid arguments");
  });

  it("handles unknown tool invocation with structured error", async () => {
    const result = await client.callTool({
      name: "non_existent_tool",
      arguments: {}
    });

    expect(result.isError).toBe(true);
    const content = result.content[0] as { type: string; text: string };
    expect(content.text).toContain("Unknown tool");
  });

  it("invokes forge_inspect_reference and returns genuine investigation report", async () => {
    // Target our own project root as a reference
    const projectRoot = path.resolve(".");
    const result = await client.callTool({
      name: "forge_inspect_reference",
      arguments: {
        referencePath: projectRoot
      }
    });

    expect(result.isError).toBeFalsy();
    const content = result.content[0] as { type: string; text: string };
    const parsed = JSON.parse(content.text);
    expect(parsed.isAvailable).toBeDefined();
    expect(parsed.provider).toBeDefined();
    expect(Array.isArray(parsed.evidence)).toBe(true);
  });

  it("executes full generation and verification lifecycle via MCP tools", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "forge-mcp-e2e-"));

    // 1. Create spec via MCP
    const specCall = await client.callTool({
      name: "forge_create_spec",
      arguments: {
        prompt: "Build a persistent task manager",
        appName: "mcp-e2e-app"
      }
    });
    const specData = JSON.parse((specCall.content[0] as any).text);

    // 2. Generate app via MCP
    const genCall = await client.callTool({
      name: "forge_generate_app",
      arguments: {
        spec: specData.spec,
        outputDirectory: tempDir
      }
    });
    expect(genCall.isError).toBeFalsy();
    const genData = JSON.parse((genCall.content[0] as any).text);
    expect(genData.generatedFilesCount).toBeGreaterThan(0);

    // 3. Verify app via MCP
    const verifyCall = await client.callTool({
      name: "forge_verify_app",
      arguments: {
        projectDirectory: tempDir
      }
    });
    expect(verifyCall.isError).toBeFalsy();
    const verifyData = JSON.parse((verifyCall.content[0] as any).text);
    expect(verifyData.overallPassed).toBe(true);

    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it("verifies live stdio transport and stdout purity using StdioClientTransport", async () => {
    const { StdioClientTransport } = await import("@modelcontextprotocol/sdk/client/stdio.js");
    const mcpBinPath = path.resolve("bin/mcp.js");

    const stdioTransport = new StdioClientTransport({
      command: process.execPath,
      args: [mcpBinPath]
    });

    const stdioClient = new Client(
      {
        name: "test-stdio-client",
        version: "1.0.0"
      },
      {
        capabilities: {}
      }
    );

    try {
      await stdioClient.connect(stdioTransport);
      const toolList = await stdioClient.listTools();
      expect(toolList.tools.length).toBe(214);
      expect(toolList.tools.some((t) => t.name === "forge_create_spec")).toBe(true);
      expect(toolList.tools.some((t) => t.name === "forge_recreate_app")).toBe(true);
      expect(toolList.tools.some((t) => t.name === "forge_rea_tool")).toBe(true);
      expect(toolList.tools.some((t) => t.name === "forge_wasp_cli")).toBe(true);
      expect(toolList.tools.some((t) => t.name === "rea_inspect_sqlite_database")).toBe(true);
    } finally {
      await stdioClient.close();
    }
  });

  it("invokes forge_rea_tool and returns structured diagnostic or result", async () => {
    const result = await client.callTool({
      name: "forge_rea_tool",
      arguments: {
        toolName: "inspect_artifact",
        toolArguments: { artifactPath: path.resolve(".") }
      }
    });

    expect(result.content).toBeDefined();
    const content = result.content[0] as { type: string; text: string };
    const parsed = JSON.parse(content.text);
    expect(parsed).toBeDefined();
    expect(content.text.length).toBeGreaterThan(0);
  }, 30000);

  it("invokes forge_wasp_cli and handles platform status truthfully", async () => {
    const result = await client.callTool({
      name: "forge_wasp_cli",
      arguments: {
        command: "version"
      }
    });

    expect(result.content).toBeDefined();
    const content = result.content[0] as { type: string; text: string };
    const parsed = JSON.parse(content.text);
    expect(parsed).toBeDefined();
    // On native Windows without Wasp in PATH, returns truthful platform diagnostic
    if (result.isError) {
      expect(parsed.status).toBe("unavailable");
      expect(parsed.remediation).toContain("WSL");
    } else {
      expect(parsed.success).toBe(true);
    }
  });
});
