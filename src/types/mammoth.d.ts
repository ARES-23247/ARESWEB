declare module 'mammoth' {
  export interface Options {
    arrayBuffer: ArrayBuffer;
  }

  export interface ConversionResult {
    value: string;
    messages: { type: string; message: string; [key: string]: unknown }[];
  }

  export function convertToHtml(
    input: { arrayBuffer: ArrayBuffer } | { path: string },
    options?: {
      convertImage?: unknown;
      styleMap?: string | string[];
      includeDefaultStyleMap?: boolean;
      [key: string]: unknown;
    }
  ): Promise<ConversionResult>;
}
