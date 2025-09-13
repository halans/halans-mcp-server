import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Cache for storing the content from halans.com
let contentCache: string | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Define our MCP agent with tools
export class MyMCP extends McpAgent {
	server = new McpServer({
		name: "Halans.com Blog Searcher",
		version: "1.0.0",
	});

	async fetchContent(): Promise<string> {
		const now = Date.now();
		
		// Return cached content if it's still fresh
		if (contentCache && (now - lastFetchTime) < CACHE_DURATION) {
			return contentCache;
		}

		try {
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

	async init() {
		// Generic content search tool
		this.server.tool(
			"search_content",
			{
				query: z.string().describe("Search query to find content on halans.com"),
				context_lines: z.number().optional().describe("Number of context lines around matches (default: 10)")
			},
			async ({ query, context_lines = 10 }) => {
				try {
					const content = await this.fetchContent();
					const lines = content.split('\n');
					const results: string[] = [];
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
							content: [{ type: "text", text: `No matches found for your "${query}" query` }]
						};
					}

					return {
						content: [{ 
							type: "text", 
							text: `Found ${results.length} matches for "${query}":\n\n${results.join('\n')}` 
						}]
					};
				} catch (error) {
					return {
						content: [{ type: "text", text: `Error searching content: ${error}` }]
					};
				}
			}
		);

		// Get content by section tool
		this.server.tool(
			"get_section",
			{
				section_title: z.string().describe("Main title or a heading to find in the content of halans.com"),
				include_subsections: z.boolean().optional().describe("Include content under subsections (default: true)")
			},
			async ({ section_title, include_subsections = true }) => {
				try {
					const content = await this.fetchContent();
					const lines = content.split('\n');
					const results: string[] = [];
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
				} catch (error) {
					return {
						content: [{ type: "text", text: `Error retrieving section: ${error}` }]
					};
				}
			}
		);

		// Get full content tool
		this.server.tool(
			"get_full_content",
			{
				max_length: z.number().optional().describe("Maximum characters to return (default: 50000)")
			},
			async ({ max_length = 50000 }) => {
				try {
					const content = await this.fetchContent();
					const truncated = content.length > max_length ? 
						`${content.substring(0, max_length)}\n\n... (content truncated)` : content;
					
					return {
						content: [{ 
							type: "text", 
							text: `Content found on halans.com (${content.length} characters):\n\n${truncated}`
						}]
					};
				} catch (error) {
					return {
						content: [{ type: "text", text: `Error retrieving content: ${error}` }]
					};
				}
			}
		);

		// Content summary tool
		this.server.tool(
			"get_content_summary",
			{},
			async () => {
				try {
					const content = await this.fetchContent();
					const lines = content.split('\n');
					const headings: string[] = [];
					
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
				} catch (error) {
					return {
						content: [{ type: "text", text: `Error generating summary: ${error}` }]
					};
				}
			}
		);
	}
}

export default {
	fetch(request: Request, env: Env, ctx: ExecutionContext) {
		const url = new URL(request.url);

		if (url.pathname === "/sse" || url.pathname === "/sse/message") {
			return MyMCP.serveSSE("/sse").fetch(request, env, ctx);
		}

		if (url.pathname === "/mcp") {
			return MyMCP.serve("/mcp").fetch(request, env, ctx);
		}

		return new Response("Not found", { status: 404 });
	},
};
