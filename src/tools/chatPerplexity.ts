/**
 * Tool implementation for chat functionality with Perplexity
 */

import crypto from "node:crypto";
import type { ChatMessage, PuppeteerContext } from "../types/index.js";

/**
 * Handles chat interactions with conversation history
 */
import type { LaunchOptions } from "puppeteer";

export default async function chatPerplexity(
  args: {
    message: string;
    chat_id?: string;
    launchOptions?: LaunchOptions;
    allowDangerous?: boolean;
  },
  ctx: PuppeteerContext,
  performSearch: (prompt: string, ctx: PuppeteerContext, options?: { launchOptions?: LaunchOptions; allowDangerous?: boolean }) => Promise<string>,
  getChatHistory: (chat_id: string) => ChatMessage[],
  saveChatMessage: (chat_id: string, message: ChatMessage) => void,
): Promise<string> {
  const { message, chat_id = crypto.randomUUID() } = args;
  const history = getChatHistory(chat_id);
  const userMessage: ChatMessage = { role: "user", content: message };
  saveChatMessage(chat_id, userMessage);

  let conversationPrompt = "";
  for (const msg of history) {
    conversationPrompt +=
      msg.role === "user" ? `User: ${msg.content}\n` : `Assistant: ${msg.content}\n`;
  }
  conversationPrompt += `User: ${message}\n`;

  return await performSearch(conversationPrompt, ctx, {
    launchOptions: args.launchOptions,
    allowDangerous: args.allowDangerous
  });
}
