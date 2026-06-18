/**
 * Date Tools - Date formatting, cron, duration, countdown, and clock utilities
 *
 * Provides tools for date/time operations: formatting, cron expression parsing,
 * duration parsing, countdowns, business day math, multi-timezone clocks, and more.
 * All operations are local and cross-platform.
 */
import { tool } from "@opencode-ai/plugin";

// ─── Shared helpers ──────────────────────────────────────────────────────────

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function pad(n, len = 2) {
  return String(n).padStart(len, "0");
}

function parseDate(input) {
  if (!input) return new Date();
  // Try ISO format first, then unix timestamp (number or "unix:1234567890")
  if (/^\d+$/.test(input)) {
    return new Date(Number(input) * 1000);
  }
  if (/^unix:/i.test(input)) {
    return new Date(Number(input.slice(5)) * 1000);
  }
  const d = new Date(input);
  if (isNaN(d.getTime())) {
    throw new Error(`Invalid date: "${input}". Use ISO 8601 format (e.g., "2025-12-25T10:30:00Z").`);
  }
  return d;
}

function formatDate(d, format, tz) {
  const opts = tz ? { timeZone: tz } : {};
  const year = tz
    ? new Intl.DateTimeFormat("en-CA", { ...opts, year: "numeric" }).format(d)
    : d.getFullYear();
  const month = tz
    ? pad(Number(new Intl.DateTimeFormat("en-US", { ...opts, month: "numeric" }).format(d)))
    : pad(d.getMonth() + 1);
  const day = tz
    ? pad(Number(new Intl.DateTimeFormat("en-US", { ...opts, day: "numeric" }).format(d)))
    : pad(d.getDate());
  const hours = tz
    ? pad(Number(new Intl.DateTimeFormat("en-US", { ...opts, hour: "numeric", hour12: false }).format(d)))
    : pad(d.getHours());
  const minutes = tz
    ? pad(Number(new Intl.DateTimeFormat("en-US", { ...opts, minute: "numeric" }).format(d)))
    : pad(d.getMinutes());
  const seconds = tz
    ? pad(Number(new Intl.DateTimeFormat("en-US", { ...opts, second: "numeric" }).format(d)))
    : pad(d.getSeconds());

  switch (format) {
    case "unix":
      return String(Math.floor(d.getTime() / 1000));
    case "YYYY-MM-DD":
      return `${year}-${month}-${day}`;
    case "ISO":
    default:
      return d.toISOString();
  }
}

// ─── Timer / stopwatch state (in-memory) ─────────────────────────────────────

const timers = new Map();

// ─── Tool 1: date ────────────────────────────────────────────────────────────

export const dateTool = tool({
  description: `Date format/convert.
Format or convert dates between ISO 8601, Unix timestamps, and human-readable formats.
Supports optional timezone conversion using IANA timezone names.`,
  args: {
    input: tool.schema
      .string()
      .optional()
      .describe("Date string (ISO 8601, 'unix:<timestamp>', or numeric Unix timestamp). Defaults to now."),
    format: tool.schema
      .string()
      .optional()
      .default("ISO")
      .describe("Output format: ISO (default), unix, YYYY-MM-DD, full (human readable)"),
    timezone: tool.schema
      .string()
      .optional()
      .describe("IANA timezone name (e.g., 'America/New_York', 'Asia/Tokyo'). Optional."),
  },
  async execute(args) {
    try {
      const d = parseDate(args.input);
      const format = (args.format || "ISO").toLowerCase();
      const tz = args.timezone || undefined;

      let output;
      if (format === "full") {
        const tzPart = tz ? ` (${tz})` : "";
        const dayName = DAYS[tz ? new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(d) : d.getDay()];
        const monthName = MONTHS[tz ? Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, month: "numeric" }).format(d)) - 1 : d.getMonth()];
        const year = tz ? new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric" }).format(d) : d.getFullYear();
        const dayNum = tz ? pad(Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, day: "numeric" }).format(d))) : pad(d.getDate());
        const hours = tz ? pad(Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", hour12: false }).format(d))) : pad(d.getHours());
        const mins = tz ? pad(Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, minute: "numeric" }).format(d))) : pad(d.getMinutes());
        const secs = tz ? pad(Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, second: "numeric" }).format(d))) : pad(d.getSeconds());
        output = `${dayName}, ${dayNum} ${monthName} ${year} ${hours}:${mins}:${secs}${tzPart}`;
      } else {
        output = formatDate(d, format, tz);
      }

      return {
        title: `date: ${output}`,
        output: [
          `Input:    ${args.input || "(now)"}`,
          `Format:   ${args.format || "ISO"}`,
          tz ? `Timezone: ${tz}` : null,
          `Output:   ${output}`,
        ].filter(Boolean).join("\n"),
        metadata: {
          input: args.input || null,
          format: args.format || "ISO",
          timezone: tz || null,
          output,
          unix: Math.floor(d.getTime() / 1000),
          iso: d.toISOString(),
        },
      };
    } catch (err) {
      return {
        title: "date: error",
        output: `Error: ${err.message}`,
        metadata: { error: err.message },
      };
    }
  },
});

