import * as fs from "node:fs";
import * as path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
/**
 * Bridges Agent App Forge to REA (Reverse Engineer Anything) capabilities.
 *
 * DESIGN PRINCIPLE: Strict Truthfulness
 * - If real REA CLI / MCP is installed and functioning, it executes REA tools.
 * - If REA is unbuilt, uninstalled, or unavailable, it degrades gracefully to
 *   Agent App Forge's native source parser and reports provider as 'forge-source-parser'.
 * - It never claims REA was executed when only native Forge heuristic parsing was performed.
 */
export class ReaInvestigationBridge {
    reaRootPath;
    customProvider;
    constructor(reaPath) {
        if (reaPath && fs.existsSync(reaPath)) {
            this.reaRootPath = path.resolve(reaPath);
        }
    }
    /**
     * Probes whether REA is genuinely installed and runnable in the host environment.
     */
    probeReaStatus() {
        // 1. Check if 'rea' CLI binary is in PATH
        let cliFound = false;
        let cliPath = null;
        try {
            const probeCmd = process.platform === "win32" ? "where.exe rea" : "which rea";
            const stdout = execSync(probeCmd, { stdio: ["pipe", "pipe", "ignore"], encoding: "utf-8" }).trim();
            if (stdout) {
                cliFound = true;
                cliPath = stdout.split(/\r?\n/)[0];
            }
        }
        catch {
            cliFound = false;
        }
        // 2. Check if local REA repository is present and built
        let mcpFound = false;
        let details = "";
        if (this.reaRootPath) {
            const reaPkgPath = path.join(this.reaRootPath, "package.json");
            const reaNodeModules = path.join(this.reaRootPath, "node_modules");
            const reaScript = path.join(this.reaRootPath, "scripts", "rea.mjs");
            if (fs.existsSync(reaPkgPath)) {
                if (!fs.existsSync(reaNodeModules)) {
                    details = `REA repository detected at '${this.reaRootPath}', but dependencies (node_modules) are not installed. Real REA execution cannot proceed without building.`;
                }
                else if (fs.existsSync(reaScript)) {
                    mcpFound = true;
                    details = `REA repository detected at '${this.reaRootPath}' with entry script '${reaScript}'.`;
                }
            }
            else {
                details = `Path '${this.reaRootPath}' does not contain a valid REA repository package.json.`;
            }
        }
        else {
            details = cliFound
                ? `REA CLI found in system PATH at '${cliPath}'.`
                : "REA is not installed in PATH and no built REA repository path was configured.";
        }
        return {
            cliFound,
            mcpFound,
            details
        };
    }
    /**
     * Investigates a target reference project or file.
     */
    async investigate(targetPath) {
        const resolvedPath = path.resolve(targetPath);
        if (!fs.existsSync(resolvedPath)) {
            throw new Error(`Target investigation path does not exist: ${resolvedPath}`);
        }
        const reaStatus = this.probeReaStatus();
        // If a mock or test fixture was explicitly configured
        if (this.customProvider === "test-fixture") {
            return this.executeFixtureAnalysis(resolvedPath, reaStatus);
        }
        // If REA CLI is available in PATH, invoke genuine REA CLI
        if (reaStatus.cliFound) {
            try {
                return await this.executeReaCli(resolvedPath, reaStatus);
            }
            catch (err) {
                // Fall back gracefully with clear diagnostic
                return this.executeNativeForgeParser(resolvedPath, reaStatus, [
                    `REA CLI failed during analysis: ${err.message}. Gracefully degraded to native Forge parser.`
                ]);
            }
        }
        // If REA is unavailable, run native Forge source parser truthfully
        return this.executeNativeForgeParser(resolvedPath, reaStatus);
    }
    /**
     * Native Forge source code parser.
     * Parses Prisma schemas, SQL DDL, and TypeScript/JavaScript route files.
     */
    executeNativeForgeParser(targetPath, reaStatus, additionalWarnings = []) {
        const evidence = [];
        const suggestedEntities = [];
        const suggestedOperations = [];
        const warnings = [...additionalWarnings];
        if (!reaStatus.cliFound && !reaStatus.mcpFound) {
            warnings.push("REA is not installed or unbuilt. Results produced strictly via native Forge AST/heuristic parser.");
        }
        // 1. Inspect Prisma schemas or SQL files
        const schemaFiles = this.findFiles(targetPath, [".prisma", ".sql"]);
        for (const file of schemaFiles) {
            const content = fs.readFileSync(file, "utf-8");
            // Prisma models
            const prismaMatches = [...content.matchAll(/model\s+(\w+)\s*\{/g)];
            for (const m of prismaMatches) {
                suggestedEntities.push(m[1]);
            }
            // SQL CREATE TABLE
            const sqlMatches = [...content.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([`"']?\w+[`"']?)/gi)];
            for (const m of sqlMatches) {
                const tableName = m[1].replace(/[`"']/g, "");
                suggestedEntities.push(tableName);
            }
            if (prismaMatches.length > 0 || sqlMatches.length > 0) {
                evidence.push({
                    sourcePath: file,
                    kind: "schema",
                    findings: {
                        prismaModels: prismaMatches.map((m) => m[1]),
                        sqlTables: sqlMatches.map((m) => m[1].replace(/[`"']/g, ""))
                    },
                    confidence: 0.95
                });
            }
        }
        // 2. Inspect route & API controllers
        const apiFiles = this.findFiles(targetPath, [".ts", ".js", ".json"]);
        for (const file of apiFiles) {
            const basename = path.basename(file).toLowerCase();
            if (basename.includes("route") || basename.includes("controller") || basename.includes("api") || basename.includes("operations")) {
                const content = fs.readFileSync(file, "utf-8");
                const funcMatches = [...content.matchAll(/(?:get|post|put|delete|patch|query|action|create|update|remove|find|list)(\w+)/gi)];
                for (const m of funcMatches) {
                    suggestedOperations.push(m[0]);
                }
                if (funcMatches.length > 0) {
                    evidence.push({
                        sourcePath: file,
                        kind: "routes",
                        findings: { endpointsFound: funcMatches.map((m) => m[0]) },
                        confidence: 0.85
                    });
                }
            }
        }
        return {
            isAvailable: true,
            reaAvailable: false,
            provider: "forge-source-parser",
            evidence,
            suggestedEntities: Array.from(new Set(suggestedEntities)),
            suggestedOperations: Array.from(new Set(suggestedOperations)),
            reaStatus,
            warnings: warnings.length > 0 ? warnings : undefined
        };
    }
    /**
     * Invokes real REA CLI when present.
     */
    async executeReaCli(targetPath, reaStatus) {
        const output = execSync(`rea "${targetPath}" --json`, {
            encoding: "utf-8",
            timeout: 15000,
            stdio: ["pipe", "pipe", "pipe"]
        });
        const parsed = JSON.parse(output);
        return {
            isAvailable: true,
            reaAvailable: true,
            provider: "rea-cli",
            evidence: parsed.evidence || [],
            suggestedEntities: parsed.entities || [],
            suggestedOperations: parsed.operations || [],
            reaStatus
        };
    }
    /**
     * Evaluates recorded REA test fixtures for deterministic testing.
     */
    executeFixtureAnalysis(targetPath, reaStatus) {
        return {
            isAvailable: true,
            reaAvailable: true,
            provider: "test-fixture",
            evidence: [
                {
                    sourcePath: targetPath,
                    kind: "binary-structure",
                    findings: { format: "ELF/Mach-O/PE", exportedSymbols: ["task_create", "task_list"] },
                    confidence: 0.99
                }
            ],
            suggestedEntities: ["TaskRecord", "TaskSession"],
            suggestedOperations: ["task_create", "task_list", "task_close"],
            reaStatus
        };
    }
    setProviderForTesting(provider) {
        this.customProvider = provider;
    }
    /**
     * Returns list of upstream REA tools supported by the REA contract (all 207 upstream tools).
     */
    listSupportedReaTools() {
        try {
            let catalogPath = path.resolve(__dirname, "reaCatalog.json");
            if (!fs.existsSync(catalogPath)) {
                catalogPath = path.resolve(__dirname, "../src/investigation/reaCatalog.json");
            }
            if (!fs.existsSync(catalogPath)) {
                catalogPath = path.resolve(process.cwd(), "src/investigation/reaCatalog.json");
            }
            if (fs.existsSync(catalogPath)) {
                const raw = fs.readFileSync(catalogPath, "utf-8");
                const catalog = JSON.parse(raw);
                if (Array.isArray(catalog) && catalog.length > 0) {
                    return catalog.map((t) => ({
                        name: t.name,
                        description: t.description || `Upstream REA analysis tool: ${t.name}`,
                        inputSchema: t.inputSchema || { type: "object", properties: {} }
                    }));
                }
            }
        }
        catch {
            // Fallback to static catalog if catalog file read fails
        }
        return [
            {
                name: "inspect_artifact",
                description: "Examine binary layout, section headers, exported symbols, web bundle manifests, and structure.",
                inputSchema: {
                    type: "object",
                    properties: {
                        artifactPath: { type: "string", description: "Absolute path to target file or binary" }
                    },
                    required: ["artifactPath"]
                }
            },
            {
                name: "analyze_function",
                description: "Decompile function, generate pseudo-code, disassembly, CFG, and caller/callee graphs.",
                inputSchema: {
                    type: "object",
                    properties: {
                        artifactPath: { type: "string" },
                        functionIdentifier: { type: "string" }
                    },
                    required: ["artifactPath", "functionIdentifier"]
                }
            },
            {
                name: "compare_artifacts",
                description: "Compare structure, signatures, and symbol graphs between two reference artifacts.",
                inputSchema: {
                    type: "object",
                    properties: {
                        artifactPathA: { type: "string" },
                        artifactPathB: { type: "string" }
                    },
                    required: ["artifactPathA", "artifactPathB"]
                }
            },
            {
                name: "get_call_graph",
                description: "Extract complete static call graph across functions with relationship coverage.",
                inputSchema: {
                    type: "object",
                    properties: {
                        artifactPath: { type: "string" },
                        depth: { type: "number", default: 2 }
                    },
                    required: ["artifactPath"]
                }
            },
            {
                name: "get_evidence_bundle",
                description: "Retrieve comprehensive retained session evidence bundle for cross-agent transfer.",
                inputSchema: {
                    type: "object",
                    properties: {
                        bundleId: { type: "string" }
                    }
                }
            }
        ];
    }
    /**
     * Executes a native REA command with full argument pass-through.
     */
    executeReaCliCommand(args) {
        const reaStatus = this.probeReaStatus();
        try {
            let cmd;
            if (reaStatus.cliFound) {
                cmd = "rea";
            }
            else if (this.reaRootPath && fs.existsSync(path.join(this.reaRootPath, "dist", "cli-runtime", "cli.js"))) {
                cmd = `node "${path.join(this.reaRootPath, "scripts", "rea.mjs")}"`;
            }
            else {
                // Fall back to upstream rea-agents package via npx
                cmd = process.platform === "win32" ? "npx.cmd --yes rea-agents@6.7.0" : "npx --yes rea-agents@6.7.0";
            }
            const fullCmd = `${cmd} ${args.map((a) => (a.includes(" ") ? `"${a}"` : a)).join(" ")}`;
            const stdout = execSync(fullCmd, { encoding: "utf-8", timeout: 30000 });
            return {
                success: true,
                exitCode: 0,
                stdout: stdout.trim(),
                stderr: ""
            };
        }
        catch (err) {
            return {
                success: false,
                exitCode: err.status || 1,
                stdout: (err.stdout || "").toString().trim(),
                stderr: (err.stderr || err.message || "").toString().trim(),
                notes: reaStatus.details
            };
        }
    }
    /**
     * Delegates invocation of a native REA MCP tool using the real upstream MCP interface.
     */
    async callReaNativeTool(toolName, toolArgs) {
        // If test fixture mode is set
        if (this.customProvider === "test-fixture") {
            return {
                isError: false,
                data: {
                    tool: toolName,
                    status: "simulated_fixture",
                    evidence_id: "ev_test_12345",
                    normalized_result: { observed: true, toolName, args: toolArgs }
                }
            };
        }
        try {
            const res = await this.invokeReaMcpTool(toolName, toolArgs);
            const isErr = res.isError ?? false;
            let errMsg = undefined;
            if (isErr) {
                if (Array.isArray(res.content) && res.content[0]?.text) {
                    errMsg = res.content[0].text;
                }
                else {
                    errMsg = `Tool '${toolName}' execution returned error status.`;
                }
            }
            return {
                isError: isErr,
                data: res,
                error: errMsg
            };
        }
        catch (err) {
            return {
                isError: true,
                error: err.message || `Failed to execute native REA tool '${toolName}'`,
                remediation: "Verify that target path exists, arguments match schema, and required analysis providers are installed."
            };
        }
    }
    /**
     * Directly invokes the real upstream REA MCP server via StdioClientTransport.
     */
    async invokeReaMcpTool(toolName, toolArgs) {
        const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
        const { StdioClientTransport } = await import("@modelcontextprotocol/sdk/client/stdio.js");
        let cmd;
        let args;
        if (this.reaRootPath && fs.existsSync(path.join(this.reaRootPath, "dist", "mcp", "main.js"))) {
            cmd = process.execPath;
            args = [path.join(this.reaRootPath, "scripts", "rea.mjs"), "--mcp"];
        }
        else {
            const probeCmd = process.platform === "win32" ? "where.exe rea" : "which rea";
            let hasGlobalRea = false;
            try {
                execSync(probeCmd, { stdio: ["pipe", "pipe", "ignore"] });
                hasGlobalRea = true;
            }
            catch { }
            if (hasGlobalRea) {
                cmd = "rea";
                args = ["--mcp"];
            }
            else {
                cmd = process.platform === "win32" ? "npx.cmd" : "npx";
                args = ["--yes", "rea-agents@6.7.0", "--mcp"];
            }
        }
        const transport = new StdioClientTransport({
            command: cmd,
            args
        });
        const client = new Client({
            name: "forge-rea-delegator",
            version: "0.1.0"
        }, { capabilities: {} });
        try {
            await client.connect(transport);
            const res = await client.callTool({
                name: toolName,
                arguments: toolArgs
            });
            return res;
        }
        finally {
            try {
                await client.close();
            }
            catch { }
        }
    }
    findFiles(dir, extensions) {
        const results = [];
        try {
            const stat = fs.statSync(dir);
            if (stat.isFile()) {
                if (extensions.some((ext) => dir.endsWith(ext))) {
                    return [dir];
                }
                return [];
            }
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                const full = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    if (!["node_modules", ".git", "dist", ".wasp", "coverage"].includes(entry.name)) {
                        results.push(...this.findFiles(full, extensions));
                    }
                }
                else if (extensions.some((ext) => entry.name.endsWith(ext))) {
                    results.push(full);
                }
            }
        }
        catch {
            // Ignore unreadable dirs
        }
        return results;
    }
}
