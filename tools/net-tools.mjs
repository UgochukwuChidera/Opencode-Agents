/**
 * Network Tools - Network diagnostics and utilities
 *
 * Provides tools for network diagnostics: DNS lookup, port checking,
 * IP address detection, and HTTP status checking.
 * Cross-platform: uses Node.js built-in modules where possible.
 */
import { tool } from "@opencode-ai/plugin";
import dns from "dns";
import { promisify } from "util";
import net from "net";

const lookupAsync = promisify(dns.lookup);
const resolveAsync = promisify(dns.resolve);
const resolveMxAsync = promisify(dns.resolveMx);

/**
 * DNS lookup tool.
 */
export const dnsTool = tool({
  description: `Perform DNS lookups: resolve hostnames to IP addresses, get MX records,
TXT records, and more. Cross-platform network diagnostic tool.
Useful for debugging connectivity issues and verifying DNS configuration.`,
  args: {
    hostname: tool.schema.string().describe("The hostname to look up (e.g., 'example.com')"),
    type: tool.schema
      .string()
      .optional()
      .default("A")
      .describe(
        "Record type: A (IPv4), AAAA (IPv6), MX (mail), TXT (text), NS (nameserver), CNAME (alias), ANY (all) (default: A)"
      ),
  },
  async execute(args, context) {
    const hostname = args.hostname.toLowerCase();
    const type = (args.type || "A").toUpperCase();

    try {
      let result;

      switch (type) {
        case "A":
        case "AAAA": {
          const family = type === "AAAA" ? 6 : 4;
          const res = await lookupAsync(hostname, { family, all: true });
          const addresses = Array.isArray(res) ? res : [{ address: res.address, family: res.family }];
          result = addresses.map((a) => `${a.address} (IPv${a.family})`).join("\n");
          break;
        }
        case "MX": {
          const mxRecords = await resolveMxAsync(hostname);
          result = mxRecords
            .sort((a, b) => a.priority - b.priority)
            .map((r) => `priority ${r.priority}: ${r.exchange}`)
            .join("\n");
          break;
        }
        case "TXT": {
          const txtRecords = await dns.promises.resolveTxt(hostname);
          result = txtRecords.map((r) => r.join(" ")).join("\n");
          break;
        }
        case "NS": {
          const nsRecords = await dns.promises.resolveNs(hostname);
          result = nsRecords.join("\n");
          break;
        }
        case "CNAME": {
          const cname = await dns.promises.resolveCname(hostname);
          result = cname.join("\n");
          break;
        }
        case "ANY": {
          const [a, aaaa, mx, txt, ns, cname] = await Promise.allSettled([
            dns.promises.resolve4(hostname).catch(() => []),
            dns.promises.resolve6(hostname).catch(() => []),
            resolveMxAsync(hostname).catch(() => []),
            dns.promises.resolveTxt(hostname).catch(() => []),
            dns.promises.resolveNs(hostname).catch(() => []),
            dns.promises.resolveCname(hostname).catch(() => []),
          ]);

          const parts = [];
          if (a.status === "fulfilled" && a.value.length > 0)
            parts.push(`A records:\n  ${a.value.join("\n  ")}`);
          if (aaaa.status === "fulfilled" && aaaa.value.length > 0)
            parts.push(`AAAA records:\n  ${aaaa.value.join("\n  ")}`);
          if (mx.status === "fulfilled" && mx.value.length > 0)
            parts.push(`MX records:\n  ${mx.value.map((r) => `priority ${r.priority}: ${r.exchange}`).join("\n  ")}`);
          if (txt.status === "fulfilled" && txt.value.length > 0)
            parts.push(`TXT records:\n  ${txt.value.map((r) => r.join(" ")).join("\n  ")}`);
          if (ns.status === "fulfilled" && ns.value.length > 0)
            parts.push(`NS records:\n  ${ns.value.join("\n  ")}`);
          if (cname.status === "fulfilled" && cname.value.length > 0)
            parts.push(`CNAME records:\n  ${cname.value.join("\n  ")}`);

          result = parts.join("\n\n") || "No records found";
          break;
        }
        default:
          return {
            title: `dns: unknown record type "${type}"`,
            output: `Unknown DNS record type: "${type}". Supported: A, AAAA, MX, TXT, NS, CNAME, ANY`,
            metadata: { error: "unknown_type" },
          };
      }

      return {
        title: `dns: ${hostname} (${type})`,
        output: `DNS ${type} records for ${hostname}:\n\n${result}`,
        metadata: { hostname, recordType: type },
      };
    } catch (error) {
      return {
        title: `dns: ${hostname} (${type}) - error`,
        output: `DNS lookup failed for ${hostname} (${type}):\n${error.message}`,
        metadata: { hostname, recordType: type, error: error.message },
      };
    }
  },
});

