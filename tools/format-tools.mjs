/**
 * Format Tools - Data format conversion, validation, and transformation
 *
 * Provides tools for working with various data formats: JSON, YAML, XML,
 * CSV, TSV, INI, TOML, properties, plist, MsgPack, diff/patch, tables,
 * charts, and progress bars.
 * All operations are local and use only Node.js built-ins.
 */
import { tool } from "@opencode-ai/plugin";

// ──────────────────────────────────────────────
// 1. JSON Tool
// ──────────────────────────────────────────────

/**
 * JSON tool.
 * Format, validate, minify, or query JSON documents.
 */
export const jsonTool = tool({
  description: `Format/validate/query JSON data.
Supports pretty-printing, minification, validation, and dot-notation queries.
Useful for debugging APIs, inspecting config files, and data transformation.`,
  args: {
    input: tool.schema
      .string()
      .describe("The JSON string to process"),
    action: tool.schema
      .string()
      .optional()
      .default("format")
      .describe("Action: format, validate, minify, or query (default: format)"),
    query: tool.schema
      .string()
      .optional()
      .describe("Dot-notation path for query action (e.g., 'a.b[0].c')"),
  },
  async execute(args, context) {
    const action = args.action || "format";
    const input = args.input;

    try {
      const parsed = JSON.parse(input);

      let result;
      switch (action) {
        case "validate":
          return {
            title: "json: valid",
            output: "JSON is valid.",
            metadata: { valid: true, type: Array.isArray(parsed) ? "array" : typeof parsed },
          };

        case "minify":
          result = JSON.stringify(parsed);
          break;

        case "query": {
          if (!args.query) {
            return {
              title: "json: query error",
              output: "Query argument is required for action 'query'.",
              metadata: { error: "missing_query" },
            };
          }
          const value = dotGet(parsed, args.query);
          result = value === undefined
            ? `Path "${args.query}" not found.`
            : JSON.stringify(value, null, 2);
          break;
        }

        case "format":
        default:
          result = JSON.stringify(parsed, null, 2);
          break;
      }

      return {
        title: `json: ${action}`,
        output: result,
        metadata: {
          action,
          inputLength: input.length,
          outputLength: result.length,
        },
      };
    } catch (error) {
      return {
        title: "json: error",
        output: `Invalid JSON: ${error.message}`,
        metadata: { error: error.message },
      };
    }
  },
});

/**
 * Simple dot-notation getter for nested objects/arrays.
 * Supports keys like "a.b[0].c" and "a[1].b".
 */
function dotGet(obj, path) {
  const parts = path.match(/[^.[\]]+/g);
  if (!parts) return undefined;
  let current = obj;
  for (const part of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = current[part];
  }
  return current;
}

// ──────────────────────────────────────────────
// 2. YAML Tool
// ──────────────────────────────────────────────

/**
 * YAML tool.
 * Convert between YAML and JSON.
 */
export const yamlTool = tool({
  description: `Convert between YAML and JSON formats.
Supports basic YAML (scalars, lists, nested maps, multi-line strings).
Useful for working with configuration files and data interchange.`,
  args: {
    input: tool.schema.string().describe("The input string to convert"),
    action: tool.schema
      .string()
      .optional()
      .default("yaml2json")
      .describe("Action: yaml2json or json2yaml (default: yaml2json)"),
  },
  async execute(args, context) {
    const action = args.action || "yaml2json";
    const input = args.input;

    try {
      if (action === "yaml2json") {
        const parsed = parseYaml(input);
        const result = JSON.stringify(parsed, null, 2);
        return {
          title: "yaml: yaml2json",
          output: result,
          metadata: { action, inputLength: input.length, outputLength: result.length },
        };
      } else if (action === "json2yaml") {
        const parsed = JSON.parse(input);
        const result = toYaml(parsed);
        return {
          title: "yaml: json2yaml",
          output: result,
          metadata: { action, inputLength: input.length, outputLength: result.length },
        };
      } else {
        return {
          title: "yaml: invalid action",
          output: `Invalid action: "${action}". Use "yaml2json" or "json2yaml".`,
          metadata: { error: "invalid_action" },
        };
      }
    } catch (error) {
      return {
        title: "yaml: error",
        output: `Error: ${error.message}`,
        metadata: { error: error.message },
      };
    }
  },
});

/**
 * Minimal YAML parser.
 * Handles: scalars (strings, numbers, booleans, null), lists, nested maps,
 * multi-line strings (|), inline JSON-like constructs.
 */
function parseYaml(text) {
  const lines = text.split("\n");
  const root = {};
  const stack = [{ obj: root, indent: -1 }];

  let i = 0;
  while (i < lines.length) {
    const rawLine = lines[i];
    const trimmed = rawLine.trimRight();

    // Skip empty lines and comments
    if (trimmed.trim() === "" || trimmed.trim().startsWith("#")) {
      i++;
      continue;
    }

    const indent = rawLine.length - rawLine.trimStart().length;

    // Pop stack items deeper than current indent
    while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
      stack.pop();
    }

    const currentObj = stack[stack.length - 1].obj;

    // Check for list item
    const listMatch = trimmed.match(/^-\s+(.*)/);
    if (listMatch) {
      // Ensure current object is an array
      let arr;
      if (Array.isArray(currentObj)) {
        arr = currentObj;
      } else {
        // This shouldn't happen in well-formed YAML, but handle gracefully
        const parent = stack[stack.length - 2]?.obj;
        if (parent) {
          arr = [];
          // Find the key on the parent and set it
          const lastKey = Object.keys(parent).pop();
          if (lastKey) {
            parent[lastKey] = arr;
          }
        } else {
          arr = [];
          root._list = arr;
        }
        stack[stack.length - 1] = { obj: arr, indent: stack[stack.length - 1].indent };
      }

      const valueStr = listMatch[1].trim();
      if (valueStr === "") {
        // Sub-items follow; push a new empty object onto the array
        const newObj = {};
        arr.push(newObj);
        stack.push({ obj: newObj, indent });
      } else {
        const parsed = parseYamlValue(valueStr);
        arr.push(parsed);
        // Check if next line is indented further (child block)
        if (i + 1 < lines.length) {
          const nextLine = lines[i + 1];
          const nextIndent = nextLine.length - nextLine.trimStart().length;
          if (nextIndent > indent && nextLine.trim() !== "" && !nextLine.trim().startsWith("#")) {
            const childObj = {};
            if (typeof parsed === "object" && !Array.isArray(parsed) && parsed !== null) {
              // Merge into existing object
              arr[arr.length - 1] = parsed;
              stack.push({ obj: parsed, indent });
            } else {
              // Replace last element with an object wrapper
              arr[arr.length - 1] = childObj;
              stack.push({ obj: childObj, indent });
            }
          }
        }
      }
      i++;
      continue;
    }

    // Key-value pair
    const kvMatch = trimmed.match(/^([^:]+?):\s*(.*)/);
    if (!kvMatch) {
      i++;
      continue;
    }

    const key = kvMatch[1].trim();
    const valueStr = kvMatch[2].trim();

    if (valueStr === "" || valueStr === "|") {
      // Multi-line scalar or nested content
      if (valueStr === "|") {
        // Literal block scalar
        const blockLines = [];
        i++;
        while (i < lines.length) {
          const bl = lines[i];
          const blTrimmed = bl.trimRight();
          const blIndent = bl.length - bl.trimStart().length;
          if (blIndent <= indent && blTrimmed !== "") break;
          if (blTrimmed !== "") {
            blockLines.push(bl.slice(indent + 2)); // account for |
          } else {
            blockLines.push("");
          }
          i++;
        }
        currentObj[key] = blockLines.join("\n");
        continue;
      }

      // Nested object
      const newObj = {};
      currentObj[key] = newObj;
      stack.push({ obj: newObj, indent });

      // Check if next line is a list item at this level
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1];
        const nextTrimmed = nextLine.trim();
        const nextIndent = nextLine.length - nextLine.trimStart().length;
        if (nextIndent > indent && nextTrimmed.startsWith("- ")) {
          // Will be handled in list processing
        }
      }
    } else {
      currentObj[key] = parseYamlValue(valueStr);
    }

    i++;
  }

  return root;
}

