import { describe, it, expect } from "vitest";
import {
  determineRecoveryLevel,
  analyzeError,
  calculateRetryDelay,
  generateBrowserArgs,
  getSearchInputSelectors,
  getCaptchaSelectors,
  validateNavigationUrl,
  isNavigationFailure,
} from "../puppeteer-logic.js";

describe("determineRecoveryLevel", () => {
  it("should return level 1 for no error", () => {
    expect(determineRecoveryLevel()).toBe(1);
  });

  it("should return level 3 for critical errors", () => {
    const criticalErrors = [
      new Error("frame detached"),
      new Error("session closed"),
      new Error("target closed"),
    ];
    for (const error of criticalErrors) {
      expect(determineRecoveryLevel(error)).toBe(3);
    }
  });

  it("should return level 3 if browser is not available", () => {
    expect(determineRecoveryLevel(new Error("any"), { hasBrowser: false, hasValidPage: false, isBrowserConnected: false, operationCount: 0 })).toBe(3);
  });

  it("should return level 2 if page is not valid", () => {
    expect(
      determineRecoveryLevel(new Error("any"), {
        hasBrowser: true,
        isBrowserConnected: true,
        hasValidPage: false,
        operationCount: 0,
      }),
    ).toBe(2);
  });

  it("should return level 1 for other errors", () => {
    expect(
      determineRecoveryLevel(new Error("any"), {
        hasBrowser: true,
        isBrowserConnected: true,
        hasValidPage: true,
        operationCount: 0,
      }),
    ).toBe(1);
  });
});

describe("analyzeError", () => {
  it("should identify timeout errors", () => {
    const analysis = analyzeError("Operation timed out");
    expect(analysis.isTimeout).toBe(true);
  });

  it("should identify navigation errors", () => {
    const analysis = analyzeError("Navigation failed");
    expect(analysis.isNavigation).toBe(true);
  });

  it("should identify connection errors", () => {
    const analysis = analyzeError("net::ERR_CONNECTION_RESET");
    expect(analysis.isConnection).toBe(true);
  });

  it("should identify detached frame errors", () => {
    const analysis = analyzeError("Frame has been detached");
    expect(analysis.isDetachedFrame).toBe(true);
  });

  it("should identify captcha errors", () => {
    const analysis = analyzeError("Captcha challenge detected");
    expect(analysis.isCaptcha).toBe(true);
  });
});

describe("calculateRetryDelay", () => {
  it("should calculate standard exponential backoff", () => {
    const delay = calculateRetryDelay(2, { isTimeout: false, isNavigation: false, isConnection: false, isDetachedFrame: false, isCaptcha: false, consecutiveTimeouts: 0, consecutiveNavigationErrors: 0 });
    expect(delay).toBeGreaterThanOrEqual(4000);
  });

  it("should apply higher delay for timeout errors", () => {
    const delay = calculateRetryDelay(0, { isTimeout: true, isNavigation: false, isConnection: false, isDetachedFrame: false, isCaptcha: false, consecutiveTimeouts: 0, consecutiveNavigationErrors: 0 });
    expect(delay).toBeGreaterThanOrEqual(5000);
  });

  it("should apply higher delay for navigation errors", () => {
    const delay = calculateRetryDelay(0, { isTimeout: false, isNavigation: true, isConnection: false, isDetachedFrame: false, isCaptcha: false, consecutiveTimeouts: 0, consecutiveNavigationErrors: 0 });
    expect(delay).toBeGreaterThanOrEqual(8000);
  });
});

describe("generateBrowserArgs", () => {
  it("should generate a list of browser arguments", () => {
    const args = generateBrowserArgs("test-user-agent");
    expect(args).toBeInstanceOf(Array);
    expect(args).toContain("--no-sandbox");
    expect(args).toContain("--user-agent=test-user-agent");
  });
});

describe("getSearchInputSelectors", () => {
  it("should return selectors in priority order", () => {
    const selectors = getSearchInputSelectors();
    expect(selectors).toHaveLength(1);
    expect(selectors[0]).toBe('[role="textbox"]');
  });
});

describe("getCaptchaSelectors", () => {
  it("should return a list of captcha selectors", () => {
    const selectors = getCaptchaSelectors();
    expect(selectors).toHaveLength(7);
    expect(selectors).toContain('[class*="captcha"]');
  });
});

describe("validateNavigationUrl", () => {
  it("should return true for valid https URLs", () => {
    expect(validateNavigationUrl("https://example.com")).toBe(true);
  });

  it("should return false for invalid URLs", () => {
    expect(validateNavigationUrl("javascript:alert(1)")).toBe(false);
  });

  it("should return false if domain does not match", () => {
    expect(validateNavigationUrl("https://google.com", "example.com")).toBe(false);
  });
});

describe("isNavigationFailure", () => {
  it("should return true for invalid current URL", () => {
    expect(isNavigationFailure("N/A")).toBe(true);
  });

  it("should return true if hostnames do not match", () => {
    expect(isNavigationFailure("https://google.com", "https://example.com")).toBe(true);
  });

  it("should return false if hostnames match", () => {
    expect(isNavigationFailure("https://example.com/page", "https://example.com")).toBe(false);
  });
});
