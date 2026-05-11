#!/usr/bin/env node
/**
 * ARES 23247 MCP Server
 *
 * Dynamic MCP server that reads the OpenAPI spec at runtime.
 * This means it automatically stays in sync with API changes.
 *
 * Usage:
 *   node dist/index.js https://aresfirst.org/api/openapi.json
 *   OR set ARES_OPENAPI_URL env var
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

interface OpenAPISpec {
  openapi: string;
  info: { title: string; version: string };
  servers?: Array<{ url: string; description: string }>;
  paths: Record<string, Record<string, {
    operationId?: string;
    summary?: string;
    description?: string;
    tags?: string[];
    parameters?: Array<{
      name: string;
      in: string;
      schema: any;
      required?: boolean;
    }>;
    requestBody?: {
      content: Record<string, { schema: any }>;
    };
    responses: Record<string, {
      content: Record<string, { schema: any }>;
    }>;
  }>>;
}

interface ARESCache {
  spec: OpenAPISpec | null;
  tools: Tool[] | null;
  lastFetch: number;
  fetchPromise: Promise<void> | null;
}

class ARESMCPServer {
  private server: Server;
  private openapiUrl: string;
  private apiBaseUrl: string;
  private cache: ARESCache = {
    spec: null,
    tools: null,
    lastFetch: 0,
    fetchPromise: null,
  };
  private readonly CACHE_TTL = 60000; // 1 minute

  constructor(openapiUrl: string) {
    this.server = new Server(
      {
        name: "aresweb-api",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    this.openapiUrl = openapiUrl;
    // Extract base URL from OpenAPI URL
    const urlObj = new URL(openapiUrl);
    this.apiBaseUrl = `${urlObj.protocol}//${urlObj.host}`;

    this.setupHandlers();
  }

  private async fetchOpenAPISpec(): Promise<OpenAPISpec> {
    // Return cached spec if fresh
    if (this.cache.spec && Date.now() - this.cache.lastFetch < this.CACHE_TTL) {
      return this.cache.spec;
    }

    // Wait for existing fetch if in progress
    if (this.cache.fetchPromise) {
      await this.cache.fetchPromise;
      return this.cache.spec!;
    }

    // Fetch fresh spec
    this.cache.fetchPromise = (async () => {
      console.error(`[ARES MCP] Fetching OpenAPI spec from ${this.openapiUrl}`);
      const response = await fetch(this.openapiUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch OpenAPI spec: ${response.status}`);
      }
      this.cache.spec = await response.json();
      this.cache.lastFetch = Date.now();
      const pathCount = this.cache.spec?.paths ? Object.keys(this.cache.spec.paths).length : 0;
      console.error(`[ARES MCP] Loaded spec with ${pathCount} endpoints`);
      this.cache.fetchPromise = null;
    })();

    await this.cache.fetchPromise;
    return this.cache.spec!;
  }

  private convertOpenAPIToMCPTools(): Tool[] {
    const spec = this.cache.spec!;
    if (!spec.paths) return [];

    const tools: Tool[] = [];

    for (const [path, methods] of Object.entries(spec.paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        if (method === "parameters" || !operation) continue;

        const operationId = operation.operationId || `${method}_${path.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const tags = operation.tags || [];
        const isWrite = ["post", "put", "patch", "delete"].includes(method.toLowerCase());

        // Build JSON Schema for input
        const properties: Record<string, any> = {};
        const required: string[] = [];

        // Path parameters
        for (const param of (operation.parameters || [])) {
          if (param.in === "path") {
            properties[param.name] = param.schema;
            if (param.required) required.push(param.name);
          }
        }

        // Query parameters
        for (const param of (operation.parameters || [])) {
          if (param.in === "query") {
            properties[param.name] = param.schema;
            if (param.required) required.push(param.name);
          }
        }

        // Request body
        if (operation.requestBody?.content?.["application/json"]?.schema) {
          const bodySchema = operation.requestBody.content["application/json"].schema;
          if (bodySchema.properties) {
            Object.assign(properties, bodySchema.properties);
            if (bodySchema.required) required.push(...bodySchema.required);
          }
        }

        tools.push({
          name: operationId,
          description: operation.summary || operation.description || `${method.toUpperCase()} ${path}`,
          inputSchema: {
            type: "object",
            properties: properties || {},
            required: required || [],
          },
        });
      }
    }

    return tools;
  }

  private async ensureToolsLoaded() {
    if (!this.cache.tools) {
      await this.fetchOpenAPISpec();
      this.cache.tools = this.convertOpenAPIToMCPTools();
    }
  }

  private setupHandlers() {
    // List tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      await this.ensureToolsLoaded();
      return {
        tools: this.cache.tools!,
      };
    });

    // Call tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      await this.ensureToolsLoaded();

      // Find the operation in the spec
      const spec = this.cache.spec!;
      let targetPath: string | undefined;
      let targetMethod: string | undefined;
      let targetOperation: any;

      for (const [path, methods] of Object.entries(spec.paths)) {
        for (const [method, operation] of Object.entries(methods)) {
          if (method === "parameters" || !operation) continue;
          const opId = operation.operationId || `${method}_${path.replace(/[^a-zA-Z0-9]/g, '_')}`;
          if (opId === name) {
            targetPath = path;
            targetMethod = method;
            targetOperation = operation;
            break;
          }
        }
        if (targetPath) break;
      }

      if (!targetPath || !targetOperation || !targetMethod) {
        throw new Error(`Unknown tool: ${name}`);
      }

      // Build the request URL
      let url = this.apiBaseUrl + "/api" + targetPath;

      // Replace path parameters
      for (const [key, value] of Object.entries(args || {})) {
        url = url.replace(`{${key}}`, encodeURIComponent(String(value)));
      }

      // Extract query parameters
      const queryParams = new URLSearchParams();
      const bodyParams: Record<string, any> = {};

      for (const param of (targetOperation.parameters || [])) {
        const value = (args || {})[param.name];
        if (value !== undefined) {
          if (param.in === "query") {
            queryParams.set(param.name, String(value));
          }
        }
      }

      // Request body
      if (targetOperation.requestBody?.content?.["application/json"]?.schema) {
        const bodySchema = targetOperation.requestBody.content["application/json"].schema;
        if (bodySchema.properties) {
          for (const key of Object.keys(bodySchema.properties)) {
            if ((args || {})[key] !== undefined) {
              bodyParams[key] = (args || {})[key];
            }
          }
        }
      }

      // Add query string
      if (queryParams.toString()) {
        url += "?" + queryParams.toString();
      }

      console.error(`[ARES MCP] Calling ${targetMethod.toUpperCase()} ${url}`);

      // Make the API call
      const response = await fetch(url, {
        method: targetMethod.toUpperCase(),
        headers: {
          "Content-Type": "application/json",
        },
        body: Object.keys(bodyParams).length > 0 ? JSON.stringify(bodyParams) : undefined,
      });

      const result = await response.text();

      if (!response.ok) {
        return {
          content: [
            {
              type: "text",
              text: `API Error (${response.status}): ${result}`,
            },
          ],
        };
      }

      // Try to parse as JSON for pretty output
      try {
        const json = JSON.parse(result);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(json, null, 2),
            },
          ],
        };
      } catch {
        return {
          content: [
            {
              type: "text",
              text: result,
            },
          ],
        };
      }
    });
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("[ARES MCP] Server started successfully");
  }
}

// Main entry point
async function main() {
  const args = process.argv.slice(2);

  // Get OpenAPI URL from args or env
  let openapiUrl = args[0] || process.env.ARES_OPENAPI_URL;

  if (!openapiUrl) {
    console.error("Usage: aresweb-mcp <openapi-url>");
    console.error("  or set ARES_OPENAPI_URL environment variable");
    console.error("\nDefaulting to: https://aresfirst.org/api/openapi.json");
    openapiUrl = "https://aresfirst.org/api/openapi.json";
  }

  const server = new ARESMCPServer(openapiUrl);
  await server.start();
}

main().catch((error) => {
  console.error("[ARES MCP] Fatal error:", error);
  process.exit(1);
});
