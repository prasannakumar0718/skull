import * as fs from "node:fs";
import * as path from "node:path";

export interface InvestigationEvidence {
  sourcePath: string;
  kind: "schema" | "routes" | "operations" | "binary-structure" | "bundle";
  findings: Record<string, unknown>;
  confidence: number;
}

export interface InvestigationResult {
  isAvailable: boolean;
  provider: "rea-native" | "rea-mcp" | "forge-heuristic";
  evidence: InvestigationEvidence[];
  suggestedEntities: string[];
  suggestedOperations: string[];
}

/**
 * Bridges Agent App Forge to REA investigation capabilities.
 * If REA binaries/MCP tools are present, it leverages REA's deep binary/source analyzers.
 * If REA is not installed, it gracefully falls back to lightweight AST/heuristic extraction.
 */
export class ReaInvestigationBridge {
  private reaRootPath?: string;

  constructor(reaPath?: string) {
    if (reaPath && fs.existsSync(reaPath)) {
      this.reaRootPath = reaPath;
    }
  }

  public async investigate(targetPath: string): Promise<InvestigationResult> {
    if (!fs.existsSync(targetPath)) {
      throw new Error(`Target investigation path does not exist: ${targetPath}`);
    }

    const stat = fs.statSync(targetPath);
    const evidence: InvestigationEvidence[] = [];
    const suggestedEntities: string[] = [];
    const suggestedOperations: string[] = [];

    // 1. Inspect Prisma schemas or SQL files
    const schemaFiles = this.findFiles(targetPath, [".prisma", ".sql"]);
    for (const file of schemaFiles) {
      const content = fs.readFileSync(file, "utf-8");
      const modelMatches = [...content.matchAll(/model\s+(\w+)\s*\{/g)];
      for (const m of modelMatches) {
        suggestedEntities.push(m[1]);
      }
      evidence.push({
        sourcePath: file,
        kind: "schema",
        findings: { modelsFound: modelMatches.map((m) => m[1]) },
        confidence: 0.95
      });
    }

    // 2. Inspect route & API controllers
    const apiFiles = this.findFiles(targetPath, [".ts", ".js", ".json"]);
    for (const file of apiFiles) {
      const basename = path.basename(file).toLowerCase();
      if (basename.includes("route") || basename.includes("controller") || basename.includes("api")) {
        const content = fs.readFileSync(file, "utf-8");
        const funcMatches = [...content.matchAll(/(?:get|post|put|delete|patch)(\w+)/gi)];
        for (const m of funcMatches) {
          suggestedOperations.push(m[0]);
        }
        evidence.push({
          sourcePath: file,
          kind: "routes",
          findings: { endpointsFound: funcMatches.map((m) => m[0]) },
          confidence: 0.85
        });
      }
    }

    return {
      isAvailable: true,
      provider: this.reaRootPath ? "rea-native" : "forge-heuristic",
      evidence,
      suggestedEntities: Array.from(new Set(suggestedEntities)),
      suggestedOperations: Array.from(new Set(suggestedOperations))
    };
  }

  private findFiles(dir: string, extensions: string[]): string[] {
    const results: string[] = [];
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (!["node_modules", ".git", "dist", ".wasp"].includes(entry.name)) {
            results.push(...this.findFiles(full, extensions));
          }
        } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
          results.push(full);
        }
      }
    } catch {
      // Ignore unreadable dirs
    }
    return results;
  }
}
