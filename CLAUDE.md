# CLAUDE.md - MCP Server Project Guide

## Project Overview
This is a **Cloudflare Workers-based MCP (Model Context Protocol) Server** that provides content querying tools for halans.com without authentication. It's built using TypeScript and deploys to Cloudflare's edge computing platform.

## Project Structure
```
├── src/
│   └── index.ts           # Main MCP server implementation
├── package.json           # Dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── wrangler.jsonc        # Cloudflare Workers configuration
├── biome.json           # Code formatting and linting rules
├── worker-configuration.d.ts # Type definitions
└── README.md            # Project documentation
```

## Key Dependencies
- `@modelcontextprotocol/sdk`: Core MCP SDK for building servers
- `agents`: Framework for building AI agents with MCP support
- `zod`: Runtime type validation and schema definition
- `wrangler`: Cloudflare Workers CLI and deployment tool
- `@biomejs/biome`: Code formatting and linting

## Available Tools
The MCP server exposes four content querying tools:

1. **search_content**: Search for specific terms in halans.com content
   - Parameters: `query` (string), `context_lines` (optional number, default: 3)
   - Returns: Matching lines with surrounding context

2. **get_section**: Retrieve a specific section by title/heading
   - Parameters: `section_title` (string), `include_subsections` (optional boolean, default: true)
   - Returns: Section content including subsections if requested

3. **get_full_content**: Retrieve the complete content from halans.com
   - Parameters: `max_length` (optional number, default: 50000)
   - Returns: Full content, truncated if it exceeds max_length

4. **get_content_summary**: Generate a summary and table of contents
   - Parameters: None
   - Returns: Content statistics and hierarchical list of all headings

## Development Commands
```bash
npm run dev          # Start development server
npm run deploy       # Deploy to Cloudflare Workers
npm run format       # Format code with Biome
npm run lint:fix     # Fix linting issues
npm run type-check   # Run TypeScript type checking
npm run cf-typegen   # Generate Cloudflare types
```

## Testing Commands
No specific test commands are configured. The project appears to rely on manual testing through the MCP client connections.

## Code Style & Linting
- Uses **Biome** for formatting and linting
- Indent width: 4 spaces
- Line width: 100 characters
- Strict TypeScript configuration enabled
- Git integration enabled for VCS operations

## Deployment
The project deploys to Cloudflare Workers and exposes two endpoints:
- `/sse` - Server-Sent Events endpoint for MCP communication
- `/mcp` - Standard MCP endpoint

## MCP Client Connection
Connect to the server using:
- Local development: `http://localhost:8787/sse`
- Production: `https://halans-mcp-server.your-account.workers.dev/sse`

## Claude Desktop Configuration
Use this configuration for the stdio-based MCP server:

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

Replace `/path/to/halans-mcp-server/` with the actual path to your project directory.

### Alternative: Cloudflare Workers Deployment
For production use, you can also deploy to Cloudflare Workers and use mcp-remote:

```json
{
  "mcpServers": {
    "halans-content": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://halans-mcp-server.your-account.workers.dev/sse"
      ]
    }
  }
}
```

## Content Caching
- Content from `https://halans.com/llms-full.txt` is cached for 5 minutes
- Cache is automatically refreshed when expired
- Improves performance and reduces external API calls

## Architecture Notes
- Built on Cloudflare Workers for edge computing
- Uses Durable Objects for stateful MCP agent instances
- Server-Sent Events (SSE) for real-time communication
- No authentication required (authless design)
- Content fetching with intelligent caching system

## File Locations
- Main server logic: `src/index.ts:11` (MyMCP class)
- Content fetching: `src/index.ts:17-37` (fetchContent method)
- Tool definitions: `src/index.ts:39-211` (search, section, content, and summary tools)
- Request routing: `src/index.ts:214-225` (fetch handler)