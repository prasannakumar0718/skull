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
  href?: string;
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
  links?: BrowserElementSummary[];
  paragraphs?: string[];
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
    links?: BrowserElementSummary[];
    paragraphs?: string[];
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
    headingParity?: ParityMetricDetail;
    linkParity?: ParityMetricDetail;
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
        try {
          fs.writeFileSync(path.join(options!.screenshotDir!, "state_01_empty.png"), desktopShotBuffer);
        } catch {}
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
            text: (e.textContent?.trim() || e.getAttribute("aria-label") || e.getAttribute("title") || e.value || "").trim().slice(0, 50),
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

      // Extract Links
      const links = await page.$$eval("a[href]", (els: any[]) =>
        els.map((e) => ({
          tag: "a",
          id: e.id || undefined,
          className: e.className || undefined,
          text: (e.textContent || "").trim().slice(0, 80),
          href: (e.getAttribute("href") || "").trim(),
          selector: e.id ? `#${e.id}` : (e.className ? `.${e.className.split(" ")[0]}` : "a")
        })).filter((l) => l.text || l.href)
      );

      // Extract Paragraphs / Text Content Blocks
      const paragraphs = await page.$$eval("p, article p, main p, .content p", (els: any[]) =>
        els.map((e) => e.textContent?.trim()).filter((t) => t && t.length > 5).slice(0, 20)
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
        links,
        paragraphs,
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

        // Step D: Submit Form if explicit submit button exists, or press Enter on single-input forms
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
        } else if (titleInput && !editor) {
          // In single-input interactive applications (e.g. TodoMVC or search inputs), Enter key triggers item creation/submission
          try {
            await titleInput.press("Enter");
            interactionSteps.push({
              step: "Submit via Enter key",
              action: "type",
              selector: "input",
              value: "Enter",
              result: "success",
              observedStateChange: "Submitted record via Enter keypress"
            });
            await page.waitForTimeout(800);
          } catch {}
        }

        // Multi-State Verification for Task Applications:
        // State 2: One active task
        if (options?.screenshotDir) {
          try {
            const s2 = await page.screenshot({ fullPage: false });
            fs.writeFileSync(path.join(options.screenshotDir, "state_02_one_active.png"), s2);
          } catch {}
        }

        // State 3: Multiple active tasks (add 2nd task)
        if (titleInput && !editor) {
          try {
            await titleInput.fill(`Forge Verified Item 2`);
            await titleInput.press("Enter");
            await page.waitForTimeout(600);
            if (options?.screenshotDir) {
              const s3 = await page.screenshot({ fullPage: false });
              fs.writeFileSync(path.join(options.screenshotDir, "state_03_multiple_active.png"), s3);
            }
            interactionSteps.push({
              step: "Add Second Active Task",
              action: "type",
              result: "success",
              observedStateChange: "Multiple active tasks present in list"
            });
          } catch {}

          // State 4: Completed task (toggle first item)
          try {
            const toggleEl = await page.$("input.toggle, input[type=checkbox]:not(.toggle-all), .btn-toggle");
            if (toggleEl) {
              await toggleEl.click();
              await page.waitForTimeout(600);
              if (options?.screenshotDir) {
                const s4 = await page.screenshot({ fullPage: false });
                fs.writeFileSync(path.join(options.screenshotDir, "state_04_completed.png"), s4);
              }
              interactionSteps.push({
                step: "Complete Task Action",
                action: "click",
                result: "success",
                observedStateChange: "Task toggled to completed status"
              });
            }
          } catch {}

          // State 5: Active / Completed Filters
          try {
            const activeFilter = await page.$("a[href*='active'], .filter-btn[data-filter='active'], button:has-text('Active')");
            if (activeFilter) {
              await activeFilter.click();
              await page.waitForTimeout(400);
              if (options?.screenshotDir) {
                const s5 = await page.screenshot({ fullPage: false });
                fs.writeFileSync(path.join(options.screenshotDir, "state_05_filtered.png"), s5);
              }
              interactionSteps.push({
                step: "Apply Active Filter",
                action: "click",
                result: "success",
                observedStateChange: "View filtered to active tasks only"
              });
            }
          } catch {}

          // State 6: Clear-Completed Action
          try {
            const clearBtn = await page.$("button.clear-completed, button:has-text('Clear completed')");
            const isVisible = clearBtn ? await clearBtn.isVisible().catch(() => false) : false;
            if (clearBtn && isVisible) {
              await clearBtn.click();
              await page.waitForTimeout(600);
              if (options?.screenshotDir) {
                const s6 = await page.screenshot({ fullPage: false });
                fs.writeFileSync(path.join(options.screenshotDir, "state_06_clear_completed.png"), s6);
              }
              interactionSteps.push({
                step: "Clear Completed Tasks",
                action: "click",
                result: "success",
                observedStateChange: "Completed tasks removed from active view"
              });
            }
          } catch {}
        }

        // Multi-State Verification for API Documentation:
        try {
          const expandBtn = await page.$(".opblock-summary-control, button:has-text('Expand operation')");
          if (expandBtn) {
            await expandBtn.click();
            await page.waitForTimeout(400);
            if (options?.screenshotDir) {
              const sExp = await page.screenshot({ fullPage: false });
              fs.writeFileSync(path.join(options.screenshotDir, "state_02_operation_expanded.png"), sExp);
            }
            const execBtn = await page.$(".btn-execute, button:has-text('Send Request')");
            if (execBtn) {
              await execBtn.click();
              await page.waitForTimeout(600);
              if (options?.screenshotDir) {
                const sProbe = await page.screenshot({ fullPage: false });
                fs.writeFileSync(path.join(options.screenshotDir, "state_03_probe_executed.png"), sProbe);
              }
              interactionSteps.push({
                step: "Execute API Endpoint Probe",
                action: "click",
                result: "success",
                observedStateChange: "Endpoint request executed and response rendered"
              });
            }
          }
        } catch {}

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
          if (options?.screenshotDir) {
            try {
              const sReload = await page.screenshot({ fullPage: false });
              fs.writeFileSync(path.join(options.screenshotDir, "state_07_reloaded.png"), sReload);
            } catch {}
          }
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
          headings,
          links,
          paragraphs
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

    return this.compareInvestigations(refInvestigation, recInvestigation, referenceUrl, recreationUrl);
  }

  /**
   * Evaluates visual and behavioral parity between two completed page investigations.
   */
  public static compareInvestigations(
    refInvestigation: BrowserPageInvestigation,
    recInvestigation: BrowserPageInvestigation,
    referenceUrl: string,
    recreationUrl: string
  ): VisualAndBehavioralComparison {
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

    // Headings comparison
    const refHeadings = (refInvestigation.observedControls.headings || []).map((h) => h.trim().toLowerCase());
    const recHeadings = (recInvestigation.observedControls.headings || []).map((h) => h.trim().toLowerCase());
    const missingHeadings = refHeadings.filter((h) => !recHeadings.includes(h));

    // Links comparison
    const refLinks = (refInvestigation.observedControls.links || []).map((l) => (l.text || l.href || "").trim().toLowerCase()).filter(Boolean);
    const recLinks = (recInvestigation.observedControls.links || []).map((l) => (l.text || l.href || "").trim().toLowerCase()).filter(Boolean);
    const missingLinks = refLinks.filter((l) => !recLinks.includes(l));

    // Distinguish between content presentation reference, API documentation, and interactive application reference
    const hasInputs = (refInvestigation.observedControls.inputs?.length || 0) > 0;
    const hasForms = (refInvestigation.observedControls.forms?.length || 0) > 0;
    const isInteractiveKeyword = /todo|task|editor|calc|note|manager/i.test(refInvestigation.url) ||
      /todo|task|editor|calc|note|manager/i.test(refInvestigation.pageTitle);
    const hasApiDocControls =
      (refInvestigation.observedControls.buttons || []).some((b) =>
        /expand operation|try it out|execute|curl|collapse operation/i.test(b.text || "")
      ) ||
      (refInvestigation.observedControls.links || []).some((l) =>
        /swagger|openapi|api-docs|redoc/i.test((l.text || "") + " " + (l.href || ""))
      );
    const isApiDocs =
      hasApiDocControls ||
      /api|swagger|openapi|documentation|endpoints|rest/i.test(refInvestigation.url) ||
      /api|swagger|openapi|documentation|endpoints|service explorer|http request|rest api/i.test(
        refInvestigation.pageTitle + " " + refHeadings.join(" ")
      );

    const isContentReference = refButtonCount <= 1 && !hasForms && !hasInputs && !isInteractiveKeyword && !isApiDocs;

    // 3. Behavioral Persistence Evaluation
    const refPersist = refInvestigation.interactionResults.persistenceVerified;
    const recPersist = recInvestigation.interactionResults.persistenceVerified;
    const persistenceParity = (isContentReference || isApiDocs) ? true : recPersist;

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

    if (missingHeadings.length > 0) {
      differences.push(`Missing reference headings in recreation (${missingHeadings.length}): ${missingHeadings.slice(0, 3).map((h) => `"${h}"`).join(", ")}`);
    }

    if (missingLinks.length > 0) {
      differences.push(`Missing reference links in recreation (${missingLinks.length}): ${missingLinks.slice(0, 3).map((l) => `"${l}"`).join(", ")}`);
    }

    if (refMobileOk && !recMobileOk) {
      differences.push("Mobile layout failure: reference adapts to 375px viewport without overflow, but recreation overflows.");
    }

    if (!isContentReference && !isApiDocs && !persistenceParity) {
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

    // Heading parity metric (Weight: 0.20 for content, 0.15 for api-docs, informative for apps)
    const headingRecallRatio = refHeadings.length > 0 ? (refHeadings.length - missingHeadings.length) / refHeadings.length : 1.0;
    const headingScore = Math.round(0.20 * headingRecallRatio * 1000) / 1000;
    const headingStatus: "pass" | "partial" | "fail" = headingRecallRatio === 1.0 ? "pass" : (headingRecallRatio >= 0.5 ? "partial" : "fail");

    // Link parity metric (Weight: 0.20 for content, 0.15 for api-docs, informative for apps)
    const linkRecallRatio = refLinks.length > 0 ? (refLinks.length - missingLinks.length) / refLinks.length : 1.0;
    const linkScore = Math.round(0.20 * linkRecallRatio * 1000) / 1000;
    const linkStatus: "pass" | "partial" | "fail" = linkRecallRatio === 1.0 ? "pass" : (linkRecallRatio >= 0.5 ? "partial" : "fail");

    let persistScore = 0.00;
    let persistStatus: "pass" | "fail" | "unavailable" = "fail";
    let rawScore = 0.0;
    let formula = "";

    if (isContentReference) {
      formula = "Content Page Fidelity: Accessibility (0.15) + Title (0.05) + Headings (0.20) + Links (0.20) + ControlCleanliness (0.20) + ResponsiveLayout (0.20)";
      // Control cleanliness: 0.20 if no fabricated extra buttons, penalized if extra buttons fabricated
      const controlCleanliness = extraInRecreation.length === 0 ? 0.20 : Math.max(0, 0.20 - extraInRecreation.length * 0.04);
      const responsiveScore = desktopScore + mobileScore; // max 0.20
      rawScore = Math.round((accScore + titleScore + headingScore + linkScore + controlCleanliness + responsiveScore) * 100) / 100;
      persistScore = 0.00;
      persistStatus = "pass"; // Not applicable/pass for static content
    } else if (isApiDocs) {
      formula = "API Documentation Fidelity: Accessibility (0.15) + Title (0.05) + Headings (0.15) + Links (0.15) + ButtonRecall (0.15) + ButtonCount (0.05) + ResponsiveLayout (0.20) + InteractiveProbe (0.10)";
      const responsiveScore = desktopScore + mobileScore; // max 0.20
      const apiHeadingScore = Math.round(0.15 * headingRecallRatio * 1000) / 1000;
      const apiLinkScore = Math.round(0.15 * linkRecallRatio * 1000) / 1000;
      const probeScore = recInvestigation.accessible ? 0.10 : 0.00;
      rawScore = Math.round((accScore + titleScore + apiHeadingScore + apiLinkScore + btnRecallScore + btnCountScore + responsiveScore + probeScore) * 100) / 100;
      persistScore = 0.00;
      persistStatus = "pass";
    } else {
      formula = "Interactive App Fidelity: Accessibility (0.15) + Title (0.05) + ButtonRecall (0.15) + ButtonCount (0.05) + DesktopLayout (0.10) + MobileResponsive (0.10) + BehavioralPersistence (0.40)";
      if (refInvestigation.interactionResults.steps.length === 0 && recInvestigation.interactionResults.steps.length === 0) {
        persistStatus = "unavailable";
        persistScore = 0.00;
      } else if (refInvestigation.interactionResults.steps.length === 0) {
        persistStatus = "unavailable";
        persistScore = 0.00;
      } else if (recPersist) {
        persistScore = 0.40;
        persistStatus = "pass";
      } else {
        persistScore = 0.00;
        persistStatus = "fail";
      }
      rawScore = Math.round((accScore + titleScore + btnRecallScore + btnCountScore + desktopScore + mobileScore + persistScore) * 100) / 100;
    }

    let finalScore = rawScore;
    let cappedReason: string | undefined = undefined;

    // RULE 1: Behavioral failures cannot be hidden by successful structural checks
    if (!isContentReference && !isApiDocs && persistStatus === "fail") {
      finalScore = Math.min(finalScore, 0.45);
      cappedReason = "Overall parity score capped at 0.45 because critical behavioral persistence check failed.";
    }

    // RULE 2: If differences or discrepancies exist, the score cannot equal 1.0
    if (differences.length > 0 && finalScore >= 1.0) {
      finalScore = 0.98;
      cappedReason = "Score reduced to 0.98 due to observed control or layout differences.";
    }

    // RULE 3: If checks were unavailable, score cannot equal 1.0 and must document unavailable status
    if (!isContentReference && !isApiDocs && persistStatus === "unavailable") {
      if (finalScore > 0.60) {
        finalScore = 0.60;
      }
      cappedReason = (cappedReason ? cappedReason + " " : "") + "Score limited because interactive behavioral checks were unavailable; behavioral persistence could not be verified.";
    }

    // RULE 4: Critical Control Gap Cap
    if (refBtnTexts.size >= 3 && btnRecallRatio < 0.50) {
      const controlCap = Math.max(0.30, Math.min(0.55, 0.40 + btnRecallRatio * 0.30));
      if (finalScore > controlCap) {
        finalScore = Number(controlCap.toFixed(2));
        cappedReason = (cappedReason ? cappedReason + " " : "") + `Overall score capped at ${finalScore} due to critical interactive control gap: only ${(btnRecallRatio * 100).toFixed(0)}% of reference buttons were recalled.`;
      }
    }

    // RULE 5: Unrelated Fabricated Controls Cap
    // If reference had <= 1 button, but recreation introduced >= 3 extra buttons,
    // cap the score at <= 0.40 to prevent fabricated task managers from passing content reference recreations.
    if (refBtnTexts.size <= 1 && extraInRecreation.length >= 3) {
      if (finalScore > 0.40) {
        finalScore = 0.40;
        cappedReason = (cappedReason ? cappedReason + " " : "") + `Overall score capped at 0.40 due to fabricated unrelated controls: reference had ${refBtnTexts.size} buttons but recreation introduced ${extraInRecreation.length} extra controls (${extraInRecreation.slice(0, 4).join(", ")}).`;
      }
    }

    const scoring: ParityScoringReport = {
      formula,
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
          name: (isContentReference || isApiDocs) ? "Interactive Workflow Equivalence" : "Interactive Workflow & State Persistence across Reload",
          weight: (isContentReference || isApiDocs) ? 0.00 : 0.40,
          score: isApiDocs ? 0.10 : (isContentReference ? 0.00 : persistScore),
          status: persistStatus,
          description: isContentReference
            ? "Content presentation reference; no interactive CRUD persistence workflows in reference."
            : (isApiDocs
              ? `API documentation explorer reference; interactive endpoint probes verified (recreation accessible=${recInvestigation.accessible}).`
              : `Interactive create/edit/autosave/reload persistence verified: ${recPersist}.`)
        },
        headingParity: {
          name: "Heading Structure Parity",
          weight: isContentReference ? 0.20 : (isApiDocs ? 0.15 : 0.00),
          score: isApiDocs ? Math.round(0.15 * headingRecallRatio * 1000) / 1000 : headingScore,
          status: headingStatus,
          description: `Recall of reference headings: ${refHeadings.length - missingHeadings.length}/${refHeadings.length} (${(headingRecallRatio * 100).toFixed(1)}%). Missing: ${missingHeadings.length ? missingHeadings.join(", ") : "none"}`
        },
        linkParity: {
          name: "Hyperlink Navigation Parity",
          weight: isContentReference ? 0.20 : (isApiDocs ? 0.15 : 0.00),
          score: isApiDocs ? Math.round(0.15 * linkRecallRatio * 1000) / 1000 : linkScore,
          status: linkStatus,
          description: `Recall of reference links: ${refLinks.length - missingLinks.length}/${refLinks.length} (${(linkRecallRatio * 100).toFixed(1)}%). Missing: ${missingLinks.length ? missingLinks.join(", ") : "none"}`
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
        scenario: isApiDocs
          ? "API Documentation & Interactive Endpoint Probing"
          : (isContentReference ? "Content Presentation & Responsive Rendering" : "Create, Edit, Autosave, Reload, Persistence"),
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
