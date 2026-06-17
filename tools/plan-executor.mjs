/**
 * Plan Executor Tool
 *
 * Reads a Meta-Architect build plan from plan.json and extracts all
 * implementation prompts into an ordered execution queue.
 * Does NOT execute prompts itself — prepares the queue for the orchestrator.
 */
import { tool } from "@opencode-ai/plugin";
import fs from "fs";
import path from "path";

export const planExecutorTool = tool({
  description: `Read a Meta-Architect build plan and extract the prompt execution queue.
Use when you need to process a plan.json from the meta-architect pipeline.
Reads prompts A (scaffold), B (data layer), C-Backend[], and C-UI[] and returns them
in strict execution order. Writes an execution-queue.json tracking file.`,
  args: {
    planPath: tool.schema
      .string()
      .optional()
      .default(".meta-architect/plan.json")
      .describe(
        "Path to the plan.json file (default: .meta-architect/plan.json)"
      ),
    action: tool.schema
      .string()
      .optional()
      .default("extract")
      .describe(
        "Action: 'extract' to get the queue, 'status' to check execution progress"
      ),
  },
  async execute(args, context) {
    const worktree = context.worktree || context.directory || process.cwd();
    const planFilePath = path.resolve(worktree, args.planPath);
    const queueFilePath = path.resolve(
      worktree,
      ".meta-architect/execution-queue.json"
    );

    if (args.action === "status") {
      return await getExecutionStatus(queueFilePath, planFilePath);
    }

    // Read the plan file
    let planData;
    try {
      const raw = fs.readFileSync(planFilePath, "utf8");
      planData = JSON.parse(raw);
    } catch (error) {
      return {
        title: "plan-executor: file not found",
        output: `Could not read plan file at ${planFilePath}: ${error.message}`,
        metadata: { error: "file_not_found", path: planFilePath },
      };
    }

    const prompts = planData?.build_plan?.prompts;
    if (!prompts) {
      return {
        title: "plan-executor: invalid plan",
        output: `Plan file at ${planFilePath} does not contain build_plan.prompts. Check the file structure.`,
        metadata: { error: "invalid_plan_structure", path: planFilePath },
      };
    }

    // Extract and order prompts into execution queue
    const queue = [];

    // Prompt A — Scaffold
    if (prompts.A_scaffold) {
      queue.push({
        id: "A_scaffold",
        label: prompts.A_scaffold.label || "Project Scaffold",
        type: "scaffold",
        depends_on: null,
        priority: 0,
        instructions: prompts.A_scaffold.instructions || "",
        commands: prompts.A_scaffold.commands || [],
        files_to_create: prompts.A_scaffold.files_to_create || [],
        status: "pending",
      });
    }

    // Prompt B — Data Layer
    if (prompts.B_data_layer) {
      queue.push({
        id: "B_data_layer",
        label: prompts.B_data_layer.label || "Data Layer",
        type: "data_layer",
        depends_on: "A_scaffold",
        priority: 1,
        instructions: prompts.B_data_layer.instructions || "",
        prisma_schema: prompts.B_data_layer.prisma_schema || "",
        commands: prompts.B_data_layer.commands || [],
        files_to_create: prompts.B_data_layer.files_to_create || [],
        status: "pending",
      });
    }

    // C-Backend features
    const backendFeatures = prompts.C_backend || [];
    backendFeatures.forEach((feature, index) => {
      queue.push({
        id: `C_backend_${index}`,
        label: feature.feature || `Backend Feature ${index + 1}`,
        type: "backend_feature",
        depends_on: feature.depends_on || "B_data_layer",
        priority: 2 + index,
        instructions: feature.instructions || "",
        files_to_create: feature.files_to_create || [],
        status: "pending",
      });
    });

    // C-UI features
    const uiFeatures = prompts.C_ui || [];
    uiFeatures.forEach((feature, index) => {
      queue.push({
        id: `C_ui_${index}`,
        label: feature.feature || `UI Feature ${index + 1}`,
        type: "ui_feature",
        depends_on: feature.depends_on || `C_backend_${index}`,
        priority: 2 + backendFeatures.length + index,
        instructions: feature.instructions || "",
        files_to_create: feature.files_to_create || [],
        status: "pending",
      });
    });

    // Write the execution queue file
    const executionQueue = {
      plan_file: planFilePath,
      extracted_at: new Date().toISOString(),
      total_prompts: queue.length,
      prompts: queue,
      status: "ready",
    };

    try {
      const queueDir = path.dirname(queueFilePath);
      if (!fs.existsSync(queueDir)) {
        fs.mkdirSync(queueDir, { recursive: true });
      }
      fs.writeFileSync(queueFilePath, JSON.stringify(executionQueue, null, 2));
    } catch (error) {
      return {
        title: "plan-executor: queue write failed",
        output: `Plan parsed but could not write queue: ${error.message}`,
        metadata: { error: "queue_write_failed", queueSize: queue.length },
      };
    }

    return {
      title: `plan-executor: ${queue.length} prompts extracted`,
      output: [
        `Plan: ${planFilePath}`,
        `Total prompts: ${queue.length}`,
        `Queue written to: ${queueFilePath}`,
        "",
        "Prompts in order:",
        ...queue.map(
          (p, i) =>
            `  ${i + 1}. [${p.status}] ${p.id}: ${p.label} (${p.type})`
        ),
      ].join("\n"),
      metadata: {
        planPath: planFilePath,
        queuePath: queueFilePath,
        totalPrompts: queue.length,
        status: executionQueue.status,
        prompts: queue.map((p) => ({
          id: p.id,
          label: p.label,
          type: p.type,
          depends_on: p.depends_on,
          status: p.status,
        })),
      },
    };
  },
});

