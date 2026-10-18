const PAGE_SIZE = 50;
const MAX_RETURNED_CONNECTIONS = 100;
const MAX_PAGES = 20;
const REQUEST_TIMEOUT_MS = 5000;

export type IntegrationConnection = {
  name: string;
  status: "connected" | "authorized_not_added" | "needs_reauthorization" | "error" | "unknown";
};

export type IntegrationStatusResult =
  | { status: "available"; integrations: IntegrationConnection[]; truncated: boolean }
  | {
      status: "unavailable";
      reason: "not_configured" | "permission_denied" | "request_failed";
    };

type IntegrationEnvironment = {
  REPLIT_CONNECTORS_HOSTNAME?: string;
  REPL_IDENTITY?: string;
  WEB_REPL_RENEWAL?: string;
};

type ConnectionPage = {
  items?: unknown;
  has_next_page?: unknown;
};

function getSafeName(connection: Record<string, unknown>): string | undefined {
  const candidate =
    connection.connector_name ??
    connection.connectorName ??
    connection.display_name ??
    connection.displayName ??
    connection.name;
  if (typeof candidate !== "string") return undefined;
  const name = candidate.trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 100);
  return name || undefined;
}

function getSafeStatus(value: unknown): IntegrationConnection["status"] {
  if (typeof value !== "string") return "connected";
  switch (value.trim().toLowerCase()) {
    case "added":
    case "active":
    case "connected":
      return "connected";
    case "not_added":
    case "authorized":
      return "authorized_not_added";
    case "expired":
    case "revoked":
    case "reauthorization_required":
    case "needs_reauthorization":
      return "needs_reauthorization";
    case "error":
    case "failed":
      return "error";
    default:
      return "unknown";
  }
}

function parseConnections(items: unknown): IntegrationConnection[] | undefined {
  if (!Array.isArray(items)) return undefined;
  const connections: IntegrationConnection[] = [];
  for (const item of items) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return undefined;
    const row = item as Record<string, unknown>;
    const name = getSafeName(row);
    if (!name) return undefined;
    connections.push({
      name,
      status: getSafeStatus(row.status ?? row.connection_status ?? row.connectionStatus),
    });
  }
  return connections;
}

function createConnectionsUrl(hostname: string, offset: number): URL | undefined {
  try {
    const url = new URL(hostname.includes("://") ? hostname : `https://${hostname}`);
    if (
      url.protocol !== "https:" ||
      !url.hostname.endsWith(".replit.com") ||
      url.port ||
      url.username ||
      url.password
    ) {
      return undefined;
    }
    url.pathname = "/api/v2/connection";
    url.search = new URLSearchParams({
      include_secrets: "false",
      limit: String(PAGE_SIZE),
      offset: String(offset),
    }).toString();
    return url;
  } catch {
    return undefined;
  }
}

export async function getReplitIntegrationStatus(
  environment: IntegrationEnvironment = process.env,
  request: typeof fetch = fetch,
): Promise<IntegrationStatusResult> {
  const hostname = environment.REPLIT_CONNECTORS_HOSTNAME?.trim();
  const token = environment.REPL_IDENTITY
    ? `repl ${environment.REPL_IDENTITY}`
    : environment.WEB_REPL_RENEWAL
      ? `depl ${environment.WEB_REPL_RENEWAL}`
      : undefined;
  if (!hostname || !token) {
    return { status: "unavailable", reason: "not_configured" };
  }

  const integrations: IntegrationConnection[] = [];
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const url = createConnectionsUrl(hostname, page * PAGE_SIZE);
    if (!url) return { status: "unavailable", reason: "request_failed" };

    let response: Response;
    try {
      response = await request(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          X_REPLIT_TOKEN: token,
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch {
      return { status: "unavailable", reason: "request_failed" };
    }

    if (response.status === 401 || response.status === 403) {
      return { status: "unavailable", reason: "permission_denied" };
    }
    if (!response.ok) {
      return { status: "unavailable", reason: "request_failed" };
    }

    let payload: ConnectionPage;
    try {
      payload = (await response.json()) as ConnectionPage;
    } catch {
      return { status: "unavailable", reason: "request_failed" };
    }
    const pageConnections = parseConnections(payload.items);
    if (!pageConnections) return { status: "unavailable", reason: "request_failed" };
    integrations.push(
      ...pageConnections.slice(0, MAX_RETURNED_CONNECTIONS - integrations.length),
    );

    if (payload.has_next_page !== true) {
      return { status: "available", integrations, truncated: false };
    }
    if (integrations.length >= MAX_RETURNED_CONNECTIONS) {
      return { status: "available", integrations, truncated: true };
    }
  }
  return { status: "available", integrations, truncated: true };
}
