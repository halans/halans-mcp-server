#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');

// Cache for storing the content from halans.com
let contentCache = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function fetchContent() {
    const now = Date.now();
    
    // Return cached content if it's still fresh
    if (contentCache && (now - lastFetchTime) < CACHE_DURATION) {
        return contentCache;
    }

    try {
        const fetch = (await import('node-fetch')).default;
        const response = await fetch("https://halans.com/llms-full.txt");
        if (!response.ok) {
            throw new Error(`Failed to fetch content: ${response.status}`);
        }
        
        contentCache = await response.text();
        lastFetchTime = now;
        return contentCache;
    } catch (error) {
        throw new Error(`Error fetching content: ${error}`);
    }
}

class HalansContentServer {
    constructor() {
        this.server = new Server(
            {
                name: "halans-content-server",
                version: "1.0.0",
            },
            {
                capabilities: {
                    tools: {},
                },
            }
        );

        this.setupToolHandlers();
        
        // Error handling
        this.server.onerror = (error) => console.error("[MCP Error]", error);
        process.on("SIGINT", async () => {
            await this.server.close();
            process.exit(0);
        });
    }

    setupToolHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => {
            return {
                tools: [
                    {
                        name: "search_content",
                        description: "Search for specific terms in halans.com content",
                        inputSchema: {
                            type: "object",
                            properties: {
                                query: {
                                    type: "string",
                                    description: "Search query to find content",
                                },
                                context_lines: {
                                    type: "number",
                                    description: "Number of context lines around matches (default: 3)",
                                    default: 3,
                                },
                            },
                            required: ["query"],
                        },
                    },
                    {
                        name: "get_section",
                        description: "Retrieve a specific section by title/heading",
                        inputSchema: {
                            type: "object",
                            properties: {
                                section_title: {
                                    type: "string",
                                    description: "Title or heading to find in the content",
                                },
                                include_subsections: {
                                    type: "boolean",
                                    description: "Include content under subsections (default: true)",
                                    default: true,
                                },
                            },
                            required: ["section_title"],
                        },
                    },
                    {
                        name: "get_full_content",
                        description: "Retrieve the complete content from halans.com",
                        inputSchema: {
                            type: "object",
                            properties: {
                                max_length: {
                                    type: "number",
                                    description: "Maximum characters to return (default: 50000)",
                                    default: 50000,
                                },
                            },
                        },
                    },
                    {
                        name: "get_content_summary",
                        description: "Generate a summary and table of contents",
                        inputSchema: {
                            type: "object",
                            properties: {},
                        },
                    },
                ],
            };
        });

        this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
            try {
                switch (request.params.name) {
                    case "search_content":
                        return await this.searchContent(request.params.arguments);
                    case "get_section":
                        return await this.getSection(request.params.arguments);
                    case "get_full_content":
                        return await this.getFullContent(request.params.arguments);
                    case "get_content_summary":
                        return await this.getContentSummary();
                    default:
                        throw new Error(`Unknown tool: ${request.params.name}`);
                }
            } catch (error) {
                return {
                    content: [
                        {
                            type: "text",
                            text: `Error: ${error.message}`,
                        },
                    ],
                };
            }
        });
    }

    async searchContent({ query, context_lines = 3 }) {
        const content = await fetchContent();
        const lines = content.split('\n');
        const results = [];
        const queryLower = query.toLowerCase();

        for (let i = 0; i < lines.length; i++) {
            if (lines[i].toLowerCase().includes(queryLower)) {
                const start = Math.max(0, i - context_lines);
                const end = Math.min(lines.length, i + context_lines + 1);
                const contextBlock = lines.slice(start, end).join('\n');
                results.push(`--- Match at line ${i + 1} ---\n${contextBlock}\n`);
            }
        }

        if (results.length === 0) {
            return {
                content: [{ type: "text", text: `No matches found for "${query}"` }]
            };
        }

        return {
            content: [{ 
                type: "text", 
                text: `Found ${results.length} matches for "${query}":\n\n${results.join('\n')}` 
            }]
        };
    }

    async getSection({ section_title, include_subsections = true }) {
        const content = await fetchContent();
        const lines = content.split('\n');
        const results = [];
        const titleLower = section_title.toLowerCase();
        let inSection = false;
        let currentLevel = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmedLine = line.trim();
            
            // Check if this is a heading
            const headingMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
            
            if (headingMatch) {
                const level = headingMatch[1].length;
                const title = headingMatch[2].toLowerCase();
                
                if (title.includes(titleLower)) {
                    inSection = true;
                    currentLevel = level;
                    results.push(line);
                } else if (inSection) {
                    // Stop if we hit a heading at same or higher level
                    if (level <= currentLevel) {
                        break;
                    }
                    // Include subsection if requested
                    if (include_subsections || level > currentLevel + 1) {
                        results.push(line);
                    }
                }
            } else if (inSection) {
                results.push(line);
            }
        }

        if (results.length === 0) {
            return {
                content: [{ type: "text", text: `No section found with title containing "${section_title}"` }]
            };
        }

        return {
            content: [{ 
                type: "text", 
                text: results.join('\n')
            }]
        };
    }

    async getFullContent({ max_length = 50000 }) {
        const content = await fetchContent();
        const truncated = content.length > max_length ? 
            `${content.substring(0, max_length)}\n\n... (content truncated)` : content;
        
        return {
            content: [{ 
                type: "text", 
                text: `Content from halans.com (${content.length} characters):\n\n${truncated}`
            }]
        };
    }

    async getContentSummary() {
        const content = await fetchContent();
        const lines = content.split('\n');
        const headings = [];
        
        for (const line of lines) {
            const headingMatch = line.trim().match(/^(#{1,6})\s+(.+)$/);
            if (headingMatch) {
                const level = headingMatch[1].length;
                const title = headingMatch[2];
                const indent = '  '.repeat(level - 1);
                headings.push(`${indent}- ${title}`);
            }
        }

        const wordCount = content.split(/\s+/).length;
        const charCount = content.length;

        return {
            content: [{ 
                type: "text", 
                text: `Content Summary from halans.com:\n\nStats:\n- ${wordCount} words\n- ${charCount} characters\n- ${headings.length} sections\n\nTable of Contents:\n${headings.join('\n')}`
            }]
        };
    }

    async run() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.error("Halans Content MCP server running on stdio");
    }
}

const server = new HalansContentServer();
server.run().catch(console.error);