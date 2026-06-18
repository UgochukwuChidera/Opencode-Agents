/**
 * Network Tools - Network diagnostics and utilities
 *
 * Provides tools for network diagnostics: DNS lookup, port checking,
 * IP address detection, HTTP checking, whois, dig, ping, traceroute,
 * SSL certificate checking, HTTP header fetching, and status code lookup.
 * Cross-platform: uses Node.js built-in modules where possible.
 */
import { tool } from "@opencode-ai/plugin";
import dns from "dns";
import { promisify } from "util";
import net from "net";
import tls from "tls";
import https from "https";

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

// ═══════════════════════════════════════════════════════════════════════
// New network tools
// ═══════════════════════════════════════════════════════════════════════

/**
 * whois tool.
 * Simulated domain registration lookup.
 */
export const whoisTool = tool({
  description: `Domain registration lookup (simulated).
Returns simulated whois data (registrar, creation/expiry dates, name servers)
based on TLD patterns. Useful for quick domain information checks.`,
  args: {
    domain: tool.schema.string().describe("The domain name to look up (e.g., 'example.com')"),
  },
  async execute(args, context) {
    const domain = args.domain.toLowerCase().trim();

    // Basic domain validation
    if (!domain || !/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i.test(domain)) {
      return {
        title: "whois: invalid domain",
        output: `Invalid domain format: "${domain}". Provide a valid domain like "example.com".`,
        metadata: { error: "invalid_domain" },
      };
    }

    const data = simulateWhois(domain);

    const lines = [
      `Domain Name:        ${data.domain}`,
      `Registry Domain ID: ${data.registryId}`,
      `Registrar:          ${data.registrar}`,
      `Registrar IANA ID:  ${data.registrarId}`,
      `Domain Status:      ${data.status.join(", ")}`,
      `DNSSEC:             ${data.dnssec}`,
      ``,
      `Dates:`,
      `  Creation Date:    ${data.creationDate}`,
      `  Updated Date:     ${data.updatedDate}`,
      `  Expiry Date:      ${data.expiryDate}`,
      ``,
      `Name Servers:`,
      ...data.nameServers.map((ns) => `  ${ns}`),
      ``,
      `(This is simulated whois data for informational purposes.)`,
    ];

    return {
      title: `whois: ${domain}`,
      output: lines.join("\n"),
      metadata: { domain, ...data },
    };
  },
});

/**
 * dig tool.
 * DNS lookup with detailed output, similar to the dig command.
 */
export const digTool = tool({
  description: `DNS lookup tool with detailed results.
Performs DNS resolution for various record types and returns formatted
output similar to the dig command. Supports A, AAAA, MX, TXT, NS, CNAME, SOA, and ANY.`,
  args: {
    hostname: tool.schema.string().describe("The hostname to look up (e.g., 'example.com')"),
    type: tool.schema
      .string()
      .optional()
      .default("A")
      .describe("Record type: A, AAAA, MX, TXT, NS, CNAME, SOA, ANY (default: A)"),
  },
  async execute(args, context) {
    const hostname = args.hostname.toLowerCase().trim();
    const type = (args.type || "A").toUpperCase().replace(/^(A|AAAA|MX|TXT|NS|CNAME|SOA|ANY)$/, "$1");

    if (!/^(A|AAAA|MX|TXT|NS|CNAME|SOA|ANY)$/.test(type)) {
      return {
        title: `dig: unknown type "${args.type}"`,
        output: `Unknown record type: "${args.type}". Supported: A, AAAA, MX, TXT, NS, CNAME, SOA, ANY`,
        metadata: { error: "unknown_type" },
      };
    }

    try {
      const startTime = Date.now();
      const result = await resolveDig(hostname, type);
      const elapsed = Date.now() - startTime;

      const lines = [
        `; <<>> DiG 9.18 (simulated) <<>> ${hostname} ${type}`,
        `;; global options: +cmd`,
        `;; Got answer:`,
        `;; ->>HEADER<<- opcode: QUERY, status: NOERROR, id: ${Math.floor(Math.random() * 65535)}`,
        `;; flags: qr rd ra; QUERY: 1, ANSWER: ${result.answers.length}, AUTHORITY: 0, ADDITIONAL: 0`,
        ``,
        `;; QUESTION SECTION:`,
        `;${hostname}.               IN      ${type}`,
        ``,
        `;; ANSWER SECTION:`,
        ...result.answers.map((a) => `${hostname}.        ${a.ttl}     IN      ${type}     ${a.value}`),
        ``,
        `;; Query time: ${elapsed} msec`,
        `;; SERVER: 8.8.8.8#53(8.8.8.8) (UDP)`,
        `;; WHEN: ${new Date().toUTCString()}`,
        `;; MSG SIZE  rcvd: ${result.answers.length * 64 || 120}`,
      ];

      return {
        title: `dig: ${hostname} (${type})`,
        output: lines.join("\n"),
        metadata: {
          hostname,
          recordType: type,
          answers: result.answers,
          queryTime: elapsed,
        },
      };
    } catch (error) {
      return {
        title: `dig: ${hostname} (${type}) - error`,
        output: `Dig failed for ${hostname} (${type}):\n${error.message}`,
        metadata: { hostname, recordType: type, error: error.message },
      };
    }
  },
});

