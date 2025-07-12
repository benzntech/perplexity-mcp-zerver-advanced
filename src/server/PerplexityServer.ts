/**
 * PerplexityServer - Modular, testable architecture
 * Uses dependency injection and focused modules for better testability
 */
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type {
  IBrowserManager,
  IDatabaseManager,
  ISearchEngine,
  ServerDependencies,
  ChatPerplexityArgs,
  GetDocumentationArgs,
  FindApisArgs,
  CheckDeprecatedCodeArgs,
  SearchArgs,
  ExtractUrlContentArgs,
} from "../types/index.js";
import { logError, logInfo } from "../utils/logging.js";
import { BrowserManager } from "./modules/BrowserManager.js";
import { DatabaseManager } from "./modules/DatabaseManager.js";
import { SearchEngine } from "./modules/SearchEngine.js";
import { createToolHandlersRegistry, setupToolHandlers } from "./toolHandlerSetup.js";

// Import modular tool implementations
import chatPerplexity from "../tools/chatPerplexity.js";
import extractUrlContent from "../tools/extractUrlContent.js";

export class PerplexityServer {
  private readonly server: Server;
  private readonly browserManager: IBrowserManager;
  private readonly searchEngine: ISearchEngine;
  private readonly databaseManager: IDatabaseManager;

