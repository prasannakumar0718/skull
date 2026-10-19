import { z } from "zod";
export const FieldTypeSchema = z.enum([
    "String",
    "Int",
    "Boolean",
    "DateTime",
    "Float"
]);
export const EntityFieldSchema = z.object({
    name: z.string(),
    type: FieldTypeSchema,
    isRequired: z.boolean().optional().default(true),
    isId: z.boolean().optional().default(false),
    defaultValue: z.any().optional(),
    description: z.string().optional()
});
export const EntityModelSchema = z.object({
    name: z.string(),
    fields: z.array(EntityFieldSchema),
    description: z.string().optional()
});
export const OperationTypeSchema = z.enum(["query", "action"]);
export const OperationSchema = z.object({
    name: z.string(),
    type: OperationTypeSchema,
    entities: z.array(z.string()),
    description: z.string().optional()
});
export const RouteSchema = z.object({
    name: z.string(),
    path: z.string(),
    component: z.string(),
    isProtected: z.boolean().default(false)
});
export const TargetEngineSchema = z.enum(["wasp", "fullstack-node", "auto"]);
export const ForgeSpecSchema = z.object({
    name: z.string().min(1).regex(/^[a-zA-Z0-9_-]+$/, "Name must be alphanumeric with dashes or underscores"),
    title: z.string().min(1),
    description: z.string(),
    targetEngine: TargetEngineSchema.default("auto"),
    entities: z.array(EntityModelSchema),
    operations: z.array(OperationSchema),
    routes: z.array(RouteSchema),
    auth: z.object({
        enabled: z.boolean().default(false),
        methods: z.array(z.string()).default(["usernameAndPassword"])
    }).default({ enabled: false, methods: ["usernameAndPassword"] }),
    metadata: z.record(z.any()).optional()
});
