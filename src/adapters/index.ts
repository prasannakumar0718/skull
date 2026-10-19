import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

export interface AdapterInfo {
  id: string;
  name: string;
  category: string;
  configPath: string | null;
  configExists: boolean;
  isConfigured: boolean;
  status: string;
  notes?: string;
}

export interface SetupResult {
  clientId: string;
  clientName: string;
  targetConfigPath: string;
  backupPath?: string;
  dryRun: boolean;
  success: boolean;
  actionTaken: "created" | "merged" | "already_configured" | "dry_run_preview";
  diff?: string;
  error?: string;
  manualInstructions: string;
}

/**
 * Returns standard MCP server configuration for Agent App Forge.
 */
export function getForgeMcpConfig(useNpx = true): Record<string, unknown> {
  if (useNpx) {
    return {
      command: "npx",
      args: ["-y", "agent-app-forge", "mcp"]
    };
  }
  return {
    command: "node",
    args: ["./bin/mcp.js"]
  };
}

/**
 * Resolves standard configuration file locations for known clients across platforms.
 */
export function resolveClientConfigPath(clientId: string): string | null {
  const home = os.homedir();
  const platform = process.platform;

  switch (clientId) {
    case "claude-code":
    case "claude-desktop":
      if (platform === "win32") {
        const appData = process.env.APPDATA || path.join(home, "AppData", "Roaming");
        return path.join(appData, "Claude", "claude_desktop_config.json");
      } else if (platform === "darwin") {
        return path.join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json");
      }
      return path.join(home, ".config", "Claude", "claude_desktop_config.json");

    case "cursor":
      return path.join(process.cwd(), ".cursor", "mcp.json");

    case "cline":
      if (platform === "win32") {
        const appData = process.env.APPDATA || path.join(home, "AppData", "Roaming");
        return path.join(appData, "Code", "User", "globalStorage", "saoudrizwan.claude-dev", "settings", "cline_mcp_settings.json");
      } else if (platform === "darwin") {
        return path.join(home, "Library", "Application Support", "Code", "User", "globalStorage", "saoudrizwan.claude-dev", "settings", "cline_mcp_settings.json");
      }
      return path.join(home, ".config", "Code", "User", "globalStorage", "saoudrizwan.claude-dev", "settings", "cline_mcp_settings.json");

    case "roo-code":
      if (platform === "win32") {
        const appData = process.env.APPDATA || path.join(home, "AppData", "Roaming");
        return path.join(appData, "Code", "User", "globalStorage", "rooveterinaryinc.roo-cline", "settings", "cline_mcp_settings.json");
      } else if (platform === "darwin") {
        return path.join(home, "Library", "Application Support", "Code", "User", "globalStorage", "rooveterinaryinc.roo-cline", "settings", "cline_mcp_settings.json");
      }
      return path.join(home, ".config", "Code", "User", "globalStorage", "rooveterinaryinc.roo-cline", "settings", "cline_mcp_settings.json");

    case "windsurf":
      return path.join(home, ".codeium", "windsurf", "mcp_config.json");

    case "opencode":
      return path.join(home, ".config", "opencode", "mcp.json");

    case "antigravity":
      return path.join(home, ".gemini", "antigravity", "mcp_config.json");

    case "vscode-copilot":
      return path.join(process.cwd(), ".vscode", "mcp.json");

    case "codex-cli":
      return path.join(home, ".codex", "mcp.json");

    case "gemini-cli":
      return path.join(home, ".gemini", "mcp.json");

    default:
      return null;
  }
}

/**
 * Lists all known client adapters and checks host file presence.
 */
export function listAdapters(): AdapterInfo[] {
  let compatibilityData: any = null;
  try {
    const jsonPath = path.resolve(__dirname, "../../config/agent-compatibility.json");
    if (fs.existsSync(jsonPath)) {
      compatibilityData = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
    }
  } catch {}

  const clients = compatibilityData?.clients || [
    { id: "antigravity", name: "Google Antigravity", category: "IDE / Autonomous Agent", status: "end-to-end verified" },
    { id: "claude-code", name: "Claude Code / Claude Desktop", category: "CLI / Desktop Agent", status: "protocol-tested" },
    { id: "cursor", name: "Cursor", category: "AI Editor", status: "protocol-tested" },
    { id: "opencode", name: "OpenCode", category: "Terminal Agent", status: "protocol-tested" },
    { id: "vscode-copilot", name: "VS Code / GitHub Copilot", category: "IDE Extension", status: "limited" },
    { id: "cline", name: "Cline (VS Code Extension)", category: "Autonomous Coding Agent", status: "configured" },
    { id: "roo-code", name: "Roo Code (Roo Clinic)", category: "Autonomous Coding Agent", status: "configured" },
    { id: "windsurf", name: "Windsurf (Codeium Cascade)", category: "AI Editor", status: "protocol-tested" },
    { id: "gemini-cli", name: "Gemini CLI", category: "Terminal Agent", status: "protocol-tested" },
    { id: "codex-cli", name: "Codex CLI", category: "Terminal Agent", status: "protocol-tested" }
  ];

  return clients.map((c: any) => {
    const configPath = resolveClientConfigPath(c.id);
    let configExists = false;
    let isConfigured = false;

    if (configPath && fs.existsSync(configPath)) {
      configExists = true;
      try {
        const raw = fs.readFileSync(configPath, "utf-8");
        const parsed = JSON.parse(raw);
        const servers = parsed.mcpServers || parsed.servers || {};
        isConfigured = Boolean(servers["agent-app-forge"] || servers["forge"]);
      } catch {}
    }

    return {
      id: c.id,
      name: c.name,
      category: c.category,
      configPath,
      configExists,
      isConfigured,
      status: c.status || "configured",
      notes: c.limitations
    };
  });
}