// ─── Tool 2: cron ────────────────────────────────────────────────────────────

/**
 * Simple cron expression parser.
 * Supports standard 5-field cron: minute hour day-of-month month day-of-week
 * Also supports @yearly, @monthly, @weekly, @daily, @hourly aliases.
 */
function parseCron(expr) {
  const aliases = {
    "@yearly": "0 0 1 1 *",
    "@annually": "0 0 1 1 *",
    "@monthly": "0 0 1 * *",
    "@weekly": "0 0 * * 0",
    "@daily": "0 0 * * *",
    "@hourly": "0 * * * *",
  };
  if (aliases[expr]) return aliases[expr].split(/\s+/);
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) {
    throw new Error(`Cron expression must have 5 fields, got ${parts.length}. Use: minute hour day month weekday`);
  }
  return parts;
}

function describeCronField(val, fieldName, values) {
  if (val === "*") return `every ${fieldName}`;
  if (val.includes("/")) {
    const [, step] = val.split("/");
    return `every ${step} ${fieldName}(s)`;
  }
  if (val.includes(",")) {
    const items = val.split(",").map((v) => values[Number(v)] || v);
    return `${fieldName}: ${items.join(", ")}`;
  }
  if (val.includes("-")) {
    const [s, e] = val.split("-");
    return `${fieldName} ${values[Number(s)] || s} through ${values[Number(e)] || e}`;
  }
  if (values[Number(val)]) return `${fieldName} ${values[Number(val)]}`;
  return `${fieldName} ${val}`;
}

function describeCron(expr) {
  const parts = parseCron(expr);
  const [min, hour, dom, month, dow] = parts;

  const months = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const desc = [];
  desc.push(describeCronField(min, "minute", []));
  desc.push(describeCronField(hour, "hour", []));
  desc.push(describeCronField(dom, "day of month", []));
  desc.push(describeCronField(month, "month", months));
  desc.push(describeCronField(dow, "day of week", days));

  return desc.join(", ");
}

function validateCron(expr) {
  try {
    const parts = parseCron(expr);
    for (const p of parts) {
      if (/^[*/,\d-]+$/.test(p)) continue;
      return { valid: false, error: `Invalid field: "${p}"` };
    }
    return { valid: true, error: null };
  } catch (err) {
    return { valid: false, error: err.message };
  }
}

function nextCronTime(expr, fromDate) {
  const parts = parseCron(expr);
  const [cMin, cHour, cDom, cMonth, cDow] = parts;

  const from = fromDate ? new Date(fromDate) : new Date();
  // Start from the next minute
  from.setSeconds(0, 0);
  from.setMinutes(from.getMinutes() + 1);

  // Check up to 2 years ahead
  const limit = new Date(from);
  limit.setFullYear(limit.getFullYear() + 2);

  const current = new Date(from);
  while (current <= limit) {
    const min = current.getMinutes();
    const hour = current.getHours();
    const dom = current.getDate();
    const month = current.getMonth() + 1;
    const dow = current.getDay();

    if (fieldMatches(cMin, min) &&
        fieldMatches(cHour, hour) &&
        fieldMatches(cDom, dom) &&
        fieldMatches(cMonth, month) &&
        fieldMatches(cDow, dow)) {
      return current;
    }

    current.setMinutes(current.getMinutes() + 1);
  }
  return null;
}

