# Halans Content MCP Server

This MCP (Model Context Protocol) server provides content querying tools for halans.com. It offers two deployment options: a local stdio-based server for direct Claude Desktop integration, and a Cloudflare Workers deployment for remote access. 

## Available Tools

The MCP server provides four content querying tools:

1. **search_content** - Search for specific terms in halans.com content with context
2. **get_section** - Retrieve specific sections by title/heading
3. **get_full_content** - Get the complete content with optional truncation
4. **get_content_summary** - Generate content statistics and table of contents

## Quick Start

### Option 1: Local Stdio Server (Recommended)

1. Clone and install dependencies:
```bash
git clone <your-repo-url>
cd halans-mcp-server
npm install
```

2. Configure Claude Desktop by adding to your MCP config:
```json
{
  "mcpServers": {
    "halans-content": {
      "command": "node",
      "args": ["/path/to/halans-mcp-server/mcp-stdio.js"],
      "env": {}
    }
  }
}
```

3. Restart Claude Desktop and the tools will be available.

### Option 2: Cloudflare Workers Deployment

1. **Prerequisites**: 
   - Sign up for a [Cloudflare account](https://dash.cloudflare.com/sign-up)
   - Install [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)

2. **Authenticate with Cloudflare**:
```bash
npx wrangler login
```

3. **Deploy to Cloudflare Workers**:
```bash
npm run deploy
```

This will deploy your MCP server to a URL like: `halans-mcp-server.<your-account>.workers.dev/sse`

4. **One-Click Deploy** (Alternative):
   
   [![Deploy to Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/halans/halans-mcp-server)

## Cloudflare Workers Features

This MCP server leverages several Cloudflare Workers features:

- **Edge Computing**: Runs close to users worldwide for low latency
- **Durable Objects**: Maintains stateful MCP agent instances
- **Server-Sent Events**: Real-time communication with MCP clients
- **No Cold Starts**: Fast response times with Cloudflare's V8 isolates
- **Built-in Observability**: Monitoring and analytics through Cloudflare dashboard

### Worker Configuration

The server exposes two endpoints:
- `/sse` - Server-Sent Events endpoint for MCP communication
- `/mcp` - Standard MCP endpoint

Configuration is managed in `wrangler.jsonc`:
```jsonc
{
  "name": "halans-mcp-server",
  "main": "src/index.ts",
  "compatibility_date": "2025-03-10",
  "durable_objects": {
    "bindings": [
      {
        "class_name": "MyMCP",
        "name": "MCP_OBJECT"
      }
    ]
  }
}
```

## Development

### Local Development with Wrangler
```bash
# Start the Cloudflare Workers dev server
npm run dev

# Run TypeScript type checking
npm run type-check

# Format code
npm run format

# Fix linting issues
npm run lint:fix
```

### Local Development with Stdio Server
```bash
# Test the stdio server directly
node mcp-stdio.js

# The server will wait for MCP protocol messages on stdin
```

### Project Structure
```
├── src/
│   └── index.ts           # Cloudflare Workers MCP server
├── mcp-stdio.js          # Local stdio MCP server
├── package.json          # Dependencies and scripts
├── wrangler.jsonc        # Cloudflare Workers config
├── CLAUDE.md            # Claude-specific documentation
└── README.md            # This file
```

## Content Source

The server fetches content from `https://halans.com/llms-full.txt` and caches it for 5 minutes to improve performance. The content includes:

- Personal blog posts and essays
- Technical documentation
- Project descriptions
- Conference notes and insights


## Test locally with MCP Inspector


```bash
npx @modelcontextprotocol/inspector
```

## Connecting to Claude Desktop

### For Local Stdio Server
Add this to your Claude Desktop MCP configuration:
```json
{
  "mcpServers": {
    "halans-content": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-stdio.js"],
      "env": {}
    }
  }
}
```

### For Deployed Workers (with mcp-remote)
```json
{
  "mcpServers": {
    "halans-content": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://your-worker-url.workers.dev/sse"
      ]
    }
  }
}
```

## Connect to Cloudflare AI Playground

For deployed Workers, you can test the MCP server using Cloudflare AI Playground:

1. Go to https://playground.ai.cloudflare.com/
2. Enter your deployed MCP server URL (`your-worker-url.workers.dev/sse`)
3. Test the content querying tools directly

## Deployment Customization

### Custom Domain (Optional)
To use a custom domain with your Cloudflare Worker:

1. Add a custom domain in your Cloudflare dashboard
2. Update `wrangler.jsonc` with your domain:
```jsonc
{
  "routes": [
    {
      "pattern": "mcp.yourdomain.com/*",
      "custom_domain": true
    }
  ]
}
```

### Environment Variables
Add environment variables for configuration:
```bash
# Set environment variables
npx wrangler secret put API_KEY
npx wrangler secret put CONTENT_URL
```

Then access them in your Worker:
```typescript
// In src/index.ts
const contentUrl = env.CONTENT_URL || "https://halans.com/llms-full.txt";
```

## Troubleshooting

### Common Issues

1. **MCP Connection Failed**
   - Ensure the server URL is correct
   - Check that the Worker is deployed and accessible
   - Verify Claude Desktop configuration

2. **Content Fetching Errors**
   - Check if `https://halans.com/llms-full.txt` is accessible
   - Verify network connectivity from the Worker
   - Monitor Cloudflare logs for fetch errors

3. **Development Server Issues**
   - Run `npm install` to ensure dependencies are installed
   - Check Node.js version compatibility (v18+ recommended)
   - Use `npm run type-check` to identify TypeScript errors

### Monitoring
- View Worker logs in the Cloudflare dashboard
- Use `wrangler tail` for real-time log monitoring
- Monitor MCP server logs in Claude Desktop

## Customization

To add your own tools:
- **Stdio server**: Edit `mcp-stdio.js` and add new tool handlers
- **Workers server**: Edit `src/index.ts` and add tools in the `init()` method

### Example: Adding a New Tool
```typescript
// In src/index.ts or mcp-stdio.js
this.server.tool(
    "new_tool",
    {
        parameter: z.string().describe("Tool parameter")
    },
    async ({ parameter }) => {
        // Tool implementation
        return {
            content: [{ type: "text", text: `Result: ${parameter}` }]
        };
    }
);
``` 