/**
 * Port check tool.
 * Check if a remote host:port is reachable.
 */
export const portCheckTool = tool({
  description: `Check if a TCP port is open on a remote host.
Performs a TCP connection test (does not send any data).
Useful for checking if services are running and firewalls are configured.`,
  args: {
    host: tool.schema.string().describe("Hostname or IP address"),
    port: tool.schema.number().describe("TCP port number (1-65535)"),
    timeout: tool.schema
      .number()
      .optional()
      .default(5000)
      .describe("Connection timeout in milliseconds (default: 5000)"),
  },
  async execute(args, context) {
    const { host, port } = args;
    const timeout = Math.min(Math.max(args.timeout ?? 5000, 1000), 30000);

    if (port < 1 || port > 65535) {
      return {
        title: "port-check: invalid port",
        output: `Invalid port: ${port}. Port must be between 1 and 65535.`,
        metadata: { error: "invalid_port" },
      };
    }

    const startTime = Date.now();

    try {
      await new Promise((resolve, reject) => {
        const socket = new net.Socket();
        socket.setTimeout(timeout);

        socket.on("connect", () => {
          socket.destroy();
          resolve();
        });

        socket.on("error", (err) => {
          socket.destroy();
          reject(err);
        });

        socket.on("timeout", () => {
          socket.destroy();
          reject(new Error("Connection timed out"));
        });

        socket.connect(port, host);
      });

      const elapsed = Date.now() - startTime;
      return {
        title: `port-check: ${host}:${port} - OPEN`,
        output: `Port ${port} on ${host} is OPEN (connected in ${elapsed}ms)`,
        metadata: { host, port, open: true, latency: elapsed },
      };
    } catch (error) {
      const elapsed = Date.now() - startTime;
      return {
        title: `port-check: ${host}:${port} - CLOSED`,
        output: `Port ${port} on ${host} is CLOSED or FILTERED\nError: ${error.message}\n(checked in ${elapsed}ms)`,
        metadata: {
          host,
          port,
          open: false,
          latency: elapsed,
          error: error.message,
        },
      };
    }
  },
});

/**
 * HTTP status check tool.
 * Check if a URL is accessible and returns a successful status code.
 */
export const httpCheckTool = tool({
  description: `Check if a URL is accessible and returns a successful HTTP status.
Makes a HEAD request (or GET if HEAD fails) and reports status, timing, and headers.
Useful for monitoring website availability and API health checks.`,
  args: {
    url: tool.schema.string().describe("The URL to check"),
    followRedirects: tool.schema
      .boolean()
      .optional()
      .default(true)
      .describe("Follow HTTP redirects (default: true)"),
    timeout: tool.schema
      .number()
      .optional()
      .default(10000)
      .describe("Timeout in milliseconds (default: 10000)"),
  },
  async execute(args, context) {
    const timeout = Math.min(args.timeout ?? 10000, 30000);

    try {
      const startTime = Date.now();

      // Try HEAD first
      let response = await fetch(args.url, {
        method: "HEAD",
        redirect: args.followRedirects ? "follow" : "manual",
        signal: AbortSignal.timeout(timeout),
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; OpencodeBot/1.0)",
        },
      });

      // If HEAD fails (405, 501), fall back to GET
      if (response.status === 405 || response.status === 501) {
        response = await fetch(args.url, {
          method: "GET",
          redirect: args.followRedirects ? "follow" : "manual",
          signal: AbortSignal.timeout(timeout),
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; OpencodeBot/1.0)",
          },
        });
      }

      const elapsed = Date.now() - startTime;
      const statusCategory = Math.floor(response.status / 100);

      return {
        title: `http-check: ${response.status} ${args.url.slice(0, 60)}`,
        output: [
          `URL:     ${response.url}`,
          `Status:  ${response.status} ${response.statusText}`,
          `Time:    ${elapsed}ms`,
          `Method:  ${response.status === 405 ? "GET" : "HEAD"}`,
          ``,
          `Headers:`,
          ...[...response.headers.entries()]
            .slice(0, 15)
            .map(([k, v]) => `  ${k}: ${v}`),
        ].join("\n"),
        metadata: {
          url: response.url,
          statusCode: response.status,
          statusCategory,
          elapsed,
          ok: response.ok,
        },
      };
    } catch (error) {
      return {
        title: `http-check: ERROR ${args.url.slice(0, 60)}`,
        output: `Error checking ${args.url}:\n${error.message}`,
        metadata: {
          url: args.url,
          statusCode: -1,
          error: error.message,
        },
      };
    }
  },
});
