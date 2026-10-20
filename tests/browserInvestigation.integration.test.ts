import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { RecreationOrchestrator } from "../src/recreation/orchestrator.js";
import { BrowserInvestigator } from "../src/recreation/browserInvestigator.js";

describe("Agent App Forge — Browser-Level REA Investigation & Comparison Suite", () => {
  const outputDir = path.resolve("outputs/browser-quicknotes-recreation");
  const referencePath = path.resolve("fixtures/quicknotes-reference");

  it("1. Verifies browser provider availability (playwright-core on system Chromium/Chrome)", async () => {
    const probe = await BrowserInvestigator.isBrowserAvailable();
    expect(probe.available).toBe(true);
    expect(probe.browserType).toBeDefined();
    expect(["chrome", "msedge"]).toContain(probe.browserType);
  });

  it("2. Executes full recreation lifecycle with live browser investigation, UI interaction, screenshot capture, and side-by-side comparison", async () => {
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

    // Verify overall success
    expect(result.success).toBe(true);
    expect(result.mode).toBe("reference_driven");

    // Verify identity mismatch resolution: title is QuickNotes Online, NOT "Document Studio"
    expect(result.spec.title).toBe("QuickNotes Online");
    expect(result.spec.name).toBe("browser-quicknotes-recreation");

    // Verify browser evidence collected during investigation
    const browserEvidence = result.investigation.evidence.find(
      (e) => e.findings && (e.findings as any).type === "browser_page_investigation"
    );
    expect(browserEvidence).toBeDefined();
    const findings = browserEvidence!.findings as any;
    expect(findings.browserProvider).toContain("playwright-core");
    expect(findings.desktopSnapshot).toBeDefined();
    expect(findings.mobileSnapshot).toBeDefined();
    expect(findings.interactionResults.persistenceVerified).toBe(true);

    // Verify generated application files
    expect(fs.existsSync(path.join(outputDir, "server.js"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "app.db"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "public", "index.html"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "public", "style.css"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "public", "app.js"))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, "implementation-plan.json"))).toBe(true);

    // Verify comparison report and captured screenshots
    expect(result.comparison).toBeDefined();
    expect(["pass", "partial"]).toContain(result.comparison!.overallStatus);
    expect(fs.existsSync(path.join(outputDir, "browser-comparison.json"))).toBe(true);

    const compJson = JSON.parse(fs.readFileSync(path.join(outputDir, "browser-comparison.json"), "utf-8"));
    expect(compJson.visualComparison.referenceTitle).toBe("QuickNotes Online");
    expect(compJson.visualComparison.recreationTitle).toBe("QuickNotes Online");
    expect(compJson.visualComparison.titleMatch).toBe(true);
    expect(compJson.behavioralComparison.referencePersistence).toBe(true);
    expect(compJson.behavioralComparison.recreationPersistence).toBe(true);
    expect(compJson.behavioralComparison.persistenceParity).toBe(true);
    expect(compJson.parityScore).toBeGreaterThanOrEqual(0.85);
    if (compJson.behavioralComparison.differences.length > 0) {
      expect(compJson.parityScore).toBeLessThan(1.0);
    }
    expect(compJson.visualComparison.imageDiffPerformed).toBe(false);
    expect(compJson.visualComparison.disclaimer).toContain("bitmap diffing was not performed");
    expect(compJson.scoring.formula).toBeDefined();

    // Verify screenshots exist on disk
    const refDesktopShot = path.join(outputDir, "comparison", "comparison_screenshots", "reference", "desktop_1280x720.png");
    const recDesktopShot = path.join(outputDir, "comparison", "comparison_screenshots", "recreation", "desktop_1280x720.png");
    const refMobileShot = path.join(outputDir, "comparison", "comparison_screenshots", "reference", "mobile_375x667.png");
    const recMobileShot = path.join(outputDir, "comparison", "comparison_screenshots", "recreation", "mobile_375x667.png");

    expect(fs.existsSync(refDesktopShot)).toBe(true);
    expect(fs.existsSync(recDesktopShot)).toBe(true);
    expect(fs.existsSync(refMobileShot)).toBe(true);
    expect(fs.existsSync(recMobileShot)).toBe(true);

    expect(fs.statSync(refDesktopShot).size).toBeGreaterThan(1000);
    expect(fs.statSync(recDesktopShot).size).toBeGreaterThan(1000);
    expect(fs.statSync(refMobileShot).size).toBeGreaterThan(1000);
    expect(fs.statSync(recMobileShot).size).toBeGreaterThan(1000);
  }, 60000);
});
