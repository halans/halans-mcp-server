import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

// Cache for storing the content from halans.com
let contentCache: string | null = null;
let lastFetchTime = 0;
let resourceContentCache: string | null = null;
let lastResourceFetchTime = 0;
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

	async fetchResourceContent(): Promise<string> {
		const now = Date.now();
		
		// Return cached resource content if it's still fresh
		if (resourceContentCache && (now - lastResourceFetchTime) < CACHE_DURATION) {
			return resourceContentCache;
		}

		try {
			const response = await fetch("https://halans.com/llms.txt");
			if (!response.ok) {
				throw new Error(`Failed to fetch resource content: ${response.status}`);
			}
			
			resourceContentCache = await response.text();
			lastResourceFetchTime = now;
			return resourceContentCache;
		} catch (error) {
			throw new Error(`Error fetching resource content: ${error}`);
		}
	}

	async init() {
		// ChatGPT content search tool
		// this.server.tool(
		// 	"search",
		// 	{
		// 		query: z.string().describe("Search query to find content on halans.com"),
		// 		context_lines: z.number().optional().describe("Number of context lines around matches (default: 5)")
		// 	},
		// 	async ({ query, context_lines = 5 }) => {
		// 		try {
		// 			const content = await this.fetchContent();
		// 			const lines = content.split('\n');
		// 			const results: string[] = [];
		// 			const queryLower = query.toLowerCase();

		// 			for (let i = 0; i < lines.length; i++) {
		// 				if (lines[i].toLowerCase().includes(queryLower)) {
		// 					const start = Math.max(0, i - context_lines);
		// 					const end = Math.min(lines.length, i + context_lines + 1);
		// 					const contextBlock = lines.slice(start, end).join('\n');
		// 					results.push(`--- Match at line ${i + 1} ---\n${contextBlock}\n`);
		// 				}
		// 			}

		// 			if (results.length === 0) {
		// 				return {
		// 					content: [{ type: "text", text: `No matches found for your "${query}" query` }]
		// 				};
		// 			}

		// 			return {
		// 				content: [{ 
		// 					type: "text", 
		// 					text: "{\"results\":[{\"id\":\"doc-1\",\"title\":\"${query}:\n\n${results.join('\n')}\",\"url\":\"https://halans.com/\"}]}"
		// 				}]
		// 			};
		// 		} catch (error) {
		// 			return {
		// 				content: [{ type: "text", text: `Error searching content: ${error}` }]
		// 			};
		// 		}
		// 	}
		// );

		// Generic content search tool
		this.server.tool(
			"search_content",
			`Searches through content from halans.com for specific terms or phrases. This tool is ideal when you need to find specific information, concepts, or topics within the content.
			Use this tool when:
			- Looking for specific technical terms, concepts, or keywords
			- Finding mentions of particular technologies, frameworks, or tools
			- Locating discussions about specific topics or problems
			- You need targeted information rather than browsing entire sections

			Parameters:
			- query: Search term or phrase (supports regex patterns for advanced searches)
			- context_lines: Number of surrounding lines to include (default: 3) - increase for more context around matches

			Returns: Array of matches with line numbers, the matching line, and surrounding context lines.

			Example usage:
			- Search for "authentication" to find security-related content
			- Search for "API" to locate API documentation or examples
			- Search for error messages or specific code patterns
			- Use regex like "function.*auth" to find authentication-related functions

			Tips:
			- Use broader terms first, then narrow down with more specific searches
			- Increase context_lines if you need more surrounding information
			- Case-insensitive matching makes searches more flexible
			- Results show line numbers for easy reference when using other tools`,
			{
				query: z.string().describe("Search query to find content on halans.com"),
				context_lines: z.number().optional().describe("Number of context lines around matches (default: 5)")
			},
			async ({ query, context_lines = 5 }) => {
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
			`Retrieves a specific section of content from halans.com by its heading or title. This tool is perfect when you need focused, structured information from a particular topic area.
			Use this tool when:
			- You know the specific section/topic you want to read about
			- You need comprehensive information about a particular subject
			- You want to avoid information overload from searching or getting full content
			- You need structured content with proper hierarchical organization

			Parameters:
			- section_title: The heading/title of the section you want (case-insensitive matching)
			- include_subsections: Whether to include nested subsections (default: true)

			Returns: The complete section content including the heading and all text under that section.

			How it works:
			1. Finds the specified section heading in the content
			2. Extracts all content from that heading until the next same-level heading
			3. If include_subsections: true, includes all nested subsections and their content
			4. If include_subsections: false, stops at the first subsection

			Strategic advantages of this tool:
			- Focused retrieval: Get exactly the information you need without irrelevant content
			- Hierarchical understanding: Maintains the logical structure and organization of information
			- Context preservation: Keeps related subsections together for better comprehension
			- Efficient processing: Reduces token usage compared to full content retrieval

			Example usage:
			- get_section("Authentication") - Get all auth-related documentation
			- get_section("API Reference", false) - Get just the API overview without detailed endpoints
			- get_section("Getting Started") - Retrieve setup and installation instructions
			- get_section("Troubleshooting") - Get problem-solving information

			Best practices:
			- Use exact or partial heading names from the content structure
			- Start with include_subsections: true for comprehensive coverage
			- Use include_subsections: false for just section overviews
			- Look for blog contents between [START_OF_CONTENT] and [END_OF_CONTENT] blocks.
			- Look for metadata listed as [POST_TITLE], [POST_LINK] and [POST_DATE].
			- Combine with get_content_summary to first see available sections`,
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
			`Retrieves the complete content from halans.com in one operation. This tool provides comprehensive access to all available information but should be used strategically due to its scope.
				Use this tool when:
				- You need to analyze or process the entire content corpus
				- Performing comprehensive analysis across multiple topics
				- No specific section meets your needs and you need broad coverage
				- Building a complete understanding of all available information
				- Working with content that spans multiple sections

				Parameters:
				- max_length: Optional limit on content length (default: 50,000 characters) - prevents overwhelming responses

				Returns: The complete content from halans.com, truncated if it exceeds the specified maximum length.

				Strategic advantages for LLMs:
				- Complete coverage: Access to all information in a single call
				- Cross-section analysis: Ability to find connections between different topics
				- Comprehensive understanding: Full context for complex queries
				- Content completeness: Ensures you don't miss relevant information scattered across sections

				Important considerations:
				- Token usage: This is the most token-intensive tool - use when necessary
				- Processing overhead: Large content requires more computational resources
				- Content truncation: May be cut off if content exceeds max_length parameter
				- Context limits: May exceed your context window for very large content

				When NOT to use:
				- When you need specific information (use search_content instead)
				- When you know the relevant section (use get_section instead)
				- When exploring content structure (use get_content_summary first)
				- For targeted queries (other tools are more efficient)

				Best practices:
				- Use other tools first to understand content structure and scope
				- Consider adjusting max_length based on your needs and context limits
				- Reserve for tasks requiring comprehensive analysis or cross-topic understanding
				- Follow up with targeted tools if you need to drill down into specific areas

				Workflow integration:
				- Last resort after other tools don't provide sufficient information
				- Use when building comprehensive documentation or analysis
				- Look for blog contents between [START_OF_CONTENT] and [END_OF_CONTENT] blocks.
				- Look for metadata listed as [POST_TITLE], [POST_LINK] and [POST_DATE].
				- Ideal for content migration, full-text analysis, or complete understanding tasks`,
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
			`Generates a comprehensive overview and table of contents for all available content from halans.com. This tool is essential for understanding the content structure and planning your
			information retrieval strategy.

			Use this tool when:
			- Starting a new task and need to understand what information is available
			- Planning which sections to retrieve or search through
			- Getting an overview of content organization and topics covered
			- Need to understand the scope and structure before diving into specifics

			Parameters:
			- None required - simply call the tool to get the complete summary

			Returns:
			- Content statistics: Total lines, characters, estimated word count
			- Hierarchical table of contents: All headings organized by level (H1, H2, H3, etc.)
			- Section structure: Shows the logical organization of topics and subtopics. 
			
			Strategic advantages of this tool:
			- Navigation aid: Acts like a map of the available content
			- Efficient planning: Helps you choose the right tool for your next step
			- Content awareness: Understand what topics are covered before searching
			- Structure understanding: See how information is organized hierarchically
			- Token efficiency: Small response that provides maximum structural insight

			Workflow integration:
			1. Start here when beginning content exploration
			2. Identify relevant sections for your specific needs
			3. Use with get_section to retrieve specific areas of interest
			4. Combine with search_content when you know what topics exist but need specific details

			Example usage patterns:
			- First call get_content_summary to see available sections
			- Then use get_section("Relevant Topic") for focused reading
			- Or use search_content("specific term") if you know what you're looking for
			- Use get_full_content only when you need everything

			Best practices:
			- Always start with this tool for new content exploration
			- Use the heading structure to inform your get_section calls
			- Blog posts are each contained within [START OF CONTENT] and [END OF CONTENT] blocks. Additionally they have metadata listed as [POST TITLE], [POST LINK] and [POST DATE].
			- Reference the statistics to understand content scope
			- Use as a "content index" throughout your session`,
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

		// Add resources to expose the content as browseable resources
		this.server.resource(
			"halans-content",
			"halans://content",
			{ 
				name: "Halans.com Content Listing",
				description: "Overview of content listing from halans.com", 
				mimeType: "text/plain" 
			}, 
			async () => {
				const content = await this.fetchResourceContent();
				return {
					contents: [{
						uri: "halans://content",
						mimeType: "text/plain",
						text: content
					}]
				};
			}
		);

		this.server.resource(
			"halans-content-summary",
			"halans://content-summary",
			{
				name: "Halans.com Content Summary",
				description: "Summary and table of contents for halans.com content",
				mimeType: "text/plain"
			},
			async () => {
				const content = await this.fetchResourceContent();
				const lines = content.split('\n');
				const yearSections: {[year: string]: string[]} = {};
				let currentYear = '';
				let totalArticles = 0;
				
				for (const line of lines) {
					const trimmedLine = line.trim();
					
					// Check if it's a year header (### YYYY)
					const yearMatch = trimmedLine.match(/^###\s+(\d{4})$/);
					if (yearMatch) {
						currentYear = yearMatch[1];
						yearSections[currentYear] = [];
						continue;
					}
					
					// Check if it's an article line and extract just the title
					const articleMatch = trimmedLine.match(/^####\s+"([^"]+)"/);
					if (articleMatch && currentYear) {
						const title = articleMatch[1];
						yearSections[currentYear].push(title);
						totalArticles++;
					}
				}

				// Build the summary with years in descending order
				const sortedYears = Object.keys(yearSections).sort((a, b) => b.localeCompare(a));
				const tableOfContents: string[] = [];
				
				for (const year of sortedYears) {
					if (yearSections[year].length > 0) {
						tableOfContents.push(`${year} (${yearSections[year].length} articles):`);
						for (const title of yearSections[year]) {
							tableOfContents.push(`  - ${title}`);
						}
						tableOfContents.push(''); // Empty line between years
					}
				}

				const wordCount = content.split(/\s+/).length;
				const charCount = content.length;

				const summary = `Content Summary from halans.com:

Stats:
- ${totalArticles} articles
- ${sortedYears.length} years covered
- ${wordCount} words total
- ${charCount} characters total

Articles by Year:
${tableOfContents.join('\n')}`;

				return {
					contents: [{
						uri: "halans://content-summary",
						mimeType: "text/plain",
						text: summary
					}]
				};
			}
		);

		this.server.resource(
			"halans-articles-list",
			"halans://articles-list",
			{
				name: "Halans.com Articles List",
				description: "Chronological list of all blog articles with titles, dates, and links",
				mimeType: "application/json"
			},
			async () => {
				const content = await this.fetchResourceContent();
				const lines = content.split('\n');
				const articles: Array<{title: string, date: string, url: string, year: string}> = [];
				let currentYear = '';
				
				for (const line of lines) {
					const trimmedLine = line.trim();
					
					// Check if it's a year header (### YYYY)
					const yearMatch = trimmedLine.match(/^###\s+(\d{4})$/);
					if (yearMatch) {
						currentYear = yearMatch[1];
						continue;
					}
					
					// Check if it's an article line (#### "Title" URL (Date))
					const articleMatch = trimmedLine.match(/^####\s+"([^"]+)"\s+(https?:\/\/[^\s]+)\s+\((\d{4}-\d{2}-\d{2})\)$/);
					if (articleMatch) {
						const [, title, url, date] = articleMatch;
						articles.push({
							title: title,
							url: url,
							date: date,
							year: currentYear
						});
					}
				}

				return {
					contents: [{
						uri: "halans://articles-list",
						mimeType: "application/json",
						text: JSON.stringify({
							total: articles.length,
							articles: articles,
							years: [...new Set(articles.map(a => a.year))].filter(Boolean).sort((a, b) => b.localeCompare(a))
						}, null, 2)
					}]
				};
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
