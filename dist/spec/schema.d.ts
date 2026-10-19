import { z } from "zod";
export declare const FieldTypeSchema: z.ZodEnum<["String", "Int", "Boolean", "DateTime", "Float"]>;
export declare const EntityFieldSchema: z.ZodObject<{
    name: z.ZodString;
    type: z.ZodEnum<["String", "Int", "Boolean", "DateTime", "Float"]>;
    isRequired: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    isId: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    defaultValue: z.ZodOptional<z.ZodAny>;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    type: "String" | "Int" | "Boolean" | "DateTime" | "Float";
    isRequired: boolean;
    isId: boolean;
    defaultValue?: any;
    description?: string | undefined;
}, {
    name: string;
    type: "String" | "Int" | "Boolean" | "DateTime" | "Float";
    isRequired?: boolean | undefined;
    isId?: boolean | undefined;
    defaultValue?: any;
    description?: string | undefined;
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
    }, "strip", z.ZodTypeAny, {
        name: string;
        type: "String" | "Int" | "Boolean" | "DateTime" | "Float";
        isRequired: boolean;
        isId: boolean;
        defaultValue?: any;
        description?: string | undefined;
    }, {
        name: string;
        type: "String" | "Int" | "Boolean" | "DateTime" | "Float";
        isRequired?: boolean | undefined;
        isId?: boolean | undefined;
        defaultValue?: any;
        description?: string | undefined;
    }>, "many">;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    fields: {
        name: string;
        type: "String" | "Int" | "Boolean" | "DateTime" | "Float";
        isRequired: boolean;
        isId: boolean;
        defaultValue?: any;
        description?: string | undefined;
    }[];
    description?: string | undefined;
}, {
    name: string;
    fields: {
        name: string;
        type: "String" | "Int" | "Boolean" | "DateTime" | "Float";
        isRequired?: boolean | undefined;
        isId?: boolean | undefined;
        defaultValue?: any;
        description?: string | undefined;
    }[];
    description?: string | undefined;
}>;
export declare const OperationTypeSchema: z.ZodEnum<["query", "action"]>;
export declare const OperationSchema: z.ZodObject<{
    name: z.ZodString;
    type: z.ZodEnum<["query", "action"]>;
    entities: z.ZodArray<z.ZodString, "many">;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name: string;
    type: "query" | "action";
    entities: string[];
    description?: string | undefined;
}, {
    name: string;
    type: "query" | "action";
    entities: string[];
    description?: string | undefined;
}>;
export declare const RouteSchema: z.ZodObject<{
    name: z.ZodString;
    path: z.ZodString;
    component: z.ZodString;
    isProtected: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    name: string;
    path: string;
    component: string;
    isProtected: boolean;
}, {
    name: string;
    path: string;
    component: string;
    isProtected?: boolean | undefined;
}>;
export declare const TargetEngineSchema: z.ZodEnum<["wasp", "fullstack-node", "auto"]>;
export declare const ForgeSpecSchema: z.ZodObject<{
    name: z.ZodString;
    title: z.ZodString;
    description: z.ZodString;
    targetEngine: z.ZodDefault<z.ZodEnum<["wasp", "fullstack-node", "auto"]>>;
    entities: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        fields: z.ZodArray<z.ZodObject<{
            name: z.ZodString;
            type: z.ZodEnum<["String", "Int", "Boolean", "DateTime", "Float"]>;
            isRequired: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            isId: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
            defaultValue: z.ZodOptional<z.ZodAny>;
            description: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            name: string;
            type: "String" | "Int" | "Boolean" | "DateTime" | "Float";
            isRequired: boolean;
            isId: boolean;
            defaultValue?: any;
            description?: string | undefined;
        }, {
            name: string;
            type: "String" | "Int" | "Boolean" | "DateTime" | "Float";
            isRequired?: boolean | undefined;
            isId?: boolean | undefined;
            defaultValue?: any;
            description?: string | undefined;
        }>, "many">;
        description: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        fields: {
            name: string;
            type: "String" | "Int" | "Boolean" | "DateTime" | "Float";
            isRequired: boolean;
            isId: boolean;
            defaultValue?: any;
            description?: string | undefined;
        }[];
        description?: string | undefined;
    }, {
        name: string;
        fields: {
            name: string;
            type: "String" | "Int" | "Boolean" | "DateTime" | "Float";
            isRequired?: boolean | undefined;
            isId?: boolean | undefined;
            defaultValue?: any;
            description?: string | undefined;
        }[];
        description?: string | undefined;
    }>, "many">;
    operations: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        type: z.ZodEnum<["query", "action"]>;
        entities: z.ZodArray<z.ZodString, "many">;
        description: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        type: "query" | "action";
        entities: string[];
        description?: string | undefined;
    }, {
        name: string;
        type: "query" | "action";
        entities: string[];
        description?: string | undefined;
    }>, "many">;
    routes: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        path: z.ZodString;
        component: z.ZodString;
        isProtected: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        name: string;
        path: string;
        component: string;
        isProtected: boolean;
    }, {
        name: string;
        path: string;
        component: string;
        isProtected?: boolean | undefined;
    }>, "many">;
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
        fields: {
            name: string;
            type: "String" | "Int" | "Boolean" | "DateTime" | "Float";
            isRequired: boolean;
            isId: boolean;
            defaultValue?: any;
            description?: string | undefined;
        }[];
        description?: string | undefined;
    }[];
    title: string;
    targetEngine: "wasp" | "fullstack-node" | "auto";
    operations: {
        name: string;
        type: "query" | "action";
        entities: string[];
        description?: string | undefined;
    }[];
    routes: {
        name: string;
        path: string;
        component: string;
        isProtected: boolean;
    }[];
    auth: {
        enabled: boolean;
        methods: string[];
    };
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
        }[];
        description?: string | undefined;
    }[];
    title: string;
    operations: {
        name: string;
        type: "query" | "action";
        entities: string[];
        description?: string | undefined;
    }[];
    routes: {
        name: string;
        path: string;
        component: string;
        isProtected?: boolean | undefined;
    }[];
    targetEngine?: "wasp" | "fullstack-node" | "auto" | undefined;
    auth?: {
        enabled?: boolean | undefined;
        methods?: string[] | undefined;
    } | undefined;
    metadata?: Record<string, any> | undefined;
}>;
export type FieldType = z.infer<typeof FieldTypeSchema>;
export type EntityField = z.infer<typeof EntityFieldSchema>;
export type EntityModel = z.infer<typeof EntityModelSchema>;
export type Operation = z.infer<typeof OperationSchema>;
export type Route = z.infer<typeof RouteSchema>;
export type TargetEngine = z.infer<typeof TargetEngineSchema>;
export type ForgeSpec = z.infer<typeof ForgeSpecSchema>;
