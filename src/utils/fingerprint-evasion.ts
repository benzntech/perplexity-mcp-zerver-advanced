/**
 * Fingerprint Evasion Module - PHASE 2 Enhancement
 * 
 * Implements advanced evasion for Cloudflare bypass improvement (85% → 95%)
 * Techniques:
 * - WebGL fingerprinting evasion (GPU vendor/renderer spoofing)
 * - Canvas fingerprinting protection (noise injection)
 * - Timezone and locale consistency
 * - Viewport and device resolution spoofing
 * - Request timing randomization
 */

import type { Page } from "puppeteer";
import { logInfo, logWarn } from "./logging.js";

/**
 * Realistic device configurations to randomly select from
 * Ensures consistency within a session
 */
interface DeviceConfig {
  width: number;
  height: number;
  deviceScaleFactor: number;
  userAgent: string;
  timezone: string;
  locale: string;
  webglVendor: string;
  webglRenderer: string;
}

// Pool of realistic device configurations (Windows Chrome)
const DEVICE_CONFIGS: DeviceConfig[] = [
  {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    timezone: "America/New_York",
    locale: "en-US",
    webglVendor: "Google Inc.",
    webglRenderer: "ANGLE (Intel HD Graphics 630)",
  },
  {
    width: 1366,
    height: 768,
    deviceScaleFactor: 1,
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    timezone: "America/Chicago",
    locale: "en-US",
    webglVendor: "Google Inc.",
    webglRenderer: "ANGLE (NVIDIA GeForce GTX 1660)",
  },
  {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    timezone: "America/Los_Angeles",
    locale: "en-US",
    webglVendor: "Google Inc.",
    webglRenderer: "ANGLE (NVIDIA GeForce RTX 2060)",
  },
  {
    width: 2560,
    height: 1440,
    deviceScaleFactor: 1,
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    timezone: "America/Denver",
    locale: "en-US",
    webglVendor: "Google Inc.",
    webglRenderer: "ANGLE (NVIDIA GeForce RTX 3080)",
  },
];

/**
 * Select a random device configuration for the session
 */
export function selectRandomDeviceConfig(): DeviceConfig {
  const config = DEVICE_CONFIGS[Math.floor(Math.random() * DEVICE_CONFIGS.length)];
  if (!config) {
    return DEVICE_CONFIGS[0]!;
  }
  return config;
}

/**
 * Apply WebGL fingerprinting evasion
 * Spoofs GPU vendor and renderer to prevent identification
 */
