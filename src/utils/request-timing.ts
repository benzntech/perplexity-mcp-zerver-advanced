/**
 * Request Timing Module - PHASE 2 Enhancement
 * 
 * Implements request timing randomization to avoid timing-based detection
 * Techniques:
 * - Random inter-request delays (human-like behavior)
 * - Adaptive delays based on previous response timing
 * - Request header variation
 * - Network behavior simulation
 */

import { logInfo } from "./logging.js";

/**
 * Request timing statistics for adaptive delays
 */
interface RequestStats {
  totalRequests: number;
  averageResponseTime: number;
  lastRequestTime: number;
  minDelay: number;
  maxDelay: number;
}

/**
 * Initialize request timing statistics
 */
export function initializeRequestStats(): RequestStats {
  return {
    totalRequests: 0,
    averageResponseTime: 0,
    lastRequestTime: Date.now(),
    minDelay: 100,
    maxDelay: 2500,
  };
}

/**
 * Calculate adaptive delay based on request patterns
 * Simulates human-like behavior with variable timing
 */
export function calculateAdaptiveDelay(stats: RequestStats): number {
  // If this is the first request, use minimum delay
  if (stats.totalRequests === 0) {
    return 100 + Math.random() * 200; // 100-300ms
  }

  // Base delay increases with number of requests (humans get tired)
  const requestFatigueFactor = Math.min(stats.totalRequests * 50, 500);

  // Adaptive based on previous response time
  let baseDelay: number;
  if (stats.averageResponseTime < 500) {
    baseDelay = 200; // Quick responses get quicker follow-ups
  } else if (stats.averageResponseTime < 2000) {
    baseDelay = 500; // Medium responses get medium delays
  } else {
    baseDelay = 1000; // Slow responses get longer delays (user reading)
  }

  // Add randomness (50% to 150% of base delay)
  const randomFactor = 0.5 + Math.random();
  const delay = (baseDelay + requestFatigueFactor) * randomFactor;

  return Math.max(stats.minDelay, Math.min(stats.maxDelay, delay));
}

/**
 * Update request statistics after a request completes
 */
export function updateRequestStats(stats: RequestStats, responseDuration: number): void {
  stats.totalRequests++;
  stats.lastRequestTime = Date.now();

  // Update rolling average of response time
  stats.averageResponseTime =
    (stats.averageResponseTime * (stats.totalRequests - 1) + responseDuration) / stats.totalRequests;

  logInfo("Request statistics updated", {
    totalRequests: stats.totalRequests,
    averageResponseTime: Math.round(stats.averageResponseTime),
    lastDuration: responseDuration,
  });
}

/**
 * Generate random HTTP headers to vary request fingerprint
 * Prevents pattern detection from repeated identical headers
 */
export function generateRandomHeaders(): Record<string, string> {
  // Realistic Accept-Encoding variations
  const acceptEncodings = [
    "gzip, deflate, br",
    "gzip, deflate",
    "gzip",
    "br, gzip, deflate",
    "gzip, deflate, br, compress",
  ];

  // Realistic Accept-Language combinations
  const acceptLanguages = [
    "en-US,en;q=0.9",
    "en-US,en;q=0.8",
    "en-US,en;q=0.9,en;q=0.8",
    "en;q=0.9,en-US;q=0.8",
  ];

  // Realistic Cache-Control values
  const cacheControlValues = [
    "max-age=0",
    "no-cache",
    "max-age=0, no-cache, no-store",
  ];

  const encoding = acceptEncodings[Math.floor(Math.random() * acceptEncodings.length)];
  const language = acceptLanguages[Math.floor(Math.random() * acceptLanguages.length)];
  const cacheControl = cacheControlValues[Math.floor(Math.random() * cacheControlValues.length)];

  return {
    "Accept-Encoding": encoding || "gzip, deflate, br",
    "Accept-Language": language || "en-US,en;q=0.9",
    "Cache-Control": cacheControl || "max-age=0",
    "Pragma": "no-cache",
    "Sec-Fetch-Dest": "document",
    "Sec-Fetch-Mode": "navigate",
    "Sec-Fetch-Site": "none",
    "Upgrade-Insecure-Requests": "1",
  };
}

/**
 * Simulate human thinking time
 * Used to add delays between page navigation and interaction
 */
export function getHumanThinkingTime(): number {
  // Humans typically take 500ms to 3 seconds to read and decide
  return 500 + Math.random() * 2500;
}

/**
 * Generate request identifier pattern that varies
 * Prevents Cloudflare from recognizing repeated request patterns
 */
export function generateRequestVariation(): {
  jitter: number;
  delay: number;
  headerVariation: Record<string, string>;
} {
  return {
    jitter: Math.random() * 100, // 0-100ms jitter
    delay: 50 + Math.random() * 300, // 50-350ms variation
    headerVariation: generateRandomHeaders(),
  };
}

/**
 * Calculate exponential backoff for retries
 * More human-like than linear backoff
 */
export function calculateExponentialBackoff(attemptNumber: number): number {
  const baseDelay = 1000; // 1 second base
  const exponentialDelay = baseDelay * Math.pow(2, attemptNumber - 1);
  const maxDelay = 30000; // 30 second max
  const randomJitter = Math.random() * 1000;

  return Math.min(exponentialDelay + randomJitter, maxDelay);
}

/**
 * Create a network behavior profile
 * Used to maintain consistency in request patterns within a session
 */
export interface NetworkBehaviorProfile {
  minRequestDelay: number;
  maxRequestDelay: number;
  requestVariability: number; // 0-1, how much to vary requests
  responseTimeMultiplier: number; // 0.8-1.2, how fast to process
  readingPaceMultiplier: number; // 0.8-1.2, how fast to interact
}

/**
 * Generate random network behavior profile for the session
 * Ensures consistent but varied behavior within a session
 */
export function generateNetworkProfile(): NetworkBehaviorProfile {
  return {
    minRequestDelay: 100 + Math.random() * 300,
    maxRequestDelay: 1500 + Math.random() * 1500,
    requestVariability: 0.3 + Math.random() * 0.4,
    responseTimeMultiplier: 0.8 + Math.random() * 0.4,
    readingPaceMultiplier: 0.7 + Math.random() * 0.6,
  };
}

/**
 * Apply network behavior profile to delay calculation
 */
export function applyBehaviorProfile(
  profile: NetworkBehaviorProfile,
  baseDelay: number,
): number {
  const variationAmount = baseDelay * profile.requestVariability;
  const variance = -variationAmount + Math.random() * variationAmount * 2;
  const adjustedDelay = baseDelay + variance;

  return Math.max(
    profile.minRequestDelay,
    Math.min(profile.maxRequestDelay, adjustedDelay * profile.responseTimeMultiplier),
  );
}

/**
 * Delay execution for specified milliseconds
 * Used throughout the application for request timing
 */
export async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.round(ms)));
}

export type { RequestStats };
