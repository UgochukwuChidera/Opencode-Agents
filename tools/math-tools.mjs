/**
 * Math Tools - Expression evaluation, Roman numerals, unit conversion, random utilities
 *
 * Provides tools for mathematical operations: safe expression evaluation (shunting-yard),
 * Roman numeral conversion, unit conversion, coin flips, dice rolls, password generation,
 * and lottery-style random selection.
 * All operations are local and cross-platform.
 */
import { tool } from "@opencode-ai/plugin";
import crypto from "crypto";

// ─── Safe Math Expression Evaluator (Shunting-Yard Algorithm) ─────────────────
// No eval() used. Implements proper recursive descent parser.

/**
 * Tokenizer for mathematical expressions.
 */
function tokenize(expr) {
  const tokens = [];
  let i = 0;
  while (i < expr.length) {
    const ch = expr[i];

    // Skip whitespace
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    // Numbers (including decimals)
    if (/\d/.test(ch) || (ch === "." && i + 1 < expr.length && /\d/.test(expr[i + 1]))) {
      let num = "";
      while (i < expr.length && (/\d/.test(expr[i]) || expr[i] === ".")) {
        num += expr[i];
        i++;
      }
      tokens.push({ type: "number", value: parseFloat(num) });
      continue;
    }

    // Function names (letters only)
    if (/[a-zA-Z]/.test(ch)) {
      let name = "";
      while (i < expr.length && /[a-zA-Z]/.test(expr[i])) {
        name += expr[i];
        i++;
      }
      tokens.push({ type: "function", value: name });
      continue;
    }

    // Operators and punctuation
    if ("+-*/%^(),".includes(ch)) {
      tokens.push({ type: "punctuation", value: ch });
      i++;
      continue;
    }

    throw new Error(`Unexpected character: "${ch}" at position ${i}`);
  }
  return tokens;
}

/**
 * Operator precedence and associativity.
 */
const PRECEDENCE = {
  "+": 2,
  "-": 2,
  "*": 3,
  "/": 3,
  "%": 3,
  "^": 4,
};

const RIGHT_ASSOC = {
  "^": true,
};

/**
 * Parse tokens using recursive descent into an AST.
 */
function parse(tokens) {
  let pos = 0;

  function peek() {
    return pos < tokens.length ? tokens[pos] : null;
  }

  function consume(expectedType, expectedValue) {
    const token = peek();
    if (!token) {
      throw new Error(expectedValue
        ? `Expected "${expectedValue}" but reached end of expression`
        : `Unexpected end of expression`);
    }
    if (expectedType && token.type !== expectedType) {
      throw new Error(`Expected ${expectedType} but got "${token.value}"`);
    }
    if (expectedValue !== undefined && token.value !== expectedValue) {
      throw new Error(`Expected "${expectedValue}" but got "${token.value}"`);
    }
    pos++;
    return token;
  }

  // Handle unary minus/plus
  function parseUnary() {
    const token = peek();
    if (!token) return null;

    if (token.type === "punctuation" && (token.value === "-" || token.value === "+")) {
      consume("punctuation", token.value);
      const operand = parseUnary();
      if (!operand) {
        throw new Error(`Expected expression after "${token.value}"`);
      }
      return {
        type: "unary",
        operator: token.value,
        operand,
      };
    }

    return parsePrimary();
  }

  function parsePrimary() {
    const token = peek();
    if (!token) return null;

    // Parenthesized expression
    if (token.type === "punctuation" && token.value === "(") {
      consume("punctuation", "(");
      const expr = parseExpression(0);
      consume("punctuation", ")");
      return expr;
    }

    // Number
    if (token.type === "number") {
      consume("number");
      return { type: "number", value: token.value };
    }

    // Function call
    if (token.type === "function") {
      consume("function");
      const name = token.value;
      const args = [];
      if (peek() && peek().type === "punctuation" && peek().value === "(") {
        consume("punctuation", "(");
        if (!(peek() && peek().type === "punctuation" && peek().value === ")")) {
          args.push(parseExpression(0));
          while (peek() && peek().type === "punctuation" && peek().value === ",") {
            consume("punctuation", ",");
            args.push(parseExpression(0));
          }
        }
        consume("punctuation", ")");
      }
      return { type: "function", name, args };
    }

    throw new Error(`Unexpected token: "${token.value}"`);
  }

  function parseExpression(minPrecedence) {
    let left = parseUnary();
    if (!left) return null;

    while (true) {
      const token = peek();
      if (!token || token.type !== "punctuation" || !["+", "-", "*", "/", "%", "^", ","].includes(token.value)) {
        break;
      }
      const op = token.value;
      const precedence = PRECEDENCE[op];
      if (precedence == null || precedence < minPrecedence) break;

      consume("punctuation", op);
      const rightMinPrecedence = precedence + (RIGHT_ASSOC[op] ? 0 : 1);
      const right = parseExpression(rightMinPrecedence);
      if (!right) {
        throw new Error(`Expected expression after "${op}"`);
      }

      left = {
        type: "binary",
        operator: op,
        left,
        right,
      };
    }

    return left;
  }

  const result = parseExpression(0);
  if (!result) {
    throw new Error("Empty expression");
  }
  if (pos < tokens.length) {
    throw new Error(`Unexpected token after expression: "${tokens[pos].value}"`);
  }
  return result;
}