/**
 * Check execution status from the queue file.
 */
async function getExecutionStatus(queueFilePath, planFilePath) {
  try {
    const raw = fs.readFileSync(queueFilePath, "utf8");
    const queue = JSON.parse(raw);

    const completed = queue.prompts.filter((p) => p.status === "completed").length;
    const failed = queue.prompts.filter((p) => p.status === "failed").length;
    const skipped = queue.prompts.filter((p) => p.status === "skipped").length;
    const pending = queue.prompts.filter((p) => p.status === "pending").length;

    return {
      title: `plan-executor: ${completed}/${queue.total_prompts} completed`,
      output: [
        `Plan: ${planFilePath}`,
        `Queue: ${queueFilePath}`,
        `Total: ${queue.total_prompts}`,
        `Completed: ${completed}`,
        `Failed: ${failed}`,
        `Pending: ${pending}`,
        `Skipped: ${skipped}`,
        "",
        "Detailed status:",
        ...queue.prompts.map(
          (p) => `  [${p.status}] ${p.id}: ${p.label}`
        ),
      ].join("\n"),
      metadata: {
        planPath: planFilePath,
        queuePath: queueFilePath,
        total: queue.total_prompts,
        completed,
        failed,
        pending,
        skipped,
      },
    };
  } catch (error) {
    return {
      title: "plan-executor: no queue found",
      output: `No execution queue found at ${queueFilePath}. Run plan-executor with action 'extract' first.`,
      metadata: {
        error: "queue_not_found",
        queuePath: queueFilePath,
      },
    };
  }
}

/**
 * Helper to mark a prompt's status in the queue.
 */
export async function markPromptStatus(
  context,
  promptId,
  status,
  error = null
) {
  const worktree = context.worktree || context.directory || process.cwd();
  const queueFilePath = path.resolve(
    worktree,
    ".meta-architect/execution-queue.json"
  );

  try {
    const raw = fs.readFileSync(queueFilePath, "utf8");
    const queue = JSON.parse(raw);

    const prompt = queue.prompts.find((p) => p.id === promptId);
    if (prompt) {
      prompt.status = status;
      if (error) prompt.error = error;
      if (status === "completed") prompt.completed_at = new Date().toISOString();

      // Update overall status
      const allDone = queue.prompts.every((p) =>
        ["completed", "skipped", "failed"].includes(p.status)
      );
      queue.status = allDone ? "complete" : "in_progress";

      fs.writeFileSync(queueFilePath, JSON.stringify(queue, null, 2));
    }
  } catch {
    // Silently fail — status tracking is best-effort
  }
}
