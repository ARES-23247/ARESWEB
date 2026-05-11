# ARES 23247 MCP Server

Dynamic Model Context Protocol (MCP) server for the ARES 23247 Web API.

## 🔄 Auto-Update Behavior

**This server automatically stays in sync with your API changes.**

It reads your OpenAPI spec at runtime, not at build time. This means:
- Add a new route → MCP server exposes it immediately (within 1 min cache)
- Modify parameters → MCP server updates automatically
- No code regeneration needed

The server caches the OpenAPI spec for 1 minute to balance freshness with performance.

## 🛠️ Installation

```bash
cd mcp-server
npm install
npm run build
```

## 📋 Setup for Different AI Platforms

### Claude Desktop (Recommended)

1. Build the MCP server:
```bash
cd mcp-server
npm install
npm run build
```

2. Add to your Claude Desktop config (`~/.claude/claude_desktop_config.json` on macOS/Linux or `%APPDATA%\Claude\claude_desktop_config.json` on Windows):

```json
{
  "mcpServers": {
    "aresweb-api": {
      "command": "node",
      "args": [
        "C:\\Users\\david\\dev\\robotics\\ftc\\ARESWEB\\mcp-server\\dist\\index.js"
      ],
      "env": {
        "ARES_OPENAPI_URL": "https://aresfirst.org/api/openapi.json"
      }
    }
  }
}
```

3. Restart Claude Desktop. The API tools will be available.

### ChatGPT / Custom GPTs

1. Create a new Custom GPT
2. In "Configure" → "Actions", click "Create new action"
3. Enter: `https://aresfirst.org/api/ai-tools/openapi`
4. ChatGPT will import your API endpoints as callable functions

### OpenAI Assistants API

Use the `/api/ai-tools/openai` endpoint to get function definitions:

```bash
curl https://aresfirst.org/api/ai-tools/openai
```

Returns OpenAI function calling format:
```json
{
  "tools": [
    {
      "type": "function",
      "function": {
        "name": "list_galleries",
        "description": "List all photo galleries",
        "parameters": { ... }
      }
    }
  ]
}
```

### Google Gemini

Use the `/api/ai-tools/gemini` endpoint:

```bash
curl https://aresfirst.org/api/ai-tools/gemini
```

Returns Gemini function declaration format.

### Anthropic API (Claude API)

Use the `/api/ai-tools/anthropic` endpoint:

```bash
curl https://aresfirst.org/api/ai-tools/anthropic
```

Returns Anthropic tool use format.

## 🔧 Development

```bash
# Watch mode - rebuilds on changes
npm run watch

# Test locally
npm run dev

# Production build
npm run build
```

## 📚 Available Endpoints

The MCP server exposes these tools (auto-generated from your OpenAPI spec):

- **Galleries**: `list_galleries`, `get_gallery`, `create_gallery`, `update_gallery`, `delete_gallery`
- **Videos**: `list_videos`, `get_video`, `parse_video_url`, `create_video`, `update_video`, `delete_video`
- **Posts**: `get_posts`, `get_post`, `save_post`, `update_post`, `delete_post`, etc.
- **Events**: `get_events`, `get_event`, `create_event`, `update_event`, `delete_event`
- **And all other API endpoints...**

## 🔌 API Tools Endpoints

Your API also exposes these endpoints for AI integration:

- `GET /api/ai-tools` - Overview of available tools
- `GET /api/ai-tools/openapi` - Full OpenAPI spec (redirect)
- `GET /api/ai-tools/openai` - OpenAI function calling format
- `GET /api/ai-tools/anthropic` - Anthropic tool use format
- `GET /api/ai-tools/gemini` - Google Gemini format
- `GET /api/ai-tools/typescript` - TypeScript type definitions

## 🧪 Testing

Once configured in Claude Desktop, you can test:

> "List all galleries and show me the first 3"

> "Create a new gallery called 'Test Gallery'"

> "Get all published blog posts"

## 🔐 Authentication

The MCP server currently calls public endpoints. For authenticated endpoints:

1. Add an API key to your MCP server config
2. Modify `src/index.ts` to include the auth header

```typescript
const response = await fetch(url, {
  method: targetMethod.toUpperCase(),
  headers: {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${process.env.ARES_API_KEY}`,
  },
  // ...
});
```

## 📝 License

Part of the ARES 23247 Web Portal project.