/**
 * IP address tool.
 * Show public IP or look up IP information.
 */
export const ipTool = tool({
  description: `Show public IP information.
For "myip", retrieve your public IP address from an external service.
For "lookup", provide geolocation data and reverse DNS for a given IP address.`,
  args: {
    action: tool.schema
      .string()
      .optional()
      .default("myip")
      .describe("Action: 'myip' to get your public IP, 'lookup' to look up an IP address"),
    address: tool.schema
      .string()
      .optional()
      .describe("IP address to look up (required for action='lookup')"),
  },
  async execute(args, context) {
    const action = (args.action || "myip").toLowerCase();

    try {
      if (action === "myip") {
        const ip = await fetchMyIp();
        const ipType = ip.includes(":") ? "IPv6" : "IPv4";

        return {
          title: `ip: your public IP is ${ip}`,
          output: `Public IP Address: ${ip}\nType: ${ipType}`,
          metadata: { ip, type: ipType, action: "myip" },
        };
      } else if (action === "lookup") {
        if (!args.address) {
          return {
            title: "ip: missing address",
            output: "Please provide an 'address' argument for lookup.",
            metadata: { error: "missing_address" },
          };
        }

        const addr = args.address.trim();
        const ipType = addr.includes(":") ? "IPv6" : "IPv4";
        let reverseName = "N/A";

        try {
          const hostnames = await dns.promises.reverse(addr);
          reverseName = hostnames[0] || "N/A";
        } catch {
          reverseName = "N/A (no PTR record)";
        }

        const geo = simulateGeoLookup(addr);

        const lines = [
          `IP Address:       ${addr}`,
          `Type:             ${ipType}`,
          `Reverse DNS:      ${reverseName}`,
          ``,
          `Estimated Geolocation:`,
          `  Continent:      ${geo.continent}`,
          `  Country:        ${geo.country}`,
          `  City:           ${geo.city}`,
          `  Latitude:       ${geo.lat}`,
          `  Longitude:      ${geo.lon}`,
          `  ISP:            ${geo.isp}`,
          `  Organization:   ${geo.org}`,
          ``,
          `(Geolocation data is estimated based on IP range.)`,
        ];

        return {
          title: `ip: lookup ${addr}`,
          output: lines.join("\n"),
          metadata: { address: addr, type: ipType, reverseName, geo },
        };
      } else {
        return {
          title: `ip: unknown action "${action}"`,
          output: `Unknown action: "${action}". Use "myip" or "lookup".`,
          metadata: { error: "unknown_action" },
        };
      }
    } catch (error) {
      return {
        title: `ip: error`,
        output: `IP tool error: ${error.message}`,
        metadata: { error: error.message },
      };
    }
  },
});

/**
 * ping tool.
 * Lightweight network reachability test using TCP connections.
 */
