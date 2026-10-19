import { ForgeSpec, ForgeSpecSchema } from "./schema.js";

export interface SpecValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateForgeSpec(data: unknown): { spec?: ForgeSpec; result: SpecValidationResult } {
  const parseResult = ForgeSpecSchema.safeParse(data);
  const errors: string[] = [];
  const warnings: string[] = [];

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
  const routePaths = new Set<string>();
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
 * Natural language intent parser for application synthesis.
 * Supports diverse application domains: Task/Todo, Fee/Financial, E-Commerce, Blog/Publishing, and Generic.
 * Injects explicit domain and inferred assumptions metadata.
 */
export function createSpecFromPrompt(prompt: string, appName: string = "app"): ForgeSpec {
  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    throw new Error("Application prompt cannot be empty or whitespace");
  }

  const cleanPrompt = prompt.trim();
  const sanitizedName = (appName || "app")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "forge-app";

  // Domain 1: Fee, Expense, Finance Tracker
  if (/fee|expense|cost|finance|invoice|payment|budget/i.test(cleanPrompt)) {
    return {
      name: sanitizedName,
      title: "Fee & Expense Tracker",
      description: cleanPrompt,
      targetEngine: "auto",
      entities: [
        {
          name: "Expense",
          description: "A financial fee or expense entry",
          fields: [
            { name: "id", type: "Int", isId: true, isRequired: true },
            { name: "title", type: "String", isId: false, isRequired: true },
            { name: "amount", type: "Float", isId: false, isRequired: true },
            { name: "category", type: "String", isId: false, isRequired: true },
            { name: "isPaid", type: "Boolean", isId: false, isRequired: true, defaultValue: false },
            { name: "createdAt", type: "DateTime", isId: false, isRequired: true }
          ]
        }
      ],
      operations: [
        { name: "getExpenses", type: "query", entities: ["Expense"], description: "Fetch all expenses" },
        { name: "createExpense", type: "action", entities: ["Expense"], description: "Record new expense" },
        { name: "togglePaid", type: "action", entities: ["Expense"], description: "Toggle paid status" },
        { name: "deleteExpense", type: "action", entities: ["Expense"], description: "Delete expense record" }
      ],
      routes: [
        { name: "HomeRoute", path: "/", component: "ExpensesPage", isProtected: false }
      ],
      auth: {
        enabled: false,
        methods: ["usernameAndPassword"]
      },
      metadata: {
        domain: "financial",
        inferredAssumptions: [
          "Inferred financial entity 'Expense' with monetary field amount (Float) and payment status isPaid",
          "Assumed single-tenant local SQLite database backend",
          "Inferred CRUD operations for tracking payments and categorization"
        ]
      }
    };
  }

  // Domain 2: E-Commerce / Inventory Catalog
  if (/commerce|shop|store|product|inventory|catalog|stock/i.test(cleanPrompt)) {
    return {
      name: sanitizedName,
      title: "Product Inventory Manager",
      description: cleanPrompt,
      targetEngine: "auto",
      entities: [
        {
          name: "Product",
          description: "An inventory product with pricing and stock levels",
          fields: [
            { name: "id", type: "Int", isId: true, isRequired: true },
            { name: "name", type: "String", isId: false, isRequired: true },
            { name: "sku", type: "String", isId: false, isRequired: true },
            { name: "price", type: "Float", isId: false, isRequired: true },
            { name: "stockQuantity", type: "Int", isId: false, isRequired: true, defaultValue: 0 },
            { name: "category", type: "String", isId: false, isRequired: false },
            { name: "createdAt", type: "DateTime", isId: false, isRequired: true }
          ]
        }
      ],
      operations: [
        { name: "getProducts", type: "query", entities: ["Product"], description: "List catalog products" },
        { name: "createProduct", type: "action", entities: ["Product"], description: "Add new product" },
        { name: "updateStock", type: "action", entities: ["Product"], description: "Update product inventory count" },
        { name: "deleteProduct", type: "action", entities: ["Product"], description: "Remove product" }
      ],
      routes: [
        { name: "HomeRoute", path: "/", component: "InventoryPage", isProtected: false }
      ],
      auth: {
        enabled: false,
        methods: ["usernameAndPassword"]
      },
      metadata: {
        domain: "e-commerce",
        inferredAssumptions: [
          "Inferred e-commerce inventory entity 'Product' with sku, price (Float), and stockQuantity (Int)",
          "Assumed single-store catalog model without multi-currency",
          "Inferred inventory management actions for stock adjustments"
        ]
      }
    };
  }

