/**
 * BrowserManager - Handles all Puppeteer browser operations
 * Focused, testable module for browser automation
 */
import type { Browser, Page, LaunchOptions } from "puppeteer";
import puppeteer from "puppeteer";
import type { IBrowserManager, PuppeteerContext } from "../../types/index.js";
import { logError, logInfo, logWarn } from "../../utils/logging.js";
import {
  checkForCaptcha,
  navigateToPerplexity,
  recoveryProcedure,
  resetIdleTimeout,
  waitForSearchInput,
} from "../../utils/puppeteer.js";

// Deep merge utility function
function deepMerge(target: any, source: any): any {
  const output = Object.assign({}, target);
  if (typeof target !== 'object' || typeof source !== 'object') return source;

  for (const key of Object.keys(source)) {
    const targetVal = target[key];
    const sourceVal = source[key];
    if (Array.isArray(targetVal) && Array.isArray(sourceVal)) {
      // Deduplicate args/ignoreDefaultArgs, prefer source values
      output[key] = [...new Set([
        ...(key === 'args' || key === 'ignoreDefaultArgs' ?
          targetVal.filter((arg: string) => {
            if (typeof arg !== 'string') return true;
            const argPrefix = arg.includes('=') ? arg.split('=')[0]! : arg;
            return !sourceVal.some((launchArg: string) =>
              typeof launchArg === 'string' &&
              arg.startsWith('--') &&
              launchArg.startsWith(argPrefix as string)
            );
          }) :
          targetVal),
        ...sourceVal
      ])];
    } else if (sourceVal instanceof Object && key in target) {
      output[key] = deepMerge(targetVal, sourceVal);
    } else {
      output[key] = sourceVal;
    }
  }
  return output;
}

const DANGEROUS_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--single-process',
  '--disable-web-security',
  '--ignore-certificate-errors',
  '--disable-features=IsolateOrigins',
  '--disable-site-isolation-trials',
  '--allow-running-insecure-content'
];

export class BrowserManager implements IBrowserManager {
  private browser: Browser | null = null;
  private page: Page | null = null;
  private isInitializing = false;
  private searchInputSelector = 'textarea[placeholder*="Ask"]';
  private readonly lastSearchTime = 0;
  private idleTimeout: NodeJS.Timeout | null = null;
  private operationCount = 0;
  private readonly IDLE_TIMEOUT_MS = 5 * 60 * 1000;
  private previousLaunchOptions: LaunchOptions | null = null;
  private launchOptions: LaunchOptions = {};
  private allowDangerous = false;

  private getPuppeteerContext(): PuppeteerContext {
    return {
      browser: this.browser,
      page: this.page,
      isInitializing: this.isInitializing,
      searchInputSelector: this.searchInputSelector,
      lastSearchTime: this.lastSearchTime,
      idleTimeout: this.idleTimeout,
      operationCount: this.operationCount,
      log: this.log.bind(this),
      setBrowser: (browser) => {
        this.browser = browser;
      },
      setPage: (page) => {
        this.page = page;
      },
      setIsInitializing: (val) => {
        this.isInitializing = val;
      },
      setSearchInputSelector: (selector) => {
        this.searchInputSelector = selector;
      },
      setIdleTimeout: (timeout) => {
        this.idleTimeout = timeout;
      },
      incrementOperationCount: () => ++this.operationCount,
      determineRecoveryLevel: this.determineRecoveryLevel.bind(this),
      IDLE_TIMEOUT_MS: this.IDLE_TIMEOUT_MS,
    };
  }

  private log(level: "info" | "error" | "warn", message: string) {
    switch (level) {
      case "info":
        logInfo(message);
        break;
      case "warn":
        logWarn(message);
        break;
      case "error":
        logError(message);
        break;
      default:
        logInfo(message);
    }
  }

  private determineRecoveryLevel(error?: Error): number {
    if (!error) return 1;

    const errorMessage = error.message.toLowerCase();

    // Level 3: Critical errors requiring full browser restart
    if (
      errorMessage.includes("detached") ||
      errorMessage.includes("crashed") ||
      errorMessage.includes("disconnected") ||
      errorMessage.includes("protocol error")
    ) {
      return 3;
    }

    // Level 2: Navigation/page errors requiring page restart
    if (
      errorMessage.includes("navigation") ||
      errorMessage.includes("timeout") ||
      errorMessage.includes("net::err")
    ) {
      return 2;
    }

    // Level 1: Minor errors requiring simple recovery
    return 1;
  }