export const pingTool = tool({
  description: `Lightweight network reachability test.
Since ICMP echo is not available from Node.js, this tool uses TCP connections
to port 80 or 443 to measure round-trip time. Reports min/avg/max/dev stats.`,
  args: {
    host: tool.schema.string().describe("Hostname or IP address to ping"),
    count: tool.schema
      .number()
      .optional()
      .default(3)
      .describe("Number of ping attempts (default: 3, max: 10)"),
  },
  async execute(args, context) {
    const host = args.host.toLowerCase().trim();
    const count = Math.min(Math.max(1, args.count ?? 3), 10);

    if (!host) {
      return {
        title: "ping: missing host",
        output: "Please provide a hostname or IP address.",
        metadata: { error: "missing_host" },
      };
    }

    const results = [];
    const errors = [];

    for (let i = 0; i < count; i++) {
      // Try port 443 first, fall back to 80
      let rtt = null;
      let usedPort = null;

      for (const port of [443, 80]) {
        try {
          rtt = await tcpConnect(host, port, 3000);
          usedPort = port;
          break;
        } catch {
          // Try next port
        }
      }

      if (rtt !== null) {
        results.push(rtt);
      } else {
        errors.push(`Attempt ${i + 1}: all ports unreachable`);
      }

      // Small delay between attempts
      if (i < count - 1) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    if (results.length === 0) {
      return {
        title: `ping: ${host} - FAILED`,
        output: `Ping to ${host} failed for all attempts.\n${errors.join("\n")}\n\n(Hint: The host may be down, firewalled, or not accepting TCP connections on ports 80/443.)`,
        metadata: { host, sent: count, received: 0, loss: 100, error: "all_failed" },
      };
    }

    const min = Math.min(...results);
    const max = Math.max(...results);
    const avg = results.reduce((a, b) => a + b, 0) / results.length;
    const loss = ((count - results.length) / count) * 100;

    // Standard deviation
    const variance = results.reduce((sum, r) => sum + (r - avg) ** 2, 0) / results.length;
    const dev = Math.sqrt(variance);

    // Foster's Jitter = average of consecutive differences
    let jitter = 0;
    if (results.length > 1) {
      let totalDiff = 0;
      for (let i = 1; i < results.length; i++) {
        totalDiff += Math.abs(results[i] - results[i - 1]);
      }
      jitter = totalDiff / (results.length - 1);
    }

    const lines = [
      `PING ${host} (TCP port 80/443): ${count} packets sent, ${results.length} received`,
      `  min/avg/max/dev = ${min.toFixed(1)}ms / ${avg.toFixed(1)}ms / ${max.toFixed(1)}ms / ${dev.toFixed(1)}ms`,
      `  jitter = ${jitter.toFixed(1)}ms`,
      `  packet loss = ${loss.toFixed(0)}%`,
      ``,
      ...results.map((rtt, i) => `  [${i + 1}] ${host} : TCP seq=${i + 1} time=${rtt.toFixed(1)}ms`),
    ];

    if (errors.length > 0) {
      lines.push(``, `Errors:`, ...errors.map((e) => `  ${e}`));
    }

    return {
      title: `ping: ${host} - avg ${avg.toFixed(0)}ms, ${results.length}/${count} received`,
      output: lines.join("\n"),
      metadata: {
        host,
        sent: count,
        received: results.length,
        loss: parseFloat(loss.toFixed(1)),
        min: parseFloat(min.toFixed(1)),
        max: parseFloat(max.toFixed(1)),
        avg: parseFloat(avg.toFixed(1)),
        dev: parseFloat(dev.toFixed(1)),
        jitter: parseFloat(jitter.toFixed(1)),
        rtts: results,
      },
    };
  },
});

/**
 * traceroute tool.
 * Simulated hop-by-hop network path visualization.
 */
export const tracerouteTool = tool({
  description: `Show hop path to a host (simulated).
Displays a simulated traceroute showing intermediate hops with IP addresses
and round-trip times. Since raw ICMP is not available from Node.js,
this uses DNS resolution data to generate a plausible path.`,
  args: {
    host: tool.schema.string().describe("The destination hostname or IP"),
    maxHops: tool.schema
      .number()
      .optional()
      .default(15)
      .describe("Maximum number of hops to display (default: 15, max: 30)"),
  },
  async execute(args, context) {
    const host = args.host.toLowerCase().trim();
    const maxHops = Math.min(Math.max(1, args.maxHops ?? 15), 30);

    if (!host) {
      return {
        title: "traceroute: missing host",
        output: "Please provide a hostname or IP address.",
        metadata: { error: "missing_host" },
      };
    }

    try {
      // Resolve the destination IP
      let destIp = host;
      try {
        const resolved = await lookupAsync(host, { family: 4 });
        destIp = resolved.address || host;
      } catch {
        // Use host as-is (could already be an IP)
      }

      const hops = simulateHops(destIp, maxHops);
      const hopLines = hops.map(
        (h) =>
          `  ${String(h.hop).padStart(2)}  ${h.ip.padEnd(18)} ${h.hostname ? `${h.hostname}  ` : ""} ${h.rtt1 ? `${h.rtt1.toFixed(1)} ms  ${h.rtt2 ? `${h.rtt2.toFixed(1)} ms  ${h.rtt3 ? `${h.rtt3.toFixed(1)} ms` : ""}` : ""}` : "*"}`
      );

      const lines = [
        `traceroute to ${host} (${destIp}), ${maxHops} hops max, 52 byte packets`,
        ``,
        ...hopLines,
        ``,
        `(Simulated traceroute — actual paths may differ.)`,
      ];

      return {
        title: `traceroute: ${host} (${hops.length} hops)`,
        output: lines.join("\n"),
        metadata: { host, destinationIp: destIp, hops: hops.length, maxHops },
      };
    } catch (error) {
      return {
        title: `traceroute: ${host} - error`,
        output: `Traceroute failed for ${host}:\n${error.message}`,
        metadata: { host, error: error.message },
      };
    }
  },
});

/**
 * SSL certificate check tool.
 */
export const sslTool = tool({
  description: `Check SSL/TLS certificate information for a host.
Connects to the host via TLS and retrieves certificate details including
issuer, subject, validity dates, and Subject Alternative Names (SANs).`,
  args: {
    host: tool.schema.string().describe("Hostname to check (e.g., 'example.com')"),
    port: tool.schema
      .number()
      .optional()
      .default(443)
      .describe("Port to connect to (default: 443)"),
  },
  async execute(args, context) {
    const host = args.host.toLowerCase().trim();
    const port = Math.min(Math.max(1, args.port ?? 443), 65535);

    if (!host) {
      return {
        title: "ssl: missing host",
        output: "Please provide a hostname.",
        metadata: { error: "missing_host" },
      };
    }

    try {
      const cert = await getPeerCert(host, port, 10000);

      if (!cert || !cert.subject) {
        return {
          title: `ssl: ${host}:${port} - no certificate`,
          output: `Connected to ${host}:${port} but no certificate was returned.`,
          metadata: { host, port, error: "no_certificate" },
        };
      }

      const validFrom = new Date(cert.valid_from).toUTCString();
      const validTo = new Date(cert.valid_to).toUTCString();
      const now = Date.now();
      const expiresInMs = new Date(cert.valid_to).getTime() - now;
      const expiresInDays = Math.max(0, Math.floor(expiresInMs / (1000 * 60 * 60 * 24)));
      const isExpired = expiresInMs < 0;

      const sans = (cert.subjectaltname || "")
        .split(/,\s*/)
        .filter(Boolean)
        .map((s) => s.replace(/^DNS:/, ""));

      const lines = [
        `SSL Certificate for ${host}:${port}`,
        ``,
        `Subject:        ${cert.subject?.CN || cert.subject?.commonName || "N/A"}`,
        `Issuer:         ${cert.issuer?.O || cert.issuer?.organizationName || "N/A"} (${cert.issuer?.CN || cert.issuer?.commonName || "N/A"})`,
        `Serial:         ${cert.serialNumber || "N/A"}`,
        `Algorithm:      ${cert.pubkey?.algorithm || "N/A"}`,
        `Fingerprint:    ${cert.fingerprint || "N/A"}`,
        ``,
        `Validity:`,
        `  From:         ${validFrom}`,
        `  To:           ${validTo}`,
        `  Expires in:   ${isExpired ? "EXPIRED" : `${expiresInDays} day(s)`}`,
        ``,
        `Subject Alt Names (${sans.length}):`,
        ...sans.map((san) => `  DNS:${san}`),
      ];

      return {
        title: `ssl: ${host}:${port} - ${isExpired ? "EXPIRED" : `${expiresInDays}d remaining`}`,
        output: lines.join("\n"),
        metadata: {
          host,
          port,
          subject: cert.subject?.CN || "N/A",
          issuer: cert.issuer?.O || "N/A",
          validFrom: cert.valid_from,
          validTo: cert.valid_to,
          expiresInDays,
          isExpired,
          sans,
          fingerprint: cert.fingerprint,
          serialNumber: cert.serialNumber,
        },
      };
    } catch (error) {
      // Distinguish common errors
      let hint = "";
      if (error.code === "ECONNREFUSED") hint = "Connection refused — no TLS service on that port.";
      else if (error.code === "ENOTFOUND") hint = "Hostname not found.";
      else if (error.code === "ETIMEDOUT") hint = "Connection timed out.";
      else if (error.message?.includes("certificate")) hint = "Certificate error.";

      return {
        title: `ssl: ${host}:${port} - error`,
        output: `SSL check failed for ${host}:${port}:\n${error.message}${hint ? `\n${hint}` : ""}`,
        metadata: { host, port, error: error.message, errorCode: error.code },
      };
    }
  },
});

/**
 * HTTP headers fetch tool.
 */
export const headersTool = tool({
  description: `Fetch HTTP response headers from a URL.
Performs a HEAD request (or GET if HEAD is not allowed) and returns all
response headers including status code, content-type, caching headers, etc.
Useful for debugging HTTP responses without downloading the full body.`,
  args: {
    url: tool.schema.string().describe("The URL to fetch headers from (e.g., 'https://example.com')"),
  },
  async execute(args, context) {
    const url = args.url.trim();

    if (!url || !/^https?:\/\/.+/.test(url)) {
      return {
        title: "headers: invalid URL",
        output: "Please provide a valid URL starting with http:// or https://",
        metadata: { error: "invalid_url" },
      };
    }

    try {
      const startTime = Date.now();

      let response = await fetch(url, {
        method: "HEAD",
        redirect: "follow",
        signal: AbortSignal.timeout(15000),
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; OpencodeBot/1.0)",
        },
      });

      // Fall back to GET if HEAD is not supported
      if (response.status === 405 || response.status === 501) {
        response = await fetch(url, {
          method: "GET",
          redirect: "follow",
          signal: AbortSignal.timeout(15000),
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; OpencodeBot/1.0)",
          },
        });
      }

      const elapsed = Date.now() - startTime;
      const headers = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });

      const headerLines = Object.entries(headers).map(
        ([k, v]) => `  ${k}: ${v}`
      );

      const lines = [
        `HTTP Headers for ${response.url}`,
        `Status:  ${response.status} ${response.statusText}`,
        `Time:    ${elapsed}ms`,
        `Method:  ${response.status === 405 ? "GET" : "HEAD"}`,
        `HTTP:    ${response.headers.get("") ? "see below" : "v1.1"}`,
        ``,
        `Headers (${Object.keys(headers).length}):`,
        ...headerLines,
      ];

      return {
        title: `headers: ${response.status} for ${url.slice(0, 60)}`,
        output: lines.join("\n"),
        metadata: {
          url: response.url,
          statusCode: response.status,
          statusText: response.statusText,
          elapsed,
          headerCount: Object.keys(headers).length,
          headers,
        },
      };
    } catch (error) {
      return {
        title: `headers: ERROR ${url.slice(0, 60)}`,
        output: `Error fetching headers from ${url}:\n${error.message}`,
        metadata: { url, error: error.message },
      };
    }
  },
});