function parseYamlValue(str) {
  // Inline list
  if (str.startsWith("[") && str.endsWith("]")) {
    try {
      return JSON.parse(`[${str.slice(1, -1)}]`);
    } catch {
      return str.slice(1, -1).split(",").map(s => parseYamlValue(s.trim()));
    }
  }
  // Inline object
  if (str.startsWith("{") && str.endsWith("}")) {
    try {
      return JSON.parse(str);
    } catch {
      return str;
    }
  }
  // Null
  if (str === "null" || str === "~") return null;
  // Boolean
  if (str === "true" || str === "yes" || str === "on") return true;
  if (str === "false" || str === "no" || str === "off") return false;
  // Number
  if (/^-?\d+(\.\d+)?$/.test(str)) return str.includes(".") ? parseFloat(str) : parseInt(str, 10);
  // String (strip quotes)
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    return str.slice(1, -1);
  }
  return str;
}

/**
 * Convert a JSON value to YAML string.
 */
function toYaml(value, indent = 0) {
  const pad = " ".repeat(indent);
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    if (/^[-\d]|[:#!]|^$|\s|["']/.test(value) || value === "null" || value === "true" || value === "false") {
      return `"${value.replace(/"/g, '\\"')}"`;
    }
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    return "\n" + value.map(item => {
      if (typeof item === "object" && item !== null) {
        const lines = toYaml(item, indent + 2).trimEnd().split("\n");
        return pad + "  - " + lines[0].trim() + "\n" + lines.slice(1).map(l => pad + "  " + l).join("\n");
      }
      return pad + "  - " + toYaml(item, indent + 2).trim();
    }).join("\n");
  }
  if (typeof value === "object") {
    const keys = Object.keys(value);
    if (keys.length === 0) return "{}";
    return "\n" + keys.map(key => {
      const val = toYaml(value[key], indent + 2).trimEnd();
      const valLines = val.split("\n");
      if (valLines.length === 1 && !val.startsWith("\n")) {
        return pad + "  " + key + ": " + val;
      }
      return pad + "  " + key + ":" + (val.startsWith("\n") ? val : " " + val);
    }).join("\n");
  }
  return String(value);
}

// ──────────────────────────────────────────────
// 3. XML Tool
// ──────────────────────────────────────────────

/**
 * XML tool.
 * Format, minify, or query XML documents.
 */
export const xmlTool = tool({
  description: `Format, minify, or query XML documents.
Uses a simple XML parser for pretty-printing and element extraction.
Useful for inspecting XML responses and configuration files.`,
  args: {
    input: tool.schema.string().describe("The XML string to process"),
    action: tool.schema
      .string()
      .optional()
      .default("format")
      .describe("Action: format, minify, or query (default: format)"),
    query: tool.schema
      .string()
      .optional()
      .describe("Element path for query action (e.g., 'root.element.sub')"),
  },
  async execute(args, context) {
    const action = args.action || "format";
    const input = args.input;

    try {
      switch (action) {
        case "minify": {
          const result = input.replace(/>\s+</g, "><").trim();
          return {
            title: "xml: minify",
            output: result,
            metadata: { action, inputLength: input.length, outputLength: result.length },
          };
        }

        case "query": {
          if (!args.query) {
            return {
              title: "xml: query error",
              output: "Query argument is required for action 'query'.",
              metadata: { error: "missing_query" },
            };
          }
          const parsed = parseXml(input);
          const value = xmlPathGet(parsed, args.query);
          const result = value !== undefined ? JSON.stringify(value, null, 2) : `Path "${args.query}" not found.`;
          return {
            title: "xml: query",
            output: result,
            metadata: { action, query: args.query },
          };
        }

        case "format":
        default: {
          const result = formatXml(input);
          return {
            title: "xml: format",
            output: result,
            metadata: { action, inputLength: input.length, outputLength: result.length },
          };
        }
      }
    } catch (error) {
      return {
        title: "xml: error",
        output: `Error: ${error.message}`,
        metadata: { error: error.message },
      };
    }
  },
});

/**
 * Minimal XML pretty-printer.
 */
function formatXml(xml) {
  let formatted = "";
  let indent = 0;
  const tokens = xml.replace(/>\s+</g, "><").split(/(?=<)/);

  for (const token of tokens) {
    if (token.startsWith("<?xml") || token.startsWith("<!DOCTYPE")) {
      formatted += token + "\n";
      continue;
    }
    if (token.startsWith("</")) {
      indent = Math.max(0, indent - 1);
      formatted += "  ".repeat(indent) + token + "\n";
    } else if (token.startsWith("<![CDATA[")) {
      formatted += "  ".repeat(indent) + token + "\n";
    } else if (token.startsWith("<!--")) {
      formatted += "  ".repeat(indent) + token + "\n";
    } else if (token.startsWith("<")) {
      formatted += "  ".repeat(indent) + token + "\n";
      if (!token.endsWith("/>")) indent++;
    } else {
      formatted += "  ".repeat(indent) + token + "\n";
    }
  }

  return formatted.trim();
}

/**
 * Minimal XML parser that returns a nested object.
 */
function parseXml(xml) {
  const root = { _name: "#root", _children: [] };
  const stack = [root];
  let i = 0;

  while (i < xml.length) {
    // Skip text content
    const textEnd = xml.indexOf("<", i);
    if (textEnd > i) {
      const text = xml.slice(i, textEnd).trim();
      if (text) {
        stack[stack.length - 1]._children.push({ _name: "#text", _value: text });
      }
      i = textEnd;
    }

    if (i >= xml.length) break;

    // Comment or CDATA
    if (xml.startsWith("<!--", i)) {
      const end = xml.indexOf("-->", i + 4);
      i = end + 3;
      continue;
    }
    if (xml.startsWith("<![CDATA[", i)) {
      const end = xml.indexOf("]]>", i + 9);
      const text = xml.slice(i + 9, end);
      stack[stack.length - 1]._children.push({ _name: "#text", _value: text });
      i = end + 3;
      continue;
    }

    // Closing tag
    if (xml.startsWith("</", i)) {
      const end = xml.indexOf(">", i + 2);
      const tagName = xml.slice(i + 2, end);
      stack.pop();
      i = end + 1;
      continue;
    }

    // Opening tag
    if (xml.startsWith("<", i)) {
      const end = xml.indexOf(">", i + 1);
      const tagContent = xml.slice(i + 1, end);
      i = end + 1;

      if (tagContent.endsWith("/")) {
        // Self-closing tag
        const name = tagContent.slice(0, -1).split(/\s+/)[0];
        stack[stack.length - 1]._children.push({ _name: name, _children: [] });
      } else {
        const parts = tagContent.split(/\s+/);
        const name = parts[0];
        const attrs = {};
        for (let j = 1; j < parts.length; j++) {
          const am = parts[j].match(/([^=]+)="([^"]*)"/);
          if (am) attrs[am[1]] = am[2];
        }
        const elem = { _name: name, _attrs: attrs, _children: [] };
        stack[stack.length - 1]._children.push(elem);
        stack.push(elem);
      }
      continue;
    }

    i++;
  }

  return root._children;
}