  // Domain 3: Personal Blog with Comments
  if (/blog|article|post|news|editorial/i.test(cleanPrompt)) {
    return {
      name: sanitizedName,
      title: "Blog Publishing Platform",
      description: cleanPrompt,
      targetEngine: "auto",
      entities: [
        {
          name: "Post",
          description: "An authored publication post",
          fields: [
            { name: "id", type: "Int", isId: true, isRequired: true },
            { name: "title", type: "String", isId: false, isRequired: true },
            { name: "content", type: "String", isId: false, isRequired: true },
            { name: "author", type: "String", isId: false, isRequired: true },
            { name: "createdAt", type: "DateTime", isId: false, isRequired: true }
          ]
        },
        {
          name: "Comment",
          description: "A user comment associated with a blog post",
          fields: [
            { name: "id", type: "Int", isId: true, isRequired: true },
            { name: "postId", type: "Int", isId: false, isRequired: true },
            { name: "author", type: "String", isId: false, isRequired: true },
            { name: "content", type: "String", isId: false, isRequired: true },
            { name: "createdAt", type: "DateTime", isId: false, isRequired: true }
          ]
        }
      ],
      operations: [
        { name: "getPosts", type: "query", entities: ["Post"], description: "Fetch blog posts" },
        { name: "createPost", type: "action", entities: ["Post"], description: "Publish new post" },
        { name: "getComments", type: "query", entities: ["Comment"], description: "Fetch comments" },
        { name: "createComment", type: "action", entities: ["Comment"], description: "Add comment" }
      ],
      routes: [
        { name: "HomeRoute", path: "/", component: "BlogFeedPage", isProtected: false }
      ],
      auth: {
        enabled: false,
        methods: ["usernameAndPassword"]
      },
      metadata: {
        domain: "blog",
        inferredAssumptions: [
          "Inferred relational content domain with Post and Comment entities",
          "Assumed 1-to-many relationship linked by postId foreign key",
          "Inferred public unauthenticated read and comment creation"
        ]
      }
    };
  }

  // Domain 4: Task / Todo / Checklist Manager (Default task domain)
  if (/task|todo|job|checklist/i.test(cleanPrompt)) {
    return {
      name: sanitizedName,
      title: "Task Manager Application",
      description: cleanPrompt,
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
      },
      metadata: {
        domain: "task-manager",
        inferredAssumptions: [
          "Inferred task tracking entity 'Task' with completion flag isDone",
          "Assumed persistent storage requirement",
          "Inferred standard CRUD operations"
        ]
      }
    };
  }

  // Domain 5: Generic data record fallback
  return {
    name: sanitizedName,
    title: `${appName} Application`,
    description: cleanPrompt,
    targetEngine: "auto",
    entities: [
      {
        name: "Record",
        description: "Generic persistent record item",
        fields: [
          { name: "id", type: "Int", isId: true, isRequired: true },
          { name: "title", type: "String", isId: false, isRequired: true },
          { name: "notes", type: "String", isId: false, isRequired: false },
          { name: "createdAt", type: "DateTime", isId: false, isRequired: true }
        ]
      }
    ],
    operations: [
      { name: "getRecords", type: "query", entities: ["Record"], description: "Fetch records" },
      { name: "createRecord", type: "action", entities: ["Record"], description: "Create record" },
      { name: "deleteRecord", type: "action", entities: ["Record"], description: "Delete record" }
    ],
    routes: [
      { name: "HomeRoute", path: "/", component: "MainPage", isProtected: false }
    ],
    auth: {
      enabled: false,
      methods: ["usernameAndPassword"]
    },
    metadata: {
      domain: "generic",
      inferredAssumptions: [
        "Inferred generic persistent data record entity 'Record'",
        "Assumed unauthenticated local dev storage",
        "Inferred generic CRUD operations"
      ]
    }
  };
}