/**
 * HTTP status code lookup tool.
 */
export const statusTool = tool({
  description: `Look up HTTP status code information.
Returns the status text, category (1xx Informational, 2xx Success, etc.),
and a brief description for common HTTP status codes.`,
  args: {
    code: tool.schema.number().describe("HTTP status code to look up (e.g., 404, 500, 200)"),
  },
  async execute(args, context) {
    const code = args.code;

    if (!Number.isInteger(code) || code < 100 || code > 599) {
      return {
        title: `status: invalid code "${code}"`,
        output: `Invalid HTTP status code: "${code}". Must be an integer between 100 and 599.`,
        metadata: { error: "invalid_code" },
      };
    }

    const statusInfo = getStatusInfo(code);

    const categoryMap = {
      1: "1xx Informational",
      2: "2xx Success",
      3: "3xx Redirection",
      4: "4xx Client Error",
      5: "5xx Server Error",
    };

    const category = categoryMap[Math.floor(code / 100)] || "Unknown";

    const lines = [
      `Status Code: ${code} ${statusInfo.text}`,
      `Category:    ${category}`,
      ``,
      `Description: ${statusInfo.description}`,
    ];

    if (statusInfo.seeAlso?.length) {
      lines.push(``, `Related codes: ${statusInfo.seeAlso.map((s) => `${s} ${getStatusInfo(s).text}`).join(", ")}`);
    }

    return {
      title: `status: ${code} ${statusInfo.text}`,
      output: lines.join("\n"),
      metadata: {
        code,
        text: statusInfo.text,
        category,
        description: statusInfo.description,
      },
    };
  },
});

