import { OpenAPIHono } from "@hono/zod-openapi";
import { AppEnv } from "../../middleware";

export const aiToolsRouter = new OpenAPIHono<AppEnv>();

/**
 * GET /ai-tools - List available tools
 * GET /ai-tools/openapi - Get OpenAPI spec
 * GET /ai-tools/openai - Get OpenAI Function Calling format
 * GET /ai-tools/anthropic - Get Anthropic Tool Use format
 * GET /ai-tools/gemini - Get Google Gemini Function Calling format
 * GET /ai-tools/typescript - Get TypeScript types
 */

// Helper to extract tools from the OpenAPI router
/* eslint-disable @typescript-eslint/no-explicit-any -- Dynamic OpenAPI spec processing */
function extractToolsFromSpec(spec: any) {
  const tools: Array<{
    name: string;
    description: string;
    parameters: any;
    method: string;
    path: string;
  }> = [];

  if (!spec?.paths) return tools;

  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(methods as Record<string, any>)) {
      if (method === "parameters" || !operation) continue;

      const operationId = operation.operationId || `${method}_${path.replace(/[^a-zA-Z0-9]/g, '_')}`;
      const description = operation.summary || operation.description || `${method.toUpperCase()} ${path}`;

      // Build parameters schema
      const properties: Record<string, any> = {};
      const required: string[] = [];

      // Path and query parameters
      for (const param of (operation.parameters || [])) {
        if (param.in !== "header") {
          properties[param.name] = convertSchemaToJson(param.schema);
          if (param.required) required.push(param.name);
        }
      }

      // Request body
      if (operation.requestBody?.content?.["application/json"]?.schema) {
        const bodySchema = operation.requestBody.content["application/json"].schema;
        if (bodySchema.properties) {
          for (const [key, prop] of Object.entries(bodySchema.properties)) {
            properties[key] = convertSchemaToJson(prop);
          }
          if (bodySchema.required) required.push(...bodySchema.required);
        }
      }

      tools.push({
        name: operationId,
        description,
        parameters: {
          type: "object",
          properties,
          required,
        },
        method: method.toUpperCase(),
        path,
      });
    }
  }

  return tools;
}

function convertSchemaToJson(schema: any): any {
  if (!schema) return {};

  const result: any = {};

  if (schema.type) result.type = schema.type;
  if (schema.description) result.description = schema.description;
  if (schema.enum) result.enum = schema.enum;

  // Handle Zod/OpenAPI refinements
  if (schema.example !== undefined) result.example = schema.example;
  if (schema.minimum !== undefined) result.minimum = schema.minimum;
  if (schema.maximum !== undefined) result.maximum = schema.maximum;
  if (schema.minLength !== undefined) result.minLength = schema.minLength;
  if (schema.maxLength !== undefined) result.maxLength = schema.maxLength;

  return result;
}

// GET /ai-tools - Overview
aiToolsRouter.get("/", async (c) => {
  const specUrl = `${new URL(c.req.url).origin}/api/openapi.json`;
  const specResponse = await fetch(specUrl);
  const spec: any = await specResponse.json();

  const tools = extractToolsFromSpec(spec);

  return c.json({
    name: "ARES 23247 Web API",
    version: spec.info?.version || "1.0.0",
    description: "AI tools interface for the ARES 23247 Web Portal",
    endpoints: {
      openapi: "/api/ai-tools/openapi",
      openai: "/api/ai-tools/openai",
      anthropic: "/api/ai-tools/anthropic",
      gemini: "/api/ai-tools/gemini",
      typescript: "/api/ai-tools/typescript",
    },
    toolCount: tools.length,
    tools: tools.map(t => ({ name: t.name, description: t.description })),
  });
});

// GET /ai-tools/openapi - Redirect to full spec
aiToolsRouter.get("/openapi", async (c) => {
  const specUrl = `${new URL(c.req.url).origin}/api/openapi.json`;
  return c.redirect(specUrl);
});

// GET /ai-tools/openai - OpenAI Function Calling format
aiToolsRouter.get("/openai", async (c) => {
  const specUrl = `${new URL(c.req.url).origin}/api/openapi.json`;
  const specResponse = await fetch(specUrl);
  const spec = await specResponse.json();

  const tools = extractToolsFromSpec(spec);

  return c.json({
    tools: tools.map(tool => ({
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    })),
  });
});

// GET /ai-tools/anthropic - Anthropic Tool Use format (same as OpenAI)
aiToolsRouter.get("/anthropic", async (c) => {
  const specUrl = `${new URL(c.req.url).origin}/api/openapi.json`;
  const specResponse = await fetch(specUrl);
  const spec = await specResponse.json();

  const tools = extractToolsFromSpec(spec);

  return c.json({
    tools: tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.parameters,
    })),
  });
});

// GET /ai-tools/gemini - Google Gemini Function Calling format
aiToolsRouter.get("/gemini", async (c) => {
  const specUrl = `${new URL(c.req.url).origin}/api/openapi.json`;
  const specResponse = await fetch(specUrl);
  const spec = await specResponse.json();

  const tools = extractToolsFromSpec(spec);

  return c.json({
    function_declarations: tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    })),
  });
});

// GET /ai-tools/typescript - Generate TypeScript types
aiToolsRouter.get("/typescript", async (c) => {
  const specUrl = `${new URL(c.req.url).origin}/api/openapi.json`;
  const specResponse = await fetch(specUrl);
  const spec = await specResponse.json();

  const tools = extractToolsFromSpec(spec);

  // Generate TypeScript interfaces
  let ts = `// Auto-generated TypeScript types for ARES 23247 API\n`;
  ts += `// Generated at: ${new Date().toISOString()}\n\n`;

  ts += `// Base API URL\n`;
  ts += `export const API_BASE_URL = "${new URL(c.req.url).origin}/api";\n\n`;

  // Tool function types
  ts += `// Tool function signatures\n`;
  for (const tool of tools) {
    const params = Object.keys(tool.parameters.properties || {});
    const required = tool.parameters.required || [];

    ts += `export interface ${tool.name.charAt(0).toUpperCase() + tool.name.slice(1)}Params {\n`;
    for (const param of params) {
      const prop = tool.parameters.properties[param];
      const isRequired = required.includes(param);
      const optional = isRequired ? "" : "?";
      ts += `  ${param}${optional}: ${prop.type || "any"};\n`;
    }
    ts += `}\n\n`;
  }

  ts += `// API client class\n`;
  ts += `export class ARESWebClient {\n`;
  ts += `  private baseUrl: string;\n\n`;
  ts += `  constructor(baseUrl: string = API_BASE_URL) {\n`;
  ts += `    this.baseUrl = baseUrl;\n`;
  ts += `  }\n\n`;

  for (const tool of tools) {
    const methodName = tool.name.replace(/[^a-zA-Z0-9]/g, "_");
    ts += `  async ${methodName}(params?: ${tool.name.charAt(0).toUpperCase() + tool.name.slice(1)}Params): Promise<any> {\n`;
    ts += `    const url = \`\${this.baseUrl}${tool.path}\`;\n`;
    ts += `    const response = await fetch(url, {\n`;
    ts += `      method: "${tool.method}",\n`;
    ts += `      headers: { "Content-Type": "application/json" },\n`;
    ts += `      body: params ? JSON.stringify(params) : undefined,\n`;
    ts += `    });\n`;
    ts += `    return response.json();\n`;
    ts += `  }\n\n`;
  }

  ts += `}\n`;

  return c.text(ts, 200, {
    "Content-Type": "text/typescript; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  });
});
