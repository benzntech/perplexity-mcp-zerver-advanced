/**
 * Tool arguments and results type definitions
 */

// ─── SEARCH ENGINE INTERFACE ──────────────────────────────────────────
export interface ISearchEngine {
  performSearch(
    query: string,
    options?: { launchOptions?: Record<string, unknown>; allowDangerous?: boolean },
  ): Promise<string>;
}

// ─── TOOL HANDLER TYPES ───────────────────────────────────────────────
export type ToolHandler = (args: Record<string, unknown>) => Promise<string>;

export interface ToolHandlersRegistry {
  test_tool?: ToolHandler;
  existing_tool?: ToolHandler;
  failing_tool?: ToolHandler;
  timeout_tool?: ToolHandler;
  chat_perplexity?: ToolHandler;
  get_documentation?: ToolHandler;
  find_apis?: ToolHandler;
  check_deprecated_code?: ToolHandler;
  search?: ToolHandler;
  extract_url_content?: ToolHandler;
  // Allow additional tools via index signature
  [key: string]: ToolHandler | undefined;
}

// ─── TOOL ARGUMENT TYPES ──────────────────────────────────────────────
export interface BaseToolArgs {
  launchOptions?: Record<string, unknown>;
  allowDangerous?: boolean;
}

export interface ChatPerplexityArgs extends BaseToolArgs {
  message: string;
  chat_id?: string;
}

export interface ExtractUrlContentArgs extends BaseToolArgs {
  url: string;
  depth?: number;
}

export interface GetDocumentationArgs extends BaseToolArgs {
  query: string;
  context?: string;
}

export interface FindApisArgs extends BaseToolArgs {
  requirement: string;
  context?: string;
}

export interface CheckDeprecatedCodeArgs extends BaseToolArgs {
  code: string;
  technology?: string;
}

export interface SearchArgs extends BaseToolArgs {
  query: string;
  detail_level?: "brief" | "normal" | "detailed";
}

// ─── UNION TYPES ──────────────────────────────────────────────────────
export type ToolArgs =
  | ChatPerplexityArgs
  | ExtractUrlContentArgs
  | GetDocumentationArgs
  | FindApisArgs
  | CheckDeprecatedCodeArgs
  | SearchArgs;
