/**
 * Custom Tools Template
 *
 * Template for creating your own custom opencode tools.
 * Copy this file, rename it, and modify the tool definitions.
 * Then import and register your tools in index.mjs.
 *
 * Each tool is defined using the tool() function which provides:
 * - Type-safe argument validation via Zod schemas
 * - Automatic JSON Schema generation for LLM context
 * - Cross-platform execution context
 *
 * Learn more: https://opencode.ai/docs/plugins
 */
import { tool } from "@opencode-ai/plugin";

/**
 * Example: A simple greeting tool.
 *
 * Each tool needs:
 * 1. description - Tells the LLM what this tool does
 * 2. args - Zod schema for parameter validation
 * 3. execute - Async function that does the work
 */
export const helloWorldTool = tool({
  description: `A friendly greeting tool. Says hello to someone.
Useful for demonstrating how to create custom tools.`,
  args: {
    name: tool.schema
      .string()
      .describe("The name of the person to greet"),
    greeting: tool.schema
      .string()
      .optional()
      .default("Hello")
      .describe("The greeting word to use (default: Hello)"),
    excited: tool.schema
      .boolean()
      .optional()
      .default(false)
      .describe("Add exclamation marks for extra enthusiasm"),
  },
  async execute(args, context) {
    const punctuation = args.excited ? "!!!" : ".";
    const message = `${args.greeting}, ${args.name}${punctuation}`;

    // You can use context for:
    // - context.directory - current project directory
    // - context.worktree - project root
    // - context.metadata() - set execution metadata
    // - context.ask() - request user permission
    // - context.abort - check if execution was aborted

    context.metadata({
      title: `Greeting ${args.name}`,
      metadata: {
        greeted: args.name,
        greeting: args.greeting,
      },
    });

    return {
      title: `hello: ${args.name}`,
      output: message,
      metadata: {
        name: args.name,
        greeting: args.greeting,
      },
    };
  },
});

/**
 * Example: A counter/stats tool that persists data.
 * Shows how to use the project directory for data storage.
 */
export const counterTool = tool({
  description: `A simple counter tool. Counts how many times it has been called.
Data is stored in a file in the project directory.
Useful for tracking usage statistics and demonstrating state persistence.`,
  args: {
    action: tool.schema
      .string()
      .optional()
      .default("increment")
      .describe("Action: 'increment', 'reset', or 'show' (default: increment)"),
  },
  async execute(args, context) {
    const fs = await import("fs");
    const path = await import("path");

    const counterFile = path.join(context.worktree, ".opencode-tools-counter.json");
    let count = 0;

    try {
      const data = JSON.parse(fs.readFileSync(counterFile, "utf8"));
      count = data.count || 0;
    } catch {
      count = 0;
    }

    switch (args.action) {
      case "increment":
        count++;
        break;
      case "reset":
        count = 0;
        break;
      case "show":
        // Just show current count
        break;
      default:
        return {
          title: "counter: unknown action",
          output: `Unknown action: "${args.action}". Use 'increment', 'reset', or 'show'.`,
          metadata: { error: "unknown_action" },
        };
    }

    try {
      fs.writeFileSync(counterFile, JSON.stringify({ count }, null, 2));
    } catch {
      // Ignore write errors for demo
    }

    return {
      title: `counter: ${count} (${args.action})`,
      output: `Counter value: ${count}\nAction: ${args.action}`,
      metadata: { count, action: args.action },
    };
  },
});

/**
 * Example: A tool that reads and parses JSON files.
 * Shows how to integrate with the project's data.
 */
export const jsonQueryTool = tool({
  description: `Query a JSON file in the project using a dot-notation path.
Useful for inspecting configuration files, package.json, and data files.
Example: path "dependencies.express" on package.json returns the version.`,
  args: {
    file: tool.schema
      .string()
      .describe("Path to JSON file (relative to project root)"),
    query: tool.schema
      .string()
      .optional()
      .default(".")
      .describe(
        "Dot-notation query path (e.g., 'name', 'scripts.build', 'dependencies'). '.' returns the entire file."
      ),
  },
  async execute(args, context) {
    const fs = await import("fs");
    const path = await import("path");

    const filePath = path.resolve(context.worktree, args.file);

    try {
      const content = fs.readFileSync(filePath, "utf8");
      const data = JSON.parse(content);

      // Resolve dot-notation query
      let result = data;
      if (args.query !== ".") {
        const keys = args.query.split(".");
        for (const key of keys) {
          if (result === undefined || result === null) {
            return {
              title: `json-query: "${args.query}" not found`,
              output: `Path "${args.query}" not found in ${args.file}`,
              metadata: { error: "path_not_found" },
            };
          }
          result = result[key];
        }
      }

      const output = JSON.stringify(result, null, 2);
      const truncated = output.length > 5000;

      return {
        title: `json-query: ${args.file} → ${args.query}`,
        output: truncated ? output.slice(0, 5000) + "\n... (truncated)" : output,
        metadata: {
          file: args.file,
          query: args.query,
          resultLength: output.length,
          truncated,
        },
      };
    } catch (error) {
      return {
        title: `json-query: error`,
        output: `Error querying ${args.file}: ${error.message}`,
        metadata: { error: error.message },
      };
    }
  },
});

/**
 * Template for your own tools.
 * Copy and modify this to create new tools.
 *
 * export const myTool = tool({
 *   description: "Describe what your tool does",
 *   args: {
 *     input: tool.schema.string().describe("Input parameter description"),
 *     optionalParam: tool.schema.number().optional().describe("Optional number"),
 *     flag: tool.schema.boolean().optional().default(false).describe("A boolean flag"),
 *   },
 *   async execute(args, context) {
 *     // Your tool logic here
 *     return {
 *       title: "my-tool: short title",
 *       output: "Result output text",
 *       metadata: { key: "value" },
 *     };
 *   },
 * });
 */
