import { describe, it, expect } from "vitest";
import { BrowserInvestigator, BrowserPageInvestigation, VisualAndBehavioralComparison } from "../src/recreation/browserInvestigator.js";
import { RecreationComparator } from "../src/recreation/comparator.js";

describe("Parity Scoring & Discrepancy Reporting Unit & Regression Suite", () => {
  // Helper to construct mock BrowserPageInvestigation
  function createMockInvestigation(overrides: Partial<BrowserPageInvestigation> = {}): BrowserPageInvestigation {
    return {
      url: "http://127.0.0.1:4000",
      accessible: true,
      pageTitle: "Test App",
      desktopSnapshot: {
        viewport: { width: 1280, height: 720, name: "desktop" },
        screenshotPath: "/path/to/desktop.png",
        title: "Test App",
        url: "http://127.0.0.1:4000",
        headings: ["Test App Header"],
        buttons: [
          { tag: "button", text: "New Note", selector: "button:has-text('New Note')" },
          { tag: "button", text: "Save", selector: "button:has-text('Save')" },
          { tag: "button", text: "Delete", selector: "button:has-text('Delete')" }
        ],
        inputs: [{ tag: "input", type: "text", selector: "#title" }],
        forms: [{ tag: "form", selector: "#note-form" }],
        menus: [],
        responsiveLayoutVerified: true
      },
      mobileSnapshot: {
        viewport: { width: 375, height: 667, name: "mobile" },
        screenshotPath: "/path/to/mobile.png",
        title: "Test App",
        url: "http://127.0.0.1:4000",
        headings: ["Test App Header"],
        buttons: [],
        inputs: [],
        forms: [],
        menus: [],
        responsiveLayoutVerified: true
      },
      observedControls: {
        buttons: [
          { tag: "button", text: "New Note", selector: "button:has-text('New Note')" },
          { tag: "button", text: "Save", selector: "button:has-text('Save')" },
          { tag: "button", text: "Delete", selector: "button:has-text('Delete')" }
        ],
        inputs: [{ tag: "input", type: "text", selector: "#title" }],
        forms: [{ tag: "form", selector: "#note-form" }],
        menus: [],
        headings: ["Test App Header"]
      },
      observedStates: {
        initialState: "ready",
        emptyStateDetected: false
      },
      interactionResults: {
        scenario: "Create, Edit, Autosave, Reload, Persistence",
        steps: [
          { step: "Navigate", action: "navigate", result: "success" },
          { step: "Reload", action: "reload", result: "success" },
          { step: "Verify", action: "verify", result: "success" }
        ],
        persistenceVerified: true,
        apiRequestsObserved: [{ method: "GET", url: "/api/notes", status: 200 }]
      },
      limitations: [],
      ...overrides
    };
  }

  it("1. Accurately reports missing and extra button controls and prevents 1.0 parity score", async () => {
    // Reference has: New, Bold, Italic, Delete (4 buttons)
    const ref = createMockInvestigation({
      observedControls: {
        buttons: [
          { tag: "button", text: "New", selector: "b1" },
          { tag: "button", text: "Bold", selector: "b2" },
          { tag: "button", text: "Italic", selector: "b3" },
          { tag: "button", text: "Delete", selector: "b4" }
        ],
        inputs: [],
        forms: [],
        menus: [],
        headings: []
      }
    });

    // Recreation has: New, Bold, Underline (3 buttons; missing Italic, Delete; extra Underline)
    const rec = createMockInvestigation({
      observedControls: {
        buttons: [
          { tag: "button", text: "New", selector: "b1" },
          { tag: "button", text: "Bold", selector: "b2" },
          { tag: "button", text: "Underline", selector: "b5" }
        ],
        inputs: [],
        forms: [],
        menus: [],
        headings: []
      }
    });

    // Spy on investigateWebPage
    const originalInvestigate = BrowserInvestigator.investigateWebPage;
    BrowserInvestigator.investigateWebPage = (async (url: string) => {
      if (url.includes("ref")) return ref;
      return rec;
    }) as any;

    try {
      const comp = await BrowserInvestigator.compareWebApplications("http://ref.local", "http://rec.local");

      // Verify buttons match breakdown
      expect(comp.visualComparison.buttonsMatch.referenceCount).toBe(4);
      expect(comp.visualComparison.buttonsMatch.recreationCount).toBe(3);
      expect(comp.visualComparison.buttonsMatch.countDifference).toBe(1);
      expect(comp.visualComparison.buttonsMatch.commonButtons).toEqual(["new", "bold"]);
      expect(comp.visualComparison.buttonsMatch.missingInRecreation).toEqual(["italic", "delete"]);
      expect(comp.visualComparison.buttonsMatch.extraInRecreation).toEqual(["underline"]);

      // Verify differences list contains the discrepancies
      expect(comp.behavioralComparison.differences.some(d => d.includes("Missing button controls"))).toBe(true);
      expect(comp.behavioralComparison.differences.some(d => d.includes("Extra button controls"))).toBe(true);
      expect(comp.behavioralComparison.differences.some(d => d.includes("Button element count variance"))).toBe(true);

      // Score must not be 1.0
      expect(comp.parityScore).toBeLessThan(1.0);
      expect(comp.scoring.metrics.buttonRecall.status).toBe("partial");
      expect(comp.scoring.metrics.buttonCountParity.status).toBe("partial");
    } finally {
      BrowserInvestigator.investigateWebPage = originalInvestigate;
    }
  });

  it("2. Strictly caps parity score at <= 0.45 when behavioral persistence fails", async () => {
    // Reference has verified persistence
    const ref = createMockInvestigation();

    // Recreation has perfect DOM and visual matching, but FAILS persistence
    const rec = createMockInvestigation({
      interactionResults: {
        scenario: "Create, Edit, Autosave, Reload, Persistence",
        steps: [
          { step: "Navigate", action: "navigate", result: "success" },
          { step: "Reload", action: "reload", result: "success" },
          { step: "Verify Persistence", action: "verify", result: "failed", details: "State was lost after reload" }
        ],
        persistenceVerified: false,
        apiRequestsObserved: []
      }
    });

    const originalInvestigate = BrowserInvestigator.investigateWebPage;
    BrowserInvestigator.investigateWebPage = (async (url: string) => {
      if (url.includes("ref")) return ref;
      return rec;
    }) as any;

    try {
      const comp = await BrowserInvestigator.compareWebApplications("http://ref.local", "http://rec.local");

      expect(comp.behavioralComparison.recreationPersistence).toBe(false);
      expect(comp.behavioralComparison.differences.some(d => d.includes("CRITICAL BEHAVIORAL DEFECT"))).toBe(true);

      // Structural score would be 0.60 without cap, but must be capped at <= 0.45
      expect(comp.parityScore).toBeLessThanOrEqual(0.45);
      expect(comp.scoring.cappedReason).toContain("capped at 0.45");
      expect(comp.scoring.metrics.behavioralPersistence.status).toBe("fail");
      expect(comp.scoring.metrics.behavioralPersistence.score).toBe(0.00);
    } finally {
      BrowserInvestigator.investigateWebPage = originalInvestigate;
    }
  });

  it("3. Reports unavailable checks as 'unavailable' and caps score at <= 0.60", async () => {
    const ref = createMockInvestigation({
      interactionResults: {
        scenario: "None",
        steps: [],
        persistenceVerified: false,
        apiRequestsObserved: []
      }
    });

    const rec = createMockInvestigation({
      interactionResults: {
        scenario: "None",
        steps: [],
        persistenceVerified: false,
        apiRequestsObserved: []
      }
    });

    const originalInvestigate = BrowserInvestigator.investigateWebPage;
    BrowserInvestigator.investigateWebPage = (async (url: string) => {
      if (url.includes("ref")) return ref;
      return rec;
    }) as any;

    try {
      const comp = await BrowserInvestigator.compareWebApplications("http://ref.local", "http://rec.local");

      expect(comp.scoring.metrics.behavioralPersistence.status).toBe("unavailable");
      expect(comp.parityScore).toBeLessThanOrEqual(0.60);
      expect(comp.scoring.cappedReason).toContain("unavailable");
    } finally {
      BrowserInvestigator.investigateWebPage = originalInvestigate;
    }
  });

  it("4. Visual parity explicitly states disclaimer and imageDiffPerformed: false", async () => {
    const ref = createMockInvestigation();
    const rec = createMockInvestigation();

    const originalInvestigate = BrowserInvestigator.investigateWebPage;
    BrowserInvestigator.investigateWebPage = (async () => ref) as any;

    try {
      const comp = await BrowserInvestigator.compareWebApplications("http://ref.local", "http://rec.local");

      expect(comp.visualComparison.imageDiffPerformed).toBe(false);
      expect(comp.visualComparison.disclaimer).toContain("Pixel-level bitmap diffing was not performed");
      expect(comp.visualComparison.method).toContain("not pixel-diffed");
    } finally {
      BrowserInvestigator.investigateWebPage = originalInvestigate;
    }
  });

  it("5. QuickNotes 14 vs 13 button count variance is detected as discrepancy and reduces score below 1.0", async () => {
    // 12 shared buttons + 2 delete buttons = 14
    const sharedLabels = ["new note", "export markdown", "export html", "export txt", "export json",
      "bold", "italic", "heading", "bullet list", "numbered list", "quote", "code block"];
    
    const refButtons = [
      ...sharedLabels.map(l => ({ tag: "button", text: l, selector: `btn-${l}` })),
      { tag: "button", text: "×", selector: "del-1" },
      { tag: "button", text: "×", selector: "del-2" }
    ];

    // 12 shared buttons + 1 delete button = 13
    const recButtons = [
      ...sharedLabels.map(l => ({ tag: "button", text: l, selector: `btn-${l}` })),
      { tag: "button", text: "×", selector: "del-1" }
    ];

    const ref = createMockInvestigation({
      pageTitle: "QuickNotes Online",
      observedControls: {
        buttons: refButtons,
        inputs: [],
        forms: [],
        menus: [],
        headings: []
      }
    });

    const rec = createMockInvestigation({
      pageTitle: "QuickNotes Online",
      observedControls: {
        buttons: recButtons,
        inputs: [],
        forms: [],
        menus: [],
        headings: []
      }
    });

    const originalInvestigate = BrowserInvestigator.investigateWebPage;
    BrowserInvestigator.investigateWebPage = (async (url: string) => {
      if (url.includes("ref")) return ref;
      return rec;
    }) as any;

    try {
      const comp = await BrowserInvestigator.compareWebApplications("http://ref.local", "http://rec.local");

      // Unique labels are identical (all 13 labels are shared)
      expect(comp.visualComparison.buttonsMatch.commonButtons.length).toBe(13);
      expect(comp.visualComparison.buttonsMatch.missingInRecreation.length).toBe(0);
      expect(comp.visualComparison.buttonsMatch.extraInRecreation.length).toBe(0);

      // But element counts differ: 14 vs 13
      expect(comp.visualComparison.buttonsMatch.referenceCount).toBe(14);
      expect(comp.visualComparison.buttonsMatch.recreationCount).toBe(13);
      expect(comp.visualComparison.buttonsMatch.countDifference).toBe(1);

      // Discrepancy is explicitly reported in differences
      expect(comp.behavioralComparison.differences.some(d => d.includes("Button element count variance: reference has 14 buttons, recreation has 13"))).toBe(true);

      // Overall score reflects this deduction and CANNOT equal 1.0
      expect(comp.parityScore).toBeLessThan(1.0);
      expect(comp.parityScore).toBeGreaterThanOrEqual(0.95);
      expect(comp.scoring.metrics.buttonCountParity.score).toBeLessThan(0.05);
    } finally {
      BrowserInvestigator.investigateWebPage = originalInvestigate;
    }
  });
});