function fieldMatches(pattern, value) {
  if (pattern === "*") return true;
  // Handle comma-separated
  for (const part of pattern.split(",")) {
    if (part.includes("/")) {
      const [range, step] = part.split("/");
      const stepNum = parseInt(step, 10);
      if (isNaN(stepNum)) continue;
      let start = 0, end = 59;
      if (range !== "*") {
        if (range.includes("-")) {
          [start, end] = range.split("-").map(Number);
        } else {
          start = end = parseInt(range, 10);
        }
      }
      if (value >= start && value <= end && (value - start) % stepNum === 0) return true;
    } else if (part.includes("-")) {
      const [s, e] = part.split("-").map(Number);
      if (value >= s && value <= e) return true;
    } else if (parseInt(part, 10) === value) {
      return true;
    }
  }
  return false;
}

export const cronTool = tool({
  description: `Cron expression describe/validate/next.
Parse and describe cron expressions in human-readable form, validate syntax, or find the next execution time.`,
  args: {
    expression: tool.schema
      .string()
      .describe("Cron expression (5-field: minute hour day month weekday) or @alias"),
    action: tool.schema
      .string()
      .optional()
      .default("describe")
      .describe("Action: describe (default), validate, next"),
  },
  async execute(args) {
    try {
      const action = (args.action || "describe").toLowerCase();

      switch (action) {
        case "describe": {
          const desc = describeCron(args.expression);
          return {
            title: `cron: ${args.expression}`,
            output: `Expression: ${args.expression}\nDescription: ${desc}`,
            metadata: { expression: args.expression, description: desc },
          };
        }
        case "validate": {
          const result = validateCron(args.expression);
          return {
            title: `cron: ${result.valid ? "valid" : "invalid"}`,
            output: `Expression: ${args.expression}\nValid: ${result.valid}${result.error ? `\nError: ${result.error}` : ""}`,
            metadata: { expression: args.expression, valid: result.valid, error: result.error },
          };
        }
        case "next": {
          const next = nextCronTime(args.expression);
          if (!next) {
            return {
              title: "cron: no next time found",
              output: `Expression: ${args.expression}\nNo matching time found within 2 years.`,
              metadata: { expression: args.expression, next: null },
            };
          }
          return {
            title: "cron: next execution",
            output: `Expression: ${args.expression}\nNext: ${next.toISOString()}`,
            metadata: { expression: args.expression, next: next.toISOString() },
          };
        }
        default:
          return {
            title: "cron: invalid action",
            output: `Invalid action: "${action}". Use describe, validate, or next.`,
            metadata: { error: "invalid_action" },
          };
      }
    } catch (err) {
      return {
        title: "cron: error",
        output: `Error: ${err.message}`,
        metadata: { error: err.message },
      };
    }
  },
});

// ─── Tool 3: duration ────────────────────────────────────────────────────────

