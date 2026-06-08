/**
 * File Tools - Cross-platform file operations
 *
 * Provides advanced file operations beyond the built-in read/write tools.
 * All paths use cross-platform normalization (both / and \ work on Windows).
 */
import { tool } from "@opencode-ai/plugin";
import fs from "fs";
import path from "path";
import { promisify } from "util";

const readdirAsync = promisify(fs.readdir);
const statAsync = promisify(fs.stat);
const readFileAsync = promisify(fs.readFile);
const writeFileAsync = promisify(fs.writeFile);
const mkdirAsync = promisify(fs.mkdir);
const accessAsync = promisify(fs.access);

/**
 * Normalize a file path for the current platform.
 */
function normalizePath(filePath, baseDir) {
  // Resolve relative paths
  if (!path.isAbsolute(filePath)) {
    filePath = path.resolve(baseDir || process.cwd(), filePath);
  }
  return path.normalize(filePath);
}

/**
 * Check if a path is within allowed directories.
 */
function isPathSafe(targetPath, allowedDirs) {
  const resolved = path.resolve(targetPath);
  for (const dir of allowedDirs) {
    const resolvedDir = path.resolve(dir);
    if (resolved.startsWith(resolvedDir + path.sep) || resolved === resolvedDir) {
      return true;
    }
  }
  return false;
}

/**
 * List files in a directory with detailed information.
 */
async function listDirectory(dirPath, options = {}) {
  const { recursive = false, pattern = null, maxDepth = 3 } = options;
  const entries = [];

  async function walk(currentPath, depth) {
    if (depth > maxDepth) return;

    try {
      const items = await readdirAsync(currentPath);
      for (const item of items) {
        const fullPath = path.join(currentPath, item);
        try {
          const stats = await statAsync(fullPath);
          const entry = {
            name: item,
            path: fullPath,
            type: stats.isDirectory() ? "directory" : stats.isFile() ? "file" : "other",
            size: stats.size,
            modified: stats.mtime.toISOString(),
            created: stats.birthtime.toISOString(),
            permissions: stats.mode.toString(8).slice(-3),
          };

          // Apply pattern filter
          if (pattern && !item.includes(pattern) && !fullPath.includes(pattern)) {
            if (stats.isDirectory() && recursive) {
              await walk(fullPath, depth + 1);
            }
            continue;
          }

          entries.push(entry);

          if (stats.isDirectory() && recursive) {
            await walk(fullPath, depth + 1);
          }
        } catch {
          // Skip inaccessible entries
        }
      }
    } catch {
      // Skip inaccessible directories
    }
  }

  await walk(dirPath, 0);
  return entries;
}

/**
 * File listing tool.
 * List files in a directory with optional recursive search and filtering.
 */
export const fileListTool = tool({
  description: `List files and directories with detailed information (size, dates, permissions).
Supports recursive listing, pattern filtering, and depth control.
Cross-platform: uses platform-specific path separators.
Safe: only allows access to the project directory and common locations.`,
  args: {
    directory: tool.schema
      .string()
      .optional()
      .describe("Directory to list (default: current project directory)"),
    recursive: tool.schema
      .boolean()
      .optional()
      .default(false)
      .describe("List files recursively (default: false)"),
    pattern: tool.schema
      .string()
      .optional()
      .describe("Filter by name/pattern (e.g., '.js', 'test', '*.md')"),
    maxDepth: tool.schema
      .number()
      .optional()
      .default(3)
      .describe("Maximum recursion depth (default: 3, max: 10)"),
    showHidden: tool.schema
      .boolean()
      .optional()
      .default(false)
      .describe("Include hidden files (dotfiles) (default: false)"),
  },
  async execute(args, context) {
    const baseDir = context.worktree || context.directory;
    const dirPath = normalizePath(args.directory || ".", baseDir);

    // Security: restrict to project directory
    if (!isPathSafe(dirPath, [baseDir, os.homedir()])) {
      return {
        title: "file-list: access denied",
        output: `Access denied: ${dirPath} is outside the project directory.`,
        metadata: { safe: false },
      };
    }

    const maxDepth = Math.min(args.maxDepth ?? 3, 10);

    try {
      await accessAsync(dirPath, fs.constants.R_OK);
    } catch {
      return {
        title: "file-list: cannot access",
        output: `Cannot access directory: ${dirPath}`,
        metadata: { error: "permission_denied" },
      };
    }

    try {
      const entries = await listDirectory(dirPath, {
        recursive: args.recursive,
        pattern: args.pattern,
        maxDepth,
      });

      if (entries.length === 0) {
        return {
          title: `file-list: ${dirPath} (0 files)`,
          output: `No files found in ${dirPath}${args.pattern ? ` matching "${args.pattern}"` : ""}`,
          metadata: { directory: dirPath, fileCount: 0 },
        };
      }

      // Organize output
      const dirs = entries.filter((e) => e.type === "directory");
      const files = entries.filter((e) => e.type !== "directory");

      let output = `Directory: ${dirPath}\n`;
      if (args.recursive) output += `(recursive, max depth: ${maxDepth})\n`;
      output += `Total: ${entries.length} items (${dirs.length} dirs, ${files.length} files)\n\n`;

      if (dirs.length > 0) {
        output += `Directories:\n`;
        for (const d of dirs.slice(0, 50)) {
          output += `  📁 ${path.relative(dirPath, d.path)}/\n`;
        }
        if (dirs.length > 50) output += `  ... and ${dirs.length - 50} more\n`;
        output += "\n";
      }

      if (files.length > 0) {
        output += `Files:\n`;
        for (const f of files.slice(0, 100)) {
          const relPath = path.relative(dirPath, f.path);
          const size = formatFileSize(f.size);
          output += `  📄 ${relPath} (${size}, ${f.modified.slice(0, 10)})\n`;
        }
        if (files.length > 100) output += `  ... and ${files.length - 100} more\n`;
      }

      return {
        title: `file-list: ${path.basename(dirPath)} (${entries.length} items)`,
        output: output.trim(),
        metadata: {
          directory: dirPath,
          fileCount: files.length,
          dirCount: dirs.length,
          total: entries.length,
        },
      };
    } catch (error) {
      return {
        title: "file-list: error",
        output: `Error listing directory ${dirPath}: ${error.message}`,
        metadata: { error: error.message },
      };
    }
  },
});