/**
 * Math function implementations.
 */
const MATH_FUNCTIONS = {
  sqrt: (x) => {
    if (x < 0) throw new Error("sqrt of negative number");
    return Math.sqrt(x);
  },
  sin: (x) => Math.sin(x),
  cos: (x) => Math.cos(x),
  tan: (x) => Math.tan(x),
  asin: (x) => Math.asin(x),
  acos: (x) => Math.acos(x),
  atan: (x) => Math.atan(x),
  abs: (x) => Math.abs(x),
  round: (x) => Math.round(x),
  floor: (x) => Math.floor(x),
  ceil: (x) => Math.ceil(x),
  exp: (x) => Math.exp(x),
  log: (x) => {
    if (x <= 0) throw new Error("log of non-positive number");
    return Math.log(x);
  },
  log10: (x) => {
    if (x <= 0) throw new Error("log10 of non-positive number");
    return Math.log10(x);
  },
  min: (...args) => Math.min(...args),
  max: (...args) => Math.max(...args),
  mean: (...args) => {
    if (args.length === 0) throw new Error("mean requires at least one argument");
    return args.reduce((a, b) => a + b, 0) / args.length;
  },
  median: (...args) => {
    if (args.length === 0) throw new Error("median requires at least one argument");
    const sorted = [...args].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
  },
  stddev: (...args) => {
    if (args.length < 2) throw new Error("stddev requires at least two values");
    const m = args.reduce((a, b) => a + b, 0) / args.length;
    const variance = args.reduce((sum, v) => sum + (v - m) ** 2, 0) / (args.length - 1);
    return Math.sqrt(variance);
  },
  pi: () => Math.PI,
  e: () => Math.E,
};

/**
 * Evaluate an AST node.
 */
function evaluate(node) {
  if (!node) {
    throw new Error("Invalid expression: empty node");
  }

  switch (node.type) {
    case "number":
      return node.value;

    case "unary": {
      const val = evaluate(node.operand);
      return node.operator === "-" ? -val : val;
    }

    case "binary": {
      const left = evaluate(node.left);
      const right = evaluate(node.right);

      switch (node.operator) {
        case "+": return left + right;
        case "-": return left - right;
        case "*": return left * right;
        case "/": {
          if (right === 0) throw new Error("Division by zero");
          return left / right;
        }
        case "%": {
          if (right === 0) throw new Error("Modulo by zero");
          return left % right;
        }
        case "^": return Math.pow(left, right);
        default:
          throw new Error(`Unknown operator: "${node.operator}"`);
      }
    }

    case "function": {
      const name = node.name.toLowerCase();
      const func = MATH_FUNCTIONS[name];
      if (!func) {
        throw new Error(`Unknown function: "${name}". Available: ${Object.keys(MATH_FUNCTIONS).join(", ")}`);
      }
      const args = node.args.map(evaluate);
      return func(...args);
    }

    default:
      throw new Error(`Unknown node type: "${node.type}"`);
  }
}

/**
 * Safe math expression evaluator.
 * Uses recursive descent parser + AST evaluator. No eval().
 */
function safeEval(expression) {
  const tokens = tokenize(expression);
  if (tokens.length === 0) {
    throw new Error("Empty expression");
  }
  const ast = parse(tokens);
  const result = evaluate(ast);
  return result;
}

// ─── Tool 1: math ────────────────────────────────────────────────────────────

