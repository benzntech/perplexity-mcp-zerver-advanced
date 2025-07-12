# Perplexity MCP Zerver Advanced

A modular, testable, and keyless research server that implements the Model Context Protocol (MCP) to deliver AI-powered research capabilities through Perplexity's web interface.

[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-blue)]()
[![TypeScript Codebase](https://img.shields.io/badge/TypeScript-Codebase-blue)]()
[![Test Coverage](https://img.shields.io/badge/Coverage-100%25-brightgreen)]()

## Features

- **Modular & Testable**: Built with a dependency-injected architecture for robust, isolated testing of each component.
- **Keyless Web Research**: Interacts with Perplexity via browser automation, eliminating the need for an API key.
- **Persistent Chat**: Maintains conversation history using a local SQLite database for contextual follow-ups.
- **Advanced Content Extraction**: Parses articles and GitHub repositories using Mozilla's Readability library.
- **Comprehensive Developer Tools**: Includes tools for documentation retrieval, API discovery, and deprecated code analysis.
- **Rich Tool Schemas**: Detailed schemas with categories, keywords, and examples improve tool discovery and usability.

---

## Available Tools

The server provides a suite of tools for research and development, each with a detailed schema for easy integration.

| Tool Name                 | Category                  | Description                                                                                              |
| ------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------- |
| `chat_perplexity`         | Conversation              | Engages in interactive, conversational queries with persistent chat history.                             |
| `extract_url_content`     | Information Extraction    | Extracts the main text content from articles, blogs, and GitHub repositories.                            |
| `get_documentation`       | Technical Reference       | Fetches technical documentation, usage examples, and version-specific information for APIs and libraries.  |
| `find_apis`               | API Discovery             | Discovers and compares external APIs based on functional requirements.                                   |
| `check_deprecated_code`   | Code Analysis             | Analyzes code snippets for outdated patterns and identifies technical debt.                              |
| `search`                  | Web Search                | Performs general web searches using Perplexity AI for information retrieval.                               |

---

## Getting Started

### Prerequisites
- Node.js 18+
- pnpm package manager

### Installation
```bash
git clone https://github.com/wysh3/perplexity-mcp-zerver.git
cd perplexity-mcp-zerver
pnpm install
pnpm run build
```

### Configuration
Add the server to your MCP configuration file. **Replace `/path/to/project` with the absolute path** to the `perplexity-mcp-zerver` directory.

```json
{
  "mcpServers": {
    "perplexity-server": {
      "command": "npx",
      "args": ["."],
      "cwd": "/path/to/project/perplexity-mcp-zerver",
      "timeout": 600
    }
  }
}
```

### Usage
Initiate commands through your MCP client:
- "Use perplexity to research quantum computing advancements."
- "Ask perplexity-server for React 18 documentation on hooks."
- "Start a chat with perplexity about the future of neural networks."

### Advanced Configuration
Pass custom Puppeteer launch options directly in your tool arguments. For example, to run in non-headless mode:
```json
{
  "tool_name": "search",
  "arguments": {
    "query": "latest advancements in AI",
    "launchOptions": { "headless": false }
  }
}
```
The server automatically includes the `--no-sandbox` flag when running as root.

---

## Architecture

This server is built with a modular and testable architecture that uses dependency injection to separate concerns and enhance stability.

- **`PerplexityServer`**: The main server class that handles MCP requests and orchestrates the other modules.
- **`BrowserManager`**: Manages all Puppeteer browser operations, including initialization, cleanup, and recovery from errors.
- **`SearchEngine`**: Encapsulates all logic for performing searches and extracting answers from the web interface.
- **`DatabaseManager`**: Manages the SQLite database for storing and retrieving chat histories, ensuring conversation persistence.

This design allows for individual components to be tested in isolation, leading to a more reliable and maintainable codebase.

---

## Troubleshooting

**Server Connection Issues**
1. Verify the absolute path in your MCP configuration.
2. Confirm your Node.js installation (`node -v`).
3. Ensure the project has been built successfully (`pnpm run build`).

**Content Extraction**
- Use full repository URLs for GitHub paths.
- For deep content extraction, adjust the link recursion depth in the source configuration.

---

## Origins & License
 
based on - [DaInfernalCoder/perplexity-researcher-mcp](https://github.com/DaInfernalCoder/perplexity-researcher-mcp)
refactored from - [sm-moshi/docshunter](https://github.com/sm-moshi/docshunter)

Licensed under **GNU GPL v3.0** - [View License](LICENSE)

---

> This project interfaces with Perplexity via browser automation. Use responsibly and ethically. Stability depends on Perplexity's website consistency. For educational use only.
