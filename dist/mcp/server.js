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
        }
    ];
    server.setRequestHandler(ListToolsRequestSchema, async () => ({
        tools
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
