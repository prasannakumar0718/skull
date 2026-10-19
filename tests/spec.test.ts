import { describe, it, expect } from "vitest";
import { createSpecFromPrompt, validateForgeSpec } from "../src/spec/validator.js";

describe("Specification Engine Diverse Domains & Validation Suite", () => {
  it("infers Task Manager domain correctly", () => {
    const spec = createSpecFromPrompt("Build a task manager with persistent storage", "my-todo");
    const { result } = validateForgeSpec(spec);

    expect(result.valid).toBe(true);
    expect(spec.name).toBe("my-todo");
    expect(spec.metadata?.domain).toBe("task-manager");
    expect(spec.entities[0].name).toBe("Task");
    expect(spec.entities[0].fields.some((f) => f.name === "isDone" && f.type === "Boolean")).toBe(true);
    expect(spec.metadata?.inferredAssumptions.length).toBeGreaterThan(0);
  });

  it("infers Fee and Financial Tracker domain correctly", () => {
    const spec = createSpecFromPrompt("Build an expense and fee tracker for monthly utility bills", "fee-app");
    const { result } = validateForgeSpec(spec);

    expect(result.valid).toBe(true);
    expect(spec.metadata?.domain).toBe("financial");
    expect(spec.entities[0].name).toBe("Expense");
    expect(spec.entities[0].fields.some((f) => f.name === "amount" && f.type === "Float")).toBe(true);
    expect(spec.entities[0].fields.some((f) => f.name === "isPaid" && f.type === "Boolean")).toBe(true);
    expect(spec.operations.some((op) => op.name === "getExpenses")).toBe(true);
  });

  it("infers E-Commerce Inventory domain correctly", () => {
    const spec = createSpecFromPrompt("Create an online shop product inventory manager", "store-catalog");
    const { result } = validateForgeSpec(spec);

    expect(result.valid).toBe(true);
    expect(spec.metadata?.domain).toBe("e-commerce");
    expect(spec.entities[0].name).toBe("Product");
    expect(spec.entities[0].fields.some((f) => f.name === "sku" && f.type === "String")).toBe(true);
    expect(spec.entities[0].fields.some((f) => f.name === "stockQuantity" && f.type === "Int")).toBe(true);
    expect(spec.operations.some((op) => op.name === "updateStock")).toBe(true);
  });

  it("infers Personal Blog with Comments domain correctly", () => {
    const spec = createSpecFromPrompt("Build a personal blog publishing platform with reader comments", "my-blog");
    const { result } = validateForgeSpec(spec);

    expect(result.valid).toBe(true);
    expect(spec.metadata?.domain).toBe("blog");
    expect(spec.entities.some((e) => e.name === "Post")).toBe(true);
    expect(spec.entities.some((e) => e.name === "Comment")).toBe(true);
    expect(spec.operations.some((op) => op.name === "getPosts")).toBe(true);
    expect(spec.operations.some((op) => op.name === "createComment")).toBe(true);
  });

  it("rejects empty or whitespace-only prompts with clear error message", () => {
    expect(() => createSpecFromPrompt("")).toThrow("Application prompt cannot be empty or whitespace");
    expect(() => createSpecFromPrompt("   \t\n  ")).toThrow("Application prompt cannot be empty or whitespace");
  });

  it("sanitizes hostile and malformed app names", () => {
    const hostileName = "<script>alert('hack')</script> App $100%!";
    const spec = createSpecFromPrompt("A simple bookmark collector", hostileName);

    expect(spec.name).toMatch(/^[a-z0-9_-]+$/);
    expect(spec.name).not.toContain("<script>");
    expect(spec.name).not.toContain("$");
    const { result } = validateForgeSpec(spec);
    expect(result.valid).toBe(true);
  });

  it("detects impossible specifications with invalid entity references", () => {
    const invalidSpec: any = {
      name: "broken-spec",
      title: "Broken Spec",
      description: "References ghost entity",
      targetEngine: "auto",
      entities: [
        {
          name: "Task",
          fields: [{ name: "id", type: "Int", isId: true }]
        }
      ],
      operations: [
        {
          name: "getGhost",
          type: "query",
          entities: ["GhostEntity"] // GhostEntity does not exist in entities
        }
      ],
      routes: [
        { name: "HomeRoute", path: "/", component: "Page" }
      ],
      auth: { enabled: false, methods: ["usernameAndPassword"] }
    };

    const { result } = validateForgeSpec(invalidSpec);
    expect(result.valid).toBe(false);
    expect(result.errors.some((err) => err.includes("references undefined entity 'GhostEntity'"))).toBe(true);
  });

  it("detects duplicate route paths", () => {
    const duplicateRouteSpec: any = {
      name: "dup-routes",
      title: "Dup Routes",
      description: "Duplicate route paths",
      targetEngine: "auto",
      entities: [
        {
          name: "Item",
          fields: [{ name: "id", type: "Int", isId: true }]
        }
      ],
      operations: [],
      routes: [
        { name: "HomeRoute", path: "/", component: "Home" },
        { name: "ConflictRoute", path: "/", component: "Conflict" }
      ],
      auth: { enabled: false, methods: ["usernameAndPassword"] }
    };

    const { result } = validateForgeSpec(duplicateRouteSpec);
    expect(result.valid).toBe(false);
    expect(result.errors.some((err) => err.includes("Duplicate route path"))).toBe(true);
  });
});