/**
 * Navigate parsed XML by path.
 */
function xmlPathGet(parsed, path) {
  const parts = path.split(/\./);
  let current = parsed;
  for (const part of parts) {
    if (!Array.isArray(current)) return undefined;
    const found = current.find(c => c._name === part);
    if (!found) return undefined;
    // Return text value if no further children
    if (found._children && found._children.length === 1 && found._children[0]._name === "#text") {
      current = found._children[0]._value;
    } else {
      current = found._children || [];
    }
  }
  return current;
}

// ──────────────────────────────────────────────
// 4. CSV Tool
// ──────────────────────────────────────────────

/**
 * CSV tool.
 * Query and filter CSV data.
 */
export const csvTool = tool({
  description: `Query and filter CSV data.
Parse comma-separated values, select columns, filter rows.
Useful for analyzing spreadsheets and data exports.`,
  args: {
    data: tool.schema.string().describe("The CSV data to process"),
    columns: tool.schema
      .string()
      .optional()
      .describe("Comma-separated list of columns to include"),
    filter: tool.schema
      .string()
      .optional()
      .describe("Filter condition: column=value"),
    limit: tool.schema
      .number()
      .optional()
      .default(0)
      .describe("Maximum rows to return (0 = all)"),
  },
  async execute(args, context) {
    const data = args.data;
    const columns = args.columns ? args.columns.split(",").map(s => s.trim()) : null;
    const filterStr = args.filter;
    const limit = args.limit || 0;

    try {
      const rows = parseCsv(data);
      if (rows.length === 0) {
        return {
          title: "csv: empty",
          output: "No data found.",
          metadata: { rows: 0 },
        };
      }

      const headers = rows[0];
      let resultRows = rows.slice(1);

      // Apply filter
      if (filterStr) {
        const eqIdx = filterStr.indexOf("=");
        if (eqIdx === -1) {
          return {
            title: "csv: invalid filter",
            output: `Invalid filter format: "${filterStr}". Use column=value.`,
            metadata: { error: "invalid_filter" },
          };
        }
        const filterCol = filterStr.slice(0, eqIdx).trim();
        const filterVal = filterStr.slice(eqIdx + 1).trim();
        const colIdx = headers.indexOf(filterCol);
        if (colIdx === -1) {
          return {
            title: "csv: column not found",
            output: `Column "${filterCol}" not found. Available: ${headers.join(", ")}`,
            metadata: { error: "column_not_found" },
          };
        }
        resultRows = resultRows.filter(row => row[colIdx] === filterVal);
      }

      // Select columns
      if (columns) {
        const colIndices = columns.map(col => {
          const idx = headers.indexOf(col);
          if (idx === -1) throw new Error(`Column "${col}" not found.`);
          return idx;
        });
        headers.length = 0;
        headers.push(...columns);
        resultRows = resultRows.map(row => colIndices.map(i => row[i]));
      }

      // Apply limit
      if (limit > 0) {
        resultRows = resultRows.slice(0, limit);
      }

      // Format output as aligned table
      const allRows = [headers, ...resultRows];
      const colWidths = headers.map((h, i) =>
        Math.max(h.length, ...resultRows.map(r => String(r[i] || "").length))
      );

      const formatRow = (row) =>
        row.map((cell, i) => String(cell || "").padEnd(colWidths[i])).join(" | ");

      const separator = colWidths.map(w => "-".repeat(w)).join("-|-");

      const output = [
        formatRow(headers),
        separator,
        ...resultRows.map(formatRow),
      ].join("\n");

      return {
        title: `csv: ${resultRows.length} rows`,
        output: output,
        metadata: {
          totalRows: rows.length - 1,
          filteredRows: resultRows.length,
          columns: headers.length,
          headers,
        },
      };
    } catch (error) {
      return {
        title: "csv: error",
        output: `Error: ${error.message}`,
        metadata: { error: error.message },
      };
    }
  },
});

/**
 * Simple CSV parser (handles quoted fields).
 */
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
  const rows = [];
  for (const line of lines) {
    const row = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === "," && !inQuotes) {
        row.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
    row.push(current);
    rows.push(row);
  }
  return rows;
}

// ──────────────────────────────────────────────
// 5. TSV Tool
// ──────────────────────────────────────────────

/**
 * TSV tool.
 * Convert between TSV and JSON.
 */
export const tsvTool = tool({
  description: `Convert between TSV (tab-separated values) and JSON formats.
Useful for working with spreadsheet exports and tabular data.`,
  args: {
    input: tool.schema.string().describe("The TSV or JSON string to convert"),
    action: tool.schema
      .string()
      .optional()
      .default("tsv2json")
      .describe("Action: tsv2json or json2tsv (default: tsv2json)"),
  },
  async execute(args, context) {
    const action = args.action || "tsv2json";
    const input = args.input;

    try {
      if (action === "tsv2json") {
        const lines = input.split(/\r?\n/).filter(l => l.trim() !== "");
        if (lines.length < 2) {
          return {
            title: "tsv: insufficient data",
            output: "TSV must have at least a header row and one data row.",
            metadata: { error: "insufficient_data" },
          };
        }
        const headers = lines[0].split("\t");
        const rows = lines.slice(1).map(line => {
          const vals = line.split("\t");
          const obj = {};
          headers.forEach((h, i) => { obj[h] = vals[i] || ""; });
          return obj;
        });
        const result = JSON.stringify(rows, null, 2);
        return {
          title: "tsv: tsv2json",
          output: result,
          metadata: { action, rows: rows.length, columns: headers.length },
        };
      } else if (action === "json2tsv") {
        const parsed = JSON.parse(input);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        if (arr.length === 0) {
          return {
            title: "tsv: empty",
            output: "Empty JSON array.",
            metadata: { rows: 0 },
          };
        }
        const headers = Object.keys(arr[0]);
        const lines = [headers.join("\t")];
        for (const row of arr) {
          lines.push(headers.map(h => String(row[h] ?? "")).join("\t"));
        }
        const result = lines.join("\n");
        return {
          title: "tsv: json2tsv",
          output: result,
          metadata: { action, rows: arr.length, columns: headers.length },
        };
      } else {
        return {
          title: "tsv: invalid action",
          output: `Invalid action: "${action}". Use "tsv2json" or "json2tsv".`,
          metadata: { error: "invalid_action" },
        };
      }
    } catch (error) {
      return {
        title: "tsv: error",
        output: `Error: ${error.message}`,
        metadata: { error: error.message },
      };
    }
  },
});

// ──────────────────────────────────────────────
// 6. INI Tool
// ──────────────────────────────────────────────

/**
 * INI tool.
 * Parse INI configuration files.
 */
export const iniTool = tool({
  description: `Parse INI configuration files to JSON.
Handles sections, key=value pairs, comments, and quoted values.
Useful for reading legacy configuration files.`,
  args: {
    input: tool.schema.string().describe("The INI string to parse"),
    action: tool.schema
      .string()
      .optional()
      .default("parse")
      .describe("Action: parse or convert (default: parse)"),
  },
  async execute(args, context) {
    const action = args.action || "parse";
    const input = args.input;

    try {
      const parsed = parseIni(input);

      if (action === "convert") {
        const result = JSON.stringify(parsed, null, 2);
        return {
          title: "ini: convert",
          output: result,
          metadata: { action, sections: Object.keys(parsed).length },
        };
      }

      // "parse" — show formatted tree
      const lines = [];
      for (const [section, keys] of Object.entries(parsed)) {
        if (section === "__global__") {
          for (const [k, v] of Object.entries(keys)) {
            lines.push(`${k}=${v}`);
          }
        } else {
          lines.push(`[${section}]`);
          for (const [k, v] of Object.entries(keys)) {
            lines.push(`  ${k}=${v}`);
          }
        }
      }

      return {
        title: `ini: parsed ${Object.keys(parsed).length} section(s)`,
        output: lines.join("\n") || "(empty)",
        metadata: {
          action,
          sections: Object.keys(parsed).length,
          keys: Object.values(parsed).reduce((sum, s) => sum + Object.keys(s).length, 0),
        },
      };
    } catch (error) {
      return {
        title: "ini: error",
        output: `Error: ${error.message}`,
        metadata: { error: error.message },
      };
    }
  },
});