function parseDuration(str) {
  const regex = /(\d+)\s*(ms|s|sec|m|min|h|hr|hour|d|day|w|week|mo|month|y|year|yr)s?\b/gi;
  let match;
  const parts = {};
  while ((match = regex.exec(str)) !== null) {
    const val = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    switch (unit) {
      case "ms": parts.ms = (parts.ms || 0) + val; break;
      case "s": case "sec": parts.s = (parts.s || 0) + val; break;
      case "m": case "min": parts.m = (parts.m || 0) + val; break;
      case "h": case "hr": case "hour": parts.h = (parts.h || 0) + val; break;
      case "d": case "day": parts.d = (parts.d || 0) + val; break;
      case "w": case "week": parts.w = (parts.w || 0) + val; break;
      case "mo": case "month": parts.mo = (parts.mo || 0) + val; break;
      case "y": case "year": case "yr": parts.y = (parts.y || 0) + val; break;
    }
  }
  if (Object.keys(parts).length === 0) {
    // Try compact format like "2h30m"
    const compact = /^(?:(\d+)y(?:ear)?)?(?:(\d+)mo)?(?:(\d+)w)?(?:(\d+)d)?(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?(?:(\d+)ms)?$/i.exec(str.replace(/\s/g, ""));
    if (compact) {
      if (compact[1]) parts.y = parseInt(compact[1], 10);
      if (compact[2]) parts.mo = parseInt(compact[2], 10);
      if (compact[3]) parts.w = parseInt(compact[3], 10);
      if (compact[4]) parts.d = parseInt(compact[4], 10);
      if (compact[5]) parts.h = parseInt(compact[5], 10);
      if (compact[6]) parts.m = parseInt(compact[6], 10);
      if (compact[7]) parts.s = parseInt(compact[7], 10);
      if (compact[8]) parts.ms = parseInt(compact[8], 10);
    }
  }
  return parts;
}

function formatDuration(parts) {
  const units = [
    { key: "y", label: "year", labelPlural: "years" },
    { key: "mo", label: "month", labelPlural: "months" },
    { key: "w", label: "week", labelPlural: "weeks" },
    { key: "d", label: "day", labelPlural: "days" },
    { key: "h", label: "hour", labelPlural: "hours" },
    { key: "m", label: "minute", labelPlural: "minutes" },
    { key: "s", label: "second", labelPlural: "seconds" },
    { key: "ms", label: "ms", labelPlural: "ms" },
  ];
  const partsList = units
    .map((u) => {
      const val = parts[u.key];
      if (!val || val === 0) return null;
      return `${val} ${val === 1 ? u.label : u.labelPlural}`;
    })
    .filter(Boolean);
  return partsList.length > 0 ? partsList.join(", ") : "0 seconds";
}

function durationToMs(parts) {
  let ms = 0;
  ms += (parts.y || 0) * 365.25 * 86400000;
  ms += (parts.mo || 0) * 30.4375 * 86400000;
  ms += (parts.w || 0) * 7 * 86400000;
  ms += (parts.d || 0) * 86400000;
  ms += (parts.h || 0) * 3600000;
  ms += (parts.m || 0) * 60000;
  ms += (parts.s || 0) * 1000;
  ms += (parts.ms || 0);
  return ms;
}

export const durationTool = tool({
  description: `Parse or format duration strings like "2h30m", "1 day 6 hours", "90min".
Supports years, months, weeks, days, hours, minutes, seconds, and milliseconds.`,
  args: {
    input: tool.schema
      .string()
      .describe("Duration string (e.g., '2h30m', '1 day 6 hours', '90min', '2w3d')"),
    action: tool.schema
      .string()
      .optional()
      .default("parse")
      .describe("Action: parse (default) or format"),
  },
  async execute(args) {
    try {
      const action = (args.action || "parse").toLowerCase();

      if (action === "parse") {
        const parts = parseDuration(args.input);
        if (Object.keys(parts).length === 0) {
          return {
            title: "duration: parse error",
            output: `Could not parse duration: "${args.input}". Use formats like "2h30m" or "1 day 6 hours".`,
            metadata: { error: "parse_failed", input: args.input },
          };
        }
        const totalMs = durationToMs(parts);
        return {
          title: `duration: ${formatDuration(parts)}`,
          output: `Input:         ${args.input}\nParsed:        ${formatDuration(parts)}\nTotal (ms):    ${totalMs}\nTotal (sec):   ${(totalMs / 1000).toFixed(1)}`,
          metadata: {
            input: args.input,
            parsed: parts,
            milliseconds: totalMs,
            seconds: totalMs / 1000,
          },
        };
      } else if (action === "format") {
        const totalMs = parseInt(args.input, 10);
        if (isNaN(totalMs)) {
          return {
            title: "duration: format error",
            output: `Invalid input for format: "${args.input}". Provide a number of milliseconds.`,
            metadata: { error: "invalid_number" },
          };
        }
        const parts = msToDuration(totalMs);
        return {
          title: `duration: ${formatDuration(parts)}`,
          output: `Input (ms):  ${totalMs}\nFormatted:    ${formatDuration(parts)}`,
          metadata: { input: totalMs, formatted: formatDuration(parts), parsed: parts },
        };
      } else {
        return {
          title: "duration: invalid action",
          output: `Invalid action: "${action}". Use parse or format.`,
          metadata: { error: "invalid_action" },
        };
      }
    } catch (err) {
      return {
        title: "duration: error",
        output: `Error: ${err.message}`,
        metadata: { error: err.message },
      };
    }
  },
});

function msToDuration(ms) {
  const abs = Math.abs(ms);
  const parts = {};
  const sign = ms < 0 ? -1 : 1;
  let remaining = abs;

  const intervals = [
    { key: "y", ms: 365.25 * 86400000 },
    { key: "mo", ms: 30.4375 * 86400000 },
    { key: "w", ms: 7 * 86400000 },
    { key: "d", ms: 86400000 },
    { key: "h", ms: 3600000 },
    { key: "m", ms: 60000 },
    { key: "s", ms: 1000 },
    { key: "ms", ms: 1 },
  ];

  for (const interval of intervals) {
    const val = Math.floor(remaining / interval.ms);
    if (val > 0) {
      parts[interval.key] = val * sign;
      remaining -= val * interval.ms;
    }
  }
  return parts;
}

// ─── Tool 4: countdown ───────────────────────────────────────────────────────

export const countdownTool = tool({
  description: `Calculate time until or since a given date.
Shows the difference in days, hours, minutes, and seconds between now and the target date.`,
  args: {
    target: tool.schema
      .string()
      .describe("Target date string (ISO 8601 format)"),
    action: tool.schema
      .string()
      .optional()
      .default("until")
      .describe("Action: until (default) or since"),
  },
  async execute(args) {
    try {
      const target = parseDate(args.target);
      const now = new Date();
      const action = (args.action || "until").toLowerCase();

      const diffMs = action === "until" ? target - now : now - target;
      const absMs = Math.abs(diffMs);
      const parts = msToDuration(absMs);
      const formatted = formatDuration(parts);

      const direction = action === "until"
        ? (diffMs >= 0 ? "remaining" : "passed")
        : (diffMs >= 0 ? "since" : "ago");

      const label = action === "until" ? "Time until target" : "Time since target";

      return {
        title: `countdown: ${formatted} ${direction}`,
        output: [
          `Target:  ${target.toISOString()}`,
          `Now:     ${now.toISOString()}`,
          `Action:  ${action}`,
          `Status:  ${diffMs >= 0 ? "Countdown running" : "Countdown ended"}`,
          "",
          `${label}: ${formatted}`,
        ].join("\n"),
        metadata: {
          target: target.toISOString(),
          now: now.toISOString(),
          action,
          milliseconds: Math.abs(diffMs),
          seconds: Math.floor(Math.abs(diffMs) / 1000),
          formatted,
          ended: diffMs < 0,
        },
      };
    } catch (err) {
      return {
        title: "countdown: error",
        output: `Error: ${err.message}`,
        metadata: { error: err.message },
      };
    }
  },
});

// ─── Tool 5: business-days ───────────────────────────────────────────────────

function isBusinessDay(d) {
  const day = d.getDay();
  return day !== 0 && day !== 6;
}

function addBusinessDays(dateStr, days) {
  const d = parseDate(dateStr);
  const direction = days >= 0 ? 1 : -1;
  let remaining = Math.abs(days);
  while (remaining > 0) {
    d.setDate(d.getDate() + direction);
    if (isBusinessDay(d)) remaining--;
  }
  return d;
}

function subtractBusinessDays(dateStr, days) {
  return addBusinessDays(dateStr, -days);
}

function countBusinessDays(start, end) {
  let count = 0;
  const current = new Date(Math.min(start, end));
  const final = new Date(Math.max(start, end));
  while (current <= final) {
    if (isBusinessDay(current)) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}

export const businessDaysTool = tool({
  description: `Business day math: add/subtract business days (Mon-Fri) or check if a date is a business day.
Useful for calculating delivery dates, work schedules, and deadline planning.`,
  args: {
    action: tool.schema
      .string()
      .optional()
      .default("add")
      .describe("Action: add (default), subtract, is-business-day, count-between"),
    date: tool.schema
      .string()
      .describe("Date string (ISO 8601 format)"),
    days: tool.schema
      .number()
      .optional()
      .default(5)
      .describe("Number of business days (default: 5, used for add/subtract)"),
    endDate: tool.schema
      .string()
      .optional()
      .describe("End date for count-between action"),
  },
  async execute(args) {
    try {
      const action = (args.action || "add").toLowerCase();
      const dateStr = args.date;
      const days = args.days ?? 5;

      switch (action) {
        case "add": {
          const result = addBusinessDays(dateStr, days);
          const d = parseDate(dateStr);
          return {
            title: `business-days: add ${days} days`,
            output: `Start: ${d.toISOString().slice(0, 10)}\nDays:  +${days} business days\nEnd:   ${result.toISOString().slice(0, 10)} (${result.toISOString().slice(0, 10)})`,
            metadata: {
              start: d.toISOString(),
              days: days,
              end: result.toISOString(),
              isBusinessDay: isBusinessDay(result),
            },
          };
        }
        case "subtract": {
          const result = subtractBusinessDays(dateStr, days);
          const d = parseDate(dateStr);
          return {
            title: `business-days: subtract ${days} days`,
            output: `Start: ${d.toISOString().slice(0, 10)}\nDays:  -${days} business days\nEnd:   ${result.toISOString().slice(0, 10)}`,
            metadata: {
              start: d.toISOString(),
              days: days,
              end: result.toISOString(),
              isBusinessDay: isBusinessDay(result),
            },
          };
        }
        case "is-business-day": {
          const d = parseDate(dateStr);
          const isBiz = isBusinessDay(d);
          const dayName = DAYS[d.getDay()];
          return {
            title: `business-days: ${isBiz ? "yes" : "no"}`,
            output: `Date: ${d.toISOString().slice(0, 10)} (${dayName})\nBusiness day: ${isBiz ? "Yes" : "No"}`,
            metadata: {
              date: d.toISOString(),
              dayOfWeek: d.getDay(),
              dayName,
              isBusinessDay: isBiz,
            },
          };
        }
        case "count-between": {
          if (!args.endDate) {
            return {
              title: "business-days: missing endDate",
              output: "The count-between action requires an endDate argument.",
              metadata: { error: "missing_endDate" },
            };
          }
          const start = parseDate(dateStr);
          const end = parseDate(args.endDate);
          const count = countBusinessDays(start, end);
          return {
            title: `business-days: ${count} business days`,
            output: `Start: ${start.toISOString().slice(0, 10)}\nEnd:   ${end.toISOString().slice(0, 10)}\nBusiness days: ${count}`,
            metadata: {
              start: start.toISOString(),
              end: end.toISOString(),
              businessDays: count,
            },
          };
        }
        default:
          return {
            title: "business-days: invalid action",
            output: `Invalid action: "${action}". Use add, subtract, is-business-day, or count-between.`,
            metadata: { error: "invalid_action" },
          };
      }
    } catch (err) {
      return {
        title: "business-days: error",
        output: `Error: ${err.message}`,
        metadata: { error: err.message },
      };
    }
  },
});

// ─── Tool 6: clock ───────────────────────────────────────────────────────────

export const clockTool = tool({
  description: `Multi-timezone clock.
Shows the current time in multiple timezones simultaneously.
Useful for scheduling across timezones or quick timezone reference.`,
  args: {
    timezones: tool.schema
      .string()
      .optional()
      .default("UTC,America/New_York,Asia/Tokyo,Europe/London")
      .describe("Comma-separated IANA timezone names"),
  },
  async execute(args) {
    try {
      const now = new Date();
      const tzList = (args.timezones || "UTC,America/New_York,Asia/Tokyo,Europe/London")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const rows = tzList.map((tz) => {
        const opts = { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false };
        const formatted = new Intl.DateTimeFormat("en-US", opts).format(now);
        // Get UTC offset
        const tzOffset = getTimezoneOffset(tz);
        return { timezone: tz, time: formatted, offset: tzOffset };
      });

      const output = rows
        .map((r) => `${r.timezone.padEnd(30)} ${r.time}  (UTC${r.offset})`)
        .join("\n");

      return {
        title: `clock: ${tzList.length} timezones`,
        output: `Current time across timezones:\n\n${output}`,
        metadata: {
          timezones: tzList,
          rows,
          timestamp: now.toISOString(),
        },
      };
    } catch (err) {
      return {
        title: "clock: error",
        output: `Error: ${err.message}`,
        metadata: { error: err.message },
      };
    }
  },
});

function getTimezoneOffset(tz) {
  try {
    const now = new Date();
    const tzDate = new Date(now.toLocaleString("en-US", { timeZone: tz }));
    const utcDate = new Date(now.toLocaleString("en-US", { timeZone: "UTC" }));
    const diff = (tzDate - utcDate) / 60000;
    const hours = Math.floor(diff / 60);
    const mins = Math.abs(diff % 60);
    const sign = hours >= 0 ? "+" : "-";
    return `${sign}${pad(Math.abs(hours))}:${pad(mins)}`;
  } catch {
    return "unknown";
  }
}

// ─── Tool 7: age ─────────────────────────────────────────────────────────────

export const ageTool = tool({
  description: `Calculate age from a date of birth.
Returns years, months, days, and total days alive.`,
  args: {
    dob: tool.schema
      .string()
      .describe("Date of birth (ISO 8601 format, e.g., '1990-01-15')"),
  },
  async execute(args) {
    try {
      const dob = parseDate(args.dob);
      const now = new Date();

      let years = now.getFullYear() - dob.getFullYear();
      let months = now.getMonth() - dob.getMonth();
      let days = now.getDate() - dob.getDate();

      if (days < 0) {
        months--;
        const prevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
        days += prevMonth.getDate();
      }
      if (months < 0) {
        years--;
        months += 12;
      }

      const totalDays = Math.floor((now - dob) / 86400000);
      const totalHours = Math.floor((now - dob) / 3600000);
      const totalMinutes = Math.floor((now - dob) / 60000);

      return {
        title: `age: ${years} years`,
        output: [
          `DOB:        ${dob.toISOString().slice(0, 10)}`,
          `Now:        ${now.toISOString().slice(0, 10)}`,
          "",
          `Years:      ${years}`,
          `Months:     ${years * 12 + months}`,
          `Weeks:      ${Math.floor(totalDays / 7)}`,
          `Days:       ${totalDays}`,
          `Hours:      ${totalHours}`,
          `Minutes:    ${totalMinutes}`,
        ].join("\n"),
        metadata: {
          dob: dob.toISOString(),
          years,
          months,
          days,
          totalDays,
          totalHours,
          totalMinutes,
        },
      };
    } catch (err) {
      return {
        title: "age: error",
        output: `Error: ${err.message}`,
        metadata: { error: err.message },
      };
    }
  },
});

// ─── Tool 8: timer ───────────────────────────────────────────────────────────

export const timerTool = tool({
  description: `Stopwatch / lap timer.
Start, stop, lap, or check the status of named timers.
Useful for timing tasks, measuring durations, and performance tracking.`,
  args: {
    action: tool.schema
      .string()
      .optional()
      .default("status")
      .describe("Action: start, stop, lap, status (default)"),
    name: tool.schema
      .string()
      .optional()
      .default("default")
      .describe("Timer name (default: 'default')"),
  },
  async execute(args) {
    try {
      const action = (args.action || "status").toLowerCase();
      const name = args.name || "default";

      switch (action) {
        case "start": {
          if (timers.has(name) && !timers.get(name).stopped) {
            return {
              title: `timer: "${name}" already running`,
              output: `Timer "${name}" is already running. Stop it first or use a different name.`,
              metadata: { name, action: "start", status: "already_running" },
            };
          }
          const timer = {
            name,
            start: Date.now(),
            laps: [],
            stopped: false,
          };
          timers.set(name, timer);
          return {
            title: `timer: "${name}" started`,
            output: `Timer "${name}" started at ${new Date(timer.start).toISOString()}`,
            metadata: { name, action: "start", start: timer.start },
          };
        }
        case "stop": {
          const timer = timers.get(name);
          if (!timer || timer.stopped) {
            return {
              title: `timer: "${name}" not running`,
              output: `Timer "${name}" is not running. Start it first.`,
              metadata: { name, action: "stop", status: "not_running" },
            };
          }
          timer.stopped = true;
          timer.end = Date.now();
          timer.elapsed = timer.end - timer.start;
          return {
            title: `timer: "${name}" stopped`,
            output: `Timer "${name}" stopped.\nElapsed: ${formatElapsed(timer.elapsed)}`,
            metadata: {
              name,
              action: "stop",
              start: timer.start,
              end: timer.end,
              elapsed: timer.elapsed,
              laps: timer.laps,
            },
          };
        }
        case "lap": {
          const timer = timers.get(name);
          if (!timer || timer.stopped) {
            return {
              title: `timer: "${name}" not running`,
              output: `Timer "${name}" is not running. Start it first.`,
              metadata: { name, action: "lap", status: "not_running" },
            };
          }
          const now = Date.now();
          const lapTime = now - timer.start;
          const lastLap = timer.laps.length > 0 ? timer.laps[timer.laps.length - 1].at : 0;
          const lapDuration = lapTime - lastLap;
          timer.laps.push({ at: lapTime, duration: lapDuration });
          return {
            title: `timer: "${name}" lap ${timer.laps.length}`,
            output: `Timer "${name}" lap ${timer.laps.length}:\n  Total:  ${formatElapsed(lapTime)}\n  Split:  ${formatElapsed(lapDuration)}`,
            metadata: {
              name,
              action: "lap",
              lap: timer.laps.length,
              total: lapTime,
              split: lapDuration,
            },
          };
        }
        case "status":
        default: {
          const timer = timers.get(name);
          if (!timer) {
            return {
              title: `timer: "${name}" not found`,
              output: `No timer named "${name}" found. Use action "start" to create one.`,
              metadata: { name, action: "status", status: "not_found" },
            };
          }
          const now = Date.now();
          const elapsed = timer.stopped ? timer.elapsed : now - timer.start;
          return {
            title: `timer: "${name}" ${timer.stopped ? "stopped" : "running"}`,
            output: [
              `Name:     ${name}`,
              `Status:   ${timer.stopped ? "Stopped" : "Running"}`,
              `Started:  ${new Date(timer.start).toISOString()}`,
              timer.stopped ? `Ended:    ${new Date(timer.end).toISOString()}` : null,
              `Elapsed:  ${formatElapsed(elapsed)}`,
              timer.laps.length > 0 ? `Laps:     ${timer.laps.length}` : null,
            ].filter(Boolean).join("\n"),
            metadata: {
              name,
              action: "status",
              running: !timer.stopped,
              start: timer.start,
              end: timer.stopped ? timer.end : null,
              elapsed,
              laps: timer.laps.length,
            },
          };
        }
      }
    } catch (err) {
      return {
        title: "timer: error",
        output: `Error: ${err.message}`,
        metadata: { error: err.message },
      };
    }
  },
});

function formatElapsed(ms) {
  const parts = msToDuration(ms);
  const y = parts.y || 0;
  const d = parts.d || 0;
  const h = parts.h || 0;
  const m = parts.m || 0;
  const s = parts.s || 0;
  const msPart = parts.ms || 0;
  let result = "";
  if (y > 0) result += `${y}y `;
  if (d > 0) result += `${d}d `;
  if (h > 0) result += `${h}h `;
  if (m > 0) result += `${m}m `;
  result += `${s}.${pad(msPart, 3)}s`;
  return result.trim();
}

// ─── Tool 9: wait ────────────────────────────────────────────────────────────

export const waitTool = tool({
  description: `Countdown / wait timer display.
Shows a countdown from a given number of seconds, displaying progress at intervals.
Useful for timed breaks, reminders, or displaying wait times.`,
  args: {
    seconds: tool.schema
      .number()
      .describe("Number of seconds to wait"),
    message: tool.schema
      .string()
      .optional()
      .describe("Optional message to display during countdown"),
  },
  async execute(args) {
    try {
      const seconds = args.seconds;
      if (seconds <= 0 || seconds > 86400) {
        return {
          title: "wait: invalid duration",
          output: `Invalid duration: ${seconds}s. Must be between 1 and 86400 (24 hours).`,
          metadata: { error: "invalid_duration" },
        };
      }

      const msg = args.message || "Waiting...";
      const startTime = Date.now();
      const intervals = [];

      // Simulate the countdown by recording the planned intervals
      // In a server context, we generate a timeline without actually sleeping
      const totalIntervals = Math.min(seconds, 20);
      for (let i = 1; i <= totalIntervals; i++) {
        const elapsed = Math.round((i / totalIntervals) * seconds);
        intervals.push({
          at: elapsed,
          remaining: seconds - elapsed,
          elapsed,
          pct: Math.round((elapsed / seconds) * 100),
        });
      }

      const endTime = startTime + seconds * 1000;

      return {
        title: `wait: ${seconds}s countdown`,
        output: [
          `Message:  ${msg}`,
          `Duration: ${seconds} seconds`,
          `Ends at:  ${new Date(endTime).toISOString()}`,
          "",
          intervals.map((i) =>
            `  [${String(i.pct).padStart(3)}%] ${i.elapsed}s elapsed, ${i.remaining}s remaining`
          ).join("\n"),
          "",
          `✓ Complete at ${new Date(endTime).toISOString()}`,
        ].join("\n"),
        metadata: {
          seconds,
          message: msg,
          startTime: startTime,
          endTime,
          intervals,
        },
      };
    } catch (err) {
      return {
        title: "wait: error",
        output: `Error: ${err.message}`,
        metadata: { error: err.message },
      };
    }
  },
});
