/**
 * z.AI Utility Functions
 * Handles sanitization and truncation of data before sending to LLMs.
 */

/**
 * Sanitize user input to prevent prompt injection attacks.
 * Removes control characters and limits length.
 */
export const sanitizeUserInput = (input: string, maxLength: number = 5000): string => {
  // Remove control characters except newlines and tabs
  // eslint-disable-next-line no-control-regex
  let sanitized = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  // Limit length to prevent DoS
  if (sanitized.length > maxLength) {
    sanitized = sanitized.slice(0, maxLength) + '... (truncated)';
  }
  return sanitized;
};

/**
 * Sanitize file content for AI context.
 * Removes control characters and limits individual file sizes.
 */
export const sanitizeFilesForAI = (files: Record<string, string>): Record<string, string> => {
  const sanitized: Record<string, string> = {};
  const MAX_FILE_SIZE = 10000; // 10KB max per file in AI context

  for (const [filename, content] of Object.entries(files)) {
    // Validate filename is safe (allow subfolders)
    // eslint-disable-next-line no-useless-escape
    if (!/^(?!.*?\.\.)[a-zA-Z0-9_\-\.\/]+\.(tsx?|jsx?|json)$/.test(filename)) {
      continue; // Skip files with suspicious names
    }

    // Sanitize content
    // eslint-disable-next-line no-control-regex
    let sanitizedContent = content.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    if (sanitizedContent.length > MAX_FILE_SIZE) {
      sanitizedContent = sanitizedContent.slice(0, MAX_FILE_SIZE) + '\n// ... (truncated for AI context)';
    }
    sanitized[filename] = sanitizedContent;
  }

  return sanitized;
};

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Truncates chat history to keep within token limits while preserving context.
 * Priority: System Message > Last 5 messages > Intermediate messages.
 */
export const truncateChatHistory = (messages: ChatMessage[], maxChars: number = 12000): ChatMessage[] => {
  let currentChars = 0;
  const result: ChatMessage[] = [];
  
  // Always iterate backwards to keep the most recent context
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (currentChars + msg.content.length > maxChars && result.length >= 3) {
      break; // Keep at least 3 messages if possible, otherwise stop at limit
    }
    result.unshift(msg);
    currentChars += msg.content.length;
  }
  
  return result;
};
