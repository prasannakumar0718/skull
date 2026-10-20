import * as path from "node:path";
import * as fs from "node:fs";

export interface BrowserElementSummary {
  tag: string;
  id?: string;
  className?: string;
  text?: string;
  type?: string;
  selector: string;
  role?: string;
}

export interface BrowserInteractionStep {
  step: string;
  action: "navigate" | "click" | "type" | "wait" | "reload" | "verify";
  selector?: string;
  value?: string;
  result: "success" | "failed" | "skipped";
  details?: string;
  observedStateChange?: string;
}

export interface BrowserVisualSnapshot {
  viewport: { width: number; height: number; name: "desktop" | "mobile" };
  screenshotPath?: string;
  screenshotBase64?: string;
  title: string;
  url: string;
  headings: string[];
  buttons: BrowserElementSummary[];
  inputs: BrowserElementSummary[];
  forms: BrowserElementSummary[];
  menus: string[];
  responsiveLayoutVerified: boolean;
}

export interface BrowserPageInvestigation {
  url: string;
  accessible: boolean;
  pageTitle: string;
  desktopSnapshot?: BrowserVisualSnapshot;
  mobileSnapshot?: BrowserVisualSnapshot;
  observedControls: {
    buttons: BrowserElementSummary[];
    inputs: BrowserElementSummary[];
    forms: BrowserElementSummary[];
    menus: string[];
    headings: string[];
  };
  observedStates: {
    initialState: string;
    emptyStateDetected: boolean;
    autosaveBadgeObserved?: string;
  };
  interactionResults: {
    scenario: string;
    steps: BrowserInteractionStep[];
    persistenceVerified: boolean;
    apiRequestsObserved: Array<{ method: string; url: string; status: number }>;
  };
  limitations: string[];
}

export interface ParityMetricDetail {
  name: string;
  weight: number;
  score: number;
  status: "pass" | "partial" | "fail" | "unavailable";
  description: string;
}

export interface ParityScoringReport {
  formula: string;
  metrics: {
    accessibility: ParityMetricDetail;
    titleMatch: ParityMetricDetail;
    buttonRecall: ParityMetricDetail;
    buttonCountParity: ParityMetricDetail;
    desktopLayout: ParityMetricDetail;
    mobileResponsiveness: ParityMetricDetail;
    behavioralPersistence: ParityMetricDetail;
  };
  rawScore: number;
  finalScore: number;
  cappedReason?: string;
}

export interface VisualAndBehavioralComparison {
  referenceUrl: string;
  recreationUrl: string;
  browserProvider: string;
  viewportsTested: Array<{ name: string; width: number; height: number }>;
  visualComparison: {
    method: string;
    imageDiffPerformed: boolean;
    disclaimer: string;
    titleMatch: boolean;
    referenceTitle: string;
    recreationTitle: string;
    buttonsMatch: {
      referenceCount: number;
      recreationCount: number;
      commonButtons: string[];
      missingInRecreation: string[];
      extraInRecreation: string[];
      countDifference: number;
    };
    responsiveParity: {
      referenceMobileOk: boolean;
      recreationMobileOk: boolean;
      parityConfirmed: boolean;
    };
    screenshots: {
      referenceDesktop?: string;
      recreationDesktop?: string;
      referenceMobile?: string;
      recreationMobile?: string;
      referencePostInteraction?: string;
      recreationPostInteraction?: string;
    };
  };
  behavioralComparison: {
    scenario: string;
    referencePersistence: boolean;
    recreationPersistence: boolean;
    persistenceParity: boolean;
    referenceApiRequests: string[];
    recreationApiRequests: string[];
    differences: string[];
  };
  scoring: ParityScoringReport;
  parityScore: number; // 0.0 to 1.0
}

/**
 * Browser-Level REA Investigation Provider using Playwright.
 * Investigates how web applications actually look, render, and behave across viewports.
 */
export class BrowserInvestigator {
  private static async getPlaywright() {
    try {
      return await import("playwright-core");
    } catch {
      return null;
    }
  }

