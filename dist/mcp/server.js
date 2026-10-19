import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { createSpecFromPrompt, validateForgeSpec } from "../spec/validator.js";
import { EngineOrchestrator } from "../engines/orchestrator.js";
import { ReaInvestigationBridge } from "../investigation/reaBridge.js";
import { ForgeVerifier } from "../verifier/verifier.js";
import * as path from "node:path";
export function createForgeMcpServer(reaPath) {
    const server = new Server({
        name: "io.github.agent-app-forge/server",
        version: "0.1.0"
    }, {
        capabilities: {
            tools: {}
        }
    });
    const orchestrator = new EngineOrchestrator();
    const verifier = new ForgeVerifier();
    const investigationBridge = new ReaInvestigationBridge(reaPath);
    const tools = [
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
        },
        {
            name: "forge_rea_tool",
            description: "Delegate invocation directly to any native REA MCP tool (supports all 207 tools across REA's full inventory, e.g., inspect_sqlite_database, inspect_artifact, analyze_function, compare_artifacts).",
            inputSchema: {
                type: "object",
                properties: {
                    toolName: { type: "string", description: "Name of the REA tool to invoke (e.g. inspect_sqlite_database, inspect_artifact, analyze_function)" },
                    toolArguments: { type: "object", description: "Arguments payload matching the REA tool schema" }
                },
                required: ["toolName", "toolArguments"]
            }
        },
        {
            name: "forge_wasp_cli",
            description: "Delegate a native Wasp CLI command (e.g., compile, clean, version) directly to Wasp.",
            inputSchema: {
                type: "object",
                properties: {
                    command: { type: "string", description: "Wasp command, e.g., 'version', 'clean', 'compile'" },
                    projectDirectory: { type: "string", description: "Path to Wasp project directory" }
                },
                required: ["command"]
            }
        },
        {
            name: "forge_recreate_app",
            description: "Investigate reference software using REA, plan architecture, generate full-stack application, and compare observable behavior.",
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
                required: ["prompt", "outputDirectory"]
            }
        }
    ];
    // Dynamically expose all 207 native REA tools with collision-safe names 'rea_<name>'
    const nativeReaTools = investigationBridge.listSupportedReaTools().map((t) => ({
        name: `rea_${t.name}`,
        description: `[Upstream REA Native Tool] ${t.description}`,
        inputSchema: t.inputSchema
    }));
    const allTools = [...tools, ...nativeReaTools];
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools: allTools
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
            // Direct collision-safe REA native tool invocation
            if (name.startsWith("rea_")) {
                const upstreamName = name.slice(4);
                const reaResult = await investigationBridge.callReaNativeTool(upstreamName, (args || {}), extra?.signal);
                return {
                    isError: reaResult.isError,
                    content: [{ type: "text", text: JSON.stringify(reaResult.data ?? reaResult, null, 2) }]
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
                            text: JSON.stringify({
                                spec,
                                validation: validation.result
                            }, null, 2)
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
                const spec = args.spec;
                const outDir = path.resolve(args.outputDirectory.trim());
                const genResult = await orchestrator.generateProject(spec, outDir);
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                engine: genResult.engineName,
                                generatedFilesCount: genResult.files.length,
                                instructions: genResult.entryPointInstructions,
                                platformNotes: genResult.platformNotes
                            }, null, 2)
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
                if (!args || typeof args.prompt !== "string" || !args.prompt.trim() || typeof args.outputDirectory !== "string" || !args.outputDirectory.trim()) {
                    return {
                        isError: true,
                        content: [{ type: "text", text: "Invalid arguments: 'prompt' and 'outputDirectory' string parameters are required." }]
                    };
                }
                const { RecreationOrchestrator } = await import("../recreation/orchestrator.js");
                const recOrchestrator = new RecreationOrchestrator();
                const recResult = await recOrchestrator.recreate({
                    prompt: args.prompt.trim(),
                    targetPath: typeof args.targetPath === "string" ? args.targetPath.trim() : undefined,
                    outputDirectory: args.outputDirectory.trim(),
                    targetEngine: args.targetEngine,
                    planOnly: Boolean(args.planOnly),
                    compare: args.compare !== false
                });
                return {
                    isError: !recResult.success,
                    content: [{ type: "text", text: JSON.stringify(recResult, null, 2) }]
                };
            }
            if (name === "forge_rea_tool") {
                if (!args || typeof args.toolName !== "string" || !args.toolArguments || typeof args.toolArguments !== "object") {
                    return {
                        isError: true,
                        content: [{ type: "text", text: "Invalid arguments: 'toolName' string and 'toolArguments' object are required." }]
                    };
                }
                const reaResult = await investigationBridge.callReaNativeTool(args.toolName, args.toolArguments, extra?.signal);
                return {
                    isError: reaResult.isError,
                    content: [{ type: "text", text: JSON.stringify(reaResult, null, 2) }]
                };
            }
            if (name === "forge_wasp_cli") {
                if (!args || typeof args.command !== "string" || !args.command.trim()) {
                    return {
                        isError: true,
                        content: [{ type: "text", text: "Invalid arguments: 'command' string is required." }]
                    };
                }
                const { checkSystemPrerequisites } = await import("../utils/prerequisites.js");
                const prereqs = checkSystemPrerequisites();
                if (!prereqs.wasp.installed) {
                    return {
                        isError: true,
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify({
                                    status: "unavailable",
                                    error: "Native Wasp CLI is not installed in the system PATH.",
                                    notes: prereqs.wasp.notes,
                                    wslAvailable: prereqs.wasp.wslAvailable,
                                    remediation: "Install Wasp CLI inside WSL or Linux via: curl -sSL https://get.wasp.sh | sh"
                                }, null, 2)
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
                }
                catch (err) {
                    return {
                        isError: true,
                        content: [
                            {
                                type: "text",
                                text: JSON.stringify({
                                    success: false,
                                    exitCode: err.status || 1,
                                    stderr: (err.stderr || err.message || "").trim()
                                }, null, 2)
                            }
                        ]
                    };
                }
            }
            return {
                isError: true,
                content: [{ type: "text", text: `Unknown tool: ${name}` }]
            };
        }
        catch (err) {
            console.error(`[MCP Tool Error] ${name}:`, err.message);
            return {
                isError: true,
                content: [{ type: "text", text: `Error in tool ${name}: ${err.message}` }]
            };
        }
    });
    return server;
}
export async function runForgeMcpServer(reaPath) {
    const server = createForgeMcpServer(reaPath);
    const transport = new StdioServerTransport();
    await server.connect(transport);
}
