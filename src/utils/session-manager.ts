/**
 * Session Manager - Handles persistent browser session storage
 * Saves and restores cookies to improve Cloudflare bypass success rate
 */

import { promises as fs } from "fs";
import { join } from "path";
import type { Page, CookieParam } from "puppeteer";
import { logError, logInfo, logWarn } from "./logging.js";
import { CONFIG } from "../server/config.js";

interface StoredSession {
  cookies: CookieParam[];
  localStorage: Record<string, string>;
  timestamp: number;
}

/**
 * Get the session file path for a given session ID
 */
function getSessionPath(sessionId: string): string {
  const dir = CONFIG.SESSION_STORAGE_DIR || "./session-storage";
  return join(dir, `${sessionId}.json`);
}

/**
 * Ensure session storage directory exists
 */
async function ensureSessionDir(): Promise<void> {
  const dir = CONFIG.SESSION_STORAGE_DIR || "./session-storage";
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    logWarn(`Failed to create session directory ${dir}:`, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Save session cookies and localStorage to disk
 * @param page - Puppeteer page instance
 * @param sessionId - Unique session identifier (typically user ID or request ID)
 */
export async function saveSessionCookies(page: Page, sessionId: string): Promise<void> {
  try {
    await ensureSessionDir();

    // Get cookies
    const cookies = await page.cookies();

    // Get localStorage
    const localStorage = await page.evaluate(() => {
      const storage: Record<string, string> = {};
      for (let i = 0; i < window.localStorage.length; i++) {
        const key = window.localStorage.key(i);
        if (key) {
          storage[key] = window.localStorage.getItem(key) || "";
        }
      }
      return storage;
    });

    const session: StoredSession = {
      cookies,
      localStorage,
      timestamp: Date.now(),
    };

    const sessionPath = getSessionPath(sessionId);
    await fs.writeFile(sessionPath, JSON.stringify(session, null, 2));

    logInfo(`Session saved for ${sessionId}`, {
      cookieCount: cookies.length,
      storageKeys: Object.keys(localStorage).length,
    });
  } catch (error) {
    logWarn(`Failed to save session for ${sessionId}:`, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Restore session cookies and localStorage from disk
 * @param page - Puppeteer page instance
 * @param sessionId - Unique session identifier
 * @returns true if session was restored, false if not found or expired
 */
export async function restoreSessionCookies(page: Page, sessionId: string): Promise<boolean> {
  try {
    const sessionPath = getSessionPath(sessionId);

    // Check if session file exists
    try {
      await fs.stat(sessionPath);
    } catch {
      logInfo(`Session file not found for ${sessionId}, starting fresh`);
      return false;
    }

    // Read and parse session file
    const sessionData = await fs.readFile(sessionPath, "utf-8");
    const session: StoredSession = JSON.parse(sessionData);

    // Check if session has expired
    const expiryMs = (CONFIG.SESSION_EXPIRY_HOURS || 24) * 60 * 60 * 1000;
    const age = Date.now() - session.timestamp;

    if (age > expiryMs) {
      logInfo(`Session expired for ${sessionId} (age: ${Math.round(age / 1000)}s)`);
      // Clean up expired session
      await fs.unlink(sessionPath).catch(() => {});
      return false;
    }

    // Restore cookies
    if (session.cookies && session.cookies.length > 0) {
      await page.setCookie(...session.cookies);
      logInfo(`Restored ${session.cookies.length} cookies for ${sessionId}`);
    }

    // Restore localStorage
    if (session.localStorage && Object.keys(session.localStorage).length > 0) {
      await page.evaluateOnNewDocument((storage) => {
        Object.entries(storage).forEach(([key, value]) => {
          try {
            window.localStorage.setItem(key, value);
          } catch (error) {
            console.warn(`Failed to restore localStorage key ${key}:`, error);
          }
        });
      }, session.localStorage);

      logInfo(`Restored ${Object.keys(session.localStorage).length} localStorage items for ${sessionId}`);
    }

    logInfo(`Session restored successfully for ${sessionId} (age: ${Math.round(age / 1000)}s)`);
    return true;
  } catch (error) {
    logWarn(`Failed to restore session for ${sessionId}:`, {
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}

/**
 * Clear expired sessions from storage
 * Runs periodically to clean up old session files
 */
export async function clearExpiredSessions(): Promise<void> {
  try {
    await ensureSessionDir();

    const dir = CONFIG.SESSION_STORAGE_DIR || "./session-storage";
    const files = await fs.readdir(dir);
    const expiryMs = (CONFIG.SESSION_EXPIRY_HOURS || 24) * 60 * 60 * 1000;

    let deletedCount = 0;

    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      const filePath = join(dir, file);
      try {
        const stats = await fs.stat(filePath);
        const age = Date.now() - stats.mtimeMs;

        if (age > expiryMs) {
          await fs.unlink(filePath);
          deletedCount++;
          logInfo(`Deleted expired session: ${file}`);
        }
      } catch (error) {
        logWarn(`Failed to process session file ${file}:`, {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (deletedCount > 0) {
      logInfo(`Cleaned up ${deletedCount} expired session(s)`);
    }
  } catch (error) {
    logWarn("Failed to clear expired sessions:", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

/**
 * Delete a specific session
 * Useful for manual cleanup or when user logs out
 */
export async function deleteSession(sessionId: string): Promise<void> {
  try {
    const sessionPath = getSessionPath(sessionId);
    await fs.unlink(sessionPath);
    logInfo(`Deleted session: ${sessionId}`);
  } catch (error) {
    logWarn(`Failed to delete session ${sessionId}:`, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
