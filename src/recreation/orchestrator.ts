import * as fs from "node:fs";
import * as path from "node:path";
import { ForgeSpec, TargetEngine } from "../spec/schema.js";
import { createSpecFromPrompt, validateForgeSpec } from "../spec/validator.js";
import { EngineOrchestrator } from "../engines/orchestrator.js";
import { ForgeVerifier, VerificationReport } from "../verifier/verifier.js";
import { GenerationResult } from "../engines/types.js";
import { RecreationInvestigator, RecreationInvestigation, RecreationMode } from "./investigator.js";
import { ImplementationPlanner, ImplementationPlan } from "./planner.js";
import { RecreationComparator, ComparisonReport } from "./comparator.js";
import { classifyUserRequest, RequestType } from "./requestClassifier.js";

export interface RecreationOptions {
  prompt: string;
  targetPath?: string;
  outputDirectory?: string;
  targetEngine?: TargetEngine;
  planOnly?: boolean;
  compare?: boolean;
}

export interface ForgeFinalReport {
  requestClassification: {
    type: RequestType;
    domain: string;
    target?: string;
    mode: RecreationMode;
  };
  outputPath: string;
  runInstructions: {
    directory: string;
    command: string;
    appUrl: string;
    healthUrl: string;
  };
  testedFeatures: Array<{
    name: string;
    status: "pass" | "fail" | "unavailable";
    evidence?: string;
    details?: string;
  }>;
  results: {
    overallStatus: "PASSED" | "FAILED";
    engine: string;
    filesGenerated: number;
    verificationPassed: boolean;
    repairAttempts: number;
    comparisonStatus?: "pass" | "fail" | "warn" | "unavailable";
    featuresPassed: number;
    featuresTotal: number;
    applicationQuality?: any;
    referenceFidelity?: any;
  };
  limitations: string[];
  summary: string;
}

export interface RecreationResult {
  success: boolean;
  mode: RecreationMode;
  investigation: RecreationInvestigation;
  spec: ForgeSpec;
  plan: ImplementationPlan;
  generation?: GenerationResult;
  comparison?: ComparisonReport;
  verification?: VerificationReport;
  finalReport?: ForgeFinalReport;
  outputDirectory: string;
  summary: string;
}

export class RecreationOrchestrator {
  private investigator: RecreationInvestigator;
  private planner: ImplementationPlanner;
  private engineOrchestrator: EngineOrchestrator;
  private verifier: ForgeVerifier;
  private comparator: RecreationComparator;

  constructor() {
    this.investigator = new RecreationInvestigator();
    this.planner = new ImplementationPlanner();
    this.engineOrchestrator = new EngineOrchestrator();
    this.verifier = new ForgeVerifier();
    this.comparator = new RecreationComparator();
  }

