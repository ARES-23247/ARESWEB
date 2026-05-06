export type MessageContent = string | Array<{
  type: "text" | "image";
  text?: string;
  source?: {
    type: "base64";
    media_type: string;
    data: string;
  };
}>;

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: MessageContent;
}

// Type guard for text content parts in MessageContent arrays
export function isTextContentPart(part: {
  type: string;
  text?: string;
  source?: unknown;
}): part is { type: "text"; text: string } {
  return part.type === "text" && typeof part.text === "string";
}

export interface ZaiChatResponse {
  choices?: Array<{
    delta?: {
      content?: string;
    };
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
}