  private async ensureBrowser(options: { launchOptions?: LaunchOptions, allowDangerous?: boolean } = {}): Promise<void> {
    // Parse environment config safely
    let envConfig = {};
    try {
      envConfig = JSON.parse(process.env['PUPPETEER_LAUNCH_OPTIONS'] || '{}');
    } catch (error: any) {
      logWarn('Failed to parse PUPPETEER_LAUNCH_OPTIONS:', error?.message || error);
    }

    // Update instance configuration
    this.launchOptions = deepMerge(this.launchOptions, options.launchOptions || {});
    this.allowDangerous = options.allowDangerous || false;

    // Deep merge environment config with instance options
    const mergedConfig = deepMerge(envConfig, this.launchOptions);

    // When running as root, --no-sandbox is required.
    if (process.getuid && process.getuid() === 0) {
      if (!mergedConfig.args) {
        mergedConfig.args = [];
      }
      if (!mergedConfig.args.includes('--no-sandbox')) {
        mergedConfig.args.push('--no-sandbox');
      }
    }

    // Security validation
    if (mergedConfig?.args) {
      const dangerousArgs = mergedConfig.args.filter?.((arg: string) =>
        DANGEROUS_ARGS.some(dangerousArg => arg.startsWith(dangerousArg)));
      
      if (dangerousArgs?.length > 0 && !(this.allowDangerous || (process.env['ALLOW_DANGEROUS'] === 'true'))) {
        throw new Error(`Dangerous browser arguments detected: ${dangerousArgs.join(', ')}. ` +
          'Set allowDangerous: true to override.');
      }
    }

    try {
      if ((this.browser && !this.browser.connected) ||
          (this.launchOptions && (JSON.stringify(this.launchOptions) !== JSON.stringify(this.previousLaunchOptions)))) {
        await this.browser?.close();
        this.browser = null;
        this.page = null;
      }
    } catch (error) {
      this.browser = null;
      this.page = null;
    }

    this.previousLaunchOptions = this.launchOptions;

    if (!this.browser) {
      const launchArgs = {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
        ],
      };
      
      this.browser = await puppeteer.launch(deepMerge(
        launchArgs,
        mergedConfig
      ));
      
      const pages = await this.browser.pages();
      this.page = pages[0] || await this.browser.newPage();
      
      if (this.page) {
        this.page.on("console", (msg) => {
          const logEntry = `[${msg.type()}] ${msg.text()}`;
          logInfo(logEntry);
        });
      }
    }
  }

  async initialize(options: { launchOptions?: LaunchOptions, allowDangerous?: boolean } = {}): Promise<void> {
    if (this.isInitializing) {
      logInfo("Browser initialization already in progress...");
      return;
    }

    this.isInitializing = true;
    try {
      await this.ensureBrowser(options);
      logInfo("BrowserManager initialized successfully");
    } catch (error) {
      logError("BrowserManager initialization failed:", {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      this.isInitializing = false;
    }
  }

  async navigateToPerplexity(): Promise<void> {
    const ctx = this.getPuppeteerContext();
    await navigateToPerplexity(ctx);
  }

  async waitForSearchInput(): Promise<string | null> {
    const ctx = this.getPuppeteerContext();
    const selector = await waitForSearchInput(ctx);
    return selector;
  }

  async checkForCaptcha(): Promise<boolean> {
    const ctx = this.getPuppeteerContext();
    return await checkForCaptcha(ctx);
  }

  async performRecovery(error?: Error): Promise<void> {
    const ctx = this.getPuppeteerContext();
    await recoveryProcedure(ctx, error);
  }

  isReady(): boolean {
    return !!(this.browser && this.page && !this.page.isClosed() && !this.isInitializing);
  }

  async cleanup(): Promise<void> {
    try {
      if (this.idleTimeout) {
        clearTimeout(this.idleTimeout);
        this.idleTimeout = null;
      }

      if (this.page && !this.page.isClosed()) {
        await this.page.close();
      }

      if (this.browser?.isConnected()) {
        await this.browser.close();
      }

      this.page = null;
      this.browser = null;
      this.isInitializing = false;
      this.previousLaunchOptions = null;

      logInfo("BrowserManager cleanup completed");
    } catch (error) {
      logError("Error during BrowserManager cleanup:", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  getPage(): Page | null {
    return this.page;
  }

  getBrowser(): Browser | null {
    return this.browser;
  }

  resetIdleTimeout(): void {
    const ctx = this.getPuppeteerContext();
    resetIdleTimeout(ctx);
  }
}