/**
 * Parse INI format with sections.
 */
function parseIni(text) {
  const result = { __global__: {} };
  let currentSection = result.__global__;

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith(";") || trimmed.startsWith("#")) continue;

    // Section
    const sectionMatch = trimmed.match(/^\[(.+)\]$/);
    if (sectionMatch) {
      const sectionName = sectionMatch[1].trim();
      if (!result[sectionName]) result[sectionName] = {};
      currentSection = result[sectionName];
      continue;
    }

    // Key=value
    const kvMatch = trimmed.match(/^([^=]+?)=(.*)$/);
    if (kvMatch) {
      let key = kvMatch[1].trim();
      let value = kvMatch[2].trim();
      // Remove surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      currentSection[key] = value;
    }
  }

  return result;
}

// ──────────────────────────────────────────────
// 7. TOML Tool
// ──────────────────────────────────────────────

/**
 * TOML tool.
 * Convert between TOML and JSON.
 */
export const tomlTool = tool({
  description: `Convert between TOML and JSON formats.
Supports basic TOML: key-value pairs, tables, arrays, inline tables.
Useful for working with modern configuration files.`,
  args: {
    input: tool.schema.string().describe("The input string to convert"),
    action: tool.schema
      .string()
      .optional()
      .default("toml2json")
      .describe("Action: toml2json or json2toml (default: toml2json)"),
  },
  async execute(args, context) {
    const action = args.action || "toml2json";
    const input = args.input;

    try {
      if (action === "toml2json") {
        const parsed = parseToml(input);
        const result = JSON.stringify(parsed, null, 2);
        return {
          title: "toml: toml2json",
          output: result,
          metadata: { action, inputLength: input.length, outputLength: result.length },
        };
      } else if (action === "json2toml") {
        const parsed = JSON.parse(input);
        const result = toToml(parsed);
        return {
          title: "toml: json2toml",
          output: result,
          metadata: { action, inputLength: input.length, outputLength: result.length },
        };
      } else {
        return {
          title: "toml: invalid action",
          output: `Invalid action: "${action}". Use "toml2json" or "json2toml".`,
          metadata: { error: "invalid_action" },
        };
      }
    } catch (error) {
      return {
        title: "toml: error",
        output: `Error: ${error.message}`,
        metadata: { error: error.message },
      };
    }
  },
});

/**
 * Minimal TOML parser.
 */
function parseToml(text) {
  const root = { __warnings: [] };
  let current = root;

  for (const rawLine of text.split(/\r?\n/)) {
    const trimmed = rawLine.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;

    // Table header [table] or [table.sub]
    const tableMatch = trimmed.match(/^\[(.+)\]$/);
    if (tableMatch) {
      const path = tableMatch[1].trim();
      const parts = path.split(".");
      current = root;
      for (const part of parts) {
        if (!current[part] || typeof current[part] !== "object" || Array.isArray(current[part])) {
          current[part] = {};
        }
        current = current[part];
      }
      continue;
    }

    // Array of tables [[array]]
    const arrayTableMatch = trimmed.match(/^\[\[(.+)\]\]$/);
    if (arrayTableMatch) {
      const path = arrayTableMatch[1].trim();
      const parts = path.split(".");
      current = root;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (i === parts.length - 1) {
          if (!current[part]) current[part] = [];
          const newObj = {};
          current[part].push(newObj);
          current = newObj;
        } else {
          if (!current[part] || typeof current[part] !== "object") {
            current[part] = {};
          }
          current = current[part];
        }
      }
      continue;
    }

    // Key = value
    const kvMatch = trimmed.match(/^([^=]+?)\s*=\s*(.*)$/);
    if (kvMatch) {
      const key = kvMatch[1].trim();
      const valueStr = kvMatch[2].trim();
      current[key] = parseTomlValue(valueStr);
    }
  }

  delete root.__warnings;
  return root;
}

function parseTomlValue(str) {
  // Quoted string
  if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
    return str.slice(1, -1);
  }
  // Multiline basic string """..."""
  if (str.startsWith('"""') && str.endsWith('"""')) {
    return str.slice(3, -3).trim();
  }
  // Boolean
  if (str === "true") return true;
  if (str === "false") return false;
  // Date/time (keep as string)
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str;
  // Array
  if (str.startsWith("[")) {
    try {
      return JSON.parse(str);
    } catch {
      // Simple manual parse for flat arrays
      const inner = str.slice(1, -1);
      if (inner.trim() === "") return [];
      return inner.split(",").map(s => parseTomlValue(s.trim()));
    }
  }
  // Inline table {key = val, ...}
  if (str.startsWith("{")) {
    const inner = str.slice(1, -1);
    const obj = {};
    for (const pair of inner.split(",")) {
      const m = pair.match(/([^=]+)=\s*(.*)/);
      if (m) obj[m[1].trim()] = parseTomlValue(m[2].trim());
    }
    return obj;
  }
  // Number
  if (/^-?\d+(\.\d+)?$/.test(str)) return str.includes(".") ? parseFloat(str) : parseInt(str, 10);
  return str;
}

/**
 * Convert a JSON value to TOML string.
 */
function toToml(value, key) {
  if (value === null || value === undefined) return "";
  if (typeof value === "boolean") return `${key} = ${value}`;
  if (typeof value === "number") return `${key} = ${value}`;
  if (typeof value === "string") return `${key} = "${value.replace(/"/g, '\\"')}"`;
  if (Array.isArray(value)) {
    if (value.length === 0) return `${key} = []`;
    // Check if array contains tables
    if (value.length > 0 && typeof value[0] === "object" && value[0] !== null && !Array.isArray(value[0])) {
      return value.map(item => {
        const inner = toTomlTable(item, key);
        return `[[${key}]]\n${inner}`;
      }).join("\n\n");
    }
    // Simple array
    const items = value.map(v => {
      if (typeof v === "string") return `"${v.replace(/"/g, '\\"')}"`;
      return String(v);
    }).join(", ");
    return `${key} = [${items}]`;
  }
  if (typeof value === "object") {
    return toTomlTable(value, key);
  }
  return `${key} = ${value}`;
}

function toTomlTable(obj, key) {
  const lines = [];
  const subTables = [];
  const subArrays = [];

  for (const [k, v] of Object.entries(obj)) {
    if (v !== null && typeof v === "object" && !Array.isArray(v)) {
      subTables.push([k, v]);
    } else if (Array.isArray(v) && v.length > 0 && typeof v[0] === "object" && v[0] !== null) {
      subArrays.push([k, v]);
    } else {
      lines.push(toToml(v, k));
    }
  }

  for (const [k, v] of subTables) {
    const sub = toTomlTable(v, k);
    lines.push(`\n[${key ? `${key}.` : ""}${k}]\n${sub}`);
  }

  for (const [k, v] of subArrays) {
    for (const item of v) {
      const sub = toTomlTable(item, k);
      lines.push(`\n[[${key ? `${key}.` : ""}${k}]]\n${sub}`);
    }
  }

  return lines.join("\n");
}

