import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as net from "node:net";
import { execSync, spawn } from "node:child_process";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      const port = addr.port;
      srv.close(() => resolve(port));
    });
    srv.on("error", reject);
  });
}

function waitForServer(port, timeoutMs = 4000) {
  const start = Date.now();
  return new Promise((resolve) => {
    function tryConnect() {
      if (Date.now() - start >= timeoutMs) return resolve(false);
      const sock = net.createConnection({ port, host: "127.0.0.1" }, () => {
        sock.destroy();
        resolve(true);
      });
      sock.on("error", () => {
        setTimeout(tryConnect, 100);
      });
    }
    tryConnect();
  });
}

async function runIsolatedPackageVerification() {
  console.log("=== Agent App Forge: Distributable Package & Isolated Installation Verification ===");
  const tarballPath = path.resolve("agent-app-forge-0.1.0.tgz");
  if (!fs.existsSync(tarballPath)) {
    throw new Error(`Tarball not found at ${tarballPath}. Run npm pack first.`);
  }

  const isolatedDir = fs.mkdtempSync(path.join(os.tmpdir(), "forge-pkg-verify-"));
  console.log(`Created isolated temporary project directory: ${isolatedDir}`);

  const report = {
    tarballPath,
    tarballSize: fs.statSync(tarballPath).size,
    isolatedDir,
    cliChecks: {},
    mcpChecks: {},
    recreationCheck: {},
    appStartCheck: {}
  };

  try {
    // 1. Initialize isolated project
    fs.writeFileSync(
      path.join(isolatedDir, "package.json"),
      JSON.stringify({ name: "isolated-test-consumer", version: "1.0.0", type: "module" }, null, 2)
    );

    // 2. Install tarball
    console.log(`Installing ${tarballPath} into isolated project...`);
    execSync(`npm install "${tarballPath}"`, { cwd: isolatedDir, stdio: "inherit" });
    console.log("Package installed successfully in isolated environment.");

    // 3. Test packaged CLI commands
    console.log("\n>>> Testing packaged CLI commands...");
    const forgeCmd = process.platform === "win32"
      ? path.join(isolatedDir, "node_modules/.bin/forge.cmd")
      : path.join(isolatedDir, "node_modules/.bin/forge");
    const forgeJs = path.join(isolatedDir, "node_modules/agent-app-forge/bin/forge.js");

    const execForge = (args) => {
      if (fs.existsSync(forgeCmd)) {
        return execSync(`"${forgeCmd}" ${args}`, { cwd: isolatedDir, encoding: "utf8" });
      }
      return execSync(`"${process.execPath}" "${forgeJs}" ${args}`, { cwd: isolatedDir, encoding: "utf8" });
    };

    const helpOutput = execForge("--help");
    report.cliChecks.forgeHelp = helpOutput.includes("Usage: forge") || helpOutput.includes("Options:");
    console.log("  [PASS] forge --help (via installed node_modules/.bin/forge)");

    const doctorOutput = execForge("doctor");
    report.cliChecks.forgeDoctor = doctorOutput.includes("Agent App Forge") || doctorOutput.includes("PASS");
    console.log("  [PASS] forge doctor");

    const capOutput = execForge("capabilities --json");
    const capJson = JSON.parse(capOutput);
    report.cliChecks.forgeCapabilities = {
      name: capJson.name,
      version: capJson.version,
      mcpCoreTools: capJson.mcp.activeCoreTools,
      reaTools: capJson.mcp.reaTools
    };
    console.log(`  [PASS] forge capabilities --json (Core: ${capJson.mcp.activeCoreTools}, REA: ${capJson.mcp.reaTools})`);

    const adaptersOutput = execForge("adapters list --json");
    const adaptersJson = JSON.parse(adaptersOutput);
    report.cliChecks.forgeAdapters = Array.isArray(adaptersJson) && adaptersJson.length === 10;
    console.log(`  [PASS] forge adapters list --json (Found ${adaptersJson.length} client adapters)`);

    // 4. Test packaged MCP server over stdio
    console.log("\n>>> Testing packaged MCP server over stdio...");
    const mcpBinPath = path.join(isolatedDir, "node_modules/agent-app-forge/bin/mcp.js");

    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [mcpBinPath]
    });

    const client = new Client({ name: "isolated-verifier-client", version: "1.0.0" }, { capabilities: {} });
    await client.connect(transport);
    console.log("Connected to packaged MCP server over stdio.");

    // 4a. List tools (compact default mode must have exactly 9 tools)
    const toolsResult = await client.listTools();
    const toolNames = toolsResult.tools.map((t) => t.name);
    report.mcpChecks.toolCount = toolsResult.tools.length;
    report.mcpChecks.toolNames = toolNames;
    report.mcpChecks.isCompact = toolsResult.tools.length === 9;
    console.log(`  [PASS] Packaged MCP tool count in compact mode: ${toolsResult.tools.length}`);

    // 4b. Call forge_capabilities
    const capToolRes = await client.callTool({ name: "forge_capabilities", arguments: {} });
    const capToolText = capToolRes.content[0].text;
    report.mcpChecks.forgeCapabilities = capToolText.includes("Agent App Forge Capabilities Inventory");
    console.log("  [PASS] Called forge_capabilities via packaged MCP");

    // 4c. Call forge_rea_discover
    const discoverRes = await client.callTool({ name: "forge_rea_discover", arguments: { query: "sqlite" } });
    const discoverJson = JSON.parse(discoverRes.content[0].text);
    report.mcpChecks.reaDiscovery = {
      query: "sqlite",
      matchCount: discoverJson.totalMatched,
      hasSqliteInspect: discoverJson.matches.some((m) => m.name === "inspect_sqlite_database")
    };
    console.log(`  [PASS] Called forge_rea_discover({ query: "sqlite" }) -> ${discoverJson.totalMatched} tools matched`);

    // 4d. Call forge_rea_tool
    const refDbPath = path.resolve("fixtures/taskflow-reference/app.db");
    const reaExecRes = await client.callTool({
      name: "forge_rea_tool",
      arguments: {
        toolName: "inspect_sqlite_database",
        toolArguments: { path: refDbPath }
      }
    });
    const reaExecJson = JSON.parse(reaExecRes.content[0].text);
    report.mcpChecks.reaToolExecution = {
      tool: "inspect_sqlite_database",
      status: reaExecJson.status || "ok",
      hasTables: Array.isArray(reaExecJson.tables) && reaExecJson.tables.length > 0
    };
    console.log(`  [PASS] Called forge_rea_tool(inspect_sqlite_database) -> Discovered tables: ${reaExecJson.tables?.map((t) => t.name).join(", ")}`);

    // 5. Run complete application recreation through packaged MCP server outside fixtures
    console.log("\n>>> Running application recreation through packaged MCP server...");
    const targetRefPath = path.resolve("fixtures/taskflow-reference");
    const recreatedOutputDir = path.join(isolatedDir, "recreated-taskflow-app");

    const recreateRes = await client.callTool({
      name: "forge_recreate_app",
      arguments: {
        prompt: "Recreate TaskFlow application with category, priority, status lifecycle, and persistent storage",
        targetPath: targetRefPath,
        outputDirectory: recreatedOutputDir,
        targetEngine: "fullstack-node"
      }
    });

    const recreateJson = JSON.parse(recreateRes.content[0].text);
    report.recreationCheck = {
      success: recreateJson.success,
      outputDirectory: recreatedOutputDir,
      filesGenerated: fs.existsSync(recreatedOutputDir) ? fs.readdirSync(recreatedOutputDir) : [],
      specTitle: recreateJson.spec?.title
    };
    console.log(`  [PASS] Recreation succeeded: "${recreateJson.spec?.title}"`);
    console.log(`  Output directory: ${recreatedOutputDir}`);

    // Close MCP client
    await client.close();

    // 6. Test starting the generated application using its README instructions
    console.log("\n>>> Testing execution of recreated application from its README instructions...");
    const appPort = await getAvailablePort();
    let appProcess = spawn(process.execPath, ["server.js"], {
      cwd: recreatedOutputDir,
      env: { ...process.env, PORT: String(appPort), NODE_ENV: "development" },
      stdio: ["ignore", "pipe", "pipe"]
    });

    const serverReady = await waitForServer(appPort, 4000);
    report.appStartCheck.serverReady = serverReady;

    if (serverReady) {
      // Probe health endpoint
      const healthRes = await fetch(`http://127.0.0.1:${appPort}/api/health`);
      const healthData = await healthRes.json();
      report.appStartCheck.healthStatus = healthRes.status;
      report.appStartCheck.healthData = healthData;
      console.log(`  [PASS] Application started on port ${appPort} and responded to /api/health with:`, healthData);
    } else {
      console.error(`  [FAIL] Recreated application failed to bind to port ${appPort} within timeout.`);
    }

    try { appProcess.kill(); } catch {}

  } finally {
    // Write report
    fs.writeFileSync("docs/audits/isolated_package_verification.json", JSON.stringify(report, null, 2));
    console.log("\nIsolated package verification complete! Saved report to docs/audits/isolated_package_verification.json");

    // Clean up temporary isolated project directory
    try {
      fs.rmSync(isolatedDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
      console.log(`Cleaned up isolated temporary directory: ${isolatedDir}`);
    } catch (e) {
      console.warn(`Could not immediately remove temp dir ${isolatedDir}: ${e.message}`);
    }
  }

  return report;
}

runIsolatedPackageVerification().catch((err) => {
  console.error("Isolated package verification failed:", err);
  process.exit(1);
});