export const mathTool = tool({
  description: `Safe mathematical expression evaluator.
Supports: +, -, *, /, %, ^, sqrt(), sin(), cos(), tan(), asin(), acos(), atan(),
abs(), round(), floor(), ceil(), exp(), log(), log10(), min(), max(), mean(),
median(), stddev(), pi, e.
Uses a proper parser (NOT eval()).`,
  args: {
    expression: tool.schema
      .string()
      .describe("Mathematical expression to evaluate (e.g., 'sqrt(25) + 3 * 2^4')"),
  },
  async execute(args) {
    try {
      const expression = args.expression.trim();
      const result = safeEval(expression);

      // Format the result nicely
      const outputResult = Number.isInteger(result) ? String(result) : String(parseFloat(result.toFixed(10)));

      // Build a step-by-step breakdown
      const tokens = tokenize(expression);
      const ast = parse(tokens);

      return {
        title: `math: ${outputResult}`,
        output: `Expression: ${expression}\nResult:     ${outputResult}`,
        metadata: {
          expression,
          result,
          isInteger: Number.isInteger(result),
        },
      };
    } catch (err) {
      return {
        title: "math: error",
        output: `Error evaluating "${args.expression}":\n${err.message}`,
        metadata: { error: err.message },
      };
    }
  },
});

// ─── Tool 2: roman ───────────────────────────────────────────────────────────