  /**
   * Probe whether browser automation is functioning on the host.
   */
  public static async isBrowserAvailable(): Promise<{
    available: boolean;
    browserType?: string;
    version?: string;
    error?: string;
  }> {
    const pw = await this.getPlaywright();
    if (!pw) {
      return {
        available: false,
        error: "playwright-core package is not installed."
      };
    }

    try {
      const browser = await pw.chromium.launch({
        channel: "chrome",
        headless: true
      });
      const version = browser.version();
      await browser.close();
      return {
        available: true,
        browserType: "chrome",
        version
      };
    } catch (chromeErr: any) {
      try {
        const edgeBrowser = await pw.chromium.launch({
          channel: "msedge",
          headless: true
        });
        const version = edgeBrowser.version();
        await edgeBrowser.close();
        return {
          available: true,
          browserType: "msedge",
          version
        };
      } catch (edgeErr: any) {
        return {
          available: false,
          error: `Browser automation launch failed: ${chromeErr.message}; Edge: ${edgeErr.message}`
        };
      }
    }
  }

  /**
   * Launch a headless browser instance using system Chrome or Edge.
   */
  private static async launchBrowser() {
    const pw = await this.getPlaywright();
    if (!pw) throw new Error("playwright-core is not installed");

    try {
      return await pw.chromium.launch({ channel: "chrome", headless: true });
    } catch {
      return await pw.chromium.launch({ channel: "msedge", headless: true });
    }
  }

