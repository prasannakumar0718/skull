import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { RecreationOrchestrator } from "../src/recreation/orchestrator.js";

describe("Task 2: Validate QuickNotes Browser Comparison Evidence in Fresh Directory", () => {
  const outputDir = path.resolve("outputs/browser-quicknotes-revalidation");
  const referencePath = path.resolve("fixtures/quicknotes-reference");

  it("Executes fresh QuickNotes recreation and validates browser comparison evidence", async () => {
    if (fs.existsSync(outputDir)) {
      fs.rmSync(outputDir, { recursive: true, force: true });
    }

    const orchestrator = new RecreationOrchestrator();
    const result = await orchestrator.recreate({
      prompt: "Recreate QuickNotes Online with rich text editing, formatting toolbar, autosave, and multi-format export",
      targetPath: referencePath,
      outputDirectory: outputDir,
      targetEngine: "fullstack-node",
      compare: true
    });

    expect(result.success).toBe(true);
    expect(result.comparison).toBeDefined();

    // Verify browser-comparison.json exists and is populated
    const compPath = path.join(outputDir, "browser-comparison.json");
    expect(fs.existsSync(compPath)).toBe(true);

    const comp = JSON.parse(fs.readFileSync(compPath, "utf-8"));

    // 1. Verify separate reference and recreation records
    expect(comp.referenceUrl).toBeDefined();
    expect(comp.recreationUrl).toBeDefined();
    expect(comp.referenceUrl).not.toEqual(comp.recreationUrl);

    // 2. Verify screenshots captured at matching viewports
    expect(comp.viewportsTested).toEqual([
      { name: "desktop", width: 1280, height: 720 },
      { name: "mobile", width: 375, height: 667 }
    ]);
    const refDesktop = comp.visualComparison.screenshots.referenceDesktop;
    const recDesktop = comp.visualComparison.screenshots.recreationDesktop;
    const refMobile = comp.visualComparison.screenshots.referenceMobile;
    const recMobile = comp.visualComparison.screenshots.recreationMobile;

    expect(fs.existsSync(refDesktop)).toBe(true);
    expect(fs.existsSync(recDesktop)).toBe(true);
    expect(fs.existsSync(refMobile)).toBe(true);
    expect(fs.existsSync(recMobile)).toBe(true);

    expect(fs.statSync(refDesktop).size).toBeGreaterThan(1000);
    expect(fs.statSync(recDesktop).size).toBeGreaterThan(1000);
    expect(fs.statSync(refMobile).size).toBeGreaterThan(1000);
    expect(fs.statSync(recMobile).size).toBeGreaterThan(1000);

    // 3. Verify control difference detection
    expect(comp.visualComparison.buttonsMatch.referenceCount).toBeGreaterThan(0);
    expect(comp.visualComparison.buttonsMatch.recreationCount).toBeGreaterThan(0);
    expect(typeof comp.visualComparison.buttonsMatch.countDifference).toBe("number");
    expect(Array.isArray(comp.visualComparison.buttonsMatch.missingInRecreation)).toBe(true);
    expect(Array.isArray(comp.visualComparison.buttonsMatch.extraInRecreation)).toBe(true);

    // 4. Verify browser interactions were executed, not inferred
    expect(comp.behavioralComparison.recreationPersistence).toBe(true);
    expect(comp.behavioralComparison.referencePersistence).toBe(true);
    expect(comp.behavioralComparison.recreationApiRequests.length).toBeGreaterThan(0);

    // 5. Verify documented scoring and parity score < 1.0 if variances exist
    expect(comp.scoring).toBeDefined();
    expect(comp.scoring.formula).toBeDefined();
    if (comp.behavioralComparison.differences.length > 0) {
      expect(comp.parityScore).toBeLessThan(1.0);
    }

    // 6. Verify non-pixel-perfect disclaimer
    expect(comp.visualComparison.imageDiffPerformed).toBe(false);
    expect(comp.visualComparison.disclaimer).toContain("Pixel-level bitmap diffing was not performed");
  }, 60000);
});