// ──────────────────────────────────────────────
// 8. Properties Tool
// ──────────────────────────────────────────────

/**
 * Properties tool.
 * Parse Java .properties files.
 */
export const propertiesTool = tool({
  description: `Parse Java .properties configuration files to JSON.
Handles key=value pairs, comments (# and !), and multi-line values.
Useful for reading Java application configurations.`,
  args: {
    input: tool.schema.string().describe("The .properties string to parse"),
    action: tool.schema
      .string()
      .optional()
      .default("parse")
      .describe("Action: parse or tojson (default: parse)"),
  },
  async execute(args, context) {
    const action = args.action || "parse";
    const input = args.input;

    try {
      const parsed = parseProperties(input);

      if (action === "tojson") {
        const result = JSON.stringify(parsed, null, 2);
        return {
          title: "properties: tojson",
          output: result,
          metadata: { action, keys: Object.keys(parsed).length },
        };
      }

      // "parse" — show key=value pairs
      const lines = Object.entries(parsed).map(([k, v]) => `${k}=${v}`);
      return {
        title: `properties: ${Object.keys(parsed).length} key(s)`,
        output: lines.join("\n") || "(empty)",
        metadata: { action, keys: Object.keys(parsed).length },
      };
    } catch (error) {
      return {
        title: "properties: error",
        output: `Error: ${error.message}`,
        metadata: { error: error.message },
      };
    }
  },
});

/**
 * Parse Java .properties format.
 */
function parseProperties(text) {
  const result = {};
  let continuedKey = null;
  let continuedValue = "";

  for (const rawLine of text.split(/\r?\n/)) {
    const trimmed = rawLine.trim();

    // Skip comments and empty lines
    if (trimmed === "" || trimmed.startsWith("#") || trimmed.startsWith("!")) {
      if (continuedKey) {
        result[continuedKey] = continuedValue.trim();
        continuedKey = null;
        continuedValue = "";
      }
      continue;
    }

    // Continuation line (ends with backslash)
    if (trimmed.endsWith("\\")) {
      if (continuedKey) {
        continuedValue += trimmed.slice(0, -1);
      } else {
        const eqIdx = trimmed.indexOf("=");
        const colonIdx = trimmed.indexOf(":");
        const sepIdx = eqIdx >= 0 && (colonIdx < 0 || eqIdx < colonIdx) ? eqIdx : colonIdx;
        if (sepIdx >= 0) {
          continuedKey = trimmed.slice(0, sepIdx).trim();
          continuedValue = trimmed.slice(sepIdx + 1, -1);
        } else {
          continuedKey = trimmed.slice(0, -1).trim();
          continuedValue = "";
        }
      }
      continue;
    }

    if (continuedKey) {
      continuedValue += trimmed;
      result[continuedKey] = continuedValue.trim();
      continuedKey = null;
      continuedValue = "";
      continue;
    }

    // Key = value or Key: value
    const eqIdx = trimmed.indexOf("=");
    const colonIdx = trimmed.indexOf(":");
    const sepIdx = eqIdx >= 0 && (colonIdx < 0 || eqIdx < colonIdx) ? eqIdx : colonIdx;

    if (sepIdx >= 0) {
      const key = trimmed.slice(0, sepIdx).trim();
      let value = trimmed.slice(sepIdx + 1).trim();
      // Unescape
      value = value.replace(/\\([nrt])/g, (_, esc) => {
        switch (esc) { case "n": return "\n"; case "r": return "\r"; case "t": return "\t"; default: return esc; }
      });
      result[key] = value;
    } else {
      result[trimmed] = "";
    }
  }

  // Flush continued value at EOF
  if (continuedKey) {
    result[continuedKey] = continuedValue.trim();
  }

  return result;
}

// ──────────────────────────────────────────────
// 9. Plist Tool
// ──────────────────────────────────────────────

/**
 * Plist tool.
 * Parse Apple plist format (XML plist only).
 */
export const plistTool = tool({
  description: `Parse Apple plist (property list) files.
Supports XML plist format (not binary).
Useful for reading macOS/iOS configuration and preferences.`,
  args: {
    input: tool.schema.string().describe("The plist XML string to parse"),
    action: tool.schema
      .string()
      .optional()
      .default("parse")
      .describe("Action: parse or tojson (default: parse)"),
  },
  async execute(args, context) {
    const action = args.action || "parse";
    const input = args.input;

    try {
      const parsed = parsePlist(input);

      if (action === "tojson") {
        const result = JSON.stringify(parsed, null, 2);
        return {
          title: "plist: tojson",
          output: result,
          metadata: { action, inputLength: input.length, outputLength: result.length },
        };
      }

      // "parse" — show tree
      const lines = plistTreeToString(parsed, 0);
      return {
        title: "plist: parsed",
        output: lines.join("\n"),
        metadata: { action, type: Array.isArray(parsed) ? "array" : typeof parsed },
      };
    } catch (error) {
      return {
        title: "plist: error",
        output: `Error: ${error.message}`,
        metadata: { error: error.message },
      };
    }
  },
});

/**
 * Parse XML plist format.
 */
function parsePlist(xml) {
  // Extract DOCTYPE and plist wrapper, then parse inner content
  const content = xml.replace(/<\?xml[^>]*\?>/, "").replace(/<!DOCTYPE[^>]*>/, "").trim();
  // Strip <plist> wrapper
  const inner = content.replace(/<\/?plist[^>]*>/g, "").trim();
  return parsePlistValue(inner);
}

function parsePlistValue(xml) {
  xml = xml.trim();

  // <dict>...</dict>
  if (xml.startsWith("<dict>")) {
    const result = {};
    const inner = xml.slice(6, xml.lastIndexOf("</dict>"));
    const entries = parsePlistPairs(inner);
    for (const [key, value] of entries) {
      result[key] = value;
    }
    return result;
  }

  // <array>...</array>
  if (xml.startsWith("<array>")) {
    const inner = xml.slice(7, xml.lastIndexOf("</array>"));
    return parsePlistArray(inner);
  }

  // <string>...</string>
  const strMatch = xml.match(/^<string>(.*?)<\/string>$/s);
  if (strMatch) return strMatch[1];

  // <integer>...</integer>
  const intMatch = xml.match(/^<integer>(-?\d+)<\/integer>$/);
  if (intMatch) return parseInt(intMatch[1], 10);

  // <real>...</real>
  const realMatch = xml.match(/^<real>(-?\d+(?:\.\d+)?)<\/real>$/);
  if (realMatch) return parseFloat(realMatch[1]);

  // <true/> or <true />
  if (xml.startsWith("<true")) return true;
  // <false/> or <false />
  if (xml.startsWith("<false")) return false;

  // <data>...</data>
  const dataMatch = xml.match(/^<data>(.*?)<\/data>$/s);
  if (dataMatch) return `[base64: ${dataMatch[1].trim()}]`;

  // <date>...</date>
  const dateMatch = xml.match(/^<date>(.*?)<\/date>$/);
  if (dateMatch) return dateMatch[1];

  return xml;
}

