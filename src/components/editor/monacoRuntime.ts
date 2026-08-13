import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor/esm/vs/editor/editor.api.js";
import EditorWorker from "monaco-editor/esm/vs/editor/editor.worker?worker";
import TypeScriptWorker from "monaco-editor/esm/vs/language/typescript/ts.worker?worker";
import "monaco-editor/esm/vs/basic-languages/javascript/javascript.contribution";
import "monaco-editor/esm/vs/basic-languages/typescript/typescript.contribution";
import "monaco-editor/esm/vs/language/typescript/monaco.contribution";

interface MonacoWorkerEnvironment {
  getWorker: (_moduleId: string, label: string) => Worker;
}

(globalThis as typeof globalThis & { MonacoEnvironment?: MonacoWorkerEnvironment }).MonacoEnvironment = {
  getWorker: (_moduleId, label) => {
    if (label === "typescript" || label === "javascript") return new TypeScriptWorker();
    return new EditorWorker();
  },
};

loader.config({ monaco });

export { monaco };
