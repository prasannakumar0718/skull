# Agent App Forge — Evidence & Provenance Model

**Standard:** Zero Fabricated Evidence & Strict Provenance Tagging  
**Module:** `src/spec/schema.ts`, `src/recreation/investigator.ts`  
**Status:** Implemented & Formally Verified  

---

## 1. Principles of Evidence-Based Engineering

Agent App Forge strictly enforces the following provenance rules:
1. **Never conflate observed behavior with speculative inference:** Every requirement, entity, model, operation, and workflow must declare its source of origin.
2. **Deterministic Fingerprinting:** Physical targets (source files, SQLite databases, binary fixtures) must have their SHA-256 cryptographic digests recorded.
3. **Transparent Unknowns:** Features that could not be verified due to missing upstream tools, platform constraints, or missing files must be explicitly flagged as `unknown` or `blockedByMissingProviders`.

---

## 2. Provenance Classification Schema

```typescript
export const ProvenanceSchema = z.enum([
  "observed",        // Confirmed via direct inspection of files, databases, routes, or REA MCP tools
  "inferred",        // Reasonably deduced by domain heuristics based on context
  "user_requested",   // Explicitly requested by the user prompt
  "unknown"          // Incomplete evidence; requires user clarification or further investigation
]);
```

### Classification Criteria

| Provenance Tag | Source of Evidence | Example Usage |
|---|---|---|
| **`observed`** | Source code file inspection, SQLite database schema introspection, REA MCP `tools/list` or tool output, HTTP route definitions. | `Document` model schema extracted from `reference.db` SQLite table `documents`. |
| **`inferred`** | Standard domain convention inferred from prompt or observed models. | Debounced autosave interval of 500ms inferred for a rich-text document editor. |
| **`user_requested`** | Explicit user constraint provided in the natural language prompt. | User specifies "Export to Markdown, HTML, Plain Text, and JSON". |
| **`unknown`** | Unresolved behavior, unverified provider dependency, or unsupported platform feature. | Native Wasp CLI execution when running on Windows host without WSL. |

---

## 3. Coverage Assessment

Every `ForgeSpec` generated via the recreation pipeline contains a formal `CoverageAssessment`:

```typescript
export interface CoverageAssessment {
  totalWorkflows: number;
  observedWorkflows: number;
  inferredWorkflows: number;
  unknownWorkflows: number;
  blockedByMissingProviders: string[];
  confidenceScore: number; // 0.0 to 1.0
}
```

### Confidence Score Calculation
The confidence score is computed deterministically:
$$\text{Confidence Score} = \frac{\text{observedWorkflows} \times 1.0 + \text{inferredWorkflows} \times 0.6 + \text{userRequestedWorkflows} \times 0.8}{\text{totalWorkflows}}$$

- **Reference-driven targets with complete evidence:** Score $\ge 0.90$.
- **Feature-driven recreation without reference target:** Score $\approx 0.85$.
- **Incomplete or missing targets:** Score $< 0.60$.

---

## 4. Evidence Artifact Representation

When an investigation completes, all extracted evidence is preserved inside the `RecreationInvestigation`:

```json
{
  "mode": "reference_driven",
  "targetPath": "D:\\git hub\\agent-app-forge\\fixtures\\reference-document-app",
  "targetType": "source_code",
  "evidence": [
    {
      "source": "server.js",
      "type": "route_definition",
      "digest": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "description": "Observed HTTP route GET /api/health",
      "provenance": "observed"
    },
    {
      "source": "reference.db",
      "type": "database_schema",
      "digest": "b5d4045c3f466fa91fe2cc6abe79232a1a57cdf104f7a26e716e0a1e2789df78",
      "description": "Observed SQLite table 'documents' (id, title, content, format, updatedAt)",
      "provenance": "observed"
    }
  ],
  "observedCapabilities": [
    "persistent-sqlite-storage",
    "document-crud",
    "document-export"
  ],
  "inferredCapabilities": [
    "rich-text-editing",
    "autosave"
  ]
}
```