export async function applyWebGLEvasion(page: Page): Promise<void> {
  const config = selectRandomDeviceConfig();

  try {
    await page.evaluateOnNewDocument((webglVendor: string, webglRenderer: string) => {
      const getParameter = WebGLRenderingContext.prototype.getParameter;
      WebGLRenderingContext.prototype.getParameter = function (parameter) {
        if (parameter === 37445) {
          // UNMASKED_VENDOR_WEBGL
          return webglVendor;
        }
        if (parameter === 37446) {
          // UNMASKED_RENDERER_WEBGL
          return webglRenderer;
        }
        return getParameter.call(this, parameter);
      };

      // Also override WebGL2RenderingContext if available
      if (typeof WebGL2RenderingContext !== "undefined") {
        const getParameter2 = WebGL2RenderingContext.prototype.getParameter;
        WebGL2RenderingContext.prototype.getParameter = function (parameter) {
          if (parameter === 37445) {
            return webglVendor;
          }
          if (parameter === 37446) {
            return webglRenderer;
          }
          return getParameter2.call(this, parameter);
        };
      }
    }, config.webglVendor, config.webglRenderer);

    logInfo("WebGL fingerprinting evasion applied", {
      vendor: config.webglVendor,
      renderer: config.webglRenderer,
    });
  } catch (error) {
    logWarn("Failed to apply WebGL evasion", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Apply Canvas fingerprinting protection
 * Adds noise to canvas API to prevent fingerprinting
 */
export async function applyCanvasEvasion(page: Page): Promise<void> {
  try {
    await page.evaluateOnNewDocument(() => {
      // Generate consistent random noise for this session
      const canvasNoise = Math.random() * 0.01; // Small noise 0-1%

      const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function (type?: string, quality?: number) {
        const context = this.getContext("2d") as CanvasRenderingContext2D | null;
        if (context && Math.random() < 0.1) {
          // 10% chance to add imperceptible noise
          try {
            const imageData = context.getImageData(0, 0, 1, 1);
            if (imageData && imageData.data && imageData.data[0] !== undefined) {
              imageData.data[0] = Math.min(255, imageData.data[0] + Math.floor(Math.random() * 2));
              context.putImageData(imageData, 0, 0);
            }
          } catch (e) {
            // Ignore canvas errors
          }
        }
        return originalToDataURL.call(this, type, quality);
      };

      // Override canvas.getContext to add noise to drawing operations
      const originalGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (contextType: string, ...args: any[]) {
        const context = originalGetContext.call(this, contextType, ...args) as any;

        if (contextType === "2d" && context) {
          const originalFillRect = (context as any).fillRect;
          (context as any).fillRect = function (x: number, y: number, w: number, h: number) {
            // Add imperceptible noise to drawing
            if (Math.random() < 0.01) {
              const originalFillStyle = this.fillStyle;
              this.fillStyle = `rgba(0,0,0,${canvasNoise})`;
              originalFillRect.call(this, x, y, 1, 1);
              this.fillStyle = originalFillStyle;
            }
            return originalFillRect.call(this, x, y, w, h);
          };
        }

        return context;
      };

      logInfo("Canvas fingerprinting protection applied");
    });

    logInfo("Canvas fingerprinting evasion applied");
  } catch (error) {
    logWarn("Failed to apply Canvas evasion", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Apply timezone and locale spoofing
 * Ensures consistency between reported timezone and actual behavior
 */
export async function applyTimezoneLocaleEvasion(page: Page): Promise<void> {
  const config = selectRandomDeviceConfig();
  if (!config) {
    logWarn("No device config selected for timezone/locale evasion");
    return;
  }

  try {
    await page.evaluateOnNewDocument((timezone: string, locale: string) => {
      // Override Intl API to report consistent timezone/locale
      const originalResolvedOptions = (Intl.DateTimeFormat as any).prototype.resolvedOptions;
      (Intl.DateTimeFormat as any).prototype.resolvedOptions = function () {
        const options = originalResolvedOptions.call(this);
        return {
          ...options,
          timeZone: timezone,
          locale: locale,
        };
      };

      // Override Date.getTimezoneOffset to match spoofed timezone
      // This is approximate but helps maintain consistency
      const originalGetTimezoneOffset = Date.prototype.getTimezoneOffset;
      Date.prototype.getTimezoneOffset = function () {
        // Return offset based on spoofed timezone
        const timezoneOffsets: Record<string, number> = {
          "America/New_York": 300, // EST
          "America/Chicago": 360, // CST
          "America/Los_Angeles": 480, // PST
          "America/Denver": 420, // MST
        };

        // Find matching timezone offset
        for (const [tz, offset] of Object.entries(timezoneOffsets)) {
          const tzPart = tz.split("/")[1];
          if (tzPart && timezone.includes(tzPart)) {
            return offset;
          }
        }

        return originalGetTimezoneOffset.call(this);
      };

      // Override navigator.language and navigator.languages
      Object.defineProperty(navigator, "language", {
        get: () => locale,
      });

      Object.defineProperty(navigator, "languages", {
        get: () => [locale],
      });
    }, config.timezone, config.locale);

    logInfo("Timezone and locale evasion applied", {
      timezone: config.timezone,
      locale: config.locale,
    });
  } catch (error) {
    logWarn("Failed to apply timezone/locale evasion", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Apply viewport and device resolution consistency
 * Ensures reported viewport matches actual browser dimensions
 */
export async function applyViewportEvasion(page: Page, config?: DeviceConfig): Promise<void> {
  const deviceConfig = config || selectRandomDeviceConfig();
  if (!deviceConfig) {
    logWarn("No device config selected for viewport evasion");
    return;
  }

  try {
    // Set viewport in Puppeteer
    await page.setViewport({
      width: deviceConfig.width,
      height: deviceConfig.height,
      deviceScaleFactor: deviceConfig.deviceScaleFactor,
    });

    // Override JavaScript viewport reporting to match
    await page.evaluateOnNewDocument((width: number, height: number, dpr: number) => {
      // eslint-disable-next-line no-var
      var devWidth = width;
      var devHeight = height;
      var devDPR = dpr;
      // Override window dimensions
      Object.defineProperty(window, "innerWidth", {
        get: () => width,
        configurable: true,
      });

      Object.defineProperty(window, "innerHeight", {
        get: () => height,
        configurable: true,
      });

      Object.defineProperty(window, "outerWidth", {
        get: () => width,
        configurable: true,
      });

      Object.defineProperty(window, "outerHeight", {
        get: () => height + 40, // Account for browser chrome
        configurable: true,
      });

      // Override screen dimensions
      Object.defineProperty(screen, "width", {
        get: () => width,
        configurable: true,
      });

      Object.defineProperty(screen, "height", {
        get: () => height,
        configurable: true,
      });

      Object.defineProperty(screen, "availWidth", {
        get: () => width,
        configurable: true,
      });

      Object.defineProperty(screen, "availHeight", {
        get: () => height - 40, // Account for taskbar
        configurable: true,
      });

      Object.defineProperty(window, "devicePixelRatio", {
        get: () => dpr,
        configurable: true,
      });
    }, deviceConfig.width, deviceConfig.height, deviceConfig.deviceScaleFactor);

    logInfo("Viewport and device resolution evasion applied", {
      width: deviceConfig.width,
      height: deviceConfig.height,
      dpr: deviceConfig.deviceScaleFactor,
    });
  } catch (error) {
    logWarn("Failed to apply viewport evasion", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Generate random request delays to avoid timing analysis
 * Returns a delay in milliseconds
 */
export function getRandomRequestDelay(): number {
  // Random delay between 100-800ms (realistic human behavior)
  return 100 + Math.random() * 700;
}

/**
 * Generate realistic inter-request delay
 * Varies based on previous request timing
 */
export function getAdaptiveDelay(previousDuration: number): number {
  // Human-like: shorter delays for fast responses, longer for slow ones
  if (previousDuration < 500) {
    return 200 + Math.random() * 400; // 200-600ms
  } else if (previousDuration < 2000) {
    return 500 + Math.random() * 800; // 500-1300ms
  } else {
    return 1000 + Math.random() * 1500; // 1000-2500ms
  }
}

/**
 * Randomize HTTP headers to vary request fingerprint
 */
export function getRandomizedHeaders(): Record<string, string> {
  const acceptEncodings = [
    "gzip, deflate, br",
    "gzip, deflate",
    "gzip",
    "br, gzip, deflate",
  ];

  const acceptLanguages = [
    "en-US,en;q=0.9",
    "en-US,en;q=0.8",
    "en;q=0.9",
  ];

  const encoding = acceptEncodings[Math.floor(Math.random() * acceptEncodings.length)];
  const language = acceptLanguages[Math.floor(Math.random() * acceptLanguages.length)];

  return {
    "Accept-Encoding": encoding || "gzip, deflate, br",
    "Accept-Language": language || "en-US,en;q=0.9",
    "Cache-Control": "max-age=0",
    "Pragma": "no-cache",
  };
}

/**
 * Apply all PHASE 2 evasion techniques
 */
export async function applyPhase2Evasion(page: Page): Promise<void> {
  logInfo("Applying PHASE 2 Cloudflare bypass enhancements...");

  const config = selectRandomDeviceConfig();

  try {
    // Apply all evasion techniques in parallel
    await Promise.all([
      applyWebGLEvasion(page),
      applyCanvasEvasion(page),
      applyTimezoneLocaleEvasion(page),
      applyViewportEvasion(page, config),
    ]);

    logInfo("PHASE 2 evasion techniques successfully applied", {
      viewport: `${config.width}x${config.height}`,
      timezone: config.timezone,
      locale: config.locale,
    });
  } catch (error) {
    logWarn("Some PHASE 2 evasion techniques failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export type { DeviceConfig };