/**
 * File search tool.
 * Search for files by name pattern in a directory tree.
 */
export const fileSearchTool = tool({
  description: `Search for files by name pattern in the project directory.
Works like the 'find' command but cross-platform.
Supports glob-style patterns and regex filtering.
Reports file sizes, modification dates, and line counts for text files.`,
  args: {
    pattern: tool.schema
      .string()
      .describe("File name pattern to search for (e.g., '*.test.js', 'README*', '*.md')"),
    directory: tool.schema
      .string()
      .optional()
      .describe("Directory to search in (default: project root)"),
    maxResults: tool.schema
      .number()
      .optional()
      .default(50)
      .describe("Maximum results to return (default: 50, max: 200)"),
    includeContent: tool.schema
      .boolean()
      .optional()
      .default(false)
      .describe("Include first line of file content as preview"),
  },
  async execute(args, context) {
    const baseDir = context.worktree || context.directory;
    const searchDir = normalizePath(args.directory || ".", baseDir);
    const maxResults = Math.min(args.maxResults ?? 50, 200);

    // Simple glob-like pattern matching
    const isMatch = createPatternMatcher(args.pattern);

    const results = [];

    async function walk(dir) {
      if (results.length >= maxResults) return;
      try {
        const items = await readdirAsync(dir);
        for (const item of items) {
          if (results.length >= maxResults) break;
          const fullPath = path.join(dir, item);
          try {
            const stats = await statAsync(fullPath);
            if (stats.isFile() && isMatch(item)) {
              const entry = {
                path: fullPath,
                relativePath: path.relative(baseDir, fullPath),
                size: stats.size,
                modified: stats.mtime.toISOString(),
              };

              if (args.includeContent && stats.size < 10000) {
                try {
                  const content = await readFileAsync(fullPath, "utf8");
                  entry.preview = content.split("\n")[0].slice(0, 100);
                } catch {
                  entry.preview = "(binary or inaccessible)";
                }
              }

              results.push(entry);
            }
            if (stats.isDirectory()) {
              // Skip node_modules, .git, and hidden dirs unless specifically requested
              if (!item.startsWith(".") && item !== "node_modules") {
                await walk(fullPath);
              }
            }
          } catch {
            // Skip inaccessible
          }
        }
      } catch {
        // Skip inaccessible
      }
    }

    try {
      await walk(searchDir);
    } catch (error) {
      return {
        title: "file-search: error",
        output: `Error searching ${searchDir}: ${error.message}`,
        metadata: { error: error.message },
      };
    }

    if (results.length === 0) {
      return {
        title: `file-search: "${args.pattern}" (0 matches)`,
        output: `No files matching "${args.pattern}" found in ${searchDir}`,
        metadata: { pattern: args.pattern, matches: 0 },
      };
    }

    let output = `Search results for "${args.pattern}" in ${path.relative(baseDir, searchDir) || "."}:\n`;
    output += `Found ${results.length} file(s)\n\n`;

    for (const r of results) {
      const size = formatFileSize(r.size);
      output += `${r.relativePath} (${size}, ${r.modified.slice(0, 10)})`;
      if (r.preview) output += `\n  → ${r.preview}`;
      output += "\n";
    }

    return {
      title: `file-search: "${args.pattern}" (${results.length} matches)`,
      output: output.trim(),
      metadata: {
        pattern: args.pattern,
        matches: results.length,
        directory: searchDir,
      },
    };
  },
});

/**
 * Create a simple pattern matching function.
 * Supports * and ? wildcards, and plain substring matching.
 */
function createPatternMatcher(pattern) {
  // If it contains * or ?, convert to regex
  if (pattern.includes("*") || pattern.includes("?")) {
    const regexStr = "^" +
      pattern
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*/g, ".*")
        .replace(/\?/g, ".") +
      "$";
    try {
      const regex = new RegExp(regexStr, "i");
      return (name) => regex.test(name);
    } catch {
      return (name) => name.includes(pattern);
    }
  }
  // Plain substring match (case-insensitive)
  const lower = pattern.toLowerCase();
  return (name) => name.toLowerCase().includes(lower);
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

// Needed for path security check
import os from "os";
