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

Deploy to Cloudflare Workers:
```bash
npm run deploy
```

This will deploy your MCP server to a URL like: `halans-mcp-server.<your-account>.workers.dev/sse`

## Development

### Local Development
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

## Customization

To add your own tools:
- **Stdio server**: Edit `mcp-stdio.js` and add new tool handlers
- **Workers server**: Edit `src/index.ts` and add tools in the `init()` method 