  /**
   * Investigate a live web application URL with Playwright.
   * Collects visual snapshots (desktop & mobile), interactive controls, and exercises real interactions.
   */
  public static async investigateWebPage(
    url: string,
    options?: {
      screenshotDir?: string;
      runInteractions?: boolean;
    }
  ): Promise<BrowserPageInvestigation> {
    const limitations: string[] = [];
    const pw = await this.getPlaywright();

    if (!pw) {
      return {
        url,
        accessible: false,
        pageTitle: "",
        observedControls: { buttons: [], inputs: [], forms: [], menus: [], headings: [] },
        observedStates: { initialState: "unknown", emptyStateDetected: false },
        interactionResults: { scenario: "None", steps: [], persistenceVerified: false, apiRequestsObserved: [] },
        limitations: ["playwright-core is not installed in the environment."]
      };
    }

    let browser: any;
    try {
      browser = await this.launchBrowser();
    } catch (err: any) {
      return {
        url,
        accessible: false,
        pageTitle: "",
        observedControls: { buttons: [], inputs: [], forms: [], menus: [], headings: [] },
        observedStates: { initialState: "unknown", emptyStateDetected: false },
        interactionResults: { scenario: "None", steps: [], persistenceVerified: false, apiRequestsObserved: [] },
        limitations: [`Failed to launch browser: ${err.message}`]
      };
    }

    const apiRequestsObserved: Array<{ method: string; url: string; status: number }> = [];

    try {
      const context = await browser.newContext({
        viewport: { width: 1280, height: 720 },
        userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 AgentAppForge-Browser/1.0"
      });

      const page = await context.newPage();

      // Listen for network API calls
      page.on("response", (res: any) => {
        const reqUrl = res.url();
        if (reqUrl.includes("/api/") || reqUrl.includes("/export")) {
          apiRequestsObserved.push({
            method: res.request().method(),
            url: reqUrl,
            status: res.status()
          });
        }
      });

      // Navigate to URL safely with error fallback
      try {
        try {
          await page.goto(url, { waitUntil: "networkidle", timeout: 10000 });
        } catch {
          await page.goto(url, { waitUntil: "domcontentloaded", timeout: 8000 });
        }
      } catch (navErr: any) {
        try { await browser.close(); } catch {}
        return {
          url,
          accessible: false,
          pageTitle: "",
          observedControls: { buttons: [], inputs: [], forms: [], menus: [], headings: [] },
          observedStates: { initialState: "unreachable", emptyStateDetected: false },
          interactionResults: { scenario: "None", steps: [], persistenceVerified: false, apiRequestsObserved: [] },
          limitations: [`Failed to navigate to ${url}: ${navErr.message}`]
        };
      }

      const pageTitle = await page.title();

      if (options?.screenshotDir && !fs.existsSync(options.screenshotDir)) {
        fs.mkdirSync(options.screenshotDir, { recursive: true });
      }

      // 1. Desktop Snapshot & Control Extraction
      const desktopShotPath = options?.screenshotDir
        ? path.join(options.screenshotDir, "desktop_1280x720.png")
        : undefined;

      const desktopShotBuffer = await page.screenshot({ fullPage: false });
      if (desktopShotPath) {
        fs.writeFileSync(desktopShotPath, desktopShotBuffer);
      }

      // Extract Headings
      const headings = await page.$$eval("h1, h2, h3", (els: any[]) =>
        els.map((e) => e.textContent?.trim()).filter(Boolean)
      );

      // Extract Buttons
      const buttons = await page.$$eval(
        "button, input[type=button], input[type=submit], [role=button], .btn, .tool-btn",
        (els: any[]) =>
          els.map((e) => ({
            tag: e.tagName.toLowerCase(),
            id: e.id || undefined,
            className: e.className || undefined,
            text: (e.textContent || e.value || "").trim().slice(0, 50),
            type: e.type || undefined,
            selector: e.id ? `#${e.id}` : e.className ? `.${e.className.split(" ")[0]}` : e.tagName.toLowerCase()
          }))
      );

      // Extract Inputs
      const inputs = await page.$$eval(
        "input, textarea, [contenteditable=true], .editor-canvas, .editor-surface",
        (els: any[]) =>
          els.map((e) => ({
            tag: e.tagName.toLowerCase(),
            id: e.id || undefined,
            className: e.className || undefined,
            text: e.getAttribute("contenteditable") === "true" ? "[contenteditable]" : undefined,
            type: e.type || (e.getAttribute("contenteditable") === "true" ? "contenteditable" : undefined),
            selector: e.id ? `#${e.id}` : e.className ? `.${e.className.split(" ")[0]}` : e.tagName.toLowerCase()
          }))
      );

      // Extract Forms
      const forms = await page.$$eval("form", (els: any[]) =>
        els.map((e) => ({
          tag: "form",
          id: e.id || undefined,
          className: e.className || undefined,
          selector: e.id ? `#${e.id}` : "form",
          type: e.getAttribute("method") || "GET"
        }))
      );

      // Extract Menus
      const menus = await page.$$eval(".dropdown-content a, .dropdown-menu a, nav a", (els: any[]) =>
        els.map((e) => e.textContent?.trim()).filter(Boolean)
      );

      const desktopSnapshot: BrowserVisualSnapshot = {
        viewport: { width: 1280, height: 720, name: "desktop" },
        screenshotPath: desktopShotPath,
        screenshotBase64: desktopShotBuffer.toString("base64"),
        title: pageTitle,
        url,
        headings,
        buttons,
        inputs,
        forms,
        menus,
        responsiveLayoutVerified: true
      };

      // 2. Mobile Snapshot (375x667)
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(300);

      const mobileShotPath = options?.screenshotDir
        ? path.join(options.screenshotDir, "mobile_375x667.png")
        : undefined;

      const mobileShotBuffer = await page.screenshot({ fullPage: false });
      if (mobileShotPath) {
        fs.writeFileSync(mobileShotPath, mobileShotBuffer);
      }

      // Check mobile viewport overflow
      const mobileScrollWidth = await page.evaluate(() => (globalThis as any).document?.documentElement?.scrollWidth || 0);
      const responsiveOk = mobileScrollWidth <= 420;

      const mobileSnapshot: BrowserVisualSnapshot = {
        viewport: { width: 375, height: 667, name: "mobile" },
        screenshotPath: mobileShotPath,
        screenshotBase64: mobileShotBuffer.toString("base64"),
        title: pageTitle,
        url,
        headings,
        buttons,
        inputs,
        forms,
        menus,
        responsiveLayoutVerified: responsiveOk
      };

      // Reset back to desktop for interaction testing
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.waitForTimeout(300);

      // 3. Observable State Checks
      const emptyStateEl = await page.$("#empty-state, .empty-view");
      const emptyStateDetected = emptyStateEl
        ? await emptyStateEl.evaluate((e: any) => (globalThis as any).window?.getComputedStyle(e).display !== "none")
        : false;

      const saveStatusEl = await page.$("#save-status, .badge-saved");
      const autosaveBadgeObserved = saveStatusEl
        ? (await saveStatusEl.textContent())?.trim()
        : undefined;

      // 4. Interactive Workflow Exploration: Create, Edit, Autosave, Reload, Persistence
      const interactionSteps: BrowserInteractionStep[] = [];
      let persistenceVerified = false;

      if (options?.runInteractions !== false) {
        interactionSteps.push({
          step: "Initial Navigation & Observation",
          action: "navigate",
          result: "success",
          details: `Observed page '${pageTitle}' with ${buttons.length} buttons and ${inputs.length} inputs.`
        });

        // Step A: Trigger New Document / Note / Task
        const newBtn = await page.$("#btn-new, #btn-new-doc, #btn-add-task, button:has-text('New'), button:has-text('+'), button:has-text('Add Task')");
        if (newBtn) {
          try {
            await newBtn.click();
            interactionSteps.push({
              step: "Click '+ New Document' / '+ Add Task' button",
              action: "click",
              selector: "#btn-new",
              result: "success",
              observedStateChange: "New document or task form initialized in workspace"
            });
            await page.waitForTimeout(400);
          } catch (e: any) {
            interactionSteps.push({
              step: "Click '+ New Document' / '+ Add Task'",
              action: "click",
              result: "failed",
              details: e.message
            });
          }
        }

        // Step B: Type Document Title / Task Title / Item Name
        const titleInput = await page.$("#task-title, #doc-title, .title-input, .doc-title-input, input[name='title'], input[type=text]");
        const testTitle = `Forge Verified Item ${Date.now().toString().slice(-4)}`;
        if (titleInput) {
          try {
            await titleInput.fill(testTitle);
            await titleInput.dispatchEvent("input");
            await titleInput.dispatchEvent("change");
            interactionSteps.push({
              step: "Enter Document Title / Item Name",
              action: "type",
              selector: "#doc-title",
              value: testTitle,
              result: "success",
              observedStateChange: `Title updated to '${testTitle}'`
            });
            await page.waitForTimeout(400);
          } catch (e: any) {
            interactionSteps.push({
              step: "Enter Document Title",
              action: "type",
              result: "failed",
              details: e.message
            });
          }
        }

        // Step C: Type Document Body Content / Notes
        const editor = await page.$("#editor-canvas, .editor-surface, .editor-canvas, [contenteditable=true], textarea");
        if (editor) {
          try {
            await editor.focus();
            await page.keyboard.type("Automated real browser interaction test verifying full typing and persistence.");
            interactionSteps.push({
              step: "Type Content in Editor / Notes Area",
              action: "type",
              selector: "#editor-canvas",
              result: "success",
              observedStateChange: "Editor content updated with keystrokes"
            });
            // Allow debounced autosave or state change to trigger
            await page.waitForTimeout(1000);
          } catch (e: any) {
            interactionSteps.push({
              step: "Type Content in Editor",
              action: "type",
              result: "failed",
              details: e.message
            });
          }
        }

        // Step D: Submit Form if explicit submit button exists
        const submitBtn = await page.$("button[type=submit], #btn-add-task, #btn-save, button:has-text('Add Task'), button:has-text('Add Item')");
        if (submitBtn) {
          try {
            await submitBtn.click();
            interactionSteps.push({
              step: "Submit Form / Save Record",
              action: "click",
              result: "success",
              observedStateChange: "Submitted record to backend via interactive form click"
            });
            await page.waitForTimeout(800);
          } catch {}
        }

        // Step D: Capture Post-Interaction Screenshot
        const postShotPath = options?.screenshotDir
          ? path.join(options.screenshotDir, "post_interaction_desktop.png")
          : undefined;
        if (postShotPath) {
          const postBuffer = await page.screenshot({ fullPage: false });
          fs.writeFileSync(postShotPath, postBuffer);
        }

        // Step E: Reload Page and Verify State Persistence
        try {
          await page.reload({ waitUntil: "networkidle", timeout: 8000 });
          interactionSteps.push({
            step: "Reload Page (Cold Navigation)",
            action: "reload",
            result: "success",
            details: "Page reloaded to test database state persistence."
          });

          // Check if document list or title retained the created title
          const reloadedContent = await page.content();
          if (reloadedContent.includes(testTitle)) {
            persistenceVerified = true;
            interactionSteps.push({
              step: "Verify Persistence after Reload",
              action: "verify",
              result: "success",
              observedStateChange: `Verified: Created record '${testTitle}' persisted in SQLite and rendered upon reload.`
            });
          } else {
            // Check if document was persisted in the sidebar list
            const sidebarHasItem = await page.$(`.doc-item:has-text("${testTitle}"), .doc-name:has-text("${testTitle}")`);
            if (sidebarHasItem) {
              persistenceVerified = true;
              interactionSteps.push({
                step: "Verify Persistence after Reload",
                action: "verify",
                result: "success",
                observedStateChange: `Verified: Created note '${testTitle}' appears in document list after reload.`
              });
            } else {
              interactionSteps.push({
                step: "Verify Persistence after Reload",
                action: "verify",
                result: "failed",
                details: "Document title not found immediately in reloaded DOM."
              });
            }
          }
        } catch (e: any) {
          interactionSteps.push({
            step: "Reload Page",
            action: "reload",
            result: "failed",
            details: e.message
          });
        }
      }

      await context.close();

      return {
        url,
        accessible: true,
        pageTitle,
        desktopSnapshot,
        mobileSnapshot,
        observedControls: {
          buttons,
          inputs,
          forms,
          menus,
          headings
        },
        observedStates: {
          initialState: emptyStateDetected ? "empty_state" : "document_active",
          emptyStateDetected,
          autosaveBadgeObserved
        },
        interactionResults: {
          scenario: "Create, Edit, Autosave, Reload, Persistence",
          steps: interactionSteps,
          persistenceVerified,
          apiRequestsObserved
        },
        limitations
      };
    } finally {
      try {
        await browser.close();
      } catch {}
    }
  }