function parsePlistPairs(xml) {
  const results = [];
  let remaining = xml.trim();
  const keyRegex = /<key>(.*?)<\/key>/;

  while (remaining.length > 0) {
    const km = remaining.match(keyRegex);
    if (!km) break;
    const key = km[1];
    remaining = remaining.slice(km.index + km[0].length).trim();

    // Find the value
    let valueEnd = 0;
    if (remaining.startsWith("<dict>")) {
      const endTag = "</dict>";
      const endIdx = remaining.indexOf(endTag);
      if (endIdx === -1) break;
      valueEnd = endIdx + endTag.length;
      const valueXml = remaining.slice(0, valueEnd);
      results.push([key, parsePlistValue(valueXml)]);
    } else if (remaining.startsWith("<array>")) {
      const endTag = "</array>";
      const endIdx = remaining.indexOf(endTag);
      if (endIdx === -1) break;
      valueEnd = endIdx + endTag.length;
      const valueXml = remaining.slice(0, valueEnd);
      results.push([key, parsePlistValue(valueXml)]);
    } else {
      const tagMatch = remaining.match(/^<(string|integer|real|true|false|data|date)[\s>]/);
      if (!tagMatch) break;
      const tagName = tagMatch[1];
      if (tagName === "true" || tagName === "false") {
        const m = remaining.match(/^<(true|false)\s*\/\s*>/);
        if (m) {
          valueEnd = m[0].length;
          results.push([key, tagName === "true"]);
        } else {
          break;
        }
      } else {
        const endTag = `</${tagName}>`;
        const m = remaining.match(new RegExp(`^<${tagName}[^>]*>(.*?)${endTag.replace("/", "\\/")}`));
        if (m) {
          valueEnd = m.index + m[0].length;
          const valueXml = m[0];
          results.push([key, parsePlistValue(valueXml)]);
        } else {
          break;
        }
      }
    }
    remaining = remaining.slice(valueEnd).trim();
  }

  return results;
}

function parsePlistArray(xml) {
  const results = [];
  let remaining = xml.trim();

  while (remaining.length > 0) {
    let valueEnd = 0;
    let parsed = null;

    if (remaining.startsWith("<dict>")) {
      const endTag = "</dict>";
      const endIdx = remaining.indexOf(endTag);
      if (endIdx === -1) break;
      valueEnd = endIdx + endTag.length;
      parsed = parsePlistValue(remaining.slice(0, valueEnd));
    } else if (remaining.startsWith("<array>")) {
      const endTag = "</array>";
      const endIdx = remaining.indexOf(endTag);
      if (endIdx === -1) break;
      valueEnd = endIdx + endTag.length;
      parsed = parsePlistValue(remaining.slice(0, valueEnd));
    } else {
      const tagMatch = remaining.match(/^<(string|integer|real|true|false|data|date)[\s>]/);
      if (!tagMatch) break;
      const tagName = tagMatch[1];
      if (tagName === "true" || tagName === "false") {
        const m = remaining.match(/^<(true|false)\s*\/\s*>/);
        if (m) {
          valueEnd = m[0].length;
          parsed = tagName === "true";
        } else {
          break;
        }
      } else {
        const endTag = `</${tagName}>`;
        const m = remaining.match(new RegExp(`^<${tagName}[^>]*>(.*?)${endTag.replace("/", "\\/")}`));
        if (m) {
          valueEnd = m.index + m[0].length;
          parsed = parsePlistValue(m[0]);
        } else {
          break;
        }
      }
    }

    if (parsed !== null) {
      results.push(parsed);
    }
    remaining = remaining.slice(valueEnd).trim();
  }

  return results;
}

function plistTreeToString(value, indent) {
  const pad = "  ".repeat(indent);
  if (value === null) return [`${pad}null`];
  if (typeof value === "boolean") return [`${pad}${value}`];
  if (typeof value === "number") return [`${pad}${value}`];
  if (typeof value === "string") return [`${pad}"${value}"`];
  if (Array.isArray(value)) {
    if (value.length === 0) return [`${pad}[]`];
    const lines = [`${pad}[`];
    for (const item of value) {
      lines.push(...plistTreeToString(item, indent + 1).map(l => l.trimStart() ? l : l));
      // We'll just use a simpler approach
    }
    // Simpler output for arrays
    const items = value.map(v => JSON.stringify(v)).join(", ");
    return [`${pad}[${items}]`];
  }
  if (typeof value === "object") {
    const keys = Object.keys(value);
    if (keys.length === 0) return [`${pad}{}`];
    const lines = [`${pad}{`];
    for (const key of keys) {
      lines.push(`  ${pad}${key} = ${JSON.stringify(value[key])}`);
    }
    lines.push(`${pad}}`);
    return lines;
  }
  return [`${pad}${String(value)}`];
}

// ──────────────────────────────────────────────
// 10. MsgPack Tool
// ──────────────────────────────────────────────

/**
 * MsgPack tool.
 * Simulate MessagePack encoding/decoding using JSON↔base64.
 */
export const msgpackTool = tool({
  description: `Simulate MessagePack encode/decode using JSON↔Base64 conversion.
Encodes JSON data to a Base64 representation (simulating MsgPack binary),
and decodes Base64 back to formatted JSON.
Useful for working with binary serialization formats.`,
  args: {
    input: tool.schema.string().describe("JSON string (encode) or Base64 string (decode)"),
    action: tool.schema
      .string()
      .optional()
      .default("encode")
      .describe("Action: encode or decode (default: encode)"),
  },
  async execute(args, context) {
    const action = args.action || "encode";
    const input = args.input;

    try {
      if (action === "encode") {
        // Validate JSON, then encode as base64
        const parsed = JSON.parse(input);
        const jsonStr = JSON.stringify(parsed);
        const encoded = Buffer.from(jsonStr, "utf8").toString("base64");
        return {
          title: "msgpack: encode",
          output: encoded,
          metadata: {
            action,
            inputLength: input.length,
            outputLength: encoded.length,
            originalType: Array.isArray(parsed) ? "array" : typeof parsed,
          },
        };
      } else if (action === "decode") {
        const decoded = Buffer.from(input, "base64").toString("utf8");
        // Validate it's valid JSON
        const parsed = JSON.parse(decoded);
        const result = JSON.stringify(parsed, null, 2);
        return {
          title: "msgpack: decode",
          output: result,
          metadata: {
            action,
            inputLength: input.length,
            outputLength: result.length,
          },
        };
      } else {
        return {
          title: "msgpack: invalid action",
          output: `Invalid action: "${action}". Use "encode" or "decode".`,
          metadata: { error: "invalid_action" },
        };
      }
    } catch (error) {
      return {
        title: "msgpack: error",
        output: `Error: ${error.message}`,
        metadata: { error: error.message },
      };
    }
  },
});

// ──────────────────────────────────────────────
// 11. Diff Tool
// ──────────────────────────────────────────────

/**
 * Diff tool.
 * Compute line-based diff between two texts using LCS.
 */
export const diffTool = tool({
  description: `Compute line-based diff between two texts.
Uses Longest Common Subsequence (LCS) algorithm to find differences.
Shows added, removed, and unchanged lines with context.
Useful for comparing file versions and debugging changes.`,
  args: {
    text1: tool.schema.string().describe("The original text"),
    text2: tool.schema.string().describe("The modified text"),
    context: tool.schema
      .number()
      .optional()
      .default(3)
      .describe("Number of context lines around changes (default: 3)"),
  },
  async execute(args, context) {
    const text1 = args.text1;
    const text2 = args.text2;
    const ctx = Math.max(0, args.context ?? 3);

    try {
      const lines1 = text1.split("\n");
      const lines2 = text2.split("\n");
      const result = computeUnifiedDiff(lines1, lines2, ctx);

      return {
        title: `diff: ${result.changes} change(s)`,
        output: result.output,
        metadata: {
          lines1: lines1.length,
          lines2: lines2.length,
          changes: result.changes,
          additions: result.additions,
          deletions: result.deletions,
        },
      };
    } catch (error) {
      return {
        title: "diff: error",
        output: `Error: ${error.message}`,
        metadata: { error: error.message },
      };
    }
  },
});

