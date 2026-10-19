import { Command } from "commander";
import * as fs from "node:fs";
import * as path from "node:path";
import { createSpecFromPrompt, validateForgeSpec } from "../spec/validator.js";
import { EngineOrchestrator } from "../engines/orchestrator.js";
import { ForgeVerifier } from "../verifier/verifier.js";
import { ReaInvestigationBridge } from "../investigation/reaBridge.js";
import { runForgeMcpServer } from "../mcp/server.js";
export function createCli() {
    const program = new Command();
    program
        .name("forge")
        .description("Agent App Forge: AI Coding-Agent Infrastructure for Reverse Engineering & App Synthesis")
        .version("0.1.0");
    program
        .command("mcp")
        .description("Start the Agent App Forge MCP server (stdio transport)")
        .option("--rea-path <path>", "Path to REA installation", path.resolve(process.cwd(), "../rea"))
        .action(async (options) => {
        await runForgeMcpServer(options.reaPath);
    });
    program
        .command("spec")
        .description("Generate or validate a ForgeSpec from an application prompt")
        .argument("<prompt>", "Application prompt (e.g., 'Build a task manager with persistent storage')")
        .option("-n, --name <name>", "Application name", "task-manager")
        .option("-o, --output <file>", "Write specification to JSON file")
        .action((prompt, options) => {
        console.log(`Generating specification for: "${prompt}"...`);
        const spec = createSpecFromPrompt(prompt, options.name);
        const validation = validateForgeSpec(spec);
        if (!validation.result.valid) {
            console.error("Specification validation errors:", validation.result.errors);
            process.exit(1);
        }
        console.log("Specification validated successfully!");
        console.log(`Entities: ${spec.entities.map((e) => e.name).join(", ")}`);
        console.log(`Operations: ${spec.operations.map((o) => o.name).join(", ")}`);
        if (options.output) {
            fs.writeFileSync(options.output, JSON.stringify(spec, null, 2), "utf-8");
            console.log(`Saved specification to: ${options.output}`);
        }
        else {
            console.log(JSON.stringify(spec, null, 2));
        }
    });
    program
        .command("create")
        .description("Synthesize and scaffold a complete application from a prompt or spec file")
        .argument("<prompt-or-spec>", "Natural language prompt or path to spec JSON")
        .option("-o, --output <dir>", "Target directory for generated application", "./generated-app")
        .option("-e, --engine <engine>", "Force engine ('wasp' or 'fullstack-node')", "auto")
        .action(async (input, options) => {
        let spec;
        if (fs.existsSync(input)) {
            spec = JSON.parse(fs.readFileSync(input, "utf-8"));
        }
        else {
            spec = createSpecFromPrompt(input);
        }
        if (options.engine !== "auto") {
            spec.targetEngine = options.engine;
        }
        console.log(`Scaffolding application '${spec.title}' into: ${options.output}...`);
        const orchestrator = new EngineOrchestrator();
        const result = await orchestrator.generateProject(spec, options.output);
        console.log(`Application generated using engine: [${result.engineName}]`);
        console.log(`Files generated: ${result.files.length}`);
        console.log(`Next steps: ${result.entryPointInstructions}`);
        if (result.platformNotes) {
            console.log(`Note: ${result.platformNotes}`);
        }
    });
    program
        .command("verify")
        .description("Run automated test suite and self-repair loop on a generated project")
        .argument("<directory>", "Path to project directory to verify")
        .action(async (directory) => {
        console.log(`Verifying project at: ${directory}...`);
        const verifier = new ForgeVerifier();
        const report = await verifier.verify(directory);
        console.log("\n--- Verification Report ---");
        for (const check of report.checks) {
            const mark = check.passed ? "✓" : "✗";
            console.log(`${mark} [${check.name}]: ${check.message}`);
            if (check.details) {
                console.log(`   Details: ${check.details}`);
            }
        }
        if (report.repairedIssues.length > 0) {
            console.log("\nRepairs automatically applied:");
            for (const rep of report.repairedIssues) {
                console.log(`  + ${rep}`);
            }
        }
        console.log(`\nOverall Result: ${report.overallPassed ? "PASSED" : "FAILED"}`);
        if (!report.overallPassed) {
            process.exit(1);
        }
    });
    program
        .command("inspect")
        .description("Inspect reference software using REA investigation bridge")
        .argument("<targetPath>", "Path to target reference directory or file")
        .action(async (targetPath) => {
        console.log(`Inspecting reference target: ${targetPath}...`);
        const bridge = new ReaInvestigationBridge();
        const result = await bridge.investigate(targetPath);
        console.log(JSON.stringify(result, null, 2));
    });
    program
        .command("wasp")
        .description("Delegate commands directly to native Wasp CLI with full argument pass-through")
        .allowUnknownOption(true)
        .argument("[args...]", "Raw arguments to pass to Wasp CLI")
        .action(async (args = []) => {
        const { checkSystemPrerequisites } = await import("../utils/prerequisites.js");
        const prereqs = checkSystemPrerequisites();
        if (!prereqs.wasp.installed) {
            console.error("\n[Agent App Forge — Native Wasp Delegation]");
            console.error("Wasp CLI is not installed or not in system PATH.");
            console.error(`Status: ${prereqs.wasp.notes}`);
            console.error("\nTo install Wasp:");
            console.error("- Linux/macOS/WSL: curl -sSL https://get.wasp.sh | sh");
            console.error("- To generate a Wasp project without executing Wasp CLI locally: forge create <prompt> --engine wasp");
            console.error("- For native Windows execution without WSL: forge create <prompt> --engine fullstack-node\n");
            process.exit(1);
        }
        const { spawnSync } = await import("node:child_process");
        const result = spawnSync("wasp", args, { stdio: "inherit" });
        process.exit(result.status || 0);
    });
    program
        .command("rea")
        .description("Delegate commands directly to native REA CLI with full argument pass-through")
        .allowUnknownOption(true)
        .argument("[args...]", "Raw arguments to pass to REA CLI")
        .action(async (args = []) => {
        const bridge = new ReaInvestigationBridge();
        const result = bridge.executeReaCliCommand(args);
        if (!result.success) {
            console.error("\n[Agent App Forge — Native REA Delegation]");
            console.error(result.stderr);
            if (result.notes)
                console.error(`Notes: ${result.notes}`);
            console.error("\nTo build REA:");
            console.error(`  cd "${path.resolve("../rea")}" && npm install && npm run build`);
            console.error("\nFallback: Use 'forge inspect <path>' for native heuristic source parsing.\n");
            process.exit(result.exitCode);
        }
        console.log(result.stdout);
    });
    program
        .command("doctor")
        .description("Check system runtime prerequisites for Node.js, SQLite, Wasp, and REA")
        .action(async () => {
        const { checkSystemPrerequisites } = await import("../utils/prerequisites.js");
        const prereqs = checkSystemPrerequisites();
        console.log("\n=== Agent App Forge System Health & Prerequisites ===\n");
        console.log(`Node.js Runtime : v${prereqs.node.version} (Major: ${prereqs.node.major}) — ${prereqs.node.isSupported ? "Supported" : "Unsupported"}`);
        console.log(`SQLite Engine   : Built-in node:sqlite is ${prereqs.node.sqliteAvailable ? "Available" : "Unavailable"}`);
        console.log(`Wasp CLI        : ${prereqs.wasp.installed ? `Installed (${prereqs.wasp.path})` : "Not installed on host PATH"}`);
        console.log(`Wasp Notes      : ${prereqs.wasp.notes}`);
        console.log(`REA CLI         : ${prereqs.rea.installed ? `Installed (${prereqs.rea.path})` : "Not installed on host PATH"}`);
        console.log(`REA Repo State  : ${prereqs.rea.repoDetected ? (prereqs.rea.built ? "Detected & Built" : "Detected but unbuilt (node_modules missing)") : "Not detected"}`);
        console.log(`REA Notes       : ${prereqs.rea.notes}\n`);
    });
    return program;
}
