import { ForgeSpecSchema } from "./schema.js";
export function validateForgeSpec(data) {
    const parseResult = ForgeSpecSchema.safeParse(data);
    const errors = [];
    const warnings = [];
    if (!parseResult.success) {
        for (const issue of parseResult.error.issues) {
            errors.push(`[${issue.path.join(".")}] ${issue.message}`);
        }
        return {
            result: { valid: false, errors, warnings }
        };
    }
    const spec = parseResult.data;
    const entityNames = new Set(spec.entities.map((e) => e.name));
    // Verify operations reference valid entities
    for (const op of spec.operations) {
        for (const ent of op.entities) {
            if (!entityNames.has(ent)) {
                errors.push(`Operation '${op.name}' references undefined entity '${ent}'`);
            }
        }
    }
    // Verify routes have unique paths
    const routePaths = new Set();
    for (const r of spec.routes) {
        if (routePaths.has(r.path)) {
            errors.push(`Duplicate route path found: '${r.path}' in route '${r.name}'`);
        }
        routePaths.add(r.path);
    }
    // Warning check: entities should have at least one ID field
    for (const ent of spec.entities) {
        const hasId = ent.fields.some((f) => f.isId);
        if (!hasId) {
            warnings.push(`Entity '${ent.name}' does not have an explicit primary key (id). One will be generated.`);
        }
    }
    return {
        spec,
        result: {
            valid: errors.length === 0,
            errors,
            warnings
        }
    };
}
/**
 * Natural language intent parser for quick prototyping
 */
export function createSpecFromPrompt(prompt, appName = "TaskManager") {
    const isTaskManager = /task|todo|item|list|job/i.test(prompt);
    if (isTaskManager) {
        return {
            name: appName.toLowerCase().replace(/[^a-z0-9]/g, "-"),
            title: "Task Manager Application",
            description: prompt,
            targetEngine: "auto",
            entities: [
                {
                    name: "Task",
                    description: "A persistent task item with status and description",
                    fields: [
                        { name: "id", type: "Int", isId: true, isRequired: true },
                        { name: "title", type: "String", isId: false, isRequired: true },
                        { name: "description", type: "String", isId: false, isRequired: false },
                        { name: "isDone", type: "Boolean", isId: false, isRequired: true, defaultValue: false },
                        { name: "createdAt", type: "DateTime", isId: false, isRequired: true }
                    ]
                }
            ],
            operations: [
                { name: "getTasks", type: "query", entities: ["Task"], description: "Fetch all tasks" },
                { name: "createTask", type: "action", entities: ["Task"], description: "Create a new task item" },
                { name: "toggleTask", type: "action", entities: ["Task"], description: "Toggle task completion status" },
                { name: "deleteTask", type: "action", entities: ["Task"], description: "Remove a task item" }
            ],
            routes: [
                { name: "HomeRoute", path: "/", component: "TasksPage", isProtected: false }
            ],
            auth: {
                enabled: false,
                methods: ["usernameAndPassword"]
            }
        };
    }
    // Default generic data item specification
    return {
        name: appName.toLowerCase().replace(/[^a-z0-9]/g, "-"),
        title: `${appName} App`,
        description: prompt,
        targetEngine: "auto",
        entities: [
            {
                name: "Item",
                description: "Generic persistent record",
                fields: [
                    { name: "id", type: "Int", isId: true, isRequired: true },
                    { name: "name", type: "String", isId: false, isRequired: true },
                    { name: "createdAt", type: "DateTime", isId: false, isRequired: true }
                ]
            }
        ],
        operations: [
            { name: "getItems", type: "query", entities: ["Item"], description: "Fetch records" },
            { name: "createItem", type: "action", entities: ["Item"], description: "Create record" }
        ],
        routes: [
            { name: "HomeRoute", path: "/", component: "MainPage", isProtected: false }
        ],
        auth: {
            enabled: false,
            methods: ["usernameAndPassword"]
        }
    };
}
