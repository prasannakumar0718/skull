import * as fs from "node:fs";
import * as path from "node:path";
import { ForgeSpec } from "../spec/schema.js";
import { AppGenerationEngine, GenerationResult } from "./types.js";
import { WaspEngine } from "./waspEngine.js";
import { UniversalNodeEngine } from "./universalNodeEngine.js";

export class EngineOrchestrator {
  private engines: AppGenerationEngine[] = [];

  constructor() {
    this.engines.push(new WaspEngine());
    this.engines.push(new UniversalNodeEngine());
  }

  public selectEngine(spec: ForgeSpec): AppGenerationEngine {
    if (spec.targetEngine === "wasp") {
      const waspEngine = this.engines.find((e) => e.name === "wasp");
      if (waspEngine && waspEngine.canHandle(spec)) return waspEngine;
    }
    if (spec.targetEngine === "fullstack-node") {
      const nodeEngine = this.engines.find((e) => e.name === "fullstack-node");
      if (nodeEngine && nodeEngine.canHandle(spec)) return nodeEngine;
    }

    // Auto resolution:
    // If running on Windows host without WSL, prioritize Universal Node Engine so the user can immediately test & preview.
    const isWindows = process.platform === "win32";
    if (isWindows) {
      return this.engines.find((e) => e.name === "fullstack-node")!;
    }

    return this.engines.find((e) => e.name === "wasp") || this.engines[0];
  }

  public async generateProject(spec: ForgeSpec, outputDirectory: string): Promise<GenerationResult> {
    const engine = this.selectEngine(spec);
    const result = await engine.generate(spec, outputDirectory);

    // Confine writes strictly to outputDirectory
    const resolvedOut = path.resolve(outputDirectory);
    if (!fs.existsSync(resolvedOut)) {
      fs.mkdirSync(resolvedOut, { recursive: true });
    }

    for (const file of result.files) {
      const targetFile = path.resolve(resolvedOut, file.relativePath);
      // Security check: path traversal prevention with strict boundary check
      const relative = path.relative(resolvedOut, targetFile);
      if (relative.startsWith("..") || path.isAbsolute(relative)) {
        throw new Error(`Security Exception: File path escape detected: ${file.relativePath}`);
      }
      fs.mkdirSync(path.dirname(targetFile), { recursive: true });
      fs.writeFileSync(targetFile, file.content, "utf-8");
    }

    // Also persist the ForgeSpec inside the generated app
    fs.writeFileSync(
      path.join(resolvedOut, "forgespec.json"),
      JSON.stringify(spec, null, 2),
      "utf-8"
    );

    return result;
  }
}
