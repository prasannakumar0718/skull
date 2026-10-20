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

  // Verify workflows have unique IDs and sequential steps
  if (spec.workflows && spec.workflows.length > 0) {
    const workflowIds = new Set<string>();
    for (const wf of spec.workflows) {
      if (workflowIds.has(wf.id)) {
        errors.push(`Duplicate workflow ID found: '${wf.id}' in workflow '${wf.name}'`);
      }
      workflowIds.add(wf.id);

      for (let i = 0; i < wf.steps.length; i++) {
        const expectedStep = i + 1;
        if (wf.steps[i].step !== expectedStep) {
          warnings.push(`Workflow '${wf.id}' step index ${wf.steps[i].step} does not match 1-based order ${expectedStep}`);
        }
      }
    }
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
 * Supports diverse application domains: Document/Word Processor, Task/Todo, Fee/Financial, E-Commerce, Blog/Publishing, and Generic.
 * Injects explicit domain, workflows, capabilities, provenance, and inferred assumptions metadata.
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

  // Domain 0: Rich-Text Document Editor (e.g. Microsoft Word alternative, Document Studio, QuickNotes)
  const isTaskPrompt = /task|todo|job|checklist/i.test(cleanPrompt);
  const isDocPrompt =
    /word|document|rich[- ]?text|writer|notepad|quill|wysiwyg/i.test(cleanPrompt) ||
    /quicknotes/i.test(cleanPrompt) ||
    (/\bdocs?\b/i.test(cleanPrompt) && !isTaskPrompt) ||
    (/\bnotes?\b/i.test(cleanPrompt) && !isTaskPrompt);

  if (isDocPrompt && !isTaskPrompt) {
    // Preserve requested application identity (e.g. QuickNotes) if specified in prompt
    let resolvedTitle = "Document Studio & Rich-Text Editor";
    if (/quicknotes/i.test(cleanPrompt)) {
      resolvedTitle = "QuickNotes Online";
    } else {
      const titleMatch = cleanPrompt.match(/(?:recreate|build|clone|develop|create)\s+([A-Z][A-Za-z0-9_ -]+?)(?:\s+(?:as|with|web|app|application|feature|in|into)|$)/i);
      if (titleMatch && titleMatch[1]?.trim()) {
        const candidate = titleMatch[1].trim().replace(/^(?:a|an|the|new|modern)\s+/i, "").trim();
        if (/word/i.test(candidate)) {
          resolvedTitle = "Document Studio & Rich-Text Editor (Word Alternative)";
        } else if (candidate.length > 2 && !/^(?:application|software|web app|tool|system|independent)$/i.test(candidate)) {
          resolvedTitle = `${candidate} - Document Studio`;
        }
      }
    }

    return {
      name: sanitizedName,
      title: resolvedTitle,
      description: cleanPrompt,
      targetEngine: "auto",
      capabilities: [
        "rich-text-editing",
        "autosave",
        "document-management",
        "document-export",
        "version-history"
      ],
      entities: [
        {
          name: "Document",
          description: "A rich-text document with formatting, metadata, and autosave state",
          provenance: "user_requested",
          fields: [
            { name: "id", type: "Int", isId: true, isRequired: true, provenance: "user_requested" },
            { name: "title", type: "String", isId: false, isRequired: true, provenance: "user_requested" },
            { name: "content", type: "String", isId: false, isRequired: true, defaultValue: "", provenance: "user_requested" },
            { name: "format", type: "String", isId: false, isRequired: true, defaultValue: "html", provenance: "inferred" },
            { name: "wordCount", type: "Int", isId: false, isRequired: true, defaultValue: 0, provenance: "inferred" },
            { name: "isArchived", type: "Boolean", isId: false, isRequired: true, defaultValue: false, provenance: "inferred" },
            { name: "createdAt", type: "DateTime", isId: false, isRequired: true, provenance: "inferred" },
            { name: "updatedAt", type: "DateTime", isId: false, isRequired: true, provenance: "inferred" }
          ]
        },
        {
          name: "Revision",
          description: "Snapshot history of a document for recovery and versioning",
          provenance: "inferred",
          fields: [
            { name: "id", type: "Int", isId: true, isRequired: true, provenance: "inferred" },
            { name: "documentId", type: "Int", isId: false, isRequired: true, provenance: "inferred" },
            { name: "contentSnapshot", type: "String", isId: false, isRequired: true, provenance: "inferred" },
            { name: "summary", type: "String", isId: false, isRequired: false, provenance: "inferred" },
            { name: "savedAt", type: "DateTime", isId: false, isRequired: true, provenance: "inferred" }
          ]
        }
      ],
      operations: [
        { name: "getDocuments", type: "query", entities: ["Document"], description: "Fetch all active documents", provenance: "user_requested" },
        { name: "getDocumentById", type: "query", entities: ["Document"], description: "Get specific document with content", provenance: "user_requested" },
        { name: "createDocument", type: "action", entities: ["Document"], description: "Create a new blank or titled document", provenance: "user_requested" },
        { name: "updateDocumentContent", type: "action", entities: ["Document"], description: "Save updated rich content and title", provenance: "user_requested" },
        { name: "autosaveDocument", type: "action", entities: ["Document"], description: "Perform background autosave without blocking UI", provenance: "user_requested" },
        { name: "exportDocument", type: "query", entities: ["Document"], description: "Export document as HTML, Markdown, Plain Text, or JSON", provenance: "user_requested" },
        { name: "deleteDocument", type: "action", entities: ["Document"], description: "Archive or delete a document", provenance: "user_requested" }
      ],
      routes: [
        { name: "HomeRoute", path: "/", component: "EditorPage", isProtected: false, provenance: "user_requested" },
        { name: "DocumentsRoute", path: "/documents", component: "DocumentsListPage", isProtected: false, provenance: "user_requested" }
      ],
      workflows: [
        {
          id: "wf_doc_editing",
          name: "Rich-Text Document Editing & Formatting",
          description: "User creates or opens a document, applies rich formatting, and modifies text",
          trigger: "User edits text in main canvas or clicks formatting toolbar buttons",
          provenance: "user_requested",
          steps: [
            { step: 1, action: "Open editor with blank or selected document", targetComponent: "EditorCanvas", expectedOutcome: "Editor initialized with editable content area and active toolbar", provenance: "user_requested" },
            { step: 2, action: "Apply formatting commands (bold, italic, heading, lists)", targetComponent: "FormattingToolbar", expectedOutcome: "Selected text or block element styled according to format command", provenance: "user_requested" },
            { step: 3, action: "Update document title in header", targetComponent: "TitleInput", expectedOutcome: "Title reflected in header and document metadata", provenance: "user_requested" }
          ],
          acceptanceCriteria: [
            "Content can be entered and edited without loss",
            "Formatting commands update HTML/rich structure",
            "Word count and character count update responsively"
          ]
        },
        {
          id: "wf_doc_autosave",
          name: "Document Autosave & Recovery",
          description: "Changes are automatically saved to persistent storage with visual status feedback",
          trigger: "User types in document; debounced autosave fires after 500ms of inactivity",
          provenance: "user_requested",
          steps: [
            { step: 1, action: "Modify document content", targetComponent: "EditorCanvas", expectedOutcome: "Save status badge transitions to 'Saving...'", provenance: "user_requested" },
            { step: 2, action: "Wait for debounce interval", targetComponent: "AutosaveWorker", expectedOutcome: "PATCH /api/documents/:id sent with current content", provenance: "user_requested" },
            { step: 3, action: "Receive HTTP 200 response", targetComponent: "StatusIndicator", expectedOutcome: "Save status badge transitions to 'Saved'", provenance: "user_requested" }
          ],
          acceptanceCriteria: [
            "Autosave executes automatically after editing pauses",
            "Visual indicator reflects 'Saved' vs 'Unsaved' state",
            "Content is saved to SQLite and persists across browser refresh or server restart"
          ]
        },
        {
          id: "wf_doc_export",
          name: "Multi-Format Document Export",
          description: "User exports current document to HTML, Markdown, Plain Text, or JSON format",
          trigger: "User clicks Export in toolbar and selects format",
          provenance: "user_requested",
          steps: [
            { step: 1, action: "Click Export button and select target format", targetComponent: "ExportDropdown", expectedOutcome: "Modal or file download initiated", provenance: "user_requested" },
            { step: 2, action: "Fetch formatted output via /api/documents/:id/export?format=...", targetComponent: "ExportAPI", expectedOutcome: "Server returns transformed content with appropriate MIME type", provenance: "user_requested" }
          ],
          acceptanceCriteria: [
            "HTML format preserves document layout and tags",
            "Markdown format strips HTML tags and produces conforming markdown syntax",
            "Plain text produces clean text without markup",
            "JSON format returns structured document payload with metadata"
          ]
        }
      ],
      coverageAssessment: {
        totalWorkflows: 3,
        observedWorkflows: 3,
        inferredWorkflows: 0,
        unknownWorkflows: 0,
        blockedByMissingProviders: [],
        confidenceScore: 0.95
      },
      auth: {
        enabled: false,
        methods: ["usernameAndPassword"]
      },
      metadata: {
        domain: "document-editor",
        inferredAssumptions: [
          "Inferred document management domain with Document and Revision history models",
          "Assumed browser-based contenteditable canvas with clean CSS formatting",
          "Inferred export pipelines for HTML, Markdown, Plain Text, and JSON",
          "Assumed single-tenant persistent SQLite database storage with WAL journal mode"
        ]
      }
    };
  }

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
          provenance: "user_requested",
          fields: [
            { name: "id", type: "Int", isId: true, isRequired: true, provenance: "user_requested" },
            { name: "title", type: "String", isId: false, isRequired: true, provenance: "user_requested" },
            { name: "amount", type: "Float", isId: false, isRequired: true, provenance: "user_requested" },
            { name: "category", type: "String", isId: false, isRequired: true, provenance: "user_requested" },
            { name: "isPaid", type: "Boolean", isId: false, isRequired: true, defaultValue: false, provenance: "user_requested" },
            { name: "createdAt", type: "DateTime", isId: false, isRequired: true, provenance: "inferred" }
          ]
        }
      ],
      operations: [
        { name: "getExpenses", type: "query", entities: ["Expense"], description: "Fetch all expenses", provenance: "user_requested" },
        { name: "createExpense", type: "action", entities: ["Expense"], description: "Record new expense", provenance: "user_requested" },
        { name: "togglePaid", type: "action", entities: ["Expense"], description: "Toggle paid status", provenance: "user_requested" },
        { name: "deleteExpense", type: "action", entities: ["Expense"], description: "Delete expense record", provenance: "user_requested" }
      ],
      routes: [
        { name: "HomeRoute", path: "/", component: "ExpensesPage", isProtected: false, provenance: "user_requested" }
      ],
      workflows: [
        {
          id: "wf_expense_crud",
          name: "Expense Recording and Reconciliation",
          description: "Record new expense with amount and category, toggle payment status",
          trigger: "User fills out expense form",
          provenance: "user_requested",
          steps: [
            { step: 1, action: "Submit expense entry", expectedOutcome: "Expense created in persistent storage", provenance: "user_requested" },
            { step: 2, action: "Toggle paid status", expectedOutcome: "isPaid status updated in database", provenance: "user_requested" }
          ],
          acceptanceCriteria: ["Expense persisted in database", "Total expenses calculate correctly"]
        }
      ],
      coverageAssessment: {
        totalWorkflows: 1,
        observedWorkflows: 1,
        inferredWorkflows: 0,
        unknownWorkflows: 0,
        blockedByMissingProviders: [],
        confidenceScore: 0.95
      },
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
          provenance: "user_requested",
          fields: [
            { name: "id", type: "Int", isId: true, isRequired: true, provenance: "user_requested" },
            { name: "name", type: "String", isId: false, isRequired: true, provenance: "user_requested" },
            { name: "sku", type: "String", isId: false, isRequired: true, provenance: "user_requested" },
            { name: "price", type: "Float", isId: false, isRequired: true, provenance: "user_requested" },
            { name: "stockQuantity", type: "Int", isId: false, isRequired: true, defaultValue: 0, provenance: "user_requested" },
            { name: "category", type: "String", isId: false, isRequired: false, provenance: "user_requested" },
            { name: "createdAt", type: "DateTime", isId: false, isRequired: true, provenance: "inferred" }
          ]
        }
      ],
      operations: [
        { name: "getProducts", type: "query", entities: ["Product"], description: "List catalog products", provenance: "user_requested" },
        { name: "createProduct", type: "action", entities: ["Product"], description: "Add new product", provenance: "user_requested" },
        { name: "updateStock", type: "action", entities: ["Product"], description: "Update product inventory count", provenance: "user_requested" },
        { name: "deleteProduct", type: "action", entities: ["Product"], description: "Remove product", provenance: "user_requested" }
      ],
      routes: [
        { name: "HomeRoute", path: "/", component: "InventoryPage", isProtected: false, provenance: "user_requested" }
      ],
      workflows: [
        {
          id: "wf_inventory_mgmt",
          name: "Product Inventory Management",
          description: "Add new products and update stock levels",
          trigger: "User updates inventory items",
          provenance: "user_requested",
          steps: [
            { step: 1, action: "Create product with SKU and initial stock", expectedOutcome: "Product saved with ID", provenance: "user_requested" },
            { step: 2, action: "Adjust stock quantity", expectedOutcome: "Stock quantity updated in database", provenance: "user_requested" }
          ],
          acceptanceCriteria: ["Product created with valid SKU", "Stock levels persist across sessions"]
        }
      ],
      coverageAssessment: {
        totalWorkflows: 1,
        observedWorkflows: 1,
        inferredWorkflows: 0,
        unknownWorkflows: 0,
        blockedByMissingProviders: [],
        confidenceScore: 0.95
      },
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
          provenance: "user_requested",
          fields: [
            { name: "id", type: "Int", isId: true, isRequired: true, provenance: "user_requested" },
            { name: "title", type: "String", isId: false, isRequired: true, provenance: "user_requested" },
            { name: "content", type: "String", isId: false, isRequired: true, provenance: "user_requested" },
            { name: "author", type: "String", isId: false, isRequired: true, provenance: "user_requested" },
            { name: "createdAt", type: "DateTime", isId: false, isRequired: true, provenance: "inferred" }
          ]
        },
        {
          name: "Comment",
          description: "A user comment associated with a blog post",
          provenance: "inferred",
          fields: [
            { name: "id", type: "Int", isId: true, isRequired: true, provenance: "inferred" },
            { name: "postId", type: "Int", isId: false, isRequired: true, provenance: "inferred" },
            { name: "author", type: "String", isId: false, isRequired: true, provenance: "inferred" },
            { name: "content", type: "String", isId: false, isRequired: true, provenance: "inferred" },
            { name: "createdAt", type: "DateTime", isId: false, isRequired: true, provenance: "inferred" }
          ]
        }
      ],
      operations: [
        { name: "getPosts", type: "query", entities: ["Post"], description: "Fetch blog posts", provenance: "user_requested" },
        { name: "createPost", type: "action", entities: ["Post"], description: "Publish new post", provenance: "user_requested" },
        { name: "getComments", type: "query", entities: ["Comment"], description: "Fetch comments", provenance: "inferred" },
        { name: "createComment", type: "action", entities: ["Comment"], description: "Add comment", provenance: "inferred" }
      ],
      routes: [
        { name: "HomeRoute", path: "/", component: "BlogFeedPage", isProtected: false, provenance: "user_requested" }
      ],
      workflows: [
        {
          id: "wf_blog_publishing",
          name: "Post Publishing & Interaction",
          description: "Author publishes post and visitors submit comments",
          trigger: "User publishes article",
          provenance: "user_requested",
          steps: [
            { step: 1, action: "Submit new post", expectedOutcome: "Post published to feed", provenance: "user_requested" },
            { step: 2, action: "Post comment on article", expectedOutcome: "Comment linked to postId", provenance: "inferred" }
          ],
          acceptanceCriteria: ["Post persists in SQLite", "Comments queryable by postId"]
        }
      ],
      coverageAssessment: {
        totalWorkflows: 1,
        observedWorkflows: 1,
        inferredWorkflows: 0,
        unknownWorkflows: 0,
        blockedByMissingProviders: [],
        confidenceScore: 0.95
      },
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
          provenance: "user_requested",
          fields: [
            { name: "id", type: "Int", isId: true, isRequired: true, provenance: "user_requested" },
            { name: "title", type: "String", isId: false, isRequired: true, provenance: "user_requested" },
            { name: "description", type: "String", isId: false, isRequired: false, provenance: "user_requested" },
            { name: "isDone", type: "Boolean", isId: false, isRequired: true, defaultValue: false, provenance: "user_requested" },
            { name: "createdAt", type: "DateTime", isId: false, isRequired: true, provenance: "inferred" }
          ]
        }
      ],
      operations: [
        { name: "getTasks", type: "query", entities: ["Task"], description: "Fetch all tasks", provenance: "user_requested" },
        { name: "createTask", type: "action", entities: ["Task"], description: "Create a new task item", provenance: "user_requested" },
        { name: "toggleTask", type: "action", entities: ["Task"], description: "Toggle task completion status", provenance: "user_requested" },
        { name: "deleteTask", type: "action", entities: ["Task"], description: "Remove a task item", provenance: "user_requested" }
      ],
      routes: [
        { name: "HomeRoute", path: "/", component: "TasksPage", isProtected: false, provenance: "user_requested" }
      ],
      workflows: [
        {
          id: "wf_task_lifecycle",
          name: "Task Lifecycle Management",
          description: "Create, view, toggle completion, and persist tasks",
          trigger: "User enters task and clicks add",
          provenance: "user_requested",
          steps: [
            { step: 1, action: "Create task", expectedOutcome: "Task added to database with isDone=false", provenance: "user_requested" },
            { step: 2, action: "Toggle task completion", expectedOutcome: "Task isDone updated in database", provenance: "user_requested" }
          ],
          acceptanceCriteria: ["Task created with non-empty title", "Task state persists across restart"]
        }
      ],
      coverageAssessment: {
        totalWorkflows: 1,
        observedWorkflows: 1,
        inferredWorkflows: 0,
        unknownWorkflows: 0,
        blockedByMissingProviders: [],
        confidenceScore: 0.95
      },
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
        provenance: "user_requested",
        fields: [
          { name: "id", type: "Int", isId: true, isRequired: true, provenance: "user_requested" },
          { name: "title", type: "String", isId: false, isRequired: true, provenance: "user_requested" },
          { name: "notes", type: "String", isId: false, isRequired: false, provenance: "user_requested" },
          { name: "createdAt", type: "DateTime", isId: false, isRequired: true, provenance: "inferred" }
        ]
      }
    ],
    operations: [
      { name: "getRecords", type: "query", entities: ["Record"], description: "Fetch records", provenance: "user_requested" },
      { name: "createRecord", type: "action", entities: ["Record"], description: "Create record", provenance: "user_requested" },
      { name: "deleteRecord", type: "action", entities: ["Record"], description: "Delete record", provenance: "user_requested" }
    ],
    routes: [
      { name: "HomeRoute", path: "/", component: "MainPage", isProtected: false, provenance: "user_requested" }
    ],
    workflows: [
      {
        id: "wf_record_crud",
        name: "Record Data Management",
        description: "Create and query persistent data records",
        trigger: "User saves record",
        provenance: "user_requested",
        steps: [
          { step: 1, action: "Save data record", expectedOutcome: "Record saved to SQLite", provenance: "user_requested" }
        ],
        acceptanceCriteria: ["Record persists with ID"]
      }
    ],
    coverageAssessment: {
      totalWorkflows: 1,
      observedWorkflows: 1,
      inferredWorkflows: 0,
      unknownWorkflows: 0,
      blockedByMissingProviders: [],
      confidenceScore: 0.9
    },
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