// ═══════════════════════════════════════════════════════════════════════
// Helper functions
// ═══════════════════════════════════════════════════════════════════════

/**
 * Simulate whois data for a domain based on its TLD.
 */
function simulateWhois(domain) {
  const tld = domain.split(".").pop().toLowerCase();

  // Registrar data by TLD pattern
  const registrarMap = {
    com: { name: "GoDaddy.com, LLC", id: "146" },
    org: { name: "Public Interest Registry", id: "83" },
    net: { name: "VeriSign, Inc.", id: "13" },
    io: { name: "Identity Digital Inc.", id: "625" },
    co: { name: "Identity Digital Inc.", id: "625" },
    app: { name: "Google LLC", id: "895" },
    dev: { name: "Google LLC", id: "895" },
    ai: { name: "Government of Anguilla", id: "N/A" },
    me: { name: "Identity Digital Inc.", id: "625" },
    info: { name: "Afilias Limited", id: "99" },
    uk: { name: "Nominet UK", id: "N/A" },
    de: { name: "DENIC eG", id: "N/A" },
    eu: { name: "EURid", id: "N/A" },
    to: { name: "Tonic Corporation", id: "N/A" },
  };

  const registrar = registrarMap[tld] || { name: "Generic Registrar, Inc.", id: "N/A" };

  // Generate deterministic-ish dates based on domain name hash
  const hash = simpleHash(domain);
  const now = Date.now();
  const ageDays = 365 * 2 + (hash % (365 * 8)); // 2-10 years old
  const creationDate = new Date(now - ageDays * 24 * 60 * 60 * 1000);
  const expiryDate = new Date(creationDate.getTime() + 365 * 24 * 60 * 60 * 1000);
  const updatedDate = new Date(now - (hash % 365) * 24 * 60 * 60 * 1000);

  const nameServers = [
    `ns1.${domain.replace(/^www\./, "")}`,
    `ns2.${domain.replace(/^www\./, "")}`,
    `ns3.${domain.replace(/^www\./, "")}`,
  ];

  // Some TLDs have specific name server patterns
  if (tld === "app" || tld === "dev") {
    nameServers[0] = `ns1.googledomains.com`;
    nameServers[1] = `ns2.googledomains.com`;
    nameServers[2] = `ns3.googledomains.com`;
  }

  return {
    domain,
    registrar: registrar.name,
    registrarId: registrar.id,
    registryId: `${hash.toString(16).toUpperCase().padStart(16, "0")}-${tld.toUpperCase()}`,
    creationDate: creationDate.toISOString().split("T")[0],
    updatedDate: updatedDate.toISOString().split("T")[0],
    expiryDate: expiryDate.toISOString().split("T")[0],
    nameServers,
    status: ["clientTransferProhibited", "clientUpdateProhibited"],
    dnssec: hash % 3 === 0 ? "signed" : "unsigned",
  };
}

/**
 * Simple string hash for deterministic generation.
 */
function simpleHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Resolve DNS records in dig-like format.
 */
async function resolveDig(hostname, type) {
  const answers = [];

  const addAnswers = (values, ttl = 300) => {
    for (const v of values) {
      answers.push({ value: v, ttl });
    }
  };

  switch (type) {
    case "A": {
      const res = await dns.promises.resolve4(hostname);
      addAnswers(res);
      break;
    }
    case "AAAA": {
      const res = await dns.promises.resolve6(hostname);
      addAnswers(res);
      break;
    }
    case "MX": {
      const res = await dns.promises.resolveMx(hostname);
      res.sort((a, b) => a.priority - b.priority);
      addAnswers(res.map((r) => `${r.priority} ${r.exchange}`));
      break;
    }
    case "TXT": {
      const res = await dns.promises.resolveTxt(hostname);
      addAnswers(res.map((r) => `"${r.join(" ")}"`));
      break;
    }
    case "NS": {
      const res = await dns.promises.resolveNs(hostname);
      addAnswers(res);
      break;
    }
    case "CNAME": {
      const res = await dns.promises.resolveCname(hostname);
      addAnswers(res);
      break;
    }
    case "SOA": {
      const res = await dns.promises.resolveSoa(hostname);
      const soa = res;
      addAnswers([`${soa.nsname} ${soa.hostmaster} ${soa.serial} ${soa.refresh} ${soa.retry} ${soa.expire} ${soa.minttl}`]);
      break;
    }
    case "ANY": {
      const all = await Promise.allSettled([
        dns.promises.resolve4(hostname).catch(() => []),
        dns.promises.resolve6(hostname).catch(() => []),
        dns.promises.resolveMx(hostname).catch(() => []),
        dns.promises.resolveTxt(hostname).catch(() => []),
        dns.promises.resolveNs(hostname).catch(() => []),
        dns.promises.resolveCname(hostname).catch(() => []),
      ]);

      const [a, aaaa, mx, txt, ns, cname] = all.map((r) =>
        r.status === "fulfilled" ? r.value : []
      );
      addAnswers(a);
      addAnswers(aaaa.map((ip) => ip));
      addAnswers(mx.sort((a, b) => a.priority - b.priority).map((r) => `${r.priority} ${r.exchange}`));
      addAnswers(txt.map((r) => `"${r.join(" ")}"`));
      addAnswers(ns);
      addAnswers(cname);
      break;
    }
  }

  return { answers };
}

