import { Command } from "commander";
import * as fs from "node:fs";
import * as path from "node:path";
import { createSpecFromPrompt, validateForgeSpec } from "../spec/validator.js";
import { EngineOrchestrator } from "../engines/orchestrator.js";
import { ForgeVerifier } from "../verifier/verifier.js";
import { ReaInvestigationBridge } from "../investigation/reaBridge.js";
import { runForgeMcpServer } from "../mcp/server.js";
import { RecreationOrchestrator } from "../recreation/orchestrator.js";

export function createCli(): Command {
  const program = new Command();

  program
    .name("forge")
    .description("Agent App Forge: AI Coding-Agent Infrastructure for Reverse Engineering & App Synthesis")
    .version("0.1.1")
    .enablePositionalOptions();

  program
    .command("mcp")
    .description("Start the Agent App Forge MCP server (stdio transport)")
    .option("-m, --mode <mode>", "Tool catalog mode: 'compact' (default, 9 core tools) or 'full' (all 216 tools)", "compact")
    .option("-f, --full", "Expose all 207 native REA tools individually (alias for --mode full)")
    .option("--rea-path <path>", "Path to REA installation", path.resolve(process.cwd(), "../rea"))
    .action(async (options) => {
      const mode = options.full ? "full" : (options.mode || "compact");
      await runForgeMcpServer({ reaPath: options.reaPath, mode });
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
    .command("recreate")
    .description("Investigate reference software, build evidence-based spec, plan, generate, verify, and compare")
    .argument("<prompt>", "Natural language recreation request or description")
    .option("-t, --target <path>", "Path to authorized reference target (directory, SQLite DB, binary fixture)")
    .option("-o, --output <dir>", "Target directory for recreated application", "./recreated-app")
    .option("-e, --engine <engine>", "Target engine ('wasp' or 'fullstack-node')", "auto")
    .option("--plan-only", "Generate investigation and implementation plan without writing project files", false)
    .option("--no-compare", "Skip behavioral comparison against reference")
    .option("--json", "Output machine-readable JSON", false)
    .action(async (prompt, options) => {
      console.log(`Initiating software recreation for: "${prompt}"...`);
      if (options.target) {
        console.log(`Reference Target: ${options.target}`);
      }
      console.log(`Target Engine: ${options.engine}`);
      console.log(`Output Directory: ${options.output}`);

      const orchestrator = new RecreationOrchestrator();
      const result = await orchestrator.recreate({
        prompt,
        targetPath: options.target,
        outputDirectory: options.output,
        targetEngine: options.engine,
        planOnly: options.planOnly,
        compare: options.compare
      });

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      console.log("\n=== RECREATION REPORT ===");
      console.log(`Mode: [${result.mode}]`);
      console.log(`Summary: ${result.summary}`);
      console.log(`Title: ${result.spec.title}`);
      console.log(`Output Directory: ${result.outputDirectory}`);
      console.log(`Engine: ${result.plan.selectedEngine} (${result.plan.engineRationale})`);
      console.log(`Run Command: node server.js (inside ${result.outputDirectory})`);
      console.log(`Observed Capabilities: ${result.investigation.observedCapabilities.join(", ") || "None (feature-driven)"}`);

      if (result.investigation.unknowns.length > 0) {
        console.log("\nIdentified Unknowns / Limitations:");
        for (const u of result.investigation.unknowns) {
          console.log(`  - ${u}`);
        }
      }

      if (result.comparison) {
        console.log("\n--- Behavioral Comparison Results ---");
        for (const ev of result.comparison.evaluations) {
          const mark = ev.status === "pass" ? "✓" : (ev.status === "fail" ? "✗" : "~");
          console.log(`${mark} [${ev.status.toUpperCase()}] ${ev.feature}`);
          if (ev.evidence) console.log(`   Evidence: ${ev.evidence}`);
        }
      }

      console.log(`\nOverall Result: ${result.success ? "PASSED" : "FAILED"}`);
      if (!result.success && !options.planOnly) {
        process.exit(1);
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
    .passThroughOptions()
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
    .passThroughOptions()
    .argument("[args...]", "Raw arguments to pass to REA CLI")
    .action(async (args = []) => {
      const bridge = new ReaInvestigationBridge();
      const result = bridge.executeReaCliCommand(args);

      if (!result.success) {
        console.error("\n[Agent App Forge — Native REA Delegation]");
        console.error(result.stderr);
        if (result.notes) console.error(`Notes: ${result.notes}`);
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

  program
    .command("capabilities")
    .description("Display comprehensive inventory of engines, REA catalog tools, verifier, and agent interfaces")
    .option("--json", "Output machine-readable JSON", false)
    .action(async (options) => {
      const bridge = new ReaInvestigationBridge();
      const meta = bridge.getCatalogMetadata();
      const reaStatus = bridge.probeReaStatus();
      const { checkSystemPrerequisites } = await import("../utils/prerequisites.js");
      const prereqs = checkSystemPrerequisites();

      const data = {
        name: "agent-app-forge",
        version: "0.1.1",
        engines: {
          "universal-node": {
            name: "Universal Fullstack Node Engine",
            supported: true,
            storage: "Native SQLite (WAL Mode)",
            dependencies: "Zero external runtime npm packages",
            platforms: ["win32", "darwin", "linux"],
            features: ["Document Studio", "Task Management", "Debounced Autosave", "Multi-Format Export (HTML, Markdown, Word .doc, Print/PDF)"]
          },
          "wasp": {
            name: "Wasp Web Framework Engine",
            supported: true,
            version: "0.26.1",
            platforms: ["linux", "darwin", "win32-wsl"],
            hostStatus: prereqs.wasp.installed ? "installed" : "wsl-required"
          }
        },
        mcp: {
          protocolVersion: "1.6.1",
          transport: "stdio",
          modes: ["compact (default)", "full"],
          defaultMode: "compact",
          totalTools: 214,
          totalAvailableTools: 216,
          compactTools: 9,
          fullTools: 216,
          coreTools: 7,
          activeCoreTools: 9,
          reaTools: meta.toolCount,
          contextReduction: "99.4% token reduction in default compact mode (<4 KB vs 776 KB)",
          toolsList: [
            "forge_capabilities",
            "forge_inspect_reference",
            "forge_create_spec",
            "forge_recreate_app",
            "forge_generate_app",
            "forge_verify_app",
            "forge_rea_discover",
            "forge_rea_tool",
            "forge_wasp_cli",
            "207 native REA tools (dynamically discovered via forge_rea_discover or exposed via --mode full)"
          ]
        },
        recreation: {
          workflow: "investigate -> specify -> plan -> build -> run -> compare -> detect failure -> repair -> re-verify",
          provenanceTags: ["observed", "inferred", "user_requested", "unknown"],
          supportedFixtures: ["source code", "sqlite databases", "REST endpoints"]
        },
        verifier: {
          boundedTimeoutMs: 10000,
          syntaxCheck: "node --check",
          selfRepair: ["SQLite missing schema recovery", "Specification-driven source reconstruction"]
        },
        adapters: {
          supportedClients: 10,
          clients: [
            "antigravity", "claude-code", "cursor", "opencode", "vscode-copilot",
            "cline", "roo-code", "windsurf", "codex-cli", "gemini-cli"
          ]
        }
      };

      if (options.json) {
        console.log(JSON.stringify(data, null, 2));
        return;
      }

      console.log("\n=== Agent App Forge Capabilities Inventory ===\n");
      console.log(`Version: ${data.version} | Node Runtime: v${prereqs.node.version}`);
      console.log(`MCP Tooling: ${data.mcp.totalTools} tools exposed over clean stdio (${data.mcp.coreTools} Forge core + ${data.mcp.reaTools} REA tools)`);
      console.log("\nApplication Engines:");
      console.log(`  • universal-node : Zero-dependency Node.js + SQLite WAL (Windows, macOS, Linux) [Active]`);
      console.log(`  • wasp           : Wasp 0.26.1 full-stack web framework [${prereqs.wasp.installed ? "Host Ready" : "Platform Dependent (WSL)"}]`);
      console.log("\nInvestigation & Reverse Engineering:");
      console.log(`  • REA Catalog    : ${meta.toolCount} tools declared (REA ${meta.catalogVersion})`);
      console.log(`  • Live REA CLI   : ${reaStatus.cliFound ? "Installed" : "Not in PATH"}`);
      console.log(`  • Static Parsers : Prisma models, SQL DDL, Express/Node route ASTs`);
      console.log("\nRecreation & Autonomous Repair:");
      console.log(`  • Recreation     : Full loop (investigate -> specify -> plan -> build -> run -> compare -> repair -> re-verify)`);
      console.log(`  • Verifier       : Bounded 10s timeout, syntax verification, schema recovery, spec-driven repair`);
      console.log("\nAI Agent Compatibility (10 supported interfaces):");
      console.log(`  • ${data.adapters.clients.join(", ")}`);
      console.log("\nUse 'forge adapters list' or 'forge doctor' for detailed client environment diagnostics.\n");
    });

  const adaptersCmd = program
    .command("adapters")
    .description("Manage and configure AI coding agent MCP adapters");

  adaptersCmd
    .command("list")
    .description("List all supported AI coding agents and configuration paths")
    .option("--json", "Output machine-readable JSON", false)
    .action(async (options) => {
      const { listAdapters } = await import("../adapters/index.js");
      const adapters = listAdapters();

      if (options.json) {
        console.log(JSON.stringify(adapters, null, 2));
        return;
      }

      console.log("\n=== Supported AI Coding Agent Adapters ===\n");
      for (const a of adapters) {
        const check = a.isConfigured ? "✓ Configured" : (a.configExists ? "~ File Present" : "○ Not Configured");
        console.log(`• [${a.id}] ${a.name} (${a.category})`);
        console.log(`    Status: ${a.status} | Detection: ${check}`);
        console.log(`    Config: ${a.configPath || "Custom or CLI"}`);
        if (a.notes) console.log(`    Notes : ${a.notes}`);
      }
      console.log("\nTo configure an agent, run: forge adapters setup <client-id>\n");
    });

  adaptersCmd
    .command("doctor")
    .description("Check configuration file health across all supported coding agents")
    .action(async () => {
      const { listAdapters } = await import("../adapters/index.js");
      const adapters = listAdapters();
      console.log("\n=== AI Agent Adapter Health Check ===\n");
      for (const a of adapters) {
        const status = a.isConfigured
          ? "ACTIVE (Forge MCP configured)"
          : (a.configExists ? "DETECTED (Config exists, Forge not added)" : "NOT DETECTED (No config file at default path)");
        console.log(`${a.name.padEnd(28)} : ${status}`);
        if (a.configPath) {
          console.log(`  Path: ${a.configPath}`);
        }
      }
      console.log("");
    });

  adaptersCmd
    .command("setup <client>")
    .description("Safely configure Agent App Forge MCP server for a specific client")
    .option("--dry-run", "Preview changes without writing to configuration file", false)
    .option("--force", "Overwrite existing Forge configuration if present", false)
    .option("--custom-path <path>", "Specify custom configuration file path")
    .action(async (client, options) => {
      const { setupAdapter } = await import("../adapters/index.js");
      const result = await setupAdapter(client, {
        dryRun: options.dryRun,
        force: options.force,
        customPath: options.customPath
      });

      console.log(`\n=== Setup Adapter: ${client} ===\n`);
      if (result.dryRun) {
        console.log("[DRY-RUN MODE: No files were modified]");
        console.log(`Target Path: ${result.targetConfigPath}`);
        console.log("\nProposed Configuration Diff:");
        console.log(result.diff);
        return;
      }

      if (!result.success) {
        console.error(`Error: ${result.error}`);
        console.log("\n" + result.manualInstructions);
        process.exit(1);
      }

      if (result.actionTaken === "already_configured") {
        console.log(`Agent '${client}' is already configured for Agent App Forge at: ${result.targetConfigPath}`);
        console.log("Use --force to re-apply configuration.");
      } else {
        console.log(`Successfully ${result.actionTaken} configuration at: ${result.targetConfigPath}`);
        if (result.backupPath) {
          console.log(`Backup created at: ${result.backupPath}`);
        }
      }
      console.log("\nNext Steps:");
      console.log(`Restart ${client} to connect to the Agent App Forge MCP server.`);
    });

  return program;
}
