/**
 * Tests for BrowserManager module
 * Mocks Puppeteer and other dependencies to ensure focused, reliable unit tests.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Browser, LaunchOptions, Page } from "puppeteer";
import puppeteer from "puppeteer";
import { BrowserManager } from "../BrowserManager.js";
import * as logging from "../../../utils/logging.js";
import * as puppeteerUtils from "../../../utils/puppeteer.js";

// Mock external dependencies
vi.mock("puppeteer", () => ({
  default: {
    launch: vi.fn(),
  },
}));

vi.mock("../../../utils/logging.js", () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("../../../utils/puppeteer.js", () => ({
  navigateToPerplexity: vi.fn(),
  waitForSearchInput: vi.fn(),
  checkForCaptcha: vi.fn(),
  recoveryProcedure: vi.fn(),
  resetIdleTimeout: vi.fn(),
}));

const mockPuppeteer = vi.mocked(puppeteer);
const mockLogInfo = vi.mocked(logging.logInfo);
const mockLogError = vi.mocked(logging.logError);
const mockNavigateToPerplexity = vi.mocked(puppeteerUtils.navigateToPerplexity);
const mockWaitForSearchInput = vi.mocked(puppeteerUtils.waitForSearchInput);
const mockCheckForCaptcha = vi.mocked(puppeteerUtils.checkForCaptcha);
const mockRecoveryProcedure = vi.mocked(puppeteerUtils.recoveryProcedure);
const mockResetIdleTimeout = vi.mocked(puppeteerUtils.resetIdleTimeout);

// Type for accessing private members
interface BrowserManagerPrivate {
  browser: Browser | null;
  page: Page | null;
  isInitializing: boolean;
  determineRecoveryLevel(error?: Error): number;
}

describe("BrowserManager", () => {
  let browserManager: BrowserManager;
  let mockPage: Page;
  let mockBrowser: Browser;

  beforeEach(() => {
    vi.clearAllMocks();

    mockPage = {
      isClosed: vi.fn().mockReturnValue(false),
      close: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
    } as unknown as Page;

    mockBrowser = {
      isConnected: vi.fn().mockReturnValue(true),
      close: vi.fn().mockResolvedValue(undefined),
      pages: vi.fn().mockResolvedValue([mockPage]),
      newPage: vi.fn().mockResolvedValue(mockPage),
    } as unknown as Browser;

    mockPuppeteer.launch.mockResolvedValue(mockBrowser);
    browserManager = new BrowserManager();
  });

  describe("initialize", () => {
    it("should initialize browser successfully", async () => {
      await browserManager.initialize({ allowDangerous: true });
      expect(mockPuppeteer.launch).toHaveBeenCalled();
      expect(browserManager.isReady()).toBe(true);
      expect(mockLogInfo).toHaveBeenCalledWith("BrowserManager initialized successfully");
    });

    it("should handle initialization errors", async () => {
      const error = new Error("Launch failed");
      mockPuppeteer.launch.mockRejectedValue(error);

      await expect(browserManager.initialize({ allowDangerous: true })).rejects.toThrow("Launch failed");
      expect(mockLogError).toHaveBeenCalledWith("BrowserManager initialization failed:", {
        error: "Launch failed",
      });
    });

    it("should not initialize if already initializing", async () => {
      (browserManager as unknown as BrowserManagerPrivate).isInitializing = true;
      await browserManager.initialize();
      expect(mockPuppeteer.launch).not.toHaveBeenCalled();
      expect(mockLogInfo).toHaveBeenCalledWith("Browser initialization already in progress...");
    });
  });

  describe("ensureBrowser", () => {
    it("should merge launch options correctly", async () => {
      const options = {
        launchOptions: { args: ["--custom-arg"] },
        allowDangerous: true,
      };
      await browserManager.initialize(options);
      expect(mockPuppeteer.launch).toHaveBeenCalledWith(
        expect.objectContaining({
          args: expect.arrayContaining(["--custom-arg", "--no-sandbox"]),
        }),
      );
    });

    it("should throw an error for dangerous arguments if not allowed", async () => {
      const options = {
        launchOptions: { args: ["--no-sandbox", "--disable-web-security"] },
        allowDangerous: false,
      };
      await expect(browserManager.initialize(options)).rejects.toThrow(
        "Dangerous browser arguments detected",
      );
    });

    it("should allow dangerous arguments when explicitly permitted", async () => {
      const options: { launchOptions: LaunchOptions; allowDangerous: boolean } = {
        launchOptions: { args: ["--no-sandbox", "--disable-web-security"] },
        allowDangerous: true,
      };
      await browserManager.initialize(options);
      expect(mockPuppeteer.launch).toHaveBeenCalled();
    });
  });

  describe("Navigation and Interaction", () => {
    beforeEach(async () => {
      await browserManager.initialize({ allowDangerous: true });
    });

    it("should navigate to Perplexity", async () => {
      await browserManager.navigateToPerplexity();
      expect(mockNavigateToPerplexity).toHaveBeenCalled();
    });

    it("should wait for search input", async () => {
      mockWaitForSearchInput.mockResolvedValue("textarea");
      const selector = await browserManager.waitForSearchInput();
      expect(selector).toBe("textarea");
      expect(mockWaitForSearchInput).toHaveBeenCalled();
    });

    it("should check for captcha", async () => {
      mockCheckForCaptcha.mockResolvedValue(true);
      const hasCaptcha = await browserManager.checkForCaptcha();
      expect(hasCaptcha).toBe(true);
      expect(mockCheckForCaptcha).toHaveBeenCalled();
    });

    it("should perform recovery", async () => {
      const error = new Error("Test recovery");
      await browserManager.performRecovery(error);
      expect(mockRecoveryProcedure).toHaveBeenCalledWith(expect.anything(), error);
    });

    it("should reset idle timeout", () => {
      browserManager.resetIdleTimeout();
      expect(mockResetIdleTimeout).toHaveBeenCalled();
    });
  });

  describe("isReady", () => {
    it("should return false when not initialized", () => {
      expect(browserManager.isReady()).toBe(false);
    });

    it("should return true when initialized and connected", async () => {
      await browserManager.initialize({ allowDangerous: true });
      expect(browserManager.isReady()).toBe(true);
    });

    it("should return false if page is closed", async () => {
      await browserManager.initialize({ allowDangerous: true });
      vi.mocked(mockPage.isClosed).mockReturnValue(true);
      expect(browserManager.isReady()).toBe(false);
    });
  });

  describe("cleanup", () => {
    it("should close browser and page successfully", async () => {
      await browserManager.initialize({ allowDangerous: true });
      await browserManager.cleanup();
      expect(mockPage.close).toHaveBeenCalled();
      expect(mockBrowser.close).toHaveBeenCalled();
      expect(browserManager.isReady()).toBe(false);
      expect(mockLogInfo).toHaveBeenCalledWith("BrowserManager cleanup completed");
    });

    it("should handle cleanup errors gracefully", async () => {
      await browserManager.initialize({ allowDangerous: true });
      const error = new Error("Close failed");
      vi.mocked(mockPage.close).mockRejectedValue(error);
      await browserManager.cleanup();
      expect(mockLogError).toHaveBeenCalledWith("Error during BrowserManager cleanup:", {
        error: "Close failed",
      });
    });
  });

  describe("determineRecoveryLevel", () => {
    it("should return level 3 for critical errors", () => {
      const criticalErrors = [
        new Error("detached"),
        new Error("crashed"),
        new Error("disconnected"),
      ];
      for (const error of criticalErrors) {
        const level = (browserManager as unknown as BrowserManagerPrivate).determineRecoveryLevel(
          error,
        );
        expect(level).toBe(3);
      }
    });

    it("should return level 2 for navigation errors", () => {
      const navErrors = [new Error("navigation"), new Error("timeout"), new Error("net::err")];
      for (const error of navErrors) {
        const level = (browserManager as unknown as BrowserManagerPrivate).determineRecoveryLevel(
          error,
        );
        expect(level).toBe(2);
      }
    });

    it("should return level 1 for other errors", () => {
      const otherError = new Error("Some other error");
      const level = (browserManager as unknown as BrowserManagerPrivate).determineRecoveryLevel(
        otherError,
      );
      expect(level).toBe(1);
    });
  });

  describe("Getters", () => {
    it("should return page and browser instances", async () => {
      await browserManager.initialize({ allowDangerous: true });
      expect(browserManager.getPage()).toBe(mockPage);
      expect(browserManager.getBrowser()).toBe(mockBrowser);
    });
  });
});