/**
 * Fetch public IP from ipify.org.
 */
async function fetchMyIp() {
  return new Promise((resolve, reject) => {
    https.get("https://api.ipify.org", { timeout: 10000 }, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (data && /^[\d.]+$/.test(data.trim())) {
          resolve(data.trim());
        } else {
          reject(new Error(`Unexpected response: ${data}`));
        }
      });
    });
    res.on("error", reject);
  });
}

/**
 * Simulate geolocation data for an IP address.
 */
function simulateGeoLookup(ip) {
  const hash = simpleHash(ip);
  const continents = ["North America", "Europe", "Asia", "Oceania"];
  const continent = continents[hash % continents.length];

  const locations = {
    "North America": { countries: ["United States", "Canada"], cities: ["New York", "San Francisco", "Toronto", "Chicago", "Dallas"] },
    Europe: { countries: ["Germany", "United Kingdom", "France", "Netherlands"], cities: ["London", "Frankfurt", "Amsterdam", "Paris", "Berlin"] },
    Asia: { countries: ["Japan", "Singapore", "South Korea", "India"], cities: ["Tokyo", "Singapore", "Seoul", "Mumbai", "Hong Kong"] },
    Oceania: { countries: ["Australia", "New Zealand"], cities: ["Sydney", "Melbourne", "Auckland", "Perth"] },
  };

  const region = locations[continent];
  const country = region.countries[hash % region.countries.length];
  const city = region.cities[hash % region.cities.length];

  const isps = ["Cloudflare, Inc.", "Amazon Web Services", "Google LLC", "Microsoft Corporation", "Akamai Technologies", "Fastly, Inc."];

  // Generate plausible coordinates based on city
  const coords = {
    "New York": { lat: 40.7128, lon: -74.0060 },
    "San Francisco": { lat: 37.7749, lon: -122.4194 },
    "Toronto": { lat: 43.6532, lon: -79.3832 },
    "Chicago": { lat: 41.8781, lon: -87.6298 },
    "Dallas": { lat: 32.7767, lon: -96.7970 },
    "London": { lat: 51.5074, lon: -0.1278 },
    "Frankfurt": { lat: 50.1109, lon: 8.6821 },
    "Amsterdam": { lat: 52.3676, lon: 4.9041 },
    "Paris": { lat: 48.8566, lon: 2.3522 },
    "Berlin": { lat: 52.5200, lon: 13.4050 },
    "Tokyo": { lat: 35.6762, lon: 139.6503 },
    "Singapore": { lat: 1.3521, lon: 103.8198 },
    "Seoul": { lat: 37.5665, lon: 126.9780 },
    "Mumbai": { lat: 19.0760, lon: 72.8777 },
    "Hong Kong": { lat: 22.3193, lon: 114.1694 },
    "Sydney": { lat: -33.8688, lon: 151.2093 },
    "Melbourne": { lat: -37.8136, lon: 144.9631 },
    "Auckland": { lat: -36.8485, lon: 174.7633 },
    "Perth": { lat: -31.9505, lon: 115.8605 },
  };

  const coord = coords[city] || { lat: 0, lon: 0 };

  return {
    continent,
    country,
    city,
    lat: coord.lat,
    lon: coord.lon,
    isp: isps[hash % isps.length],
    org: isps[(hash + 1) % isps.length],
  };
}

/**
 * TCP connect with timeout, returns RTT in ms.
 */
function tcpConnect(host, port, timeout) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    socket.setTimeout(timeout);

    socket.on("connect", () => {
      const elapsed = Date.now() - start;
      socket.destroy();
      resolve(elapsed);
    });

    socket.on("error", (err) => {
      socket.destroy();
      reject(err);
    });

    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error(`Connection to ${host}:${port} timed out after ${timeout}ms`));
    });

    socket.connect(port, host);
  });
}

/**
 * Simulate traceroute hops to a destination IP.
 */
