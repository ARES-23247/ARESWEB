import { TiptapTransformer } from "@hocuspocus/transformer";
import * as Y from "yjs";

export function extractTiptapAstFromYjs(yDocBinary: Uint8Array, fieldName: string = "default"): Record<string, unknown> {
  const ydoc = new Y.Doc();
  Y.applyUpdate(ydoc, yDocBinary);
  const transformer = TiptapTransformer.fromYdoc(ydoc, fieldName);
  return transformer.default as Record<string, unknown>;
}

export function extractTiptapHtmlFromYjs(yDocBinary: Uint8Array, fieldName: string = "default"): string {
  const ast = extractTiptapAstFromYjs(yDocBinary, fieldName);
  return JSON.stringify(ast);
}
