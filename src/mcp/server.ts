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
import { checkSystemPrerequisites } from "../utils/prerequisites.js";
import * as path from "node:path";

export type ForgeMcpMode = "compact" | "full";

export interface ForgeMcpServerOptions {
  reaPath?: string;
  mode?: ForgeMcpMode;
}

export const FORGE_SERVER_INSTRUCTIONS =
  "Agent App Forge is an agent-agnostic software recreation and application-generation toolkit with zero-configuration user experience. " +
  "For an existing application, inspect the authorized reference and use forge_recreate_app to plan, build, and verify an independent implementation. " +
  "For new applications, describe the goal with forge_recreate_app or use forge_create_spec and forge_generate_app. Use forge_verify_app to test results. " +
  "Discover and invoke native REA tools when deeper investigation is required. " +
  "Wasp and other engines remain separately accessible. Report evidence, failures, and unknowns honestly.";

export function createForgeMcpServer(optionsOrReaPath?: string | ForgeMcpServerOptions): Server {
  let reaPath: string | undefined;
  let mode: ForgeMcpMode = (process.env.FORGE_MCP_MODE as ForgeMcpMode) || "compact";

  if (typeof optionsOrReaPath === "string") {
    reaPath = optionsOrReaPath;
  } else if (typeof optionsOrReaPath === "object" && optionsOrReaPath !== null) {
    reaPath = optionsOrReaPath.reaPath;
    if (optionsOrReaPath.mode) {
      mode = optionsOrReaPath.mode;
    }
  }

  const server = new Server(
    {
      name: "io.github.agent-app-forge/server",
      version: "0.1.0"
    },
    {
      capabilities: {
        tools: {}
      },
      instructions: FORGE_SERVER_INSTRUCTIONS
    }
  );

  const orchestrator = new EngineOrchestrator();
  const verifier = new ForgeVerifier();
  const investigationBridge = new ReaInvestigationBridge(reaPath);

  // 9 Core Forge Tools (Default Compact Catalog)
  const coreTools: Tool[] = [
    {
      name: "forge_capabilities",
      description: "Explain Agent App Forge's primary purpose, 8-step workflow (INVESTIGATE -> UNDERSTAND -> SPECIFY -> PLAN -> BUILD -> VERIFY -> COMPARE -> IMPROVE), available engines (Universal Node Engine, Wasp), active MCP mode (compact vs full), and system prerequisites.",
      inputSchema: {
        type: "object",
        properties: {
          detail: {
            type: "string",
            enum: ["summary", "full", "engines", "modes"],
            description: "Level of detail requested (default: summary)",
            default: "summary"
          }
        }
      }
    },
    {
      name: "forge_inspect_reference",
      description: "Investigate an authorized reference application or codebase using REA reverse engineering tools to extract data models, routes, database schemas, and observable behaviors.",
      inputSchema: {
        type: "object",
        properties: {
          referencePath: { type: "string", description: "Absolute path to reference directory, SQLite DB, or code fixture" }
        },
        required: ["referencePath"]
      }
    },
    {
      name: "forge_create_spec",
      description: "Convert a natural-language application request into a validated, strongly typed ForgeSpec schema defining entities, operations, and user workflows.",
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
      name: "forge_recreate_app",
      description: "Coordinate the complete software recreation lifecycle: investigate reference with REA, generate specification with provenance, formulate implementation plan, synthesize independent application, run verifier, and compare observable behavior.",
      inputSchema: {
        type: "object",
        properties: {
          prompt: { type: "string", description: "Recreation prompt or feature description" },
          targetPath: { type: "string", description: "Path to reference software directory, SQLite DB, or binary fixture" },
          outputDirectory: { type: "string", description: "Target directory where recreation will be generated" },
          targetEngine: { type: "string", enum: ["auto", "wasp", "fullstack-node"], default: "auto" },
          planOnly: { type: "boolean", description: "Only produce investigation and implementation plan without writing files", default: false },
          compare: { type: "boolean", description: "Run behavioral comparison against reference after build", default: true }
        },
        required: ["prompt"]
      }
    },
    {
      name: "forge_generate_app",
      description: "Generate a complete, running, standalone full-stack web application with persistent SQLite WAL storage from a validated ForgeSpec.",
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
      description: "Run automated structural verification checks, test suites, and self-repair loops on a generated project, returning detailed pass/fail diagnostics.",
      inputSchema: {
        type: "object",
        properties: {
          projectDirectory: { type: "string", description: "Path to generated application" }
        },
        required: ["projectDirectory"]
      }
    },
    {
      name: "forge_rea_discover",
      description: "Search and discover relevant native REA (Reverse Engineer Anything) tools from REA's 207-tool inventory by keyword, category, or target type. Returns matching tool names, descriptions, and full input schemas for execution via forge_rea_tool.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query matching tool name, description, or keywords (e.g. 'sqlite', 'binary', 'android', 'frida', 'decompilation')" },
          category: { type: "string", description: "Filter by functional category: 'database', 'web', 'android', 'binary', 'procedure', 'dynamic', 'network', 'reconstruction', 'analysis'" },
          targetType: { type: "string", description: "Filter by target file/artifact type (e.g., 'sqlite', 'pe', 'apk', 'wasm', 'pcap', 'js')" },
          limit: { type: "number", description: "Maximum number of tools to return (default: 10, max: 50)", default: 10 },
          refresh: { type: "boolean", description: "Force refresh discovery from live REA MCP runtime", default: false }
        }
      }
    },
    {
      name: "forge_rea_tool",
      description: "Execute any supported native REA reverse-engineering tool (all 207 tools across REA's inventory, e.g., inspect_sqlite_database, inspect_artifact, analyze_function, compare_artifacts) with original arguments preserved. Accepts structured or serialized JSON arguments.",
      inputSchema: {
        type: "object",
        properties: {
          toolName: { type: "string", description: "Name of the native REA tool to invoke (e.g. 'inspect_sqlite_database', 'inspect_artifact', 'analyze_function')" },
          toolArguments: { description: "Arguments payload matching the REA tool schema (object or serialized JSON string)" }
        },
        required: ["toolName", "toolArguments"]
      }
    },
    {
      name: "forge_wasp_cli",
      description: "Delegate supported native Wasp CLI commands (e.g., 'compile', 'clean', 'version') directly to Wasp, reporting platform requirements truthfully.",
      inputSchema: {
        type: "object",
        properties: {
          command: { type: "string", description: "Wasp command, e.g., 'version', 'clean', 'compile'" },
          projectDirectory: { type: "string", description: "Path to Wasp project directory" }
        },
        required: ["command"]
      }
    }
  ];

  // Dynamically prepare all 207 native REA tools with collision-safe names 'rea_<name>' for full mode
  const nativeReaTools: Tool[] = investigationBridge.listSupportedReaTools().map((t) => ({
    name: `rea_${t.name}`,
    description: `[Upstream REA Native Tool] ${t.description}`,
    inputSchema: t.inputSchema as any
  }));

  const advertisedTools: Tool[] = mode === "full" ? [...coreTools, ...nativeReaTools] : coreTools;

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: advertisedTools
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
    const { name, arguments: args } = request.params;

    if (extra?.signal?.aborted) {
      return {
        isError: true,
        content: [{ type: "text", text: `Request cancelled by client for tool ${name}` }]
      };
    }

    try {
      // Direct collision-safe REA native tool invocation (supported in BOTH compact and full modes)
      if (name.startsWith("rea_")) {
        const upstreamName = name.slice(4);
        const reaResult = await investigationBridge.callReaNativeTool(upstreamName, (args || {}) as any, extra?.signal);
        return {
          isError: reaResult.isError,
          content: [{ type: "text", text: JSON.stringify(reaResult.data ?? reaResult, null, 2) }]
        };
      }

      if (name === "forge_capabilities") {
        const prereqs = checkSystemPrerequisites();
        const catalogMeta = investigationBridge.getCatalogMetadata();
        const payload = {
          name: "agent-app-forge",
          version: "0.1.0",
          purpose: "Agent-agnostic software recreation, reverse engineering, and fullstack application synthesis system with autonomous verification and MCP tooling.",
          workflow: "INVESTIGATE -> UNDERSTAND -> SPECIFY -> PLAN -> BUILD -> VERIFY -> COMPARE -> IMPROVE",
          mcp: {
            activeMode: mode,
            availableModes: {
              compact: "Default mode exposing 9 core Forge tools (<4 KB payload, ~1,100 tokens). Discovers all 207 REA tools dynamically via forge_rea_discover.",
              full: "Exposes all 216 tools (9 core + 207 individual rea_<name> tools). Opt-in via --mode full or FORGE_MCP_MODE=full."
            },
            toolsAdvertisedInSession: advertisedTools.length,
            totalReaToolsAvailable: catalogMeta.toolCount,
            instructions: FORGE_SERVER_INSTRUCTIONS
          },
          engines: {
            "universal-node": {
              name: "Universal Fullstack Node Engine",
              supported: true,
              storage: "Native SQLite (WAL Mode via node:sqlite)",
              dependencies: "Zero external runtime npm packages",
              platforms: ["win32", "darwin", "linux"]
            },
            wasp: {
              name: "Wasp Web Framework Engine",
              supported: true,
              platforms: ["linux", "darwin", "win32-wsl"],
              installedOnHost: prereqs.wasp.installed,
              notes: prereqs.wasp.notes
            }
          },
          prerequisites: {
            node: prereqs.node,
            sqliteAvailable: prereqs.node.sqliteAvailable,
            wasp: prereqs.wasp,
            rea: prereqs.rea
          }
        };

        return {
          content: [{ type: "text", text: JSON.stringify(payload, null, 2) }]
        };
      }

      if (name === "forge_rea_discover") {
        if (args?.refresh === true) {
          await investigationBridge.refreshDiscovery();
        }
        const searchResult = investigationBridge.searchReaTools({
          query: typeof args?.query === "string" ? args.query.trim() : undefined,
          category: typeof args?.category === "string" ? args.category.trim() : undefined,
          targetType: typeof args?.targetType === "string" ? args.targetType.trim() : undefined,
          limit: typeof args?.limit === "number" ? args.limit : 10
        });

        return {
          content: [{ type: "text", text: JSON.stringify(searchResult, null, 2) }]
        };
      }

      if (name === "forge_inspect_reference") {
        if (!args || typeof args.referencePath !== "string" || !args.referencePath.trim()) {
          return {
            isError: true,
            content: [{ type: "text", text: "Invalid arguments: 'referencePath' string parameter is required." }]
          };
        }
        const refPath = path.resolve(args.referencePath.trim());
        const result = await investigationBridge.investigate(refPath);
        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }]
        };
      }

      if (name === "forge_create_spec") {
        if (!args || typeof args.prompt !== "string" || !args.prompt.trim()) {
          return {
            isError: true,
            content: [{ type: "text", text: "Invalid arguments: 'prompt' string parameter is required." }]
          };
        }
        const prompt = args.prompt.trim();
        const appName = typeof args.appName === "string" && args.appName.trim() ? args.appName.trim() : "TaskManager";
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
        if (!args || !args.spec || typeof args.spec !== "object" || typeof args.outputDirectory !== "string" || !args.outputDirectory.trim()) {
          return {
            isError: true,
            content: [{ type: "text", text: "Invalid arguments: 'spec' object and 'outputDirectory' string parameters are required." }]
          };
        }
        const spec = args.spec as any;
        const outDir = path.resolve(args.outputDirectory.trim());
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
        if (!args || typeof args.projectDirectory !== "string" || !args.projectDirectory.trim()) {
          return {
            isError: true,
            content: [{ type: "text", text: "Invalid arguments: 'projectDirectory' string parameter is required." }]
          };
        }
        const projDir = path.resolve(args.projectDirectory.trim());
        const report = await verifier.verify(projDir);
        return {
          content: [{ type: "text", text: JSON.stringify(report, null, 2) }]
        };
      }

      if (name === "forge_recreate_app") {
        if (!args || typeof args.prompt !== "string" || !args.prompt.trim()) {
          return {
            isError: true,
            content: [{ type: "text", text: "Invalid arguments: 'prompt' non-empty string parameter is required." }]
          };
        }
        const { RecreationOrchestrator } = await import("../recreation/orchestrator.js");
        const recOrchestrator = new RecreationOrchestrator();
        const recResult = await recOrchestrator.recreate({
          prompt: args.prompt.trim(),
          targetPath: typeof args.targetPath === "string" && args.targetPath.trim() ? args.targetPath.trim() : undefined,
          outputDirectory: typeof args.outputDirectory === "string" && args.outputDirectory.trim() ? args.outputDirectory.trim() : undefined,
          targetEngine: args.targetEngine as any,
          planOnly: Boolean(args.planOnly),
          compare: args.compare !== false
        });

        const report = recResult.finalReport;
        const formattedReport = report
          ? [
              `# Agent App Forge — Execution Report`,
              `**Status:** ${recResult.success ? "✅ SUCCESS" : "❌ FAILURE"} (${recResult.mode})`,
              `**Title:** ${recResult.spec.title}`,
              `**Request Type:** ${report.requestClassification.type} | **Domain:** ${report.requestClassification.domain}`,
              report.requestClassification.target ? `**Target Reference:** \`${report.requestClassification.target}\`` : "",
              `**Output Directory:** \`${report.outputPath}\``,
              ``,
              `## How to Run`,
              `\`\`\`bash`,
              `cd "${report.runInstructions.directory}"`,
              `${report.runInstructions.command}`,
              `\`\`\``,
              `Health check: ${report.runInstructions.healthUrl}`,
              `Application: ${report.runInstructions.appUrl}`,
              ``,
              `## Tested Features`,
              ...report.testedFeatures.map(f => {
                const mark = f.status === "pass" ? "✓" : (f.status === "unavailable" ? "⚠️ [UNAVAILABLE]" : "✗ [FAILED]");
                return `- ${mark} **${f.name}**: ${f.details || f.evidence || ""}`;
              }),
              ``,
              report.limitations.length > 0 ? `## Known Limitations\n${report.limitations.map(l => `- ℹ️ ${l}`).join("\n")}\n` : "",
              `## Summary`,
              recResult.summary
            ].filter(Boolean).join("\n")
          : recResult.summary;

        return {
          isError: !recResult.success,
          content: [
            { type: "text", text: JSON.stringify(recResult, null, 2) },
            { type: "text", text: formattedReport }
          ]
        };
      }

      if (name === "forge_rea_tool") {
        if (!args || typeof args.toolName !== "string" || !args.toolName.trim()) {
          return {
            isError: true,
            content: [{ type: "text", text: "Invalid arguments: 'toolName' non-empty string is required." }]
          };
        }

        // Support both structured objects and serialized JSON strings (Requirement 6)
        let parsedArgs: Record<string, unknown>;
        if (typeof args.toolArguments === "string") {
          try {
            parsedArgs = JSON.parse(args.toolArguments);
          } catch (err: any) {
            return {
              isError: true,
              content: [{ type: "text", text: `Invalid arguments: 'toolArguments' JSON string could not be parsed: ${err.message}` }]
            };
          }
        } else if (args.toolArguments && typeof args.toolArguments === "object" && !Array.isArray(args.toolArguments)) {
          parsedArgs = args.toolArguments as Record<string, unknown>;
        } else {
          return {
            isError: true,
            content: [{ type: "text", text: "Invalid arguments: 'toolArguments' must be a valid JSON object or serialized JSON string." }]
          };
        }

        const targetToolName = (args.toolName as string).trim();

        // Validate required fields against known schema before delegating
        const supportedTools = investigationBridge.listSupportedReaTools();
        const toolDef = supportedTools.find((t) => t.name === targetToolName);
        if (toolDef && toolDef.inputSchema && Array.isArray((toolDef.inputSchema as any).required)) {
          const requiredFields = (toolDef.inputSchema as any).required as string[];
          const missing = requiredFields.filter((f) => parsedArgs[f] === undefined || parsedArgs[f] === null);
          if (missing.length > 0) {
            return {
              isError: true,
              content: [
                {
                  type: "text",
                  text: `Schema validation error for REA tool '${targetToolName}': Missing required argument(s) [${missing.join(", ")}].`
                }
              ]
            };
          }
        }

        const reaResult = await investigationBridge.callReaNativeTool(targetToolName, parsedArgs, extra?.signal);
        return {
          isError: reaResult.isError,
          content: [{ type: "text", text: JSON.stringify(reaResult.data ?? reaResult, null, 2) }]
        };
      }

      if (name === "forge_wasp_cli") {
        if (!args || typeof args.command !== "string" || !args.command.trim()) {
          return {
            isError: true,
            content: [{ type: "text", text: "Invalid arguments: 'command' string is required." }]
          };
        }
        const prereqs = checkSystemPrerequisites();
        if (!prereqs.wasp.installed) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    status: "unavailable",
                    error: "Native Wasp CLI is not installed in the system PATH.",
                    notes: prereqs.wasp.notes,
                    wslAvailable: prereqs.wasp.wslAvailable,
                    remediation: "Install Wasp CLI inside WSL or Linux via: curl -sSL https://get.wasp.sh | sh"
                  },
                  null,
                  2
                )
              }
            ]
          };
        }

        const projectDir = args.projectDirectory ? path.resolve(String(args.projectDirectory)) : process.cwd();
        try {
          const { execSync } = await import("node:child_process");
          const out = execSync(`wasp ${args.command}`, { cwd: projectDir, encoding: "utf-8", timeout: 30000 });
          return {
            content: [{ type: "text", text: JSON.stringify({ success: true, stdout: out.trim() }, null, 2) }]
          };
        } catch (err: any) {
          return {
            isError: true,
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: false,
                    exitCode: err.status || 1,
                    stderr: (err.stderr || err.message || "").trim()
                  },
                  null,
                  2
                )
              }
            ]
          };
        }
      }

      return {
        isError: true,
        content: [{ type: "text", text: `Unknown tool: ${name}` }]
      };
    } catch (err: any) {
      console.error(`[MCP Tool Error] ${name}:`, err.message);
      return {
        isError: true,
        content: [{ type: "text", text: `Error in tool ${name}: ${err.message}` }]
      };
    }
  });

  return server;
}

export async function runForgeMcpServer(optionsOrReaPath?: string | ForgeMcpServerOptions) {
  const server = createForgeMcpServer(optionsOrReaPath);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
