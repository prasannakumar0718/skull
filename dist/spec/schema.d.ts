import { z } from "zod";
export declare const FieldTypeSchema: z.ZodEnum<["String", "Int", "Boolean", "DateTime", "Float"]>;
export declare const ProvenanceSchema: z.ZodEnum<["observed", "inferred", "user_requested", "unknown"]>;
export declare const EntityFieldSchema: z.ZodObject<{
    name: z.ZodString;
    type: z.ZodEnum<["String", "Int", "Boolean", "DateTime", "Float"]>;
    isRequired: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    isId: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    defaultValue: z.ZodOptional<z.ZodAny>;
    description: z.ZodOptional<z.ZodString>;
    provenance: z.ZodDefault<z.ZodOptional<z.ZodEnum<["observed", "inferred", "user_requested", "unknown"]>>>;
    evidenceId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    type: "String" | "Int" | "Boolean" | "DateTime" | "Float";
    isRequired: boolean;
    isId: boolean;
    provenance: "observed" | "inferred" | "user_requested" | "unknown";
    defaultValue?: any;
    description?: string | undefined;
    evidenceId?: string | undefined;
}, {
    name: string;
    type: "String" | "Int" | "Boolean" | "DateTime" | "Float";
    isRequired?: boolean | undefined;
    isId?: boolean | undefined;
    defaultValue?: any;
    description?: string | undefined;
    provenance?: "observed" | "inferred" | "user_requested" | "unknown" | undefined;
    evidenceId?: string | undefined;
}>;
export declare const EntityModelSchema: z.ZodObject<{
    name: z.ZodString;
    fields: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        type: z.ZodEnum<["String", "Int", "Boolean", "DateTime", "Float"]>;
        isRequired: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        isId: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
        defaultValue: z.ZodOptional<z.ZodAny>;
        description: z.ZodOptional<z.ZodString>;
        provenance: z.ZodDefault<z.ZodOptional<z.ZodEnum<["observed", "inferred", "user_requested", "unknown"]>>>;
        evidenceId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        type: "String" | "Int" | "Boolean" | "DateTime" | "Float";
        isRequired: boolean;
        isId: boolean;
        provenance: "observed" | "inferred" | "user_requested" | "unknown";
        defaultValue?: any;
        description?: string | undefined;
        evidenceId?: string | undefined;
    }, {
        name: string;
        type: "String" | "Int" | "Boolean" | "DateTime" | "Float";
        isRequired?: boolean | undefined;
        isId?: boolean | undefined;
        defaultValue?: any;
        description?: string | undefined;
        provenance?: "observed" | "inferred" | "user_requested" | "unknown" | undefined;
        evidenceId?: string | undefined;
    }>, "many">;
    description: z.ZodOptional<z.ZodString>;
    provenance: z.ZodDefault<z.ZodOptional<z.ZodEnum<["observed", "inferred", "user_requested", "unknown"]>>>;
    evidenceId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    provenance: "observed" | "inferred" | "user_requested" | "unknown";
    fields: {
        name: string;
        type: "String" | "Int" | "Boolean" | "DateTime" | "Float";
        isRequired: boolean;
        isId: boolean;
        provenance: "observed" | "inferred" | "user_requested" | "unknown";
        defaultValue?: any;
        description?: string | undefined;
        evidenceId?: string | undefined;
    }[];
    description?: string | undefined;
    evidenceId?: string | undefined;
}, {
    name: string;
    fields: {
        name: string;
        type: "String" | "Int" | "Boolean" | "DateTime" | "Float";
        isRequired?: boolean | undefined;
        isId?: boolean | undefined;
        defaultValue?: any;
        description?: string | undefined;
        provenance?: "observed" | "inferred" | "user_requested" | "unknown" | undefined;
        evidenceId?: string | undefined;
    }[];
    description?: string | undefined;
    provenance?: "observed" | "inferred" | "user_requested" | "unknown" | undefined;
    evidenceId?: string | undefined;
}>;
export declare const OperationTypeSchema: z.ZodEnum<["query", "action"]>;
export declare const OperationSchema: z.ZodObject<{
    name: z.ZodString;
    type: z.ZodEnum<["query", "action"]>;
    entities: z.ZodArray<z.ZodString, "many">;
    description: z.ZodOptional<z.ZodString>;
    provenance: z.ZodDefault<z.ZodOptional<z.ZodEnum<["observed", "inferred", "user_requested", "unknown"]>>>;
    evidenceId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    type: "query" | "action";
    provenance: "observed" | "inferred" | "user_requested" | "unknown";
    entities: string[];
    description?: string | undefined;
    evidenceId?: string | undefined;
}, {
    name: string;
    type: "query" | "action";
    entities: string[];
    description?: string | undefined;
    provenance?: "observed" | "inferred" | "user_requested" | "unknown" | undefined;
    evidenceId?: string | undefined;
}>;
export declare const RouteSchema: z.ZodObject<{
    name: z.ZodString;
    path: z.ZodString;
    component: z.ZodString;
    isProtected: z.ZodDefault<z.ZodBoolean>;
    provenance: z.ZodDefault<z.ZodOptional<z.ZodEnum<["observed", "inferred", "user_requested", "unknown"]>>>;
    evidenceId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    provenance: "observed" | "inferred" | "user_requested" | "unknown";
    path: string;
    component: string;
    isProtected: boolean;
    evidenceId?: string | undefined;
}, {
    name: string;
    path: string;
    component: string;
    provenance?: "observed" | "inferred" | "user_requested" | "unknown" | undefined;
    evidenceId?: string | undefined;
    isProtected?: boolean | undefined;
}>;
export declare const WorkflowStepSchema: z.ZodObject<{
    step: z.ZodNumber;
    action: z.ZodString;
    targetComponent: z.ZodOptional<z.ZodString>;
    expectedOutcome: z.ZodString;
    provenance: z.ZodDefault<z.ZodEnum<["observed", "inferred", "user_requested", "unknown"]>>;
    evidenceId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    provenance: "observed" | "inferred" | "user_requested" | "unknown";
    action: string;
    step: number;
    expectedOutcome: string;
    evidenceId?: string | undefined;
    targetComponent?: string | undefined;
}, {
    action: string;
    step: number;
    expectedOutcome: string;
    provenance?: "observed" | "inferred" | "user_requested" | "unknown" | undefined;
    evidenceId?: string | undefined;
    targetComponent?: string | undefined;
}>;
export declare const AppWorkflowSchema: z.ZodObject<{
    id: z.ZodString;
    name: z.ZodString;
    description: z.ZodString;
    trigger: z.ZodString;
    steps: z.ZodArray<z.ZodObject<{
        step: z.ZodNumber;
        action: z.ZodString;
        targetComponent: z.ZodOptional<z.ZodString>;
        expectedOutcome: z.ZodString;
        provenance: z.ZodDefault<z.ZodEnum<["observed", "inferred", "user_requested", "unknown"]>>;
        evidenceId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        provenance: "observed" | "inferred" | "user_requested" | "unknown";
        action: string;
        step: number;
        expectedOutcome: string;
        evidenceId?: string | undefined;
        targetComponent?: string | undefined;
    }, {
        action: string;
        step: number;
        expectedOutcome: string;
        provenance?: "observed" | "inferred" | "user_requested" | "unknown" | undefined;
        evidenceId?: string | undefined;
        targetComponent?: string | undefined;
    }>, "many">;
    acceptanceCriteria: z.ZodArray<z.ZodString, "many">;
    provenance: z.ZodDefault<z.ZodEnum<["observed", "inferred", "user_requested", "unknown"]>>;
    evidenceId: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    description: string;
    provenance: "observed" | "inferred" | "user_requested" | "unknown";
    id: string;
    trigger: string;
    steps: {
        provenance: "observed" | "inferred" | "user_requested" | "unknown";
        action: string;
        step: number;
        expectedOutcome: string;
        evidenceId?: string | undefined;
        targetComponent?: string | undefined;
    }[];
    acceptanceCriteria: string[];
    evidenceId?: string | undefined;
}, {
    name: string;
    description: string;
    id: string;
    trigger: string;
    steps: {
        action: string;
        step: number;
        expectedOutcome: string;
        provenance?: "observed" | "inferred" | "user_requested" | "unknown" | undefined;
        evidenceId?: string | undefined;
        targetComponent?: string | undefined;
    }[];
    acceptanceCriteria: string[];
    provenance?: "observed" | "inferred" | "user_requested" | "unknown" | undefined;
    evidenceId?: string | undefined;
}>;
export declare const CoverageAssessmentSchema: z.ZodObject<{
    totalWorkflows: z.ZodNumber;
    observedWorkflows: z.ZodNumber;
    inferredWorkflows: z.ZodNumber;
    unknownWorkflows: z.ZodNumber;
    blockedByMissingProviders: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    confidenceScore: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    totalWorkflows: number;
    observedWorkflows: number;
    inferredWorkflows: number;
    unknownWorkflows: number;
    blockedByMissingProviders: string[];
    confidenceScore: number;
}, {
    totalWorkflows: number;
    observedWorkflows: number;
    inferredWorkflows: number;
    unknownWorkflows: number;
    confidenceScore: number;
    blockedByMissingProviders?: string[] | undefined;
}>;
export declare const TargetEngineSchema: z.ZodEnum<["wasp", "fullstack-node", "auto"]>;
export declare const ForgeSpecSchema: z.ZodObject<{
    name: z.ZodString;
    title: z.ZodString;
    description: z.ZodString;
    targetEngine: z.ZodDefault<z.ZodEnum<["wasp", "fullstack-node", "auto"]>>;
    capabilities: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    entities: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        fields: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            type: z.ZodEnum<["String", "Int", "Boolean", "DateTime", "Float"]>;
            isRequired: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            isId: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            defaultValue: z.ZodOptional<z.ZodAny>;
            description: z.ZodOptional<z.ZodString>;
            provenance: z.ZodDefault<z.ZodOptional<z.ZodEnum<["observed", "inferred", "user_requested", "unknown"]>>>;
            evidenceId: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            type: "String" | "Int" | "Boolean" | "DateTime" | "Float";
            isRequired: boolean;
            isId: boolean;
            provenance: "observed" | "inferred" | "user_requested" | "unknown";
            defaultValue?: any;
            description?: string | undefined;
            evidenceId?: string | undefined;
        }, {
            name: string;
            type: "String" | "Int" | "Boolean" | "DateTime" | "Float";
            isRequired?: boolean | undefined;
            isId?: boolean | undefined;
            defaultValue?: any;
            description?: string | undefined;
            provenance?: "observed" | "inferred" | "user_requested" | "unknown" | undefined;
            evidenceId?: string | undefined;
        }>, "many">;
        description: z.ZodOptional<z.ZodString>;
        provenance: z.ZodDefault<z.ZodOptional<z.ZodEnum<["observed", "inferred", "user_requested", "unknown"]>>>;
        evidenceId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        provenance: "observed" | "inferred" | "user_requested" | "unknown";
        fields: {
            name: string;
            type: "String" | "Int" | "Boolean" | "DateTime" | "Float";
            isRequired: boolean;
            isId: boolean;
            provenance: "observed" | "inferred" | "user_requested" | "unknown";
            defaultValue?: any;
            description?: string | undefined;
            evidenceId?: string | undefined;
        }[];
        description?: string | undefined;
        evidenceId?: string | undefined;
    }, {
        name: string;
        fields: {
            name: string;
            type: "String" | "Int" | "Boolean" | "DateTime" | "Float";
            isRequired?: boolean | undefined;
            isId?: boolean | undefined;
            defaultValue?: any;
            description?: string | undefined;
            provenance?: "observed" | "inferred" | "user_requested" | "unknown" | undefined;
            evidenceId?: string | undefined;
        }[];
        description?: string | undefined;
        provenance?: "observed" | "inferred" | "user_requested" | "unknown" | undefined;
        evidenceId?: string | undefined;
    }>, "many">;
    operations: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        type: z.ZodEnum<["query", "action"]>;
        entities: z.ZodArray<z.ZodString, "many">;
        description: z.ZodOptional<z.ZodString>;
        provenance: z.ZodDefault<z.ZodOptional<z.ZodEnum<["observed", "inferred", "user_requested", "unknown"]>>>;
        evidenceId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        type: "query" | "action";
        provenance: "observed" | "inferred" | "user_requested" | "unknown";
        entities: string[];
        description?: string | undefined;
        evidenceId?: string | undefined;
    }, {
        name: string;
        type: "query" | "action";
        entities: string[];
        description?: string | undefined;
        provenance?: "observed" | "inferred" | "user_requested" | "unknown" | undefined;
        evidenceId?: string | undefined;
    }>, "many">;
    routes: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        path: z.ZodString;
        component: z.ZodString;
        isProtected: z.ZodDefault<z.ZodBoolean>;
        provenance: z.ZodDefault<z.ZodOptional<z.ZodEnum<["observed", "inferred", "user_requested", "unknown"]>>>;
        evidenceId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        provenance: "observed" | "inferred" | "user_requested" | "unknown";
        path: string;
        component: string;
        isProtected: boolean;
        evidenceId?: string | undefined;
    }, {
        name: string;
        path: string;
        component: string;
        provenance?: "observed" | "inferred" | "user_requested" | "unknown" | undefined;
        evidenceId?: string | undefined;
        isProtected?: boolean | undefined;
    }>, "many">;
    workflows: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        name: z.ZodString;
        description: z.ZodString;
        trigger: z.ZodString;
        steps: z.ZodArray<z.ZodObject<{
            step: z.ZodNumber;
            action: z.ZodString;
            targetComponent: z.ZodOptional<z.ZodString>;
            expectedOutcome: z.ZodString;
            provenance: z.ZodDefault<z.ZodEnum<["observed", "inferred", "user_requested", "unknown"]>>;
            evidenceId: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            provenance: "observed" | "inferred" | "user_requested" | "unknown";
            action: string;
            step: number;
            expectedOutcome: string;
            evidenceId?: string | undefined;
            targetComponent?: string | undefined;
        }, {
            action: string;
            step: number;
            expectedOutcome: string;
            provenance?: "observed" | "inferred" | "user_requested" | "unknown" | undefined;
            evidenceId?: string | undefined;
            targetComponent?: string | undefined;
        }>, "many">;
        acceptanceCriteria: z.ZodArray<z.ZodString, "many">;
        provenance: z.ZodDefault<z.ZodEnum<["observed", "inferred", "user_requested", "unknown"]>>;
        evidenceId: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        description: string;
        provenance: "observed" | "inferred" | "user_requested" | "unknown";
        id: string;
        trigger: string;
        steps: {
            provenance: "observed" | "inferred" | "user_requested" | "unknown";
            action: string;
            step: number;
            expectedOutcome: string;
            evidenceId?: string | undefined;
            targetComponent?: string | undefined;
        }[];
        acceptanceCriteria: string[];
        evidenceId?: string | undefined;
    }, {
        name: string;
        description: string;
        id: string;
        trigger: string;
        steps: {
            action: string;
            step: number;
            expectedOutcome: string;
            provenance?: "observed" | "inferred" | "user_requested" | "unknown" | undefined;
            evidenceId?: string | undefined;
            targetComponent?: string | undefined;
        }[];
        acceptanceCriteria: string[];
        provenance?: "observed" | "inferred" | "user_requested" | "unknown" | undefined;
        evidenceId?: string | undefined;
    }>, "many">>>;
    coverageAssessment: z.ZodOptional<z.ZodObject<{
        totalWorkflows: z.ZodNumber;
        observedWorkflows: z.ZodNumber;
        inferredWorkflows: z.ZodNumber;
        unknownWorkflows: z.ZodNumber;
        blockedByMissingProviders: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
        confidenceScore: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        totalWorkflows: number;
        observedWorkflows: number;
        inferredWorkflows: number;
        unknownWorkflows: number;
        blockedByMissingProviders: string[];
        confidenceScore: number;
    }, {
        totalWorkflows: number;
        observedWorkflows: number;
        inferredWorkflows: number;
        unknownWorkflows: number;
        confidenceScore: number;
        blockedByMissingProviders?: string[] | undefined;
    }>>;
    auth: z.ZodDefault<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        methods: z.ZodDefault<z.ZodArray<z.ZodString, "many">>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        methods: string[];
    }, {
        enabled?: boolean | undefined;
        methods?: string[] | undefined;
    }>>;
    metadata: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    description: string;
    entities: {
        name: string;
        provenance: "observed" | "inferred" | "user_requested" | "unknown";
        fields: {
            name: string;
            type: "String" | "Int" | "Boolean" | "DateTime" | "Float";
            isRequired: boolean;
            isId: boolean;
            provenance: "observed" | "inferred" | "user_requested" | "unknown";
            defaultValue?: any;
            description?: string | undefined;
            evidenceId?: string | undefined;
        }[];
        description?: string | undefined;
        evidenceId?: string | undefined;
    }[];
    title: string;
    targetEngine: "wasp" | "fullstack-node" | "auto";
    operations: {
        name: string;
        type: "query" | "action";
        provenance: "observed" | "inferred" | "user_requested" | "unknown";
        entities: string[];
        description?: string | undefined;
        evidenceId?: string | undefined;
    }[];
    routes: {
        name: string;
        provenance: "observed" | "inferred" | "user_requested" | "unknown";
        path: string;
        component: string;
        isProtected: boolean;
        evidenceId?: string | undefined;
    }[];
    workflows: {
        name: string;
        description: string;
        provenance: "observed" | "inferred" | "user_requested" | "unknown";
        id: string;
        trigger: string;
        steps: {
            provenance: "observed" | "inferred" | "user_requested" | "unknown";
            action: string;
            step: number;
            expectedOutcome: string;
            evidenceId?: string | undefined;
            targetComponent?: string | undefined;
        }[];
        acceptanceCriteria: string[];
        evidenceId?: string | undefined;
    }[];
    auth: {
        enabled: boolean;
        methods: string[];
    };
    capabilities?: string[] | undefined;
    coverageAssessment?: {
        totalWorkflows: number;
        observedWorkflows: number;
        inferredWorkflows: number;
        unknownWorkflows: number;
        blockedByMissingProviders: string[];
        confidenceScore: number;
    } | undefined;
    metadata?: Record<string, any> | undefined;
}, {
    name: string;
    description: string;
    entities: {
        name: string;
        fields: {
            name: string;
            type: "String" | "Int" | "Boolean" | "DateTime" | "Float";
            isRequired?: boolean | undefined;
            isId?: boolean | undefined;
            defaultValue?: any;
            description?: string | undefined;
            provenance?: "observed" | "inferred" | "user_requested" | "unknown" | undefined;
            evidenceId?: string | undefined;
        }[];
        description?: string | undefined;
        provenance?: "observed" | "inferred" | "user_requested" | "unknown" | undefined;
        evidenceId?: string | undefined;
    }[];
    title: string;
    operations: {
        name: string;
        type: "query" | "action";
        entities: string[];
        description?: string | undefined;
        provenance?: "observed" | "inferred" | "user_requested" | "unknown" | undefined;
        evidenceId?: string | undefined;
    }[];
    routes: {
        name: string;
        path: string;
        component: string;
        provenance?: "observed" | "inferred" | "user_requested" | "unknown" | undefined;
        evidenceId?: string | undefined;
        isProtected?: boolean | undefined;
    }[];
    targetEngine?: "wasp" | "fullstack-node" | "auto" | undefined;
    capabilities?: string[] | undefined;
    workflows?: {
        name: string;
        description: string;
        id: string;
        trigger: string;
        steps: {
            action: string;
            step: number;
            expectedOutcome: string;
            provenance?: "observed" | "inferred" | "user_requested" | "unknown" | undefined;
            evidenceId?: string | undefined;
            targetComponent?: string | undefined;
        }[];
        acceptanceCriteria: string[];
        provenance?: "observed" | "inferred" | "user_requested" | "unknown" | undefined;
        evidenceId?: string | undefined;
    }[] | undefined;
    coverageAssessment?: {
        totalWorkflows: number;
        observedWorkflows: number;
        inferredWorkflows: number;
        unknownWorkflows: number;
        confidenceScore: number;
        blockedByMissingProviders?: string[] | undefined;
    } | undefined;
    auth?: {
        enabled?: boolean | undefined;
        methods?: string[] | undefined;
    } | undefined;
    metadata?: Record<string, any> | undefined;
}>;
export type FieldType = z.infer<typeof FieldTypeSchema>;
export type Provenance = z.infer<typeof ProvenanceSchema>;
export type EntityField = z.infer<typeof EntityFieldSchema>;
export type EntityModel = z.infer<typeof EntityModelSchema>;
export type Operation = z.infer<typeof OperationSchema>;
export type Route = z.infer<typeof RouteSchema>;
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;
export type AppWorkflow = z.infer<typeof AppWorkflowSchema>;
export type CoverageAssessment = z.infer<typeof CoverageAssessmentSchema>;
export type TargetEngine = z.infer<typeof TargetEngineSchema>;
export type ForgeSpec = z.infer<typeof ForgeSpecSchema>;
