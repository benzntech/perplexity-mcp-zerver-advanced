/**
 * Tool implementation for web search functionality with real streaming support
 */

import type { PuppeteerContext } from "../types/index.js";

/**
 * Handles web search with configurable detail levels and optional streaming
 */
export default async function search(
  args: {
    query: string;
  },
  ctx: PuppeteerContext,
  performSearch: (prompt: string, ctx: PuppeteerContext) => Promise<string>,
): Promise<string> {
  const { query } = args;
  return await performSearch(query, ctx);
}
