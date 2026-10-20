import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";

export interface SystemPrerequisites {
  node: {
    version: string;
    major: number;
    minor: number;
    isSupported: boolean;
    sqliteAvailable: boolean;
    notes?: string;
  };
  wasp: {
    installed: boolean;
    path: string | null;
    version: string | null;
    wslAvailable: boolean;
    isSupportedOnHost: boolean;
    notes: string;
  };
  rea: {
    installed: boolean;
    path: string | null;
    repoDetected: boolean;
    built: boolean;
    notes: string;
  };
}

export function checkSystemPrerequisites(reaRepoPath = path.resolve(process.cwd(), "../rea")): SystemPrerequisites {
  // 1. Check Node.js Version
  const nodeVersion = process.versions.node;
  const [major, minor] = nodeVersion.split(".").map(Number);
  // node:sqlite requires Node >= 22.13.0 for stable unflagged DatabaseSync execution
  const sqliteAvailable = major > 22 || (major === 22 && minor >= 13);
  const nodeSupported = major > 22 || (major === 22 && minor >= 13);

  // 2. Check Wasp CLI and WSL on host
  let waspInstalled = false;
  let waspPath: string | null = null;
  let waspVersion: string | null = null;
  try {
    const probeCmd = process.platform === "win32" ? "where.exe wasp" : "which wasp";
    const out = execSync(probeCmd, { stdio: ["pipe", "pipe", "ignore"], encoding: "utf-8" }).trim();
    if (out) {
      waspInstalled = true;
      waspPath = out.split(/\r?\n/)[0];
      waspVersion = execSync("wasp version", { stdio: ["pipe", "pipe", "ignore"], encoding: "utf-8" }).trim();
    }
  } catch {
    waspInstalled = false;
  }

  let wslAvailable = false;
  if (process.platform === "win32") {
    try {
      execSync("wsl --status", { stdio: ["pipe", "pipe", "ignore"] });
      wslAvailable = true;
    } catch {
      wslAvailable = false;
    }
  }

  const isWindows = process.platform === "win32";
  const waspNotes = waspInstalled
    ? `Wasp CLI installed at ${waspPath}`
    : isWindows
    ? (wslAvailable
        ? "Wasp CLI not in Windows PATH. WSL is available; install Wasp in WSL via: curl -sSL https://get.wasp.sh | sh"
        : "Wasp CLI requires Linux, macOS, or WSL. WSL is not installed. Use Universal Node Engine for native Windows execution.")
    : "Wasp CLI not installed. Install via: curl -sSL https://get.wasp.sh | sh";

  // 3. Check REA CLI and local repository state
  let reaInstalled = false;
  let reaPath: string | null = null;
  try {
    const probeCmd = process.platform === "win32" ? "where.exe rea" : "which rea";
    const out = execSync(probeCmd, { stdio: ["pipe", "pipe", "ignore"], encoding: "utf-8" }).trim();
    if (out) {
      reaInstalled = true;
      reaPath = out.split(/\r?\n/)[0];
    }
  } catch {
    reaInstalled = false;
  }

  const resolvedReaRepo = path.resolve(reaRepoPath);
  const repoDetected = fs.existsSync(path.join(resolvedReaRepo, "package.json"));
  const reaBuilt = repoDetected && fs.existsSync(path.join(resolvedReaRepo, "node_modules"));

  const reaNotes = reaInstalled
    ? `REA CLI found in PATH at ${reaPath}`
    : repoDetected
    ? (reaBuilt
        ? `REA repository present and built at ${resolvedReaRepo}`
        : `REA repository detected at ${resolvedReaRepo}, but unbuilt (node_modules missing). Run 'cd "${resolvedReaRepo}" && npm install && npm run build'`)
    : "REA CLI not found in PATH and REA repository not detected.";

  return {
    node: {
      version: nodeVersion,
      major,
      minor,
      isSupported: nodeSupported,
      sqliteAvailable,
      notes: nodeSupported ? undefined : "Node.js >= 22.13.0 is required for built-in node:sqlite support."
    },
    wasp: {
      installed: waspInstalled,
      path: waspPath,
      version: waspVersion,
      wslAvailable,
      isSupportedOnHost: !isWindows || waspInstalled,
      notes: waspNotes
    },
    rea: {
      installed: reaInstalled,
      path: reaPath,
      repoDetected,
      built: reaBuilt,
      notes: reaNotes
    }
  };
}
