import { loader } from "@monaco-editor/react";
import * as monaco from "monaco-editor/editor";
import EditorWorker from "monaco-editor/editor/editor.worker?worker";
import TypeScriptWorker from "monaco-editor/languages/features/typescript/ts.worker?worker";
import "monaco-editor/languages/definitions/javascript/register";
import "monaco-editor/languages/definitions/typescript/register";
import * as typescriptLanguage from "monaco-editor/languages/features/typescript/register";

interface MonacoWorkerEnvironment {
  getWorker: (_moduleId: string, label: string) => Worker;
}

(
  globalThis as typeof globalThis & {
    MonacoEnvironment?: MonacoWorkerEnvironment;
  }
).MonacoEnvironment = {
  getWorker: (_moduleId, label) => {
    if (label === "typescript" || label === "javascript")
      return new TypeScriptWorker();
    return new EditorWorker();
  },
};

// The tree-shakeable editor API does not attach the TypeScript contribution to
// `languages` on its own. @monaco-editor/react and useMonacoEditor expect the
// standard Monaco namespace shape, so attach the locally bundled contribution
// before configuring the loader.
Object.assign(monaco.languages, { typescript: typescriptLanguage });

loader.config({ monaco });

export { monaco };