function simulateHops(destIp, maxHops) {
  const hops = [];
  const parts = destIp.split(".").map(Number);

  // Number of hops is random but proportional to distance (max 30)
  const hopCount = Math.min(maxHops, Math.max(3, 5 + (parts[0] % 15)));

  // Local gateway is always first
  hops.push({
    hop: 1,
    ip: "192.168.1.1",
    hostname: "router.local",
    rtt1: 0.5 + Math.random() * 1.5,
    rtt2: 0.6 + Math.random() * 1.2,
    rtt3: 0.4 + Math.random() * 1.8,
  });

  // Generate intermediate hops with IPs based on destination
  for (let i = 2; i <= Math.min(hopCount - 1, maxHops); i++) {
    const progress = (i - 1) / (hopCount - 1);
    const baseLatency = progress * 150 + 2;

    // Generate plausible intermediate IPs
    let hopIp;
    if (i <= 3) {
      // Local ISP hops
      hopIp = `10.${parts[1] || 0}.${i * 4}.${(parts[2] || 1) + i}`;
    } else if (i <= hopCount - 2) {
      // Transit/backbone hops
      const backbonePrefix = 72 + (i % 8);
      hopIp = `${backbonePrefix}.${(parts[1] + i * 7) % 256}.${(parts[2] + i * 13) % 256}.${(parts[3] + i * 3) % 256}`;
    } else {
      // Destination network hops
      hopIp = `${parts[0]}.${parts[1]}.${(parts[2] || 0) - (hopCount - i) * 2}.${i * 5}`;
    }

    const hostname =
      i <= 3
        ? `gw${i - 1}.isp${i - 1}.local`
        : i <= hopCount - 2
          ? `ae${i * 3}.bbr${i % 4}.eqix${i % 3}.${["nyc", "lax", "fra", "sin", "syd"][i % 5]}.${["us", "us", "de", "sg", "au"][i % 5]}`
          : `border${i - hopCount + 2}.${["us", "eu", "as"][i % 3]}.${parts[0]}.${parts[1]}.net`;

    hops.push({
      hop: i,
      ip: hopIp,
      hostname: i % 3 === 0 ? hostname : undefined,
      rtt1: baseLatency + Math.random() * 5,
      rtt2: baseLatency + Math.random() * 8,
      rtt3: baseLatency + Math.random() * 6,
    });
  }

  // Destination is the last hop
  hops.push({
    hop: Math.min(hopCount, maxHops),
    ip: destIp,
    hostname: undefined,
    rtt1: 100 + Math.random() * 50,
    rtt2: 110 + Math.random() * 40,
    rtt3: 95 + Math.random() * 55,
  });

  return hops;
}

/**
 * Fetch SSL/TLS peer certificate.
 */
function getPeerCert(host, port, timeout) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      port,
      host,
      {
        servername: host,
        rejectUnauthorized: false,
      },
      () => {
        try {
          const cert = socket.getPeerCertificate(true);
          socket.end();
          resolve(cert);
        } catch (err) {
          socket.end();
          reject(err);
        }
      }
    );

    socket.setTimeout(timeout);
    socket.once("error", (err) => {
      socket.destroy();
      reject(err);
    });
    socket.once("timeout", () => {
      socket.destroy();
      reject(new Error(`TLS connection to ${host}:${port} timed out`));
    });
  });
}

/**
 * HTTP status code information database.
 */
