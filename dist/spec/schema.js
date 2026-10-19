import { z } from "zod";
export const FieldTypeSchema = z.enum([
    "String",
    "Int",
    "Boolean",
    "DateTime",
    "Float"
]);
export const ProvenanceSchema = z.enum([
    "observed", // Directly observed in reference software/fixture
    "inferred", // Reasoned interpretation of observed behavior
    "user_requested", // Explicitly specified by user prompt
    "unknown" // Insufficient evidence; open requirement
]);
export const EntityFieldSchema = z.object({
    name: z.string(),
    type: FieldTypeSchema,
    isRequired: z.boolean().optional().default(true),
    isId: z.boolean().optional().default(false),
    defaultValue: z.any().optional(),
    description: z.string().optional(),
    provenance: ProvenanceSchema.optional().default("user_requested"),
    evidenceId: z.string().optional()
});
export const EntityModelSchema = z.object({
    name: z.string(),
    fields: z.array(EntityFieldSchema),
    description: z.string().optional(),
    provenance: ProvenanceSchema.optional().default("user_requested"),
    evidenceId: z.string().optional()
});
export const OperationTypeSchema = z.enum(["query", "action"]);
export const OperationSchema = z.object({
    name: z.string(),
    type: OperationTypeSchema,
    entities: z.array(z.string()),
    description: z.string().optional(),
    provenance: ProvenanceSchema.optional().default("user_requested"),
    evidenceId: z.string().optional()
});
export const RouteSchema = z.object({
    name: z.string(),
    path: z.string(),
    component: z.string(),
    isProtected: z.boolean().default(false),
    provenance: ProvenanceSchema.optional().default("user_requested"),
    evidenceId: z.string().optional()
});
export const WorkflowStepSchema = z.object({
    step: z.number().int().positive(),
    action: z.string(),
    targetComponent: z.string().optional(),
    expectedOutcome: z.string(),
    provenance: ProvenanceSchema.default("user_requested"),
    evidenceId: z.string().optional()
});
export const AppWorkflowSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    trigger: z.string(),
    steps: z.array(WorkflowStepSchema),
    acceptanceCriteria: z.array(z.string()),
    provenance: ProvenanceSchema.default("user_requested"),
    evidenceId: z.string().optional()
});
export const CoverageAssessmentSchema = z.object({
    totalWorkflows: z.number().int().nonnegative(),
    observedWorkflows: z.number().int().nonnegative(),
    inferredWorkflows: z.number().int().nonnegative(),
    unknownWorkflows: z.number().int().nonnegative(),
    blockedByMissingProviders: z.array(z.string()).default([]),
    confidenceScore: z.number().min(0).max(1)
});
export const TargetEngineSchema = z.enum(["wasp", "fullstack-node", "auto"]);
export const ForgeSpecSchema = z.object({
    name: z.string().min(1).regex(/^[a-zA-Z0-9_-]+$/, "Name must be alphanumeric with dashes or underscores"),
    title: z.string().min(1),
    description: z.string(),
    targetEngine: TargetEngineSchema.default("auto"),
    capabilities: z.array(z.string()).optional(),
    entities: z.array(EntityModelSchema),
    operations: z.array(OperationSchema),
    routes: z.array(RouteSchema),
    workflows: z.array(AppWorkflowSchema).optional().default([]),
    coverageAssessment: CoverageAssessmentSchema.optional(),
    auth: z.object({
        enabled: z.boolean().default(false),
        methods: z.array(z.string()).default(["usernameAndPassword"])
    }).default({ enabled: false, methods: ["usernameAndPassword"] }),
    metadata: z.record(z.any()).optional()
});