  public async recreate(options: RecreationOptions): Promise<RecreationResult> {
    const prompt = options.prompt.trim();
    const classification = classifyUserRequest(prompt, options.targetPath, options.outputDirectory);
    const resolvedOut = path.resolve(options.outputDirectory?.trim() || classification.defaultOutputDirectory);
    const effectiveTarget = options.targetPath?.trim() || classification.targetPath;

    // Step 1: INVESTIGATE & UNDERSTAND
    const investigation = await this.investigator.investigate(prompt, effectiveTarget);

    // Step 2: SPECIFY
    const baseSpec = createSpecFromPrompt(prompt, path.basename(resolvedOut));

    // Merge observed entities & workflows if reference-driven
    // Prioritize observed entities discovered from reference code or SQLite schema
    const mergedEntities = [...investigation.inferredEntities];
    for (const baseEnt of baseSpec.entities) {
      if (!mergedEntities.some(e => e.name.toLowerCase() === baseEnt.name.toLowerCase())) {
        mergedEntities.push(baseEnt);
      }
    }

    const mergedWorkflows = [...(baseSpec.workflows || [])];
    for (const obsWf of investigation.inferredWorkflows) {
      if (!mergedWorkflows.some(w => w.id === obsWf.id)) {
        mergedWorkflows.push(obsWf);
      }
    }

    const mergedCapabilities = Array.from(new Set([
      ...(baseSpec.capabilities || []),
      ...investigation.observedCapabilities
    ]));

    // Use observed application title from evidence if available (browser investigation or static HTML markup)
    let resolvedTitle = baseSpec.title;
    const titleEvidence = investigation.evidence.find(
      e => e.findings && (typeof (e.findings as any).pageTitle === "string" || typeof (e.findings as any).title === "string")
    );
    if (titleEvidence) {
      const observedTitle = (titleEvidence.findings as any).pageTitle || (titleEvidence.findings as any).title;
      if (observedTitle && typeof observedTitle === "string" && observedTitle.trim()) {
        resolvedTitle = observedTitle.trim();
      }
    }

    // Extract observed controls, headings, paragraphs, links, and endpoints from investigation evidence
    const observedButtons: string[] = [];
    const observedHeadings: string[] = [];
    const observedParagraphs: string[] = [];
    const observedLinks: Array<{ text: string; href: string }> = [];
    const observedEndpoints: Array<{ method: string; path: string; description: string }> = [];

    for (const ev of investigation.evidence) {
      if (ev.findings) {
        const findings = ev.findings as any;
        const btns = findings.observedControls?.buttons || findings.buttons;
        if (Array.isArray(btns)) {
          for (const b of btns) {
            const label = typeof b === "string" ? b : (b?.text || b?.label);
            if (typeof label === "string" && label.trim()) {
              observedButtons.push(label.trim());
            }
          }
        }
        const hList = findings.observedControls?.headings || findings.headings;
        if (Array.isArray(hList)) {
          for (const h of hList) {
            if (typeof h === "string" && h.trim()) observedHeadings.push(h.trim());
          }
        }
        const pList = findings.observedControls?.paragraphs || findings.paragraphs;
        if (Array.isArray(pList)) {
          for (const p of pList) {
            if (typeof p === "string" && p.trim()) observedParagraphs.push(p.trim());
          }
        }
        const lList = findings.observedControls?.links || findings.links;
        if (Array.isArray(lList)) {
          for (const l of lList) {
            if (typeof l === "object" && l !== null) {
              const text = String(l.text || l.href || "").trim();
              const href = String(l.href || "").trim();
              if (href) observedLinks.push({ text: text || href, href });
            }
          }
        }
        const epList = findings.apiEndpoints || findings.endpoints;
        if (Array.isArray(epList)) {
          for (const ep of epList) {
            if (typeof ep === "string") {
              observedEndpoints.push({ method: "GET", path: ep, description: `Observed route ${ep}` });
            } else if (typeof ep === "object" && ep !== null) {
              observedEndpoints.push({
                method: ep.method || "GET",
                path: ep.path || ep.url || "/api",
                description: ep.description || `Observed route ${ep.path || ep.url || ""}`
              });
            }
          }
        }
      }
    }

    const isReferenceTask =
      investigation.inferredEntities.some(e => /task/i.test(e.name)) ||
      investigation.observedCapabilities.includes("task-management") ||
      /task|todo|job/i.test(prompt);

    const isStudentMgmt =
      baseSpec.metadata?.domain === "student-management" ||
      mergedEntities.some(e => /student/i.test(e.name)) ||
      /student|school|attendance/i.test(prompt);

    const isDocApp =
      baseSpec.metadata?.domain === "document-editor" ||
      investigation.observedCapabilities.includes("rich-text-editing") ||
      investigation.inferredEntities.some(e => /document/i.test(e.name)) ||
      /word|document|writer|quicknotes/i.test(prompt);

    const isApiDocs =
      !isReferenceTask && !isStudentMgmt && !isDocApp && (
        baseSpec.metadata?.domain === "api-docs" ||
        investigation.observedCapabilities.includes("api-documentation") ||
        investigation.inferredEntities.some(e => /apiendpoint/i.test(e.name)) ||
        /api|swagger|openapi|documentation|endpoints|service explorer|http request|rest api/i.test(resolvedTitle) ||
        (observedEndpoints.length > 0 && observedButtons.length === 0) ||
        observedButtons.some(b => /expand operation|try it out|execute/i.test(b))
      );

    const isContentPage =
      !isReferenceTask && !isStudentMgmt && !isDocApp && !isApiDocs && (
        baseSpec.metadata?.domain === "content" ||
        investigation.observedCapabilities.includes("content-presentation") ||
        investigation.inferredEntities.some(e => /contentpage/i.test(e.name)) ||
        (investigation.targetClassification?.accessible !== false && observedButtons.length <= 1 && (investigation.targetType === "web_url" || /recreate|clone|website/i.test(prompt)))
      );

    let finalDomain = baseSpec.metadata?.domain;
    if (isReferenceTask) {
      finalDomain = "task-management";
    } else if (isStudentMgmt) {
      finalDomain = "student-management";
    } else if (isDocApp) {
      finalDomain = "document-editor";
    } else if (isApiDocs) {
      finalDomain = "api-docs";
    } else if (isContentPage) {
      finalDomain = "content";
    }

    let filteredEntities = mergedEntities.filter(e => {
      if ((isReferenceTask || isStudentMgmt || isContentPage || isApiDocs) && (e.name === "Document" || e.name === "Revision")) {
        return false;
      }
      if ((isStudentMgmt || isContentPage || isApiDocs) && e.name === "Task") {
        return false;
      }
      if ((isContentPage || isApiDocs) && (e.name.startsWith("Record") || e.name === "Item")) {
        return false;
      }
      if ((isReferenceTask || isStudentMgmt) && (e.name === "ContentPage" || e.name === "ApiEndpoint")) {
        return false;
      }
      return true;
    });

    if (isContentPage && !filteredEntities.some(e => e.name === "ContentPage")) {
      filteredEntities.push({
        name: "ContentPage",
        description: "Content page observed with structured headings, text, and hyperlinks",
        provenance: "observed",
        fields: [
          { name: "id", type: "Int", isId: true, isRequired: true, provenance: "inferred" },
          { name: "title", type: "String", isId: false, isRequired: true, provenance: "observed" },
          { name: "content", type: "String", isId: false, isRequired: false, provenance: "observed" }
        ]
      });
    }

    if (isApiDocs && !filteredEntities.some(e => e.name === "ApiEndpoint")) {
      filteredEntities.push({
        name: "ApiEndpoint",
        description: "API endpoint discovered on service explorer / documentation page",
        provenance: "observed",
        fields: [
          { name: "id", type: "Int", isId: true, isRequired: true, provenance: "inferred" },
          { name: "path", type: "String", isId: false, isRequired: true, provenance: "observed" },
          { name: "method", type: "String", isId: false, isRequired: true, provenance: "observed" },
          { name: "description", type: "String", isId: false, isRequired: false, provenance: "observed" }
        ]
      });
    }

    const entityNames = new Set(filteredEntities.map(e => e.name));
    let filteredOperations = (baseSpec.operations || []).filter(op =>
      op.entities.every(entName => entityNames.has(entName))
    );

    if (isContentPage && !filteredOperations.some(op => op.entities.includes("ContentPage"))) {
      filteredOperations.push({
        name: "getContent",
        type: "query",
        entities: ["ContentPage"],
        description: "Retrieve structured content page and metadata",
        provenance: "observed"
      });
    }

    if (isApiDocs && !filteredOperations.some(op => op.entities.includes("ApiEndpoint"))) {
      filteredOperations.push({
        name: "getEndpoints",
        type: "query",
        entities: ["ApiEndpoint"],
        description: "Retrieve documented API routes and metadata",
        provenance: "observed"
      });
    }

    const filteredWorkflows = mergedWorkflows.filter(w => {
      if ((isReferenceTask || isStudentMgmt || isContentPage || isApiDocs) && (w.id === "wf_doc_editing" || w.id === "wf_edit_save" || w.id === "wf_create_rename")) {
        return false;
      }
      if ((isStudentMgmt || isContentPage || isApiDocs) && w.id === "wf_task_lifecycle") {
        return false;
      }
      return true;
    });

    const filteredCapabilities = mergedCapabilities.filter(c => {
      if ((isReferenceTask || isStudentMgmt || isContentPage || isApiDocs) && (c === "rich-text-editing" || c === "document-management" || c === "document-export" || c === "version-history")) {
        return false;
      }
      return true;
    });

    const spec: ForgeSpec = {
      ...baseSpec,
      title: resolvedTitle,
      metadata: {
        ...baseSpec.metadata,
        domain: finalDomain || "general",
        observedButtons: Array.from(new Set(observedButtons)),
        observedHeadings: Array.from(new Set(observedHeadings)),
        observedParagraphs: Array.from(new Set(observedParagraphs)),
        observedLinks: Array.from(new Set(observedLinks.map(l => JSON.stringify(l)))).map(s => JSON.parse(s)),
        observedEndpoints
      },
      targetEngine: options.targetEngine || baseSpec.targetEngine,
      entities: filteredEntities,
      operations: filteredOperations,
      workflows: filteredWorkflows,
      capabilities: filteredCapabilities.length > 0 ? filteredCapabilities : undefined,
      coverageAssessment: investigation.coverageAssessment
    };

    const validation = validateForgeSpec(spec);
    if (!validation.result.valid) {
      throw new Error(`Recreation specification validation failed: ${validation.result.errors.join("; ")}`);
    }

    // Step 3: PLAN
    const plan = this.planner.plan(spec, investigation, options.targetEngine || "auto");

    // Plan-only return
    if (options.planOnly) {
      return {
        success: true,
        mode: investigation.mode,
        investigation,
        spec,
        plan,
        outputDirectory: resolvedOut,
        summary: `Plan generated successfully for '${spec.title}' in mode [${investigation.mode}]. Generation skipped due to planOnly=true.`
      };
    }

    // Step 4: BUILD
    if (!fs.existsSync(resolvedOut)) {
      fs.mkdirSync(resolvedOut, { recursive: true });
    }

    const generation = await this.engineOrchestrator.generateProject(spec, resolvedOut);

    // Write implementation plan to project
    fs.writeFileSync(
      path.join(resolvedOut, "implementation-plan.json"),
      JSON.stringify(plan, null, 2),
      "utf-8"
    );

    // Step 5: VERIFY
    const verification = await this.verifier.verify(resolvedOut);

    // Step 6: COMPARE & IMPROVE
    let comparison: ComparisonReport | undefined = undefined;
    if (options.compare !== false) {
      comparison = await this.comparator.compare(resolvedOut, spec, investigation, plan);
    }

    const isSuccess = verification.overallPassed && (!comparison || comparison.overallStatus !== "fail");

    const summary = [
      `Application generation [${investigation.mode}] completed for '${spec.title}'.`,
      `Engine: [${generation.engineName}] | Files Generated: ${generation.files.length}`,
      `Verification: ${verification.overallPassed ? "PASSED" : "FAILED"} (${verification.repairAttempts} repairs)`,
      comparison ? `Comparison: ${comparison.overallStatus.toUpperCase()} (${comparison.summary.passed}/${comparison.summary.total} features passed)` : ""
    ].filter(Boolean).join(" ");

    // Prepare human-readable final report
    const testedFeatures: ForgeFinalReport["testedFeatures"] = [];
    for (const chk of verification.checks) {
      testedFeatures.push({
        name: chk.name,
        status: chk.passed ? "pass" : "fail",
        details: chk.message + (chk.details ? ` (${chk.details})` : "")
      });
    }
    if (comparison) {
      for (const ev of comparison.evaluations) {
        testedFeatures.push({
          name: ev.feature,
          status: ev.status === "pass" ? "pass" : (ev.status === "unavailable" ? "unavailable" : "fail"),
          evidence: ev.evidence,
          details: ev.details
        });
      }
    }

    const allLimitations = Array.from(new Set([
      ...investigation.limitations,
      ...(investigation.targetClassification?.accessible === false
        ? [`Target '${effectiveTarget}' was inaccessible: ${investigation.targetClassification.reason}. Live website inspection could not be performed.`]
        : [])
    ]));

    const finalReport: ForgeFinalReport = {
      requestClassification: {
        type: classification.type,
        domain: finalDomain || "general",
        target: effectiveTarget,
        mode: investigation.mode
      },
      outputPath: resolvedOut,
      runInstructions: {
        directory: resolvedOut,
        command: "node server.js",
        appUrl: "http://localhost:3000",
        healthUrl: "http://localhost:3000/api/health"
      },
      testedFeatures,
      results: {
        overallStatus: isSuccess ? "PASSED" : "FAILED",
        engine: generation.engineName,
        filesGenerated: generation.files.length,
        verificationPassed: verification.overallPassed,
        repairAttempts: verification.repairAttempts,
        comparisonStatus: comparison?.overallStatus as any,
        featuresPassed: comparison ? comparison.summary.passed : (verification.overallPassed ? 1 : 0),
        featuresTotal: comparison ? comparison.summary.total : 1,
        applicationQuality: (comparison as any)?.applicationQuality,
        referenceFidelity: (comparison as any)?.referenceFidelity
      },
      limitations: allLimitations,
      summary
    };

    return {
      success: isSuccess,
      mode: investigation.mode,
      investigation,
      spec,
      plan,
      generation,
      comparison,
      verification,
      finalReport,
      outputDirectory: resolvedOut,
      summary
    };
  }
}

