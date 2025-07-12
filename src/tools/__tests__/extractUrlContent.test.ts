import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PuppeteerContext } from "../../types/index.js";
import extractUrlContent from "../extractUrlContent.js";

describe("extractUrlContent Tool", () => {
  let mockContext: PuppeteerContext;
  let mockFetchSinglePageContent: ReturnType<typeof vi.fn>;
  let mockRecursiveFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockContext = {
      log: vi.fn(),
      browser: null,
      page: null,
      isInitializing: false,
      searchInputSelector: "",
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
      IDLE_TIMEOUT_MS: 100, // Use a short timeout for testing
    };

    mockFetchSinglePageContent = vi.fn().mockResolvedValue(
      JSON.stringify({
        status: "Success",
        content: [{ url: "https://example.com", textContent: "Example content" }],
      }),
    );

    mockRecursiveFetch = vi.fn().mockImplementation(async (startUrl, maxDepth, currentDepth, visitedUrls, results) => {
      results.push({ url: startUrl, textContent: "Recursive content" });
    });
  });

  it("should call fetchSinglePageContent for depth 1", async () => {
    const args = { url: "https://example.com", depth: 1 };
    await extractUrlContent(args, mockContext, mockFetchSinglePageContent, mockRecursiveFetch);
    expect(mockFetchSinglePageContent).toHaveBeenCalledWith("https://example.com", mockContext, expect.any(Object));
    expect(mockRecursiveFetch).not.toHaveBeenCalled();
  });

  it("should call recursiveFetch for depth greater than 1", async () => {
    const args = { url: "https://example.com", depth: 2 };
    const result = await extractUrlContent(args, mockContext, mockFetchSinglePageContent, mockRecursiveFetch);
    expect(mockRecursiveFetch).toHaveBeenCalled();
    expect(mockFetchSinglePageContent).not.toHaveBeenCalled();
    const parsedResult = JSON.parse(result);
    expect(parsedResult.status).toBe("Success");
    expect(parsedResult.content[0].textContent).toBe("Recursive content");
  });

  it("should handle errors during recursive fetch", async () => {
    const error = new Error("Recursive fetch failed");
    mockRecursiveFetch.mockRejectedValue(error);
    const args = { url: "https://example.com", depth: 2 };
    const result = await extractUrlContent(args, mockContext, mockFetchSinglePageContent, mockRecursiveFetch);
    const parsedResult = JSON.parse(result);
    expect(parsedResult.status).toBe("Error");
    expect(parsedResult.message).toContain("Recursive fetch failed");
  });

  it("should handle timeouts during recursive fetch", async () => {
    mockRecursiveFetch.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 200)));
    const args = { url: "https://example.com", depth: 2 };
    const result = await extractUrlContent(args, mockContext, mockFetchSinglePageContent, mockRecursiveFetch);
    const parsedResult = JSON.parse(result);
    expect(parsedResult.status).toBe("Error");
    expect(parsedResult.message).toContain("timed out");
  });
});