/**
 * Generates copy-paste manual setup instructions for any client.
 */
export function getManualInstructions(clientId: string): string {
  const config = getForgeMcpConfig(true);
  const jsonSnippet = JSON.stringify({ mcpServers: { "agent-app-forge": config } }, null, 2);
  const targetPath = resolveClientConfigPath(clientId) || "(client settings file)";

  return [
    `Manual Configuration for ${clientId}:`,
    `1. Open or create: ${targetPath}`,
    `2. Add the following entry to the 'mcpServers' object:`,
    jsonSnippet,
    `3. Save the file and restart your AI coding client.`
  ].join("\n");
}

/**
 * Safely sets up or updates configuration for a given client adapter.
 * Never overwrites existing unrelated servers; creates timestamped backup before touching files.
 */
export async function setupAdapter(
  clientId: string,
  options: { dryRun?: boolean; force?: boolean; customPath?: string } = {}
): Promise<SetupResult> {
  const targetPath = options.customPath || resolveClientConfigPath(clientId);
  const manual = getManualInstructions(clientId);

  if (!targetPath) {
    return {
      clientId,
      clientName: clientId,
      targetConfigPath: "",
      dryRun: Boolean(options.dryRun),
      success: false,
      actionTaken: "already_configured",
      error: `Could not automatically resolve configuration path for client '${clientId}'.`,
      manualInstructions: manual
    };
  }

  const forgeConfig = getForgeMcpConfig(true);
  let existingContent: any = { mcpServers: {} };
  let fileExisted = false;

  if (fs.existsSync(targetPath)) {
    fileExisted = true;
    try {
      const raw = fs.readFileSync(targetPath, "utf-8");
      existingContent = JSON.parse(raw);
    } catch (err: any) {
      return {
        clientId,
        clientName: clientId,
        targetConfigPath: targetPath,
        dryRun: Boolean(options.dryRun),
        success: false,
        actionTaken: "already_configured",
        error: `Existing configuration file at '${targetPath}' contains invalid JSON: ${err.message}. Refusing to overwrite.`,
        manualInstructions: manual
      };
    }
  }

  // Ensure mcpServers structure exists
  if (!existingContent.mcpServers || typeof existingContent.mcpServers !== "object") {
    existingContent.mcpServers = {};
  }

  const isAlreadyConfigured = Boolean(
    existingContent.mcpServers["agent-app-forge"] || existingContent.mcpServers["forge"]
  );

  if (isAlreadyConfigured && !options.force) {
    return {
      clientId,
      clientName: clientId,
      targetConfigPath: targetPath,
      dryRun: Boolean(options.dryRun),
      success: true,
      actionTaken: "already_configured",
      manualInstructions: manual
    };
  }

  // Merge configuration safely
  const updatedContent = {
    ...existingContent,
    mcpServers: {
      ...existingContent.mcpServers,
      "agent-app-forge": forgeConfig
    }
  };

  const formattedJson = JSON.stringify(updatedContent, null, 2);

  if (options.dryRun) {
    return {
      clientId,
      clientName: clientId,
      targetConfigPath: targetPath,
      dryRun: true,
      success: true,
      actionTaken: "dry_run_preview",
      diff: formattedJson,
      manualInstructions: manual
    };
  }

  // Create backup if modifying existing file
  let backupPath: string | undefined;
  if (fileExisted) {
    backupPath = `${targetPath}.backup.${Date.now()}`;
    fs.copyFileSync(targetPath, backupPath);
  } else {
    // Ensure parent directory exists
    const dir = path.dirname(targetPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // Write updated configuration safely
  fs.writeFileSync(targetPath, formattedJson, "utf-8");

  return {
    clientId,
    clientName: clientId,
    targetConfigPath: targetPath,
    backupPath,
    dryRun: false,
    success: true,
    actionTaken: fileExisted ? "merged" : "created",
    diff: formattedJson,
    manualInstructions: manual
  };
}
