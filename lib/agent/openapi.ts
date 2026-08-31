/**
 * lib/agent/openapi.ts — The Agent API described in OpenAPI 3.1.
 *
 * Generated from the registry rather than hand-written. A hand-written spec
 * drifts from the code within weeks, and for an agent platform that drift is
 * not a documentation problem — it is an agent confidently sending requests
 * that cannot succeed.
 *
 * Every tool appears as its own path, `/api/agent/tools/<name>`, so a platform
 * that imports this document gets one named operation per capability. That is
 * the same guarantee the registry makes internally: there is no operation whose
 * input is an instruction to be interpreted.
 */

import { BASE_URL } from "@/lib/base-url"
import { AGENT_API_VERSION } from "./envelope"
import { AGENT_ERROR_CODES } from "./errors"
import { AGENT_PERMISSIONS } from "./permissions"
import { describeTools, type ToolDescriptor } from "./registry"

type OpenApiObject = Record<string, unknown>

const ENVELOPE_META: OpenApiObject = {
  type: "object",
  properties: {
    requestId: { type: "string" },
    timestamp: { type: "string", format: "date-time" },
    apiVersion: { type: "string" },
    tool: { type: "string" },
    agentId: { type: "string" },
    durationMs: { type: "integer" },
    idempotentReplay: {
      type: "boolean",
      description: "True when this body was replayed from an earlier identical call.",
    },
    auditRecorded: {
      type: "boolean",
      description: "False when the write succeeded but its audit row could not be stored.",
    },
    confirmation: {
      type: "object",
      description: "Present only with a CONFIRMATION_REQUIRED error.",
      properties: {
        reason: { type: "string" },
        summary: { type: "string" },
        confirmationToken: {
          type: "string",
          description: "Send back as `confirmationToken` in the body to proceed.",
        },
      },
    },
  },
}

const ERROR_SCHEMA: OpenApiObject = {
  type: "object",
  required: ["success", "error", "meta"],
  properties: {
    success: { type: "boolean", enum: [false] },
    error: {
      type: "object",
      required: ["code", "message"],
      properties: {
        code: { type: "string", enum: [...AGENT_ERROR_CODES] },
        message: { type: "string" },
        details: { type: "object", additionalProperties: true },
      },
    },
    meta: ENVELOPE_META,
  },
}

function successSchema(dataSchema: OpenApiObject): OpenApiObject {
  return {
    type: "object",
    required: ["success", "data", "meta"],
    properties: {
      success: { type: "boolean", enum: [true] },
      data: dataSchema,
      meta: ENVELOPE_META,
    },
  }
}

function jsonContent(schema: OpenApiObject): OpenApiObject {
  return { "application/json": { schema } }
}

/** The standard failure responses every tool path shares. */
function errorResponses(): OpenApiObject {
  const body = { description: "", content: jsonContent(ERROR_SCHEMA) }
  return {
    "401": { ...body, description: "Missing or invalid API key." },
    "403": { ...body, description: "The agent lacks a permission this tool requires." },
    "404": { ...body, description: "Unknown tool, or the target article does not exist." },
    "409": {
      ...body,
      description:
        "Conflict — an illegal status transition, a duplicate source URL, an idempotency clash, " +
        "or an action awaiting human confirmation.",
    },
    "422": { ...body, description: "The input failed validation." },
    "429": { ...body, description: "Rate limit exceeded." },
    "500": { ...body, description: "Unexpected server error." },
  }
}

function toolPath(tool: ToolDescriptor): OpenApiObject {
  return {
    post: {
      operationId: tool.name,
      summary: tool.title,
      description:
        tool.description +
        `\n\nRequired permissions: ${tool.permissions.join(", ") || "none"}.` +
        (tool.mutating
          ? "\n\nMutating. Send an `Idempotency-Key` header so a retry does not repeat the effect."
          : "\n\nRead-only."),
      tags: [tool.mutating ? "write" : "read"],
      parameters: tool.mutating
        ? [
            {
              name: "Idempotency-Key",
              in: "header",
              required: false,
              schema: { type: "string", maxLength: 200 },
              description:
                "Opaque client-generated key. Repeating a call with the same key returns the " +
                "stored response instead of acting twice.",
            },
          ]
        : [],
      requestBody: {
        required: true,
        content: jsonContent(tool.inputSchema as OpenApiObject),
      },
      responses: {
        "200": {
          description: "Success.",
          content: jsonContent(successSchema(tool.outputSchema as OpenApiObject)),
        },
        ...errorResponses(),
      },
    },
  }
}

/**
 * Builds the document. `granted` narrows it to one agent's permissions, which
 * is what an integration should import — showing an agent a tool it cannot call
 * only teaches it to retry a guaranteed failure.
 */
export function buildOpenApiDocument(granted?: readonly string[]): OpenApiObject {
  const tools = describeTools(granted)

  const paths: OpenApiObject = {
    "/api/agent/health": {
      get: {
        operationId: "health",
        summary: "Health check",
        description: "Liveness of the Agent API. No authentication required.",
        tags: ["meta"],
        security: [],
        responses: {
          "200": {
            description: "The API is reachable.",
            content: jsonContent({
              type: "object",
              properties: {
                status: { type: "string", enum: ["ok"] },
                apiVersion: { type: "string" },
                timestamp: { type: "string", format: "date-time" },
                configured: {
                  type: "boolean",
                  description: "Whether any agent credential is configured on this deployment.",
                },
              },
            }),
          },
        },
      },
    },
    "/api/agent/capabilities": {
      get: {
        operationId: "capabilities",
        summary: "Discover available tools",
        description:
          "Returns the tools this credential may call, with their input and output schemas and " +
          "the permissions they cost. Call this first — it is the authoritative catalogue.",
        tags: ["meta"],
        responses: {
          "200": {
            description: "The catalogue.",
            content: jsonContent(successSchema({ type: "object", additionalProperties: true })),
          },
          ...errorResponses(),
        },
      },
    },
  }

  for (const tool of tools) {
    paths[tool.endpoint] = toolPath(tool)
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "NotiLab Agent Management API",
      version: AGENT_API_VERSION,
      description:
        "A controlled editorial surface for external AI agents.\n\n" +
        "Every operation is a named tool with a fixed input schema — there is no endpoint that " +
        "accepts a free-form instruction, executes code, or reaches the database directly. Calls " +
        "run through NotiLab's own business rules: an article reaches the public site only from " +
        "the APPROVED state, provenance fields are immutable, computed scores are read-only, and " +
        "every write is recorded in the audit trail.\n\n" +
        "Not available through this API at all: user management, role changes, global settings, " +
        "secrets, audit deletion, and hard deletion of content. Archiving is the strongest " +
        "destructive action, and it is reversible only by an operator.",
    },
    servers: [{ url: BASE_URL }],
    security: [{ bearerAuth: [] }],
    tags: [
      { name: "meta", description: "Discovery and health." },
      { name: "read", description: "Read-only tools." },
      { name: "write", description: "Tools that change editorial state." },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          description: "Authorization: Bearer <NOTILAB_AGENT_API_KEY>",
        },
        apiKeyHeader: {
          type: "apiKey",
          in: "header",
          name: "X-Agent-Api-Key",
          description: "Alternative for platforms that cannot set an Authorization header.",
        },
      },
      schemas: {
        AgentError: ERROR_SCHEMA,
        AgentMeta: ENVELOPE_META,
        Permission: { type: "string", enum: [...AGENT_PERMISSIONS] },
      },
    },
    paths,
  }
}
