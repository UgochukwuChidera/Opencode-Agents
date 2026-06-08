/**
 * Web Fetch Tool - Fetch content from URLs
 *
 * Fetches web pages, APIs, or any URL and returns the content.
 * Supports multiple output formats and request customization.
 */
import { tool } from "@opencode-ai/plugin";

const MAX_RESPONSE_SIZE = 512 * 1024; // 512KB max response size
const DEFAULT_TIMEOUT = 15000; // 15 seconds

/**
 * Fetch a URL and return its content.
 */
async function fetchUrl(urlString, options = {}) {
  const {
    method = "GET",
    headers = {},
    body = null,
    timeout = DEFAULT_TIMEOUT,
    responseType = "text",
    maxSize = MAX_RESPONSE_SIZE,
  } = options;

  // Validate URL
  let url;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error(`Invalid URL: ${urlString}`);
  }

  // Only allow http and https
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(`Unsupported protocol: ${url.protocol}. Only http and https are allowed.`);
  }

  const fetchOptions = {
    method,
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; OpencodeBot/1.0; +https://opencode.ai)",
      "Accept": "text/html,application/json,*/*",
      ...headers,
    },
    signal: AbortSignal.timeout(timeout),
    redirect: "follow",
  };

  if (body && method !== "GET" && method !== "HEAD") {
    fetchOptions.body = body;
  }

  const response = await fetch(url.toString(), fetchOptions);

  // Read response based on content type
  const contentType = response.headers.get("content-type") || "";
  let content;
  let truncated = false;

  if (responseType === "text" || contentType.includes("text") || contentType.includes("json")) {
    content = await response.text();
    if (content.length > maxSize) {
      content = content.slice(0, maxSize) + `\n\n... [truncated ${content.length - maxSize} more bytes]`;
      truncated = true;
    }
  } else {
    // For binary content, just return metadata
    content = `[Binary content - ${contentType}]`;
  }

  const responseHeaders = {};
  response.headers.forEach((value, key) => {
    responseHeaders[key] = value;
  });

  return {
    url: response.url, // Final URL after redirects
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
    contentType,
    content,
    truncated,
    size: content.length,
  };
}

/**
 * Web fetch tool.
 * Fetches content from URLs (web pages, APIs, etc.).
 */
export const webFetchTool = tool({
  description: `Fetch content from a URL. Supports HTTP/HTTPS URLs.
Can fetch web pages, API responses, raw text, and JSON data.
Returns the response status, headers, and body content.
Useful for checking API responses, reading documentation, and downloading text content.
Maximum response size: 512KB. Timeout: 15 seconds default.`,
  args: {
    url: tool.schema
      .string()
      .describe("The URL to fetch (http:// or https:// only)"),
    method: tool.schema
      .string()
      .optional()
      .default("GET")
      .describe("HTTP method (GET, POST, PUT, DELETE, PATCH; default: GET)"),
    headers: tool.schema
      .record(tool.schema.string(), tool.schema.string())
      .optional()
      .describe("Optional HTTP headers as key-value pairs"),
    body: tool.schema
      .string()
      .optional()
      .describe("Request body (for POST/PUT/PATCH requests)"),
    timeout: tool.schema
      .number()
      .optional()
      .default(DEFAULT_TIMEOUT)
      .describe("Timeout in milliseconds (default: 15000, max: 60000)"),
    includeHeaders: tool.schema
      .boolean()
      .optional()
      .default(true)
      .describe("Include response headers in output (default: true)"),
  },
  async execute(args, context) {
    const timeout = Math.min(args.timeout ?? DEFAULT_TIMEOUT, 60000);

    try {
      const result = await fetchUrl(args.url, {
        method: args.method || "GET",
        headers: args.headers,
        body: args.body,
        timeout,
      });

      let output = `URL: ${result.url}\nStatus: ${result.status} ${result.statusText}\nType: ${result.contentType}\nSize: ${result.size} bytes\n`;

      if (args.includeHeaders !== false && result.headers) {
        const headerLines = Object.entries(result.headers)
          .filter(([key]) => !key.startsWith("x-") || args.includeHeaders)
          .slice(0, 20)
          .map(([key, value]) => `  ${key}: ${value}`)
          .join("\n");
        if (headerLines) {
          output += `\nResponse Headers:\n${headerLines}\n`;
        }
      }

      output += `\n---\n${result.content}`;

      if (result.truncated) {
        output += "\n\n[Response was truncated due to size]";
      }

      return {
        title: `${result.status === 200 ? "✓" : "✗"} ${args.url.slice(0, 70)}`,
        output,
        metadata: {
          url: result.url,
          status: result.status,
          contentType: result.contentType,
          size: result.size,
          truncated: result.truncated,
        },
      };
    } catch (error) {
      return {
        title: `✗ ${args.url.slice(0, 70)}`,
        output: `Error fetching ${args.url}:\n${error.message}`,
        metadata: {
          url: args.url,
          status: -1,
          error: error.message,
        },
      };
    }
  },
});