/**
 * Compute LCS-based unified diff.
 */
function computeUnifiedDiff(lines1, lines2, contextLines) {
  const lcs = computeLCS(lines1, lines2);
  const changes = [];
  let i1 = 0, i2 = 0, lcsIdx = 0;

  while (i1 < lines1.length || i2 < lines2.length) {
    if (lcsIdx < lcs.length && lines1[i1] === lcs[lcsIdx] && lines2[i2] === lcs[lcsIdx]) {
      changes.push({ type: "same", line: lines1[i1] });
      i1++;
      i2++;
      lcsIdx++;
    } else if (lcsIdx < lcs.length && lines1[i1] !== lcs[lcsIdx]) {
      changes.push({ type: "del", line: lines1[i1] });
      i1++;
    } else if (lcsIdx < lcs.length && lines2[i2] !== lcs[lcsIdx]) {
      changes.push({ type: "add", line: lines2[i2] });
      i2++;
    } else if (i1 < lines1.length) {
      changes.push({ type: "del", line: lines1[i1] });
      i1++;
    } else if (i2 < lines2.length) {
      changes.push({ type: "add", line: lines2[i2] });
      i2++;
    } else {
      break;
    }
  }

  // Generate unified diff output with context
  const outputLines = [];
  let additions = 0, deletions = 0;

  // Group changes into hunks
  const hunks = [];
  let currentHunk = null;

  for (let i = 0; i < changes.length; i++) {
    const c = changes[i];
    if (c.type === "same") {
      if (currentHunk) {
        currentHunk.lines.push(c);
        // Count trailing context
        const trailingContext = currentHunk.lines.filter(l => l.type === "same").length;
        if (trailingContext > contextLines * 2) {
          // Trim extra context
          while (currentHunk.lines.length > 0) {
            const last = currentHunk.lines[currentHunk.lines.length - 1];
            if (last.type === "same" && trailingContext > contextLines) {
              currentHunk.lines.pop();
              // Recalculate
            } else {
              break;
            }
          }
          hunks.push(currentHunk);
          currentHunk = null;
        }
      }
    } else {
      if (!currentHunk) {
        currentHunk = { lines: [] };
        // Add context before
        const start = Math.max(0, i - contextLines);
        for (let j = start; j < i; j++) {
          currentHunk.lines.push(changes[j]);
        }
      }
      currentHunk.lines.push(c);
    }
  }
  if (currentHunk) hunks.push(currentHunk);

  // If no hunks, everything is the same
  if (hunks.length === 0) {
    return { output: "(no differences)", changes: 0, additions: 0, deletions: 0 };
  }

  for (const hunk of hunks) {
    const hunkChanges = hunk.lines.filter(l => l.type !== "same");
    const firstChangeIdx = changes.indexOf(hunkChanges[0]);
    const hunkStart1 = Math.max(0, firstChangeIdx - contextLines);
    const hunkStart2 = Math.max(0, firstChangeIdx - contextLines);

    // Simplified: just show changes with unified format
    for (const c of hunk.lines) {
      switch (c.type) {
        case "add":
          outputLines.push(`+${c.line}`);
          additions++;
          break;
        case "del":
          outputLines.push(`-${c.line}`);
          deletions++;
          break;
        case "same":
          outputLines.push(` ${c.line}`);
          break;
      }
    }
  }

  const totalChanges = additions + deletions;
  const header = `--- text1\n+++ text2\n@@ -1,${lines1.length} +1,${lines2.length} @@\n`;

  return {
    output: totalChanges > 0 ? header + outputLines.join("\n") : "(no differences)",
    changes: totalChanges,
    additions,
    deletions,
  };
}

/**
 * Compute LCS (Longest Common Subsequence) of two string arrays.
 */
function computeLCS(a, b) {
  const m = a.length;
  const n = b.length;
  // Build DP table
  const dp = Array.from({ length: m + 1 }, () => new Int32Array(n + 1));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  // Backtrack
  const result = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      result.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  return result;
}

// ──────────────────────────────────────────────
// 12. Patch Tool
// ──────────────────────────────────────────────

/**
 * Patch tool.
 * Apply a unified diff to a text.
 */
export const patchTool = tool({
  description: `Apply a unified diff (patch) to text.
Parses unified diff format and applies additions/deletions.
Useful for applying code changes and patching configuration files.`,
  args: {
    input: tool.schema.string().describe("The original text to patch"),
    patch: tool.schema.string().describe("The unified diff/patch to apply"),
  },
  async execute(args, context) {
    const input = args.input;
    const patchStr = args.patch;

    try {
      const lines = input.split("\n");
      const result = applyPatch(lines, patchStr);

      return {
        title: `patch: ${result.applied} change(s) applied`,
        output: result.output.join("\n"),
        metadata: {
          inputLines: lines.length,
          outputLines: result.output.length,
          applied: result.applied,
          failed: result.failed,
        },
      };
    } catch (error) {
      return {
        title: "patch: error",
        output: `Error: ${error.message}`,
        metadata: { error: error.message },
      };
    }
  },
});

/**
 * Apply a unified diff patch.
 * Parses simple unified diff format (---/+++ header, @@ hunk headers,
 * lines starting with +, -, or space).
 */
function applyPatch(lines, patchStr) {
  const patchLines = patchStr.split("\n");
  const hunks = parseUnifiedHunks(patchLines);

  let applied = 0;
  let failed = 0;
  let result = [...lines];

  for (const hunk of hunks) {
    const searchStart = Math.max(0, hunk.oldStart - 1);
    // Try to find the context in the current result
    const contextLines = hunk.lines.filter(l => l.type === "ctx").map(l => l.text);
    const searchLines = result.slice(searchStart, searchStart + contextLines.length + hunk.lines.filter(l => l.type !== "ctx").length);

    let matchIdx = searchStart;
    let matched = true;

    // Simple strategy: match context lines sequentially
    let ri = searchStart;
    let pi = 0;
    let tempResult = [...result];
    let changes = 0;

    while (pi < hunk.lines.length && ri < tempResult.length) {
      const pl = hunk.lines[pi];
      if (pl.type === "ctx") {
        if (tempResult[ri] === pl.text) {
          pi++;
          ri++;
        } else {
          matched = false;
          break;
        }
      } else if (pl.type === "del") {
        if (tempResult[ri] === pl.text) {
          tempResult.splice(ri, 1);
          pi++;
          changes++;
        } else {
          matched = false;
          break;
        }
      } else if (pl.type === "add") {
        tempResult.splice(ri, 0, pl.text);
        ri++;
        pi++;
        changes++;
      }
    }

    if (matched && pi === hunk.lines.length) {
      result = tempResult;
      applied += changes;
    } else {
      failed++;
    }
  }

  return { output: result, applied, failed };
}

/**
 * Parse unified diff format into hunks.
 */