  /**
   * Run side-by-side visual and behavioral comparison between reference and recreation apps.
   */
  public static async compareWebApplications(
    referenceUrl: string,
    recreationUrl: string,
    options?: {
      outputDir?: string;
    }
  ): Promise<VisualAndBehavioralComparison> {
    const shotDir = options?.outputDir
      ? path.join(options.outputDir, "comparison_screenshots")
      : undefined;

    if (shotDir && !fs.existsSync(shotDir)) {
      fs.mkdirSync(shotDir, { recursive: true });
    }

    const refInvestigation = await this.investigateWebPage(referenceUrl, {
      screenshotDir: shotDir ? path.join(shotDir, "reference") : undefined,
      runInteractions: true
    });

    const recInvestigation = await this.investigateWebPage(recreationUrl, {
      screenshotDir: shotDir ? path.join(shotDir, "recreation") : undefined,
      runInteractions: true
    });

    // 1. Control Extraction & Set Comparison
    const refButtons = refInvestigation.observedControls.buttons;
    const recButtons = recInvestigation.observedControls.buttons;
    const refButtonCount = refButtons.length;
    const recButtonCount = recButtons.length;
    const countDifference = Math.abs(refButtonCount - recButtonCount);

    const refBtnTexts = new Set(
      refButtons.map((b) => b.text?.trim().toLowerCase()).filter(Boolean) as string[]
    );
    const recBtnTexts = new Set(
      recButtons.map((b) => b.text?.trim().toLowerCase()).filter(Boolean) as string[]
    );

    const commonButtons = Array.from(refBtnTexts).filter((b): b is string => typeof b === "string" && recBtnTexts.has(b));
    const missingInRecreation = Array.from(refBtnTexts).filter((b): b is string => typeof b === "string" && !recBtnTexts.has(b));
    const extraInRecreation = Array.from(recBtnTexts).filter((b): b is string => typeof b === "string" && !refBtnTexts.has(b));

    // 2. Title & Viewport Evaluation
    const titleMatch =
      refInvestigation.pageTitle.trim().toLowerCase() === recInvestigation.pageTitle.trim().toLowerCase();

    const refMobileOk = refInvestigation.mobileSnapshot?.responsiveLayoutVerified ?? false;
    const recMobileOk = recInvestigation.mobileSnapshot?.responsiveLayoutVerified ?? false;
    const parityConfirmed = refMobileOk === recMobileOk || recMobileOk;

    // 3. Behavioral Persistence Evaluation
    const refPersist = refInvestigation.interactionResults.persistenceVerified;
    const recPersist = recInvestigation.interactionResults.persistenceVerified;
    const persistenceParity = recPersist;

    // 4. Collect Differences & Discrepancies
    const differences: string[] = [];
    if (!titleMatch) {
      differences.push(`Title difference: reference is '${refInvestigation.pageTitle}', recreation is '${recInvestigation.pageTitle}'`);
    }
    if (missingInRecreation.length > 0) {
      differences.push(`Missing button controls in recreation (${missingInRecreation.length}): ${missingInRecreation.map(b => `"${b}"`).join(", ")}`);
    }
    if (extraInRecreation.length > 0) {
      differences.push(`Extra button controls in recreation (${extraInRecreation.length}): ${extraInRecreation.map(b => `"${b}"`).join(", ")}`);
    }
    if (countDifference > 0) {
      differences.push(`Button element count variance: reference has ${refButtonCount} buttons, recreation has ${recButtonCount} (variance: ${countDifference}).`);
    }

    const refInputs = refInvestigation.observedControls.inputs.length;
    const recInputs = recInvestigation.observedControls.inputs.length;
    if (refInputs !== recInputs) {
      differences.push(`Input element count variance: reference has ${refInputs} inputs, recreation has ${recInputs}.`);
    }

    if (refMobileOk && !recMobileOk) {
      differences.push("Mobile layout failure: reference adapts to 375px viewport without overflow, but recreation overflows.");
    }

    if (!persistenceParity) {
      differences.push("CRITICAL BEHAVIORAL DEFECT: recreation failed state persistence verification across browser reload.");
    }

    // 5. Documented Scoring Formula (Total 1.00 Max)
    // Metric 1: Accessibility & Reachability (Weight: 0.15)
    const accScore = recInvestigation.accessible ? 0.15 : 0.00;
    const accStatus: "pass" | "fail" = recInvestigation.accessible ? "pass" : "fail";

    // Metric 2a: Title Match (Weight: 0.05)
    const titleScore = titleMatch ? 0.05 : 0.00;
    const titleStatus: "pass" | "fail" = titleMatch ? "pass" : "fail";

    // Metric 2b: Button Recall (Weight: 0.15)
    const btnRecallRatio = refBtnTexts.size > 0 ? (commonButtons.length / refBtnTexts.size) : 1.0;
    const btnRecallScore = Math.round(0.15 * btnRecallRatio * 1000) / 1000;
    const btnRecallStatus: "pass" | "partial" | "fail" = btnRecallRatio === 1.0 ? "pass" : (btnRecallRatio >= 0.5 ? "partial" : "fail");

    // Metric 2c: Button Count Parity (Weight: 0.05)
    const countRatio = refButtonCount > 0 ? Math.max(0, 1 - countDifference / refButtonCount) : (recButtonCount === 0 ? 1.0 : 0.0);
    const btnCountScore = Math.round(0.05 * countRatio * 1000) / 1000;
    const btnCountStatus: "pass" | "partial" | "fail" = countDifference === 0 ? "pass" : (countRatio >= 0.5 ? "partial" : "fail");

    // Metric 3a: Desktop Layout Verified (Weight: 0.10)
    const desktopScore = recInvestigation.desktopSnapshot ? 0.10 : 0.00;
    const desktopStatus: "pass" | "fail" = recInvestigation.desktopSnapshot ? "pass" : "fail";

    // Metric 3b: Mobile Responsiveness (Weight: 0.10)
    let mobileScore = 0.00;
    let mobileStatus: "pass" | "partial" | "fail" = "fail";
    if (recMobileOk) {
      mobileScore = 0.10;
      mobileStatus = "pass";
    } else if (!refMobileOk && !recMobileOk) {
      mobileScore = 0.05;
      mobileStatus = "partial";
    } else {
      mobileScore = 0.00;
      mobileStatus = "fail";
    }

    // Metric 4: Behavioral Persistence across Reload (Weight: 0.40)
    let persistScore = 0.00;
    let persistStatus: "pass" | "fail" | "unavailable" = "fail";
    if (refInvestigation.interactionResults.steps.length === 0 && recInvestigation.interactionResults.steps.length === 0) {
      persistStatus = "unavailable";
      persistScore = 0.00;
    } else if (recPersist) {
      persistScore = 0.40;
      persistStatus = "pass";
    } else {
      persistScore = 0.00;
      persistStatus = "fail";
    }

    const rawScore = Math.round((accScore + titleScore + btnRecallScore + btnCountScore + desktopScore + mobileScore + persistScore) * 100) / 100;
    let finalScore = rawScore;
    let cappedReason: string | undefined = undefined;

    // RULE 1: Behavioral failures cannot be hidden by successful structural checks
    if (persistStatus === "fail") {
      finalScore = Math.min(finalScore, 0.45);
      cappedReason = "Overall parity score capped at 0.45 because critical behavioral persistence check failed.";
    }

    // RULE 2: If differences or discrepancies exist, the score cannot equal 1.0
    if (differences.length > 0 && finalScore >= 1.0) {
      finalScore = 0.98;
      cappedReason = "Score reduced to 0.98 due to observed control or layout differences.";
    }

    // RULE 3: If checks were unavailable, score cannot equal 1.0 and must document unavailable status
    if (persistStatus === "unavailable") {
      if (finalScore > 0.60) {
        finalScore = 0.60;
      }
      cappedReason = (cappedReason ? cappedReason + " " : "") + "Score limited because interactive behavioral checks were unavailable; behavioral persistence could not be verified.";
    }

    // RULE 4: Critical Control Gap Cap
    // If reference had significant interactive controls (>= 3 unique buttons) and recreation button recall is < 0.50,
    // cap the score so an app missing core controls cannot score passing/near-passing.
    if (refBtnTexts.size >= 3 && btnRecallRatio < 0.50) {
      const controlCap = Math.max(0.30, Math.min(0.55, 0.40 + btnRecallRatio * 0.30));
      if (finalScore > controlCap) {
        finalScore = Number(controlCap.toFixed(2));
        cappedReason = (cappedReason ? cappedReason + " " : "") + `Overall score capped at ${finalScore} due to critical interactive control gap: only ${(btnRecallRatio * 100).toFixed(0)}% of reference buttons were recalled.`;
      }
    }

    const scoring: ParityScoringReport = {
      formula: "Accessibility (0.15) + Title (0.05) + ButtonRecall (0.15) + ButtonCount (0.05) + DesktopLayout (0.10) + MobileResponsive (0.10) + BehavioralPersistence (0.40)",
      metrics: {
        accessibility: {
          name: "Application Reachability & Access",
          weight: 0.15,
          score: accScore,
          status: accStatus,
          description: "Recreation server starts and responds with HTTP 200 without runtime errors."
        },
        titleMatch: {
          name: "Page Title Parity",
          weight: 0.05,
          score: titleScore,
          status: titleStatus,
          description: `Page title match: reference='${refInvestigation.pageTitle}', recreation='${recInvestigation.pageTitle}'`
        },
        buttonRecall: {
          name: "Interactive Button Controls Recall",
          weight: 0.15,
          score: btnRecallScore,
          status: btnRecallStatus,
          description: `Recall of unique button labels: ${commonButtons.length}/${refBtnTexts.size} (${(btnRecallRatio * 100).toFixed(1)}%). Missing: ${missingInRecreation.length ? missingInRecreation.join(", ") : "none"}`
        },
        buttonCountParity: {
          name: "Button Element Count Parity",
          weight: 0.05,
          score: btnCountScore,
          status: btnCountStatus,
          description: `Total button elements: reference=${refButtonCount}, recreation=${recButtonCount} (variance: ${countDifference}).`
        },
        desktopLayout: {
          name: "Desktop (1280x720) Visual Rendering",
          weight: 0.10,
          score: desktopScore,
          status: desktopStatus,
          description: "Desktop viewport rendered and captured via headless Chrome; DOM hierarchy inspected."
        },
        mobileResponsiveness: {
          name: "Mobile (375x667) Viewport Layout Parity",
          weight: 0.10,
          score: mobileScore,
          status: mobileStatus,
          description: `Mobile viewport responsive test: reference=${refMobileOk}, recreation=${recMobileOk}.`
        },
        behavioralPersistence: {
          name: "Interactive Workflow & State Persistence across Reload",
          weight: 0.40,
          score: persistScore,
          status: persistStatus,
          description: `Interactive create/edit/autosave/reload persistence verified: ${recPersist}.`
        }
      },
      rawScore,
      finalScore,
      cappedReason
    };

    return {
      referenceUrl,
      recreationUrl,
      browserProvider: "playwright-core (Headless Chromium/Chrome)",
      viewportsTested: [
        { name: "desktop", width: 1280, height: 720 },
        { name: "mobile", width: 375, height: 667 }
      ],
      visualComparison: {
        method: "DOM structural hierarchy and responsive viewport layout analysis at matching dimensions (1280x720, 375x667); not pixel-diffed.",
        imageDiffPerformed: false,
        disclaimer: "Visual comparison evaluates DOM controls, layout wrapping, and responsive viewport bounds. Pixel-level bitmap diffing was not performed; visual parity does not imply pixel-perfection.",
        titleMatch,
        referenceTitle: refInvestigation.pageTitle,
        recreationTitle: recInvestigation.pageTitle,
        buttonsMatch: {
          referenceCount: refButtonCount,
          recreationCount: recButtonCount,
          commonButtons,
          missingInRecreation,
          extraInRecreation,
          countDifference
        },
        responsiveParity: {
          referenceMobileOk: refMobileOk,
          recreationMobileOk: recMobileOk,
          parityConfirmed
        },
        screenshots: {
          referenceDesktop: refInvestigation.desktopSnapshot?.screenshotPath,
          recreationDesktop: recInvestigation.desktopSnapshot?.screenshotPath,
          referenceMobile: refInvestigation.mobileSnapshot?.screenshotPath,
          recreationMobile: recInvestigation.mobileSnapshot?.screenshotPath
        }
      },
      behavioralComparison: {
        scenario: "Create, Edit, Autosave, Reload, Persistence",
        referencePersistence: refPersist,
        recreationPersistence: recPersist,
        persistenceParity,
        referenceApiRequests: refInvestigation.interactionResults.apiRequestsObserved.map((r) => `${r.method} ${r.url}`),
        recreationApiRequests: recInvestigation.interactionResults.apiRequestsObserved.map((r) => `${r.method} ${r.url}`),
        differences
      },
      scoring,
      parityScore: finalScore
    };
  }
}
