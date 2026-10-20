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

export interface RecreationOptions {
  prompt: string;
  targetPath?: string;
  outputDirectory: string;
  targetEngine?: TargetEngine;
  planOnly?: boolean;
  compare?: boolean;
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
    const resolvedOut = path.resolve(options.outputDirectory.trim());

    // Step 1: INVESTIGATE & UNDERSTAND
    const investigation = await this.investigator.investigate(prompt, options.targetPath);

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

    const isReferenceTask =
      investigation.inferredEntities.some(e => /task/i.test(e.name)) ||
      investigation.observedCapabilities.includes("task-management") ||
      /task/i.test(prompt);

    let finalDomain = baseSpec.metadata?.domain;
    if (isReferenceTask) {
      finalDomain = "task-management";
    }

    const filteredEntities = mergedEntities.filter(e => {
      if (isReferenceTask && (e.name === "Document" || e.name === "Revision")) {
        return false;
      }
      return true;
    });

    const filteredWorkflows = mergedWorkflows.filter(w => {
      if (isReferenceTask && (w.id === "wf_doc_editing" || w.id === "wf_edit_save" || w.id === "wf_create_rename")) {
        return false;
      }
      return true;
    });

    const filteredCapabilities = mergedCapabilities.filter(c => {
      if (isReferenceTask && (c === "rich-text-editing" || c === "document-management" || c === "document-export" || c === "version-history")) {
        return false;
      }
      return true;
    });

    const spec: ForgeSpec = {
      ...baseSpec,
      title: resolvedTitle,
      metadata: {
        ...baseSpec.metadata,
        domain: finalDomain || "general"
      },
      targetEngine: options.targetEngine || baseSpec.targetEngine,
      entities: filteredEntities,
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
      `Recreation [${investigation.mode}] completed for '${spec.title}'.`,
      `Engine: [${generation.engineName}] | Files Generated: ${generation.files.length}`,
      `Verification: ${verification.overallPassed ? "PASSED" : "FAILED"} (${verification.repairAttempts} repairs)`,
      comparison ? `Comparison: ${comparison.overallStatus.toUpperCase()} (${comparison.summary.passed}/${comparison.summary.total} features passed)` : ""
    ].filter(Boolean).join(" ");

    return {
      success: isSuccess,
      mode: investigation.mode,
      investigation,
      spec,
      plan,
      generation,
      comparison,
      verification,
      outputDirectory: resolvedOut,
      summary
    };
  }
}