function parseUnifiedHunks(patchLines) {
  const hunks = [];
  let currentHunk = null;

  for (const line of patchLines) {
    // Hunk header: @@ -oldStart,oldCount +newStart,newCount @@
    const hunkMatch = line.match(/^@@\s+-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/);
    if (hunkMatch) {
      if (currentHunk) hunks.push(currentHunk);
      currentHunk = {
        oldStart: parseInt(hunkMatch[1], 10),
        newStart: parseInt(hunkMatch[2], 10),
        lines: [],
      };
      continue;
    }

    // Skip --- and +++ header lines
    if (line.startsWith("--- ") || line.startsWith("+++ ")) continue;
    // Skip index, diff --git etc
    if (line.startsWith("diff --") || line.startsWith("index ") || line.startsWith("new file") || line.startsWith("deleted file")) continue;

    if (currentHunk) {
      if (line.startsWith("+")) {
        currentHunk.lines.push({ type: "add", text: line.slice(1) });
      } else if (line.startsWith("-")) {
        currentHunk.lines.push({ type: "del", text: line.slice(1) });
      } else if (line.startsWith(" ")) {
        currentHunk.lines.push({ type: "ctx", text: line.slice(1) });
      } else if (line === "\\ No newline at end of file") {
        // Ignore
      }
    }
  }

  if (currentHunk) hunks.push(currentHunk);
  return hunks;
}

// ──────────────────────────────────────────────
// 13. Table Tool
// ──────────────────────────────────────────────

/**
 * Table tool.
 * Pretty-print a JSON array as an aligned table.
 */
export const tableTool = tool({
  description: `Pretty-print a JSON array of objects as an aligned ASCII table.
Automatically computes column widths and alignment.
Useful for displaying tabular data in the terminal.`,
  args: {
    data: tool.schema.string().describe("JSON array of objects to display as a table"),
    columns: tool.schema
      .string()
      .optional()
      .describe("Comma-separated list of columns to show (default: all)"),
  },
  async execute(args, context) {
    const dataStr = args.data;
    const columnsArg = args.columns;

    try {
      const parsed = JSON.parse(dataStr);
      const arr = Array.isArray(parsed) ? parsed : [parsed];

      if (arr.length === 0) {
        return {
          title: "table: empty",
          output: "(empty array)",
          metadata: { rows: 0 },
        };
      }

      // Collect all keys
      const allKeys = new Set();
      for (const item of arr) {
        if (item && typeof item === "object") {
          Object.keys(item).forEach(k => allKeys.add(k));
        }
      }

      let columns = columnsArg
        ? columnsArg.split(",").map(s => s.trim())
        : [...allKeys];

      // Filter to valid columns
      columns = columns.filter(c => allKeys.has(c));

      if (columns.length === 0) {
        return {
          title: "table: no columns",
          output: "No valid columns found.",
          metadata: { error: "no_columns" },
        };
      }

      // Compute max widths
      const colWidths = columns.map(col => {
        const headerLen = col.length;
        const maxDataLen = arr.reduce((max, row) => {
          const val = row[col];
          const str = val === null || val === undefined ? "" : String(val);
          return Math.max(max, str.length);
        }, 0);
        return Math.max(headerLen, maxDataLen);
      });

      // Build table
      const header = columns.map((col, i) => col.padEnd(colWidths[i])).join(" │ ");
      const separator = colWidths.map(w => "─".repeat(w)).join("─┼─");
      const rows = arr.map(item =>
        columns.map((col, i) => {
          const val = item[col];
          const str = val === null || val === undefined ? "" : String(val);
          return str.padEnd(colWidths[i]);
        }).join(" │ ")
      );

      const output = [header, separator, ...rows].join("\n");

      return {
        title: `table: ${arr.length} row(s), ${columns.length} col(s)`,
        output: output,
        metadata: {
          rows: arr.length,
          columns: columns.length,
          columnNames: columns,
        },
      };
    } catch (error) {
      return {
        title: "table: error",
        output: `Error: ${error.message}`,
        metadata: { error: error.message },
      };
    }
  },
});

// ──────────────────────────────────────────────
// 14. Chart Tool
// ──────────────────────────────────────────────

/**
 * Chart tool.
 * Render ASCII bar charts from numeric data.
 */
export const chartTool = tool({
  description: `Render an ASCII bar chart from numeric data.
Accepts a JSON array of numbers or {label, value} objects.
Useful for quick data visualization in the terminal.`,
  args: {
    data: tool.schema
      .string()
      .describe("JSON array of numbers or [{label, value}] objects"),
    width: tool.schema
      .number()
      .optional()
      .default(40)
      .describe("Width of the chart in characters (default: 40)"),
  },
  async execute(args, context) {
    const dataStr = args.data;
    const width = Math.max(10, Math.min(120, args.width || 40));

    try {
      const parsed = JSON.parse(dataStr);
      const items = normalizeChartData(parsed);

      if (items.length === 0) {
        return {
          title: "chart: empty",
          output: "(no data)",
          metadata: { items: 0 },
        };
      }

      const maxValue = Math.max(...items.map(i => i.value), 1);
      const maxLabelLen = Math.max(...items.map(i => i.label.length));
      const barMaxWidth = width - maxLabelLen - 4; // label + " │ " + bar + " 123"

      const lines = [];
      for (const item of items) {
        const barLen = Math.max(1, Math.round((item.value / maxValue) * barMaxWidth));
        const bar = "█".repeat(Math.max(0, barLen - 1)) + (item.value > 0 ? "▌" : "");
        const label = item.label.padEnd(maxLabelLen);
        const valueStr = String(item.value).padStart(5);
        lines.push(`${label} │ ${bar} ${valueStr}`);
      }

      // Add scale line
      const scaleLine = `${"".padEnd(maxLabelLen)} │ 0${" ".repeat(barMaxWidth - 4)}${String(maxValue).padStart(5)}`;
      lines.push(scaleLine);

      return {
        title: `chart: ${items.length} bar(s)`,
        output: lines.join("\n"),
        metadata: {
          items: items.length,
          maxValue,
          chartWidth: width,
        },
      };
    } catch (error) {
      return {
        title: "chart: error",
        output: `Error: ${error.message}`,
        metadata: { error: error.message },
      };
    }
  },
});

/**
 * Normalize chart input data.
 */
function normalizeChartData(data) {
  if (!Array.isArray(data)) return [];
  return data.map((item, idx) => {
    if (typeof item === "number") {
      return { label: `#${idx + 1}`, value: item };
    }
    if (item && typeof item === "object" && "value" in item) {
      return {
        label: item.label !== undefined ? String(item.label) : `#${idx + 1}`,
        value: Number(item.value) || 0,
      };
    }
    return { label: `#${idx + 1}`, value: 0 };
  });
}

// ──────────────────────────────────────────────
// 15. Progress Tool
// ──────────────────────────────────────────────

/**
 * Progress tool.
 * Render an ASCII progress bar.
 */
export const progressTool = tool({
  description: `Render an ASCII progress bar with percentage.
Shows a visual progress indicator like [====>    ] 45%.
Useful for displaying completion status and task progress.`,
  args: {
    value: tool.schema.number().describe("Current progress value"),
    total: tool.schema
      .number()
      .optional()
      .default(100)
      .describe("Total/maximum value (default: 100)"),
    width: tool.schema
      .number()
      .optional()
      .default(30)
      .describe("Width of the progress bar in characters (default: 30)"),
  },
  async execute(args, context) {
    const value = args.value;
    const total = Math.max(1, args.total ?? 100);
    const width = Math.max(5, Math.min(100, args.width ?? 30));

    const fraction = Math.max(0, Math.min(1, value / total));
    const percent = Math.round(fraction * 100);
    const filled = Math.round(fraction * width);

    const bar = "=".repeat(Math.max(0, filled - 1)) + (filled > 0 ? ">" : "") + " ".repeat(Math.max(0, width - filled));

    // Clamp bar to exact width
    const clampedBar = bar.slice(0, width).padEnd(width, " ");

    const output = `[${clampedBar}] ${percent}%`;

    return {
      title: `progress: ${percent}%`,
      output: output,
      metadata: {
        value,
        total,
        percent,
        width,
        bar: clampedBar,
      },
    };
  },
});
