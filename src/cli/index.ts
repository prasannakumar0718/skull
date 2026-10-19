import { Command } from "commander";
import * as fs from "node:fs";
import * as path from "node:path";
import { createSpecFromPrompt, validateForgeSpec } from "../spec/validator.js";
import { EngineOrchestrator } from "../engines/orchestrator.js";
import { ForgeVerifier } from "../verifier/verifier.js";
import { ReaInvestigationBridge } from "../investigation/reaBridge.js";
import { runForgeMcpServer } from "../mcp/server.js";

export function createCli(): Command {
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
      } else {
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
      } else {
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

  return program;
}
