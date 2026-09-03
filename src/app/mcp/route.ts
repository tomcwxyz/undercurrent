import { requireApiV1Key, apiV1ErrorResponse } from "@/lib/api-v1";

export const runtime = "nodejs";
export const maxDuration = 60;

type JsonRpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

const tools = [
  {
    name: "swells_list_spaces",
    description: "List Swells spaces available to the user represented by the API key.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
    annotations: { readOnlyHint: true },
  },
  {
    name: "swells_recent_observations",
    description: "Read recent approved human observations from a Swells space as sensing evidence.",
    inputSchema: {
      type: "object",
      properties: {
        spaceId: { type: "string", format: "uuid" },
        limit: { type: "integer", minimum: 1, maximum: 100, default: 30 },
      },
      required: ["spaceId"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "swells_get_observation",
    description:
      "Read one approved Swells Observation by stable record ID within an explicit space. Use after a broader observation read when one specific record materially supports the answer.",
    inputSchema: {
      type: "object",
      properties: {
        spaceId: { type: "string", format: "uuid" },
        observationId: { type: "string", format: "uuid" },
      },
      required: ["spaceId", "observationId"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "swells_signals",
    description: "Read current active Swells signals: patterns assembled from observations.",
    inputSchema: {
      type: "object",
      properties: {
        spaceId: { type: "string", format: "uuid" },
        limit: { type: "integer", minimum: 1, maximum: 100, default: 30 },
      },
      required: ["spaceId"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "swells_surface_scene",
    description:
      "Read the first-party Swells semantic surface scene for a space, including the real temperature reading, bounded active swells and current changes. Prefer this over reconstructing Swells visual semantics in another product.",
    inputSchema: {
      type: "object",
      properties: {
        spaceId: { type: "string", format: "uuid" },
        surface: {
          type: "string",
          enum: ["web", "r1", "tablet", "epaper"],
          default: "tablet",
        },
      },
      required: ["spaceId"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "swells_get_signal",
    description:
      "Read one active Swells Signal by stable record ID within an explicit space. Use after a broader signal read when one specific pattern materially supports the answer.",
    inputSchema: {
      type: "object",
      properties: {
        spaceId: { type: "string", format: "uuid" },
        signalId: { type: "string", format: "uuid" },
      },
      required: ["spaceId", "signalId"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  {
    name: "swells_create_observation",
    description: "Create a normal Swells Observation in an explicit space. Requires observations:write.",
    inputSchema: {
      type: "object",
      properties: {
        spaceId: { type: "string", format: "uuid" },
        text: { type: "string", minLength: 1, maxLength: 5000 },
      },
      required: ["spaceId", "text"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
  },
] as const;

function rpc(id: JsonRpcRequest["id"], result: unknown, status = 200) {
  return Response.json(
    { jsonrpc: "2.0", id: id ?? null, result },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function rpcError(id: JsonRpcRequest["id"], code: number, message: string, status = 400) {
  return Response.json(
    { jsonrpc: "2.0", id: id ?? null, error: { code, message } },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function asRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function positiveInt(value: unknown, fallback: number, max: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed)
    ? Math.max(1, Math.min(Math.trunc(parsed), max))
    : fallback;
}

function spaceUrl(request: Request, spaceId: string) {
  return new URL(
    "/dashboard/" + encodeURIComponent(spaceId),
    request.url,
  ).toString();
}

async function apiCall(request: Request, path: string, init?: RequestInit) {
  const target = new URL(path, request.url);
  const authorization = request.headers.get("authorization") ?? "";
  const response = await fetch(target, {
    ...init,
    headers: {
      authorization,
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({
    error: { message: `Swells API request failed (${response.status})` },
  }));
  if (!response.ok) {
    const error = payload && typeof payload === "object" && "error" in payload
      ? (payload as { error?: unknown }).error
      : undefined;
    const message = error && typeof error === "object" && "message" in error
      ? String((error as { message: unknown }).message)
      : `Swells API request failed (${response.status})`;
    throw new Error(message);
  }
  return payload;
}

async function callTool(request: Request, name: string, args: Record<string, unknown>) {
  switch (name) {
    case "swells_list_spaces":
      return apiCall(request, "/api/v1/spaces");
    case "swells_recent_observations": {
      if (typeof args.spaceId !== "string" || !args.spaceId) throw new Error("spaceId is required");
      const params = new URLSearchParams({
        spaceId: args.spaceId,
        limit: String(positiveInt(args.limit, 30, 100)),
      });
      return apiCall(request, `/api/v1/observations?${params}`);
    }
    case "swells_get_observation": {
      if (typeof args.spaceId !== "string" || !args.spaceId) throw new Error("spaceId is required");
      if (typeof args.observationId !== "string" || !args.observationId) throw new Error("observationId is required");
      const payload = await apiCall(
        request,
        `/api/v1/observations/${encodeURIComponent(args.observationId)}?spaceId=${encodeURIComponent(args.spaceId)}`,
      );
      return {
        ...asRecord(payload),
        spaceId: args.spaceId,
        spaceUrl: spaceUrl(request, args.spaceId),
      };
    }
    case "swells_signals": {
      if (typeof args.spaceId !== "string" || !args.spaceId) throw new Error("spaceId is required");
      const params = new URLSearchParams({
        spaceId: args.spaceId,
        limit: String(positiveInt(args.limit, 30, 100)),
      });
      return apiCall(request, `/api/v1/signals?${params}`);
    }
    case "swells_surface_scene": {
      if (typeof args.spaceId !== "string" || !args.spaceId) {
        throw new Error("spaceId is required");
      }
      const surface =
        typeof args.surface === "string" &&
        ["web", "r1", "tablet", "epaper"].includes(args.surface)
          ? args.surface
          : "tablet";
      const params = new URLSearchParams({
        spaceId: args.spaceId,
        surface,
      });
      return apiCall(request, `/api/v1/surface-scene?${params}`);
    }
    case "swells_get_signal": {
      if (typeof args.spaceId !== "string" || !args.spaceId) throw new Error("spaceId is required");
      if (typeof args.signalId !== "string" || !args.signalId) throw new Error("signalId is required");
      const payload = await apiCall(
        request,
        `/api/v1/signals/${encodeURIComponent(args.signalId)}?spaceId=${encodeURIComponent(args.spaceId)}`,
      );
      return {
        ...asRecord(payload),
        spaceId: args.spaceId,
        spaceUrl: spaceUrl(request, args.spaceId),
      };
    }
    case "swells_create_observation":
      return apiCall(request, "/api/v1/observations", {
        method: "POST",
        body: JSON.stringify({ spaceId: args.spaceId, text: args.text }),
      });
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export async function POST(request: Request) {
  try {
    // MCP discovery itself requires spaces:read. Individual API calls still
    // enforce their own finer-grained scopes.
    await requireApiV1Key(request, "spaces:read");
  } catch (error) {
    return apiV1ErrorResponse(error);
  }

  let body: JsonRpcRequest;
  try {
    body = await request.json() as JsonRpcRequest;
  } catch {
    return rpcError(null, -32700, "Parse error");
  }

  if (body.jsonrpc !== "2.0" || !body.method) return rpcError(body.id, -32600, "Invalid Request");
  if (body.method === "notifications/initialized") return new Response(null, { status: 202 });

  if (body.method === "initialize") {
    const params = asRecord(body.params);
    return rpc(body.id, {
      protocolVersion: typeof params.protocolVersion === "string" ? params.protocolVersion : "2025-06-18",
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "swells", version: "1.0.0" },
    });
  }

  if (body.method === "ping") return rpc(body.id, {});
  if (body.method === "tools/list") return rpc(body.id, { tools });

  if (body.method === "tools/call") {
    const params = asRecord(body.params);
    const name = typeof params.name === "string" ? params.name : "";
    const args = asRecord(params.arguments);
    if (!name) return rpcError(body.id, -32602, "Tool name is required");
    try {
      const result = await callTool(request, name, args);
      return rpc(body.id, {
        content: [{ type: "text", text: JSON.stringify(result) }],
        structuredContent: result,
        isError: false,
      });
    } catch (error) {
      return rpc(body.id, {
        content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
        isError: true,
      });
    }
  }

  return rpcError(body.id, -32601, "Method not found");
}

export async function GET() {
  return Response.json(
    { error: "Use MCP Streamable HTTP POST requests" },
    { status: 405, headers: { Allow: "POST" } },
  );
}
