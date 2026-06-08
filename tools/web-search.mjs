/**
 * Web Search Tool - Search the web using DuckDuckGo's instant answer API
 *
 * Provides web search capabilities without requiring an API key.
 * Uses the DuckDuckGo Lite API which is free and does not require authentication.
 * Falls back to alternative search backends if DuckDuckGo is unavailable.
 */
import { tool } from "@opencode-ai/plugin";

// Maximum results to return
const MAX_RESULTS = 10;

/**
 * Search DuckDuckGo Lite (no API key required).
 * Returns an array of { title, url, snippet } results.
 */
async function searchDuckDuckGoLite(query, maxResults = MAX_RESULTS) {
  try {
    const url = new URL("https://lite.duckduckgo.com/lite/");
    url.searchParams.set("q", query);

    const response = await fetch(url.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; OpencodeBot/1.0; +https://opencode.ai)",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`DuckDuckGo responded with ${response.status}`);
    }

    const html = await response.text();
    return parseDuckDuckGoLiteResults(html, maxResults);
  } catch (error) {
    // Fall back to the HTML version
    return searchDuckDuckGoHtml(query, maxResults);
  }
}

/**
 * Parse DuckDuckGo Lite HTML results.
 */
function parseDuckDuckGoLiteResults(html, maxResults) {
  const results = [];
  // Simple regex-based parsing for DuckDuckGo Lite results
  const resultRegex =
    /<a[^>]*href="(https?:\/\/[^"]+)"[^>]*rel="nofollow"[^>]*>([\s\S]*?)<\/a>/gi;
  const snippetRegex = /<td class="result-snippet">([\s\S]*?)<\/td>/gi;

  const urls = [];
  const titles = [];
  const snippets = [];

  let match;
  while ((match = resultRegex.exec(html)) !== null) {
    const url = match[1];
    const title = match[2].replace(/<[^>]*>/g, "").trim();
    if (url && title && !url.includes("duckduckgo.com")) {
      urls.push(url);
      titles.push(title);
    }
  }

  while ((match = snippetRegex.exec(html)) !== null) {
    const snippet = match[1].replace(/<[^>]*>/g, "").trim();
    snippets.push(snippet);
  }

  for (let i = 0; i < Math.min(urls.length, maxResults); i++) {
    results.push({
      title: titles[i] || "No title",
      url: urls[i],
      snippet: snippets[i] || "",
    });
  }

  return results;
}

/**
 * Fall back to DuckDuckGo HTML search.
 */
async function searchDuckDuckGoHtml(query, maxResults = MAX_RESULTS) {
  try {
    const url = new URL("https://html.duckduckgo.com/html/");
    url.searchParams.set("q", query);

    const response = await fetch(url.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; OpencodeBot/1.0; +https://opencode.ai)",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`DuckDuckGo HTML responded with ${response.status}`);
    }

    const html = await response.text();
    return parseDuckDuckGoHtmlResults(html, maxResults);
  } catch (error) {
    throw new Error(
      `Web search unavailable: ${error.message}. Try the web-fetch tool to manually fetch URLs.`
    );
  }
}

/**
 * Parse DuckDuckGo HTML results.
 */
function parseDuckDuckGoHtmlResults(html, maxResults) {
  const results = [];
  // Extract result blocks
  const blockRegex =
    /<div class="result[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>/gi;

  let blockMatch;
  while ((blockMatch = blockRegex.exec(html)) !== null) {
    if (results.length >= maxResults) break;

    const block = blockMatch[1];
    const titleMatch = block.match(
      /<a[^>]*class="result__a"[^>]*>([\s\S]*?)<\/a>/
    );
    const urlMatch = block.match(/<a[^>]*href="([^"]+)"[^>]*class="result__a"/);
    const snippetMatch = block.match(
      /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/
    );

    if (titleMatch && urlMatch) {
      results.push({
        title: titleMatch[1].replace(/<[^>]*>/g, "").trim(),
        url: urlMatch[1],
        snippet: snippetMatch
          ? snippetMatch[1].replace(/<[^>]*>/g, "").trim()
          : "",
      });
    }
  }

  // If no results from block parsing, try simpler parsing
  if (results.length === 0) {
    const linkRegex = /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    while ((linkMatch = linkRegex.exec(html)) !== null && results.length < maxResults) {
      results.push({
        title: linkMatch[2].replace(/<[^>]*>/g, "").trim(),
        url: linkMatch[1],
        snippet: "",
      });
    }
  }

  return results;
}

/**
 * Search using a configurable backend URL (for users who want to use a custom search service).
 */
async function searchCustom(query, backendUrl, maxResults = MAX_RESULTS) {
  try {
    const url = new URL(backendUrl);
    url.searchParams.set("q", query);
    if (maxResults) url.searchParams.set("num", String(maxResults));

    const response = await fetch(url.toString(), {
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw new Error(`Search backend responded with ${response.status}`);
    }

    const data = await response.json();
    // Try to extract results from common API formats
    if (Array.isArray(data)) return data.slice(0, maxResults);
    if (data.results) return data.results.slice(0, maxResults);
    if (data.items) return data.items.slice(0, maxResults);
    if (data.data) return data.data.slice(0, maxResults);

    // Return raw data as a single result
    return [
      {
        title: "Search completed",
        url: url.toString(),
        snippet: JSON.stringify(data).slice(0, 500),
      },
    ];
  } catch (error) {
    throw new Error(`Custom search failed: ${error.message}`);
  }
}

/**
 * Web search tool.
 * Searches the web using DuckDuckGo (no API key required).
 */
export const webSearchTool = tool({
  description: `Search the web for information. Uses DuckDuckGo (no API key required).
Returns up to 10 results with title, URL, and snippet.
Useful for finding documentation, tutorials, news, package info, and troubleshooting.
Can use a custom search backend URL if configured.`,
  args: {
    query: tool.schema
      .string()
      .describe("The search query"),
    maxResults: tool.schema
      .number()
      .optional()
      .default(5)
      .describe("Maximum number of results to return (1-10, default: 5)"),
    backend: tool.schema
      .string()
      .optional()
      .describe(
        "Optional custom search backend URL. " +
        "The query will be appended as ?q=<query>. " +
        "The backend should return JSON with a 'results' or 'items' array. " +
        "If not specified, uses DuckDuckGo."
      ),
  },
  async execute(args, context) {
    const maxResults = Math.min(Math.max(1, args.maxResults ?? 5), 10);

    let results;
    if (args.backend) {
      results = await searchCustom(args.query, args.backend, maxResults);
    } else {
      results = await searchDuckDuckGoLite(args.query, maxResults);
    }

    if (!results || results.length === 0) {
      return {
        title: `web-search: ${args.query.slice(0, 60)}`,
        output: `No results found for "${args.query}". Try a different query.`,
        metadata: { query: args.query, resultCount: 0 },
      };
    }

    const output = results
      .map(
        (r, i) =>
          `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.snippet || "(no preview)"}`
      )
      .join("\n\n");

    return {
      title: `web-search: ${args.query.slice(0, 60)} (${results.length} results)`,
      output: `Search results for "${args.query}":\n\n${output}`,
      metadata: {
        query: args.query,
        resultCount: results.length,
        backend: args.backend || "duckduckgo",
      },
    };
  },
});