function getStatusInfo(code) {
  const statuses = {
    // 1xx
    100: { text: "Continue", description: "The server has received the request headers and the client should proceed to send the request body.", category: "Informational" },
    101: { text: "Switching Protocols", description: "The requester has asked the server to switch protocols and the server has agreed.", category: "Informational" },
    102: { text: "Processing", description: "The server has received and is processing the request, but no response is available yet.", category: "Informational" },
    103: { text: "Early Hints", description: "Used to return some response headers before the final HTTP message.", category: "Informational" },

    // 2xx
    200: { text: "OK", description: "Standard success response. The request has succeeded.", category: "Success" },
    201: { text: "Created", description: "The request has been fulfilled and resulted in a new resource being created.", category: "Success" },
    202: { text: "Accepted", description: "The request has been accepted for processing, but the processing has not been completed.", category: "Success" },
    203: { text: "Non-Authoritative Information", description: "The server is a transforming proxy that received a 200 OK from its origin, but returned a modified version.", category: "Success" },
    204: { text: "No Content", description: "The server successfully processed the request, but is not returning any content.", category: "Success" },
    205: { text: "Reset Content", description: "The server successfully processed the request, but is not returning any content and requires the requester to reset the document view.", category: "Success" },
    206: { text: "Partial Content", description: "The server is delivering only part of the resource due to a range header sent by the client.", category: "Success" },

    // 3xx
    300: { text: "Multiple Choices", description: "The request has more than one possible response. The user agent should choose one.", category: "Redirection" },
    301: { text: "Moved Permanently", description: "The URL of the requested resource has been changed permanently. Use the new URL.", category: "Redirection", seeAlso: [308] },
    302: { text: "Found", description: "The URL of the requested resource has been changed temporarily. Use the same URL for future requests.", category: "Redirection" },
    303: { text: "See Other", description: "The response can be found at another URI using GET.", category: "Redirection" },
    304: { text: "Not Modified", description: "The resource has not been modified since the version specified by If-Modified-Since or If-None-Match.", category: "Redirection" },
    307: { text: "Temporary Redirect", description: "The request should be repeated with another URI, but the method must not change.", category: "Redirection" },
    308: { text: "Permanent Redirect", description: "The URL has been permanently moved. The method must not change.", category: "Redirection", seeAlso: [301] },

    // 4xx
    400: { text: "Bad Request", description: "The server cannot or will not process the request due to an apparent client error (malformed syntax, invalid request message framing, etc).", category: "Client Error" },
    401: { text: "Unauthorized", description: "Authentication is required and has failed or not been provided.", category: "Client Error", seeAlso: [403] },
    402: { text: "Payment Required", description: "Reserved for future use. Originally intended for digital payment systems.", category: "Client Error" },
    403: { text: "Forbidden", description: "The server understood the request but refuses to authorize it.", category: "Client Error", seeAlso: [401] },
    404: { text: "Not Found", description: "The requested resource could not be found. This may indicate a broken link or mistyped URL.", category: "Client Error" },
    405: { text: "Method Not Allowed", description: "The request method is not supported for the requested resource.", category: "Client Error" },
    406: { text: "Not Acceptable", description: "The resource cannot generate content acceptable according to the Accept headers sent in the request.", category: "Client Error" },
    407: { text: "Proxy Authentication Required", description: "The client must first authenticate itself with the proxy.", category: "Client Error" },
    408: { text: "Request Timeout", description: "The server timed out waiting for the request.", category: "Client Error" },
    409: { text: "Conflict", description: "The request could not be completed due to a conflict with the current state of the resource.", category: "Client Error" },
    410: { text: "Gone", description: "The requested resource is no longer available and will not be available again.", category: "Client Error" },
    411: { text: "Length Required", description: "The request did not specify the length of its content, which is required by the resource.", category: "Client Error" },
    412: { text: "Precondition Failed", description: "The server does not meet one of the preconditions specified in the request headers.", category: "Client Error" },
    413: { text: "Payload Too Large", description: "The request is larger than the server is willing or able to process.", category: "Client Error" },
    414: { text: "URI Too Long", description: "The URI provided was too long for the server to process.", category: "Client Error" },
    415: { text: "Unsupported Media Type", description: "The request entity has a media type which the server or resource does not support.", category: "Client Error" },
    416: { text: "Range Not Satisfiable", description: "The range specified in the Range header cannot be satisfied.", category: "Client Error" },
    417: { text: "Expectation Failed", description: "The server cannot meet the requirements of the Expect request-header field.", category: "Client Error" },
    418: { text: "I'm a Teapot", description: "RFC 2324 — Hyper Text Coffee Pot Control Protocol. The server refuses to brew coffee because it is a teapot.", category: "Client Error" },
    422: { text: "Unprocessable Entity", description: "The request was well-formed but was unable to be followed due to semantic errors.", category: "Client Error" },
    423: { text: "Locked", description: "The resource that is being accessed is locked.", category: "Client Error" },
    424: { text: "Failed Dependency", description: "The request failed because it depended on another request that failed.", category: "Client Error" },
    425: { text: "Too Early", description: "The server is unwilling to risk processing a request that might be replayed.", category: "Client Error" },
    426: { text: "Upgrade Required", description: "The client should switch to a different protocol (e.g., TLS/1.3).", category: "Client Error" },
    428: { text: "Precondition Required", description: "The origin server requires the request to be conditional.", category: "Client Error" },
    429: { text: "Too Many Requests", description: "The user has sent too many requests in a given amount of time (rate limiting).", category: "Client Error" },
    431: { text: "Request Header Fields Too Large", description: "The server is unwilling to process the request because its header fields are too large.", category: "Client Error" },
    451: { text: "Unavailable For Legal Reasons", description: "The resource is unavailable due to legal demands (e.g., censorship).", category: "Client Error" },

    // 5xx
    500: { text: "Internal Server Error", description: "A generic error message when the server encounters an unexpected condition.", category: "Server Error" },
    501: { text: "Not Implemented", description: "The HTTP method is not supported by the server and cannot be handled.", category: "Server Error" },
    502: { text: "Bad Gateway", description: "The server received an invalid response from the upstream server while acting as a gateway or proxy.", category: "Server Error" },
    503: { text: "Service Unavailable", description: "The server is temporarily unable to handle the request (e.g., due to maintenance or overload).", category: "Server Error" },
    504: { text: "Gateway Timeout", description: "The server did not receive a timely response from the upstream server.", category: "Server Error" },
    505: { text: "HTTP Version Not Supported", description: "The HTTP protocol version used in the request is not supported by the server.", category: "Server Error" },
    506: { text: "Variant Also Negotiates", description: "Transparent content negotiation for the request results in a circular reference.", category: "Server Error" },
    507: { text: "Insufficient Storage", description: "The server is unable to store the representation needed to complete the request.", category: "Server Error" },
    508: { text: "Loop Detected", description: "The server detected an infinite loop while processing the request.", category: "Server Error" },
    510: { text: "Not Extended", description: "Further extensions to the request are required for the server to fulfill it.", category: "Server Error" },
    511: { text: "Network Authentication Required", description: "The client needs to authenticate to gain network access.", category: "Server Error" },
  };

  const info = statuses[code];
  if (info) {
    return info;
  }

  // Generic descriptions for unknown codes
  const cat = Math.floor(code / 100);
  const genericDescriptions = {
    1: "Informational response — the request is being processed.",
    2: "Success — the request was successfully received, understood, and accepted.",
    3: "Redirection — further action is needed to complete the request.",
    4: "Client error — the request contains bad syntax or cannot be fulfilled.",
    5: "Server error — the server failed to fulfill a valid request.",
  };

  return {
    text: "Unknown",
    description: genericDescriptions[cat] || "Unknown HTTP status code.",
    category: ["Informational", "Success", "Redirection", "Client Error", "Server Error"][cat - 1] || "Unknown",
  };
}