  private constructor(dependencies?: ServerDependencies) {
    try {
      // Initialize MCP Server
      this.server = new Server(
        { name: "perplexity-server", version: "0.2.0" },
        {
          capabilities: {
            tools: {
              listChanged: true,
            },
          },
        },
      );

      // Initialize modules with dependency injection
      this.databaseManager = dependencies?.databaseManager ?? new DatabaseManager();
      this.browserManager = dependencies?.browserManager ?? new BrowserManager();
      this.searchEngine = dependencies?.searchEngine ?? new SearchEngine(this.browserManager);

      // Setup tool handlers
      this.setupToolHandlers();

      // Setup graceful shutdown (only if not in MCP mode)
      // biome-ignore lint/complexity/useLiteralKeys: Environment variable access
      if (!process.env["MCP_MODE"]) {
        this.setupShutdownHandler();
      }

      logInfo("PerplexityServer constructed successfully");
    } catch (error) {
      logError("Error in PerplexityServer constructor:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      throw error;
    }
  }

  public static async create(dependencies?: ServerDependencies): Promise<PerplexityServer> {
    const serverInstance = new PerplexityServer(dependencies);
    await serverInstance.databaseManager.initialize();
    await serverInstance.browserManager.initialize();
    logInfo("PerplexityServer initialized successfully");
    return serverInstance;
  }

  private setupShutdownHandler(): void {
    process.on("SIGINT", async () => {
      logInfo("SIGINT received, shutting down gracefully...");
      try {
        await this.cleanup();
        await this.server.close();
        process.exit(0);
      } catch (error) {
        logError("Error during shutdown:", {
          error: error instanceof Error ? error.message : String(error),
        });
        process.exit(1);
      }
    });
  }

  private async cleanup(): Promise<void> {
    try {
      await this.browserManager.cleanup();
      this.databaseManager.close();
      logInfo("Server cleanup completed");
    } catch (error) {
      logError("Error during cleanup:", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Tool handler implementations
  private async handleChatPerplexity(args: Record<string, unknown>): Promise<string> {
    const typedArgs = args as unknown as ChatPerplexityArgs;

    // Use modular search engine
    const searchResult = await this.searchEngine.performSearch(typedArgs.message, {
      launchOptions: typedArgs.launchOptions,
      allowDangerous: typedArgs.allowDangerous,
    });

    // Use modular database manager
    const getChatHistoryFn = (chatId: string) => this.databaseManager.getChatHistory(chatId);
    const saveChatMessageFn = (
      chatId: string,
      message: { role: "user" | "assistant"; content: string },
    ) => this.databaseManager.saveChatMessage(chatId, message.role, message.content);

    // Call the original tool implementation with injected dependencies
    return await chatPerplexity(
      typedArgs,
      {} as never, // Context not needed with modular approach
      () => Promise.resolve(searchResult),
      getChatHistoryFn,
      saveChatMessageFn,
    );
  }

  private async handleGetDocumentation(args: Record<string, unknown>): Promise<string> {
    const typedArgs = args as unknown as GetDocumentationArgs;
    const searchResult = await this.searchEngine.performSearch(
      `Documentation for ${typedArgs.query}: ${typedArgs.context || ""}`,
      {
        launchOptions: typedArgs.launchOptions,
        allowDangerous: typedArgs.allowDangerous,
      },
    );
    return searchResult;
  }

  private async handleFindApis(args: Record<string, unknown>): Promise<string> {
    const typedArgs = args as unknown as FindApisArgs;
    const searchResult = await this.searchEngine.performSearch(
      `Find APIs for ${typedArgs.requirement}: ${typedArgs.context || ""}`,
      {
        launchOptions: typedArgs.launchOptions,
        allowDangerous: typedArgs.allowDangerous,
      },
    );
    return searchResult;
  }

  private async handleCheckDeprecatedCode(args: Record<string, unknown>): Promise<string> {
    const typedArgs = args as unknown as CheckDeprecatedCodeArgs;
    const searchResult = await this.searchEngine.performSearch(
      `Check if this ${typedArgs.technology || "code"} is deprecated: ${typedArgs.code}`,
      {
        launchOptions: typedArgs.launchOptions,
        allowDangerous: typedArgs.allowDangerous,
      },
    );
    return searchResult;
  }

  private async handleSearch(args: Record<string, unknown>): Promise<string> {
    const typedArgs = args as unknown as SearchArgs;

    return await this.searchEngine.performSearch(typedArgs.query, {
      launchOptions: typedArgs.launchOptions,
      allowDangerous: typedArgs.allowDangerous,
    });
  }

  private async handleExtractUrlContent(args: Record<string, unknown>): Promise<string> {
    const typedArgs = args as unknown as ExtractUrlContentArgs;

    // For now, use the original implementation
    // In the future, this could be moved to a ContentExtractor module
    return await extractUrlContent(
      typedArgs,
      {} as never, // Context not needed
      async () => "Placeholder implementation", // Simplified for now
      async () => {}, // Simplified for now
    );
  }

  private setupToolHandlers(): void {
    const toolHandlers = createToolHandlersRegistry({
      chat_perplexity: this.handleChatPerplexity.bind(this),
      get_documentation: this.handleGetDocumentation.bind(this),
      find_apis: this.handleFindApis.bind(this),
      check_deprecated_code: this.handleCheckDeprecatedCode.bind(this),
      search: this.handleSearch.bind(this),
      extract_url_content: this.handleExtractUrlContent.bind(this),
    });

    setupToolHandlers(this.server, toolHandlers);
  }

  async run(): Promise<void> {
    try {
      logInfo("Creating StdioServerTransport...");
      const transport = new StdioServerTransport();

      logInfo("Starting PerplexityServer...");
      logInfo(`Tools registered: ${Object.keys(this.getToolHandlersRegistry()).join(", ")}`);

      logInfo("Attempting to connect server to transport...");
      await this.server.connect(transport);
      logInfo("PerplexityServer connected and ready");
      logInfo("Server is listening for requests...");

      // The transport handles keeping the process alive.
    } catch (error) {
      logError("Failed to start server:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      process.exit(1);
    }
  }

  private getToolHandlersRegistry() {
    return {
      chat_perplexity: this.handleChatPerplexity.bind(this),
      get_documentation: this.handleGetDocumentation.bind(this),
      find_apis: this.handleFindApis.bind(this),
      check_deprecated_code: this.handleCheckDeprecatedCode.bind(this),
      search: this.handleSearch.bind(this),
      extract_url_content: this.handleExtractUrlContent.bind(this),
    };
  }

  // Getters for testing
  public getBrowserManager(): IBrowserManager {
    return this.browserManager;
  }

  public getSearchEngine(): ISearchEngine {
    return this.searchEngine;
  }

  public getDatabaseManager(): IDatabaseManager {
    return this.databaseManager;
  }
}
