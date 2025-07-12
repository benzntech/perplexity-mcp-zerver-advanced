import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PerplexityServer } from "../PerplexityServer.js";
import { BrowserManager } from "../modules/BrowserManager.js";
import { DatabaseManager } from "../modules/DatabaseManager.js";
import { SearchEngine } from "../modules/SearchEngine.js";
import { setupToolHandlers } from "../toolHandlerSetup.js";

// Mock modules
vi.mock("../modules/BrowserManager.js");
vi.mock("../modules/DatabaseManager.js");
vi.mock("../modules/SearchEngine.js");
vi.mock("../toolHandlerSetup.js");
vi.mock("@modelcontextprotocol/sdk/server/index.js", () => ({
  Server: vi.fn(() => ({
    name: "perplexity-server",
    version: "0.2.0",
    connect: vi.fn(),
    close: vi.fn(),
  })),
}));

const mockBrowserManager = vi.mocked(BrowserManager);
const mockDatabaseManager = vi.mocked(DatabaseManager);
const mockSearchEngine = vi.mocked(SearchEngine);
const mockSetupToolHandlers = vi.mocked(setupToolHandlers);

describe("PerplexityServer", () => {
  let browserManagerInstance: BrowserManager;
  let databaseManagerInstance: DatabaseManager;
  let searchEngineInstance: SearchEngine;

  beforeEach(() => {
    vi.clearAllMocks();

    browserManagerInstance = {
      initialize: vi.fn().mockResolvedValue(undefined),
      cleanup: vi.fn().mockResolvedValue(undefined),
    } as unknown as BrowserManager;

    databaseManagerInstance = {
      initialize: vi.fn().mockResolvedValue(undefined),
      close: vi.fn(),
    } as unknown as DatabaseManager;

    searchEngineInstance = {
      performSearch: vi.fn(),
    } as unknown as SearchEngine;

    mockBrowserManager.mockReturnValue(browserManagerInstance);
    mockDatabaseManager.mockReturnValue(databaseManagerInstance);
    mockSearchEngine.mockReturnValue(searchEngineInstance);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("create", () => {
    it("should create and initialize a server instance", async () => {
      const server = await PerplexityServer.create();
      expect(server).toBeInstanceOf(PerplexityServer);
      expect(databaseManagerInstance.initialize).toHaveBeenCalled();
      expect(browserManagerInstance.initialize).toHaveBeenCalled();
    });

    it("should use provided dependencies", async () => {
      const customBrowserManager = { initialize: vi.fn() } as any;
      const customDatabaseManager = { initialize: vi.fn() } as any;
      const customSearchEngine = {} as any;

      await PerplexityServer.create({
        browserManager: customBrowserManager,
        databaseManager: customDatabaseManager,
        searchEngine: customSearchEngine,
      });

      expect(customDatabaseManager.initialize).toHaveBeenCalled();
      expect(customBrowserManager.initialize).toHaveBeenCalled();
    });
  });

  describe("Tool Handlers", () => {
    it("should set up tool handlers on construction", async () => {
      await PerplexityServer.create();
      expect(mockSetupToolHandlers).toHaveBeenCalled();
    });
  });

  describe("Shutdown", () => {
    it("should set up SIGINT handler when not in MCP mode", async () => {
      const processOnSpy = vi.spyOn(process, "on");
      await PerplexityServer.create();
      expect(processOnSpy).toHaveBeenCalledWith("SIGINT", expect.any(Function));
      processOnSpy.mockRestore();
    });

    it("should not set up SIGINT handler when in MCP mode", async () => {
      vi.stubEnv("MCP_MODE", "true");
      const processOnSpy = vi.spyOn(process, "on");
      await PerplexityServer.create();
      expect(processOnSpy).not.toHaveBeenCalledWith("SIGINT", expect.any(Function));
      processOnSpy.mockRestore();
    });
  });
});
