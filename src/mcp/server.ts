import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from "@modelcontextprotocol/sdk/types.js";
import { createSpecFromPrompt, validateForgeSpec } from "../spec/validator.js";
import { EngineOrchestrator } from "../engines/orchestrator.js";
import { ReaInvestigationBridge } from "../investigation/reaBridge.js";
import { ForgeVerifier } from "../verifier/verifier.js";
import * as path from "node:path";

export function createForgeMcpServer(reaPath?: string): Server {
  const server = new Server(
    {
      name: "io.github.agent-app-forge/server",
      version: "0.1.0"
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  const orchestrator = new EngineOrchestrator();
  const verifier = new ForgeVerifier();
  const investigationBridge = new ReaInvestigationBridge(reaPath);

  const tools: Tool[] = [
    {
      name: "forge_inspect_reference",
      description: "Inspect an existing reference software project using REA investigation bridge to extract schemas, routes, and behavior.",
      inputSchema: {
        type: "object",
        properties: {
          referencePath: { type: "string", description: "Absolute path to reference directory or file" }
        },
        required: ["referencePath"]
      }
    },
    {
      name: "forge_create_spec",
      description: "Convert a natural-language application request into a validated, editable ForgeSpec.",
      inputSchema: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Application prompt, e.g., 'Build a task manager with persistent storage'" },
          appName: { type: "string", description: "Identifier name for application", default: "TaskManager" }
        },
        required: ["prompt"]
      }
    },
    {
      name: "forge_generate_app",
      description: "Generate a complete, running web application from a validated ForgeSpec.",
      inputSchema: {
        type: "object",
        properties: {
          spec: { type: "object", description: "Validated ForgeSpec JSON" },
          outputDirectory: { type: "string", description: "Directory where application will be generated" }
        },
        required: ["spec", "outputDirectory"]
      }
    },
    {
      name: "forge_verify_app",
      description: "Run automated structural and test verification checks on a generated application and attempt focused repairs.",
      inputSchema: {
        type: "object",
        properties: {
          projectDirectory: { type: "string", description: "Path to generated application" }
        },
        required: ["projectDirectory"]
      }
    }
  ];

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      if (name === "forge_inspect_reference") {
        const refPath = String(args?.referencePath);
        const result = await investigationBridge.investigate(refPath);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
      }

      if (name === "forge_create_spec") {
        const prompt = String(args?.prompt);
        const appName = String(args?.appName || "TaskManager");
        const spec = createSpecFromPrompt(prompt, appName);
        const validation = validateForgeSpec(spec);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  spec,
                  validation: validation.result
                },
                null,
                2
              )
            }
          ]
        };
      }

      if (name === "forge_generate_app") {
        const spec = args?.spec as any;
        const outDir = String(args?.outputDirectory);
        const genResult = await orchestrator.generateProject(spec, outDir);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  engine: genResult.engineName,
                  generatedFilesCount: genResult.files.length,
                  instructions: genResult.entryPointInstructions,
                  platformNotes: genResult.platformNotes
                },
                null,
                2
              )
            }
          ]
        };
      }

      if (name === "forge_verify_app") {
        const projDir = String(args?.projectDirectory);
        const report = await verifier.verify(projDir);
        return {
          content: [{ type: "text", text: JSON.stringify(report, null, 2) }]
        };
      }

      throw new Error(`Unknown tool: ${name}`);
    } catch (err: any) {
      return {
        isError: true,
        content: [{ type: "text", text: `Error in tool ${name}: ${err.message}` }]
      };
    }
  });

  return server;
}

export async function runForgeMcpServer(reaPath?: string) {
  const server = createForgeMcpServer(reaPath);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
