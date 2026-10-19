import { ForgeSpec } from "../spec/schema.js";
import { AppGenerationEngine, GenerationResult, GeneratedFile } from "./types.js";

export class WaspEngine implements AppGenerationEngine {
  public name = "wasp";

  public canHandle(spec: ForgeSpec): boolean {
    return (
      spec.targetEngine === "wasp" ||
      spec.targetEngine === "auto"
    );
  }

  public async generate(spec: ForgeSpec, _targetDirectory: string): Promise<GenerationResult> {
    const files: GeneratedFile[] = [];

    // 1. Generate schema.prisma
    let prismaModels = `datasource db {\n  provider = "sqlite"\n  url      = "file:./dev.db"\n}\n\ngenerator client {\n  provider = "prisma-client-js"\n}\n\n`;
    for (const ent of spec.entities) {
      prismaModels += `model ${ent.name} {\n`;
      for (const f of ent.fields) {
        let fieldLine = `  ${f.name} `;
        if (f.type === "Int") fieldLine += "Int";
        else if (f.type === "Boolean") fieldLine += "Boolean";
        else if (f.type === "DateTime") fieldLine += "DateTime";
        else if (f.type === "Float") fieldLine += "Float";
        else fieldLine += "String";

        if (f.isId) fieldLine += " @id @default(autoincrement())";
        if (!f.isRequired && !f.isId) fieldLine += "?";
        if (f.defaultValue !== undefined) fieldLine += ` @default(${f.defaultValue})`;
        if (f.name === "createdAt" && f.type === "DateTime") fieldLine += " @default(now())";
        prismaModels += fieldLine + "\n";
      }
      prismaModels += "}\n\n";
    }

    files.push({
      relativePath: "schema.prisma",
      content: prismaModels.trim() + "\n"
    });

    // 2. Generate main.wasp.ts
    const opImports = spec.operations.map((op) => op.name).join(", ");
    let waspContent = `import { app, page, route, query, action } from "@wasp.sh/spec";\n`;
    waspContent += `import { TasksPage } from "./src/TasksPage" with { type: "ref" };\n`;
    if (spec.operations.length > 0) {
      waspContent += `import { ${opImports} } from "./src/operations" with { type: "ref" };\n`;
    }
    waspContent += `\nexport default app({\n`;
    waspContent += `  name: "${spec.name}",\n`;
    waspContent += `  wasp: { version: "0.26.1" },\n`;
    waspContent += `  title: "${spec.title}",\n`;
    waspContent += `  spec: [\n`;
    waspContent += `    route("HomeRoute", "/", page(TasksPage)),\n`;

    for (const op of spec.operations) {
      const entitiesArr = JSON.stringify(op.entities);
      waspContent += `    ${op.type}(${op.name}, { entities: ${entitiesArr} }),\n`;
    }
    waspContent += `  ]\n});\n`;

    files.push({
      relativePath: "main.wasp.ts",
      content: waspContent
    });

    // 3. User code files: src/operations.ts
    let operationsContent = `import { HttpError } from "wasp/server";\n\n`;
    for (const op of spec.operations) {
      if (op.type === "query") {
        operationsContent += `export const ${op.name} = async (args: any, context: any) => {\n`;
        operationsContent += `  return context.entities.Task.findMany();\n};\n\n`;
      } else {
        operationsContent += `export const ${op.name} = async (args: any, context: any) => {\n`;
        operationsContent += `  return context.entities.Task.create({ data: args });\n};\n\n`;
      }
    }
    files.push({
      relativePath: "src/operations.ts",
      content: operationsContent
    });

    // 4. User code files: src/TasksPage.tsx
    const componentContent = `import React, { useState } from "react";
import { useQuery, useAction, getTasks, createTask, toggleTask } from "wasp/client/operations";

export const TasksPage = () => {
  const { data: tasks, isLoading, error } = useQuery(getTasks);
  const createTaskFn = useAction(createTask);
  const toggleTaskFn = useAction(toggleTask);
  const [title, setTitle] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    await createTaskFn({ title, isDone: false });
    setTitle("");
  };

  return (
    <div style={{ padding: 24, fontFamily: "sans-serif", maxWidth: 600, margin: "0 auto" }}>
      <h1>${spec.title}</h1>
      <form onSubmit={handleSubmit} style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="New task..."
          style={{ flex: 1, padding: 8 }}
        />
        <button type="submit" style={{ padding: "8px 16px" }}>Add Task</button>
      </form>
      {isLoading && <p>Loading tasks...</p>}
      {error && <p style={{ color: "red" }}>Error loading tasks</p>}
      <ul>
        {tasks?.map((t: any) => (
          <li key={t.id} style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
            <input
              type="checkbox"
              checked={t.isDone}
              onChange={() => toggleTaskFn({ id: t.id, isDone: !t.isDone })}
            />
            <span style={{ textDecoration: t.isDone ? "line-through" : "none" }}>{t.title}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};
`;
    files.push({
      relativePath: "src/TasksPage.tsx",
      content: componentContent
    });

    // 5. Root package.json conforming to Wasp 0.26.1 specs
    const waspPkg = {
      name: spec.name,
      version: "0.1.0",
      private: true,
      dependencies: {
        "@wasp.sh/spec": "file:.wasp/spec",
        "react": "^18.3.1",
        "react-dom": "^18.3.1",
        "wasp": "file:.wasp/out/sdk/wasp"
      },
      devDependencies: {
        "vite": "^5.4.14",
        "typescript": "^5.8.2"
      }
    };
    files.push({
      relativePath: "package.json",
      content: JSON.stringify(waspPkg, null, 2) + "\n"
    });

    // 6. tsconfig.json
    const tsconfig = {
      compilerOptions: {
        target: "ES2022",
        module: "ESNext",
        moduleResolution: "bundler",
        jsx: "react-jsx",
        strict: true,
        skipLibCheck: true
      },
      include: ["src/**/*", "main.wasp.ts"]
    };
    files.push({
      relativePath: "tsconfig.json",
      content: JSON.stringify(tsconfig, null, 2) + "\n"
    });

    // 7. .env.server
    files.push({
      relativePath: ".env.server",
      content: `DATABASE_URL="file:./dev.db"\nPORT=3001\n`
    });

    // 8. .gitignore
    files.push({
      relativePath: ".gitignore",
      content: `node_modules/\n.wasp/\ndev.db\ndev.db-journal\ndist/\n`
    });

    const isWindows = process.platform === "win32";
    return {
      engineName: this.name,
      files,
      entryPointInstructions: isWindows
        ? "Run inside WSL: `wasp start` or compile with `wasp compile`"
        : "Run `wasp start` to launch dev server",
      supportedOnPlatform: !isWindows,
      platformNotes: isWindows
        ? "Wasp CLI requires Linux, macOS, or WSL on Windows hosts. Native Windows execution is not supported by upstream Wasp."
        : undefined
    };
  }
}
