import * as fs from "node:fs";
import * as path from "node:path";
import { RecreationMode } from "./investigator.js";

export type RequestType = "new_application" | "reference_recreation" | "modification" | "analysis";

export interface RequestClassification {
  type: RequestType;
  mode: RecreationMode;
  domain: string;
  targetPath?: string;
  targetType: "web_url" | "sqlite_database" | "source_code" | "android_package" | "binary" | "greenfield" | "unknown";
  defaultOutputDirectory: string;
  extractedFromPrompt: boolean;
  confidence: number;
  reasoning: string;
}

/**
 * Normalizes text to a kebab-case slug for folder/file naming.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/https?:\/\/[^\s]+/g, "")
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "app";
}

/**
 * Automatically classifies user intent, target references, and domain
 * without requiring the user to know MCP, REA, ForgeSpec, or specific tool names.
 */
export function classifyUserRequest(prompt: string, explicitTarget?: string, explicitOutputDir?: string): RequestClassification {
  const cleanPrompt = (prompt || "").trim();
  let targetPath = explicitTarget?.trim();
  let extractedFromPrompt = false;

  // 1. Target URL extraction from prompt (e.g., "Recreate this website: https://example.com")
  if (!targetPath) {
    const urlMatch = cleanPrompt.match(/https?:\/\/[^\s"'>)]+/i);
    if (urlMatch) {
      targetPath = urlMatch[0];
      extractedFromPrompt = true;
    }
  }

  // 2. Local file/directory path extraction from prompt if not already found
  if (!targetPath) {
    const pathMatch = cleanPrompt.match(/(?:from|at|path|directory|target|repo|reference|app|project)\s+([A-Za-z0-9_.\/\\:-]+(?:(?:\/|\\)[A-Za-z0-9_.-]+)+)/i);
    if (pathMatch && pathMatch[1]) {
      const candidate = pathMatch[1].trim();
      const resolved = path.resolve(candidate);
      if (fs.existsSync(resolved)) {
        targetPath = candidate;
        extractedFromPrompt = true;
      }
    }
  }

  // 3. Classify target type
  let targetType: RequestClassification["targetType"] = "greenfield";
  if (targetPath) {
    if (targetPath.startsWith("http://") || targetPath.startsWith("https://")) {
      targetType = "web_url";
    } else {
      const lower = targetPath.toLowerCase();
      const resolved = path.resolve(targetPath);
      const exists = fs.existsSync(resolved);
      if (lower.endsWith(".db") || lower.endsWith(".sqlite")) {
        targetType = "sqlite_database";
      } else if (lower.endsWith(".apk") || lower.endsWith(".aab")) {
        targetType = "android_package";
      } else if (exists && fs.statSync(resolved).isDirectory()) {
        targetType = "source_code";
      } else if (lower.endsWith(".wasm") || lower.endsWith(".exe") || lower.endsWith(".dll") || lower.endsWith(".so")) {
        targetType = "binary";
      } else {
        targetType = exists ? "source_code" : "unknown";
      }
    }
  }

  // 4. Classify domain
  let domain = "generic";
  if (/student|school|attendance|course|classroom|grade|admission|tuition|academic/i.test(cleanPrompt)) {
    domain = "student-management";
  } else if (/word|document|rich[- ]?text|writer|notepad|quill|wysiwyg|quicknotes/i.test(cleanPrompt) && !/task|todo/i.test(cleanPrompt)) {
    domain = "document-editor";
  } else if (/task|todo|job|checklist|taskflow/i.test(cleanPrompt)) {
    domain = "task-management";
  } else if (/fee|expense|cost|finance|invoice|payment|budget/i.test(cleanPrompt)) {
    domain = "financial";
  } else if (/commerce|shop|store|product|inventory|catalog|stock/i.test(cleanPrompt)) {
    domain = "e-commerce";
  } else if (/blog|article|post|news|editorial/i.test(cleanPrompt)) {
    domain = "blog";
  }

  // 5. Classify Request Type
  const isAnalysisIntent = /^(?:analyze|inspect|audit|examine|investigate|probe|check|scan)\b/i.test(cleanPrompt) &&
    !/recreate|build|generate|create|scaffold|develop/i.test(cleanPrompt);

  const isModificationIntent = /^(?:modify|update|add\s+feature|change|fix|repair|patch|enhance|extend|refactor)\b/i.test(cleanPrompt) &&
    Boolean(targetPath && targetType === "source_code");

  const isRecreationIntent = Boolean(targetPath) ||
    /recreate|clone|reverse|alternative|replace|rebuild|copy|duplicate/i.test(cleanPrompt);

  let type: RequestType;
  let mode: RecreationMode;
  let reasoning: string;

  if (isAnalysisIntent) {
    type = "analysis";
    mode = targetPath ? "reference_driven" : "feature_driven";
    reasoning = `Classified as analysis request for inspection and discovery. Target: ${targetPath || "unspecified"}.`;
  } else if (isModificationIntent) {
    type = "modification";
    mode = "reference_driven";
    reasoning = `Classified as modification request on existing codebase at '${targetPath}'.`;
  } else if (isRecreationIntent) {
    type = "reference_recreation";
    mode = targetPath ? "reference_driven" : "feature_driven";
    reasoning = targetPath
      ? `Classified as reference-based recreation targeting '${targetPath}' (${targetType}).`
      : "Classified as feature-driven recreation without explicit external reference.";
  } else {
    type = "new_application";
    mode = "greenfield";
    reasoning = `Classified as new application generation for domain '${domain}' from prompt description.`;
  }

  // 6. Automatic Output Directory
  let defaultOutputDirectory = explicitOutputDir ? path.resolve(explicitOutputDir) : "";
  if (!defaultOutputDirectory) {
    let slugCandidate = "";
    if (domain === "student-management") {
      slugCandidate = "student-management-app";
    } else if (domain === "document-editor") {
      slugCandidate = "document-editor-app";
    } else if (domain === "task-management") {
      slugCandidate = "taskflow-app";
    } else if (targetPath && (targetType === "web_url" || targetType === "source_code")) {
      const baseName = targetType === "web_url"
        ? new URL(targetPath).hostname.replace(/[^a-z0-9]/gi, "-")
        : path.basename(targetPath);
      slugCandidate = `${slugify(baseName)}-recreation`;
    } else {
      slugCandidate = `${slugify(cleanPrompt.slice(0, 30))}-app`;
    }
    defaultOutputDirectory = path.resolve("outputs", slugCandidate);
  }

  return {
    type,
    mode,
    domain,
    targetPath,
    targetType,
    defaultOutputDirectory,
    extractedFromPrompt,
    confidence: targetPath ? 0.95 : 0.9,
    reasoning
  };
}
