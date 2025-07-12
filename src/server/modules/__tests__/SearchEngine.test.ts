import type { Page } from "puppeteer";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { IBrowserManager } from "../../../types/index.js";
import { SearchEngine } from "../SearchEngine.js";
import * as logging from "../../../utils/logging.js";
import { CONFIG } from "../../config.js";

// Mock dependencies
vi.mock("../../../utils/logging.js", () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("../../config.js", () => ({
  CONFIG: {
    SELECTOR_TIMEOUT: 1000, // Use a shorter timeout for tests
  },
}));

const mockLogInfo = vi.mocked(logging.logInfo);
const mockLogWarn = vi.mocked(logging.logWarn);
const mockLogError = vi.mocked(logging.logError);

// Type for accessing private methods
interface SearchEnginePrivate {
  executeSearch(page: Page, selector: string, query: string): Promise<void>;
  waitForCompleteAnswer(page: Page): Promise<string>;
  extractCompleteAnswer(page: Page): Promise<string>;
  generateErrorResponse(error: unknown): string;
}

describe("SearchEngine", () => {
  let searchEngine: SearchEngine;
  let mockBrowserManager: IBrowserManager;
  let mockPage: Page;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPage = {
      evaluate: vi.fn(),
      click: vi.fn(),
      type: vi.fn(),
      waitForSelector: vi.fn(),
      keyboard: {
        press: vi.fn(),
      },
    } as unknown as Page;

    mockBrowserManager = {
      isReady: vi.fn().mockReturnValue(true),
      initialize: vi.fn().mockResolvedValue(undefined),
      navigateToPerplexity: vi.fn().mockResolvedValue(undefined),
      getPage: vi.fn().mockReturnValue(mockPage),
      waitForSearchInput: vi.fn().mockResolvedValue('textarea[placeholder*="Ask"]'),
      resetIdleTimeout: vi.fn(),
      performRecovery: vi.fn().mockResolvedValue(undefined),
      checkForCaptcha: vi.fn(),
      cleanup: vi.fn(),
      getBrowser: vi.fn(),
    };

    searchEngine = new SearchEngine(mockBrowserManager);
  });

  describe("performSearch", () => {
    it("should perform a successful search", async () => {
      (searchEngine as unknown as SearchEnginePrivate).waitForCompleteAnswer = vi
        .fn()
        .mockResolvedValue("Test answer");

      const result = await searchEngine.performSearch("test query");

      expect(result).toBe("Test answer");
      expect(mockBrowserManager.initialize).not.toHaveBeenCalled();
      expect(mockBrowserManager.navigateToPerplexity).toHaveBeenCalled();
      expect(mockBrowserManager.resetIdleTimeout).toHaveBeenCalled();
    });

    it("should initialize browser if not ready", async () => {
      mockBrowserManager.isReady = vi.fn().mockReturnValue(false);
      (searchEngine as unknown as SearchEnginePrivate).waitForCompleteAnswer = vi
        .fn()
        .mockResolvedValue("Test answer");

      await searchEngine.performSearch("test query");

      expect(mockBrowserManager.initialize).toHaveBeenCalled();
      expect(mockLogInfo).toHaveBeenCalledWith("Browser not ready, initializing...");
    });

    it("should handle errors and perform recovery", async () => {
      const error = new Error("Search failed");
      mockBrowserManager.navigateToPerplexity = vi.fn().mockRejectedValue(error);

      const result = await searchEngine.performSearch("test query");

      expect(result).toContain("search operation could not be completed");
      expect(mockBrowserManager.performRecovery).toHaveBeenCalledWith(error);
      expect(mockLogError).toHaveBeenCalledWith("Search operation failed:", {
        error: "Search failed",
      });
    });
  });

  describe("executeSearch", () => {
    const privateAccess = () => searchEngine as unknown as SearchEnginePrivate;

    it("should execute search query correctly", async () => {
      await privateAccess().executeSearch(mockPage, "textarea", "query");

      expect(mockPage.evaluate).toHaveBeenCalled();
      expect(mockPage.click).toHaveBeenCalledWith("textarea", { clickCount: 3 });
      expect(mockPage.keyboard.press).toHaveBeenCalledWith("Backspace");
      expect(mockPage.type).toHaveBeenCalledWith("textarea", "query", expect.any(Object));
      expect(mockPage.keyboard.press).toHaveBeenCalledWith("Enter");
      expect(mockLogInfo).toHaveBeenCalledWith("Search query submitted successfully");
    });

    it("should handle errors when clearing input", async () => {
      const error = new Error("Clear failed");
      vi.mocked(mockPage.evaluate).mockRejectedValue(error);

      await privateAccess().executeSearch(mockPage, "textarea", "query");

      expect(mockLogWarn).toHaveBeenCalledWith("Error clearing input field:", {
        error: "Clear failed",
      });
    });

    it("should truncate long queries in logs", async () => {
      const longQuery = "a".repeat(60);
      await privateAccess().executeSearch(mockPage, "textarea", longQuery);
      expect(mockLogInfo).toHaveBeenCalledWith(
        `Executing search for: "${"a".repeat(50)}..."`,
      );
    });
  });

  describe("waitForCompleteAnswer", () => {
    const privateAccess = () => searchEngine as unknown as SearchEnginePrivate;

    it("should wait for and return the complete answer", async () => {
      const mockElementHandle = {} as any;
      vi.mocked(mockPage.waitForSelector).mockResolvedValue(mockElementHandle);
      privateAccess().extractCompleteAnswer = vi.fn().mockResolvedValue("Final answer");

      const result = await privateAccess().waitForCompleteAnswer(mockPage);

      expect(result).toBe("Final answer");
      expect(mockLogInfo).toHaveBeenCalledWith("Found response with selector: .prose");
    });

    it("should try multiple selectors if the first fails", async () => {
      const mockElementHandle = {} as any;
      vi.mocked(mockPage.waitForSelector)
        .mockRejectedValueOnce(new Error("Not found"))
        .mockResolvedValue(mockElementHandle);
      privateAccess().extractCompleteAnswer = vi.fn().mockResolvedValue("Final answer");

      await privateAccess().waitForCompleteAnswer(mockPage);

      expect(mockPage.waitForSelector).toHaveBeenCalledTimes(2);
      expect(mockLogWarn).toHaveBeenCalledWith("Selector .prose not found, trying next...");
    });

    it("should throw if no response selectors are found", async () => {
      vi.mocked(mockPage.waitForSelector).mockRejectedValue(new Error("Not found"));

      await expect(privateAccess().waitForCompleteAnswer(mockPage)).rejects.toThrow(
        "No response elements found on page",
      );
      expect(mockLogError).toHaveBeenCalledWith("No response selectors found");
    });
  });

  describe("extractCompleteAnswer", () => {
    it("should return fallback message if no answer is found", async () => {
      vi.mocked(mockPage.evaluate).mockResolvedValue("No answer content found. The website may be experiencing issues.");
      const result = await (
        searchEngine as unknown as SearchEnginePrivate
      ).extractCompleteAnswer(mockPage);
      expect(result).toContain("No answer content found");
    });
  });

  describe("generateErrorResponse", () => {
    const privateAccess = () => searchEngine as unknown as SearchEnginePrivate;

    it("should generate a timeout-specific error message", () => {
      const error = new Error("A timeout error occurred");
      const result = privateAccess().generateErrorResponse(error);
      expect(result).toBe("The search operation is taking longer than expected. This might be due to high server load. Please try again with a more specific query.");
    });

    it("should generate a navigation-specific error message", () => {
      const error = new Error("Navigation failed");
      const result = privateAccess().generateErrorResponse(error);
      expect(result).toBe("The search operation encountered a navigation issue. This might be due to network connectivity problems. Please try again later.");
    });

    it("should generate a detached-specific error message", () => {
      const error = new Error("Detached");
      const result = privateAccess().generateErrorResponse(error);
      expect(result).toBe("The search operation encountered a technical issue. Please try again with a more specific query.");
    });

    it("should generate a generic error for other errors", () => {
      const error = new Error("A generic error");
      const result = privateAccess().generateErrorResponse(error);
      expect(result).toBe(`The search operation could not be completed. Error: A generic error. Please try again later with a more specific query.`);
    });

    it("should handle non-Error objects", () => {
      const error = "A string error";
      const result = privateAccess().generateErrorResponse(error);
      expect(result).toBe(`The search operation could not be completed. Error: A string error. Please try again later with a more specific query.`);
    });
  });
});
