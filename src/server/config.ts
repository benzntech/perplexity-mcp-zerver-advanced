export const CONFIG = {
  SEARCH_COOLDOWN: 5000, // Restored from backup.ts for better Cloudflare handling
  PAGE_TIMEOUT: 180000, // Restored from backup.ts (3 minutes) for Cloudflare challenges
  SELECTOR_TIMEOUT: 90000, // Restored from backup.ts (1.5 minutes) for slow loading
  SELECTOR_TIMEOUT_NORMAL: 30000, // Smart timeout: 30s for normal page loads
  SELECTOR_TIMEOUT_EXTENDED: 90000, // Smart timeout: 90s fallback for slow/blocked pages
  MAX_RETRIES: 10, // Restored from backup.ts for better resilience
  MCP_TIMEOUT_BUFFER: 60000, // Restored from backup.ts
  ANSWER_WAIT_TIMEOUT: 120000, // Restored from backup.ts (2 minutes)
  ANSWER_WAIT_TIMEOUT_NORMAL: 60000, // Smart timeout: 60s default with early exit
  ANSWER_WAIT_TIMEOUT_EXTENDED: 120000, // Smart timeout: 120s for retries
  RECOVERY_WAIT_TIME: 15000, // Restored from backup.ts
  USER_AGENT:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  SESSION_STORAGE_DIR: "./session-storage", // Directory for persistent session cookies
  SESSION_EXPIRY_HOURS: 24, // Session validity period in hours
  TIMEOUT_PROFILES: {
    navigation: 45000, // Restored from backup.ts for Cloudflare navigation
    selector: 15000, // Restored from backup.ts
    content: 120000, // Restored from backup.ts (2 minutes)
    recovery: 30000, // Restored from backup.ts
  },
  DEBUG: {
    CAPTURE_SCREENSHOTS: true, // Enable/disable debug screenshots
    MAX_SCREENSHOTS: 5, // Maximum number of screenshots to keep
    SCREENSHOT_ON_RECOVERY_SUCCESS: false, // Don't screenshot successful recoveries
  },
} as const;