const ROMAN_MAP = [
  [1000, "M"],
  [900, "CM"],
  [500, "D"],
  [400, "CD"],
  [100, "C"],
  [90, "XC"],
  [50, "L"],
  [40, "XL"],
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

function toRoman(num) {
  if (!Number.isInteger(num) || num < 1 || num > 3999) {
    throw new Error("Number must be an integer between 1 and 3999");
  }
  let result = "";
  let n = num;
  for (const [value, symbol] of ROMAN_MAP) {
    while (n >= value) {
      result += symbol;
      n -= value;
    }
  }
  return result;
}

function fromRoman(str) {
  const romanRegex = /^M{0,3}(CM|CD|D?C{0,3})(XC|XL|L?X{0,3})(IX|IV|V?I{0,3})$/;
  if (!romanRegex.test(str.toUpperCase())) {
    throw new Error(`Invalid Roman numeral: "${str}"`);
  }

  const map = {
    I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000,
  };

  const s = str.toUpperCase();
  let total = 0;
  let prev = 0;

  for (let i = s.length - 1; i >= 0; i--) {
    const val = map[s[i]];
    if (val < prev) {
      total -= val;
    } else {
      total += val;
      prev = val;
    }
  }

  // Validate by converting back
  if (toRoman(total) !== s) {
    throw new Error(`Invalid Roman numeral: "${str}"`);
  }

  return total;
}

export const romanTool = tool({
  description: `Convert between Roman numerals and numbers (1-3999).
Supports to-roman (number → Roman) and to-number (Roman → number).`,
  args: {
    input: tool.schema
      .string()
      .describe("Input: a number (e.g., '2025') or Roman numeral (e.g., 'MMXXV')"),
    action: tool.schema
      .string()
      .optional()
      .default("to-roman")
      .describe("Action: to-roman (default) or to-number"),
  },
  async execute(args) {
    try {
      const action = (args.action || "to-roman").toLowerCase();

      if (action === "to-roman") {
        const num = parseInt(args.input, 10);
        if (isNaN(num)) {
          return {
            title: "roman: invalid number",
            output: `Invalid number: "${args.input}". Provide an integer between 1 and 3999.`,
            metadata: { error: "invalid_number" },
          };
        }
        const result = toRoman(num);
        return {
          title: `roman: ${num} → ${result}`,
          output: `Number: ${num}\nRoman:  ${result}`,
          metadata: { number: num, roman: result },
        };
      } else if (action === "to-number") {
        const result = fromRoman(args.input);
        return {
          title: `roman: ${args.input.toUpperCase()} → ${result}`,
          output: `Roman:  ${args.input.toUpperCase()}\nNumber: ${result}`,
          metadata: { roman: args.input.toUpperCase(), number: result },
        };
      } else {
        return {
          title: "roman: invalid action",
          output: `Invalid action: "${action}". Use to-roman or to-number.`,
          metadata: { error: "invalid_action" },
        };
      }
    } catch (err) {
      return {
        title: "roman: error",
        output: `Error: ${err.message}`,
        metadata: { error: err.message },
      };
    }
  },
});

// ─── Tool 3: units ───────────────────────────────────────────────────────────

const UNIT_CONVERSIONS = {
  weight: {
    base: "kg",
    units: {
      mg: 0.000001,
      g: 0.001,
      kg: 1,
      t: 1000,
      oz: 0.0283495,
      lb: 0.453592,
      stone: 6.35029,
    },
  },
  length: {
    base: "m",
    units: {
      mm: 0.001,
      cm: 0.01,
      m: 1,
      km: 1000,
      in: 0.0254,
      ft: 0.3048,
      yd: 0.9144,
      mi: 1609.344,
    },
  },
  temperature: {
    base: "celsius",
    units: {
      celsius: "celsius",
      fahrenheit: "fahrenheit",
      kelvin: "kelvin",
    },
  },
  data: {
    base: "B",
    units: {
      b: 0.125,
      B: 1,
      KB: 1024,
      MB: 1048576,
      GB: 1073741824,
      TB: 1099511627776,
      Kb: 128,
      Mb: 131072,
      Gb: 134217728,
    },
  },
  speed: {
    base: "m/s",
    units: {
      "m/s": 1,
      "km/h": 0.277778,
      "mph": 0.44704,
      knot: 0.514444,
      "ft/s": 0.3048,
    },
  },
};

function convertTemperature(value, from, to) {
  // Convert to Celsius first
  let celsius;
  switch (from) {
    case "celsius": celsius = value; break;
    case "fahrenheit": celsius = (value - 32) * 5 / 9; break;
    case "kelvin": celsius = value - 273.15; break;
    default: throw new Error(`Unknown temperature unit: "${from}"`);
  }

  // Convert from Celsius
  switch (to) {
    case "celsius": return celsius;
    case "fahrenheit": return celsius * 9 / 5 + 32;
    case "kelvin": return celsius + 273.15;
    default: throw new Error(`Unknown temperature unit: "${to}"`);
  }
}

export const unitsTool = tool({
  description: `Unit conversion tool.
Convert between units of weight, temperature, length, data, and speed.
Supports metric and imperial units.`,
  args: {
    value: tool.schema
      .number()
      .describe("The numeric value to convert"),
    from: tool.schema
      .string()
      .describe("Source unit (e.g., 'kg', 'lb', 'm', 'ft', 'celsius', 'fahrenheit')"),
    to: tool.schema
      .string()
      .describe("Target unit (e.g., 'g', 'oz', 'km', 'mi', 'kelvin')"),
    category: tool.schema
      .string()
      .optional()
      .describe("Category: weight, temperature, length, data, speed. Auto-detected if omitted."),
  },
  async execute(args) {
    try {
      const { value, from, to } = args;
      const fromLower = from.toLowerCase();
      const toLower = to.toLowerCase();

      // Auto-detect category
      let category = args.category ? args.category.toLowerCase() : null;
      if (!category) {
        for (const [cat, info] of Object.entries(UNIT_CONVERSIONS)) {
          if (cat === "temperature") {
            if (info.units[fromLower] || info.units[toLower]) {
              category = cat;
              break;
            }
          } else {
            if (info.units[fromLower] !== undefined || info.units[toLower] !== undefined) {
              category = cat;
              break;
            }
          }
        }
      }

      if (!category || !UNIT_CONVERSIONS[category]) {
        return {
          title: "units: unknown category",
          output: `Could not determine conversion category for "${from}" → "${to}".\nAvailable categories: ${Object.keys(UNIT_CONVERSIONS).join(", ")}`,
          metadata: { error: "unknown_category" },
        };
      }

      const cat = UNIT_CONVERSIONS[category];
      let result;
      let resultUnit = toLower;

      if (category === "temperature") {
        result = convertTemperature(value, fromLower, toLower);
      } else {
        if (cat.units[fromLower] === undefined) {
          return {
            title: "units: unknown unit",
            output: `Unknown unit: "${from}" in category "${category}".\nAvailable: ${Object.keys(cat.units).join(", ")}`,
            metadata: { error: "unknown_unit" },
          };
        }
        if (cat.units[toLower] === undefined) {
          return {
            title: "units: unknown unit",
            output: `Unknown unit: "${to}" in category "${category}".\nAvailable: ${Object.keys(cat.units).join(", ")}`,
            metadata: { error: "unknown_unit" },
          };
        }
        const baseValue = value * cat.units[fromLower];
        result = baseValue / cat.units[toLower];
      }

      // Format output
      const formattedResult = Number.isFinite(result)
        ? (Math.abs(result) < 0.001 || Math.abs(result) > 999999
            ? result.toExponential(6)
            : parseFloat(result.toFixed(10)))
        : result;

      return {
        title: `units: ${value} ${from} → ${formattedResult} ${to}`,
        output: [
          `Value:    ${value}`,
          `From:     ${from}`,
          `To:       ${to}`,
          `Category: ${category}`,
          `Result:   ${formattedResult} ${to}`,
        ].join("\n"),
        metadata: {
          value,
          from: fromLower,
          to: toLower,
          category,
          result,
        },
      };
    } catch (err) {
      return {
        title: "units: error",
        output: `Error: ${err.message}`,
        metadata: { error: err.message },
      };
    }
  },
});

// ─── Tool 4: coin ────────────────────────────────────────────────────────────

export const coinTool = tool({
  description: `Flip one or more coins.
Returns 'Heads' or 'Tails' for each coin flip.`,
  args: {
    count: tool.schema
      .number()
      .optional()
      .default(1)
      .describe("Number of coins to flip (default: 1, max: 100)"),
  },
  async execute(args) {
    const count = Math.min(Math.max(1, args.count ?? 1), 100);
    const flips = [];
    let heads = 0;
    let tails = 0;

    for (let i = 0; i < count; i++) {
      const result = crypto.randomInt(2) === 0 ? "Heads" : "Tails";
      flips.push(result);
      if (result === "Heads") heads++;
      else tails++;
    }

    const output = count === 1
      ? `🪙 ${flips[0]}`
      : flips.map((f, i) => `${i + 1}. ${f}`).join("\n") +
        `\n───\nHeads: ${heads}\nTails: ${tails}`;

    return {
      title: `coin: ${count} flip(s)`,
      output,
      metadata: { count, flips, heads, tails },
    };
  },
});

// ─── Tool 5: dice ────────────────────────────────────────────────────────────

function parseDiceNotation(notation) {
  const regex = /^(\d*)[dD](\d+)([+-]\d+)?$/;
  const match = notation.trim().match(regex);
  if (!match) {
    throw new Error(`Invalid dice notation: "${notation}". Use format like "2d6", "d20", "3d8+4".`);
  }
  const count = match[1] ? parseInt(match[1], 10) : 1;
  const sides = parseInt(match[2], 10);
  const modifier = match[3] ? parseInt(match[3], 10) : 0;

  if (count < 1 || count > 100) throw new Error("Number of dice must be between 1 and 100");
  if (sides < 2 || sides > 1000) throw new Error("Number of sides must be between 2 and 1000");

  return { count, sides, modifier };
}

export const diceTool = tool({
  description: `Roll dice using standard notation (e.g., "2d6", "d20", "3d8+4").
Supports modifiers and multiple dice.`,
  args: {
    notation: tool.schema
      .string()
      .optional()
      .default("1d6")
      .describe("Dice notation (e.g., '2d6', 'd20', '3d8+4'). Default: 1d6"),
  },
  async execute(args) {
    try {
      const { count, sides, modifier } = parseDiceNotation(args.notation || "1d6");
      const rolls = [];

      for (let i = 0; i < count; i++) {
        rolls.push(crypto.randomInt(1, sides + 1));
      }

      const total = rolls.reduce((a, b) => a + b, 0) + modifier;
      const rollStr = rolls.join(", ");
      const modStr = modifier !== 0 ? `${modifier >= 0 ? " + " : " - "}${Math.abs(modifier)}` : "";

      const output = count === 1
        ? `🎲 ${args.notation || "1d6"}: ${total}`
        : [
            `🎲 ${args.notation || "1d6"}`,
            `Rolls: ${rollStr}`,
            `Total: ${total}${modStr}`,
          ].join("\n");

      return {
        title: `dice: ${total}`,
        output,
        metadata: {
          notation: args.notation || "1d6",
          count,
          sides,
          modifier,
          rolls,
          total,
        },
      };
    } catch (err) {
      return {
        title: "dice: error",
        output: `Error: ${err.message}`,
        metadata: { error: err.message },
      };
    }
  },
});

// ─── Tool 6: password ────────────────────────────────────────────────────────

const CHAR_SETS = {
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  lowercase: "abcdefghijklmnopqrstuvwxyz",
  digits: "0123456789",
  symbols: "!@#$%^&*()_+-=[]{}|;:,.<>?",
};

export const passwordTool = tool({
  description: `Generate random passwords with configurable character sets.
Uses cryptographically secure random bytes.`,
  args: {
    length: tool.schema
      .number()
      .optional()
      .default(16)
      .describe("Password length (default: 16, max: 256)"),
    uppercase: tool.schema
      .boolean()
      .optional()
      .default(true)
      .describe("Include uppercase letters (A-Z). Default: true"),
    lowercase: tool.schema
      .boolean()
      .optional()
      .default(true)
      .describe("Include lowercase letters (a-z). Default: true"),
    digits: tool.schema
      .boolean()
      .optional()
      .default(true)
      .describe("Include digits (0-9). Default: true"),
    symbols: tool.schema
      .boolean()
      .optional()
      .default(false)
      .describe("Include symbols. Default: false"),
    exclude: tool.schema
      .string()
      .optional()
      .describe("Characters to exclude from the generated password"),
  },
  async execute(args) {
    const length = Math.min(Math.max(4, args.length ?? 16), 256);

    let chars = "";
    if (args.uppercase !== false) chars += CHAR_SETS.uppercase;
    if (args.lowercase !== false) chars += CHAR_SETS.lowercase;
    if (args.digits !== false) chars += CHAR_SETS.digits;
    if (args.symbols === true) chars += CHAR_SETS.symbols;

    if (args.exclude) {
      chars = chars.replace(new RegExp(`[${args.exclude.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}]`, "g"), "");
    }

    if (chars.length === 0) {
      return {
        title: "password: no character sets",
        output: "No character sets selected. Enable at least one of: uppercase, lowercase, digits, symbols.",
        metadata: { error: "no_character_sets" },
      };
    }

    // Generate using crypto.randomBytes for secure randomness
    const bytes = crypto.randomBytes(length);
    let password = "";
    for (let i = 0; i < length; i++) {
      password += chars[bytes[i] % chars.length];
    }

    // Calculate entropy
    const entropy = Math.log2(chars.length) * length;

    // Determine strength
    let strength;
    if (entropy >= 80) strength = "Very Strong";
    else if (entropy >= 60) strength = "Strong";
    else if (entropy >= 40) strength = "Moderate";
    else strength = "Weak";

    return {
      title: `password: ${length} chars (${strength})`,
      output: [
        `Password: ${password}`,
        `Length:   ${length}`,
        `Charset:  ${chars.length} characters`,
        `Entropy:  ${entropy.toFixed(1)} bits (${strength})`,
        args.uppercase !== false ? `  ✓ Uppercase (A-Z)` : `  ✗ Uppercase`,
        args.lowercase !== false ? `  ✓ Lowercase (a-z)` : `  ✗ Lowercase`,
        args.digits !== false ? `  ✓ Digits (0-9)` : `  ✗ Digits`,
        args.symbols === true ? `  ✓ Symbols` : `  ✗ Symbols`,
      ].join("\n"),
      metadata: {
        password,
        length,
        charsetSize: chars.length,
        entropy: parseFloat(entropy.toFixed(1)),
        strength,
        characterSets: {
          uppercase: args.uppercase !== false,
          lowercase: args.lowercase !== false,
          digits: args.digits !== false,
          symbols: args.symbols === true,
        },
      },
    };
  },
});

// ─── Tool 7: lottery ─────────────────────────────────────────────────────────

export const lotteryTool = tool({
  description: `Randomly pick one or more items from a comma-separated list.
Useful for making random selections, drawing winners, or choosing options.`,
  args: {
    items: tool.schema
      .string()
      .describe("Comma-separated list of items to pick from"),
    count: tool.schema
      .number()
      .optional()
      .default(1)
      .describe("Number of items to pick (default: 1)"),
  },
  async execute(args) {
    try {
      const items = args.items.split(",").map((s) => s.trim()).filter(Boolean);
      if (items.length === 0) {
        return {
          title: "lottery: no items",
          output: "No items provided. Provide a comma-separated list.",
          metadata: { error: "no_items" },
        };
      }

      const count = Math.min(Math.max(1, args.count ?? 1), items.length);

      // Fisher-Yates shuffle (partial)
      const shuffled = [...items];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = crypto.randomInt(0, i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }

      const picked = shuffled.slice(0, count);

      const output = count === 1
        ? `🎯 Picked: ${picked[0]}`
        : [
            `🎯 Picked ${count} of ${items.length}:`,
            ...picked.map((p, i) => `${i + 1}. ${p}`),
          ].join("\n");

      return {
        title: `lottery: ${count} of ${items.length}`,
        output,
        metadata: {
          totalItems: items.length,
          picked: picked,
          count,
        },
      };
    } catch (err) {
      return {
        title: "lottery: error",
        output: `Error: ${err.message}`,
        metadata: { error: err.message },
      };
    }
  },
});
