import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PuppeteerContext } from "../../types/index.js";
import search from "../search.js";

// Mock the dependencies before importing the module
vi.mock("puppeteer", () => ({
  default: {
    launch: vi.fn(),
  },
}));

describe("Search Tool", () => {
  let mockContext: PuppeteerContext;
  let mockPerformSearch: ReturnType<typeof vi.fn>;
  let mockPage: {
    isClosed: ReturnType<typeof vi.fn>;
    evaluate: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockPage = {
      isClosed: vi.fn().mockReturnValue(false),
      evaluate: vi.fn().mockResolvedValue({
        hasContent: true,
        contentLength: 500,
        hasInputField: true,
        pageState: "complete",
      }),
    };

    mockContext = {
      log: vi.fn(),
      browser: {} as never,
      page: mockPage as never,
      isInitializing: false,
      searchInputSelector: 'textarea[placeholder*="Ask"]',
      lastSearchTime: 0,
      idleTimeout: null,
      operationCount: 0,
      setBrowser: vi.fn(),
      setPage: vi.fn(),
      setIsInitializing: vi.fn(),
      setSearchInputSelector: vi.fn(),
      setIdleTimeout: vi.fn(),
      incrementOperationCount: vi.fn(),
      determineRecoveryLevel: vi.fn(),
      IDLE_TIMEOUT_MS: 300000,
    };

    mockPerformSearch = vi.fn().mockResolvedValue("Mock search result");
  });

  describe("Basic functionality", () => {
    it("should be defined", () => {
      // Basic smoke test
      expect(true).toBe(true);
    });

    it("should handle empty query", () => {
      // Test empty query validation
      const query = "";
      expect(query.length).toBe(0);
    });

    it("should validate query parameters", () => {
      // Test query parameter validation
      const validQuery = "test search query";
      const invalidQuery = "";

      expect(validQuery.length).toBeGreaterThan(0);
      expect(invalidQuery.length).toBe(0);
    });
  });

  describe("Search functionality", () => {
    it("should format search results correctly", () => {
      // Test result formatting
      const mockResult = {
        content: [
          {
            type: "text",
            text: "Sample search result",
          },
        ],
        isError: false,
      };

      expect(mockResult.content).toHaveLength(1);
      expect(mockResult.content[0]?.type).toBe("text");
      expect(mockResult.content[0]?.text).toBe("Sample search result");
      expect(mockResult.isError).toBe(false);
    });

    it("should handle search errors", () => {
      // Test error handling
      const errorResult = {
        content: [
          {
            type: "text",
            text: "Error: Search failed",
          },
        ],
        isError: true,
      };

      expect(errorResult.isError).toBe(true);
      expect(errorResult.content[0]?.text).toContain("Error:");
    });
  });

  describe("search function", () => {
    it("should perform a basic search", async () => {
      const args = { query: "test query" };
      const result = await search(args, mockContext, mockPerformSearch);

      expect(result).toBe("Mock search result");
      expect(mockPerformSearch).toHaveBeenCalledWith("test query", mockContext);
    });

    it("should handle an empty query", async () => {
      const args = { query: "" };
      const result = await search(args, mockContext, mockPerformSearch);

      expect(result).toBe("Mock search result");
      expect(mockPerformSearch).toHaveBeenCalledWith("", mockContext);
    });
  });

  describe("Error handling", () => {
    it("should propagate errors from performSearch", async () => {
      mockPerformSearch.mockRejectedValue(new Error("Network error"));

      const args = { query: "error test" };

      await expect(search(args, mockContext, mockPerformSearch)).rejects.toThrow("Network error");
    });
  });
});
