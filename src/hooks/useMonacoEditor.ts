import { useCallback, useEffect, useRef, useState } from 'react';
import type { editor } from 'monaco-editor';
import type { Monaco } from '@monaco-editor/react';
import type { Position } from 'monaco-editor';
import type { languages } from 'monaco-editor';
import type { CancellationToken } from 'monaco-editor';
import { logger } from '../utils/logger';

interface IVimMode {
  dispose(): void;
}

export function useMonacoEditor() {
  const [isVimMode, setIsVimMode] = useState(false);
  const [isWordWrap, setIsWordWrap] = useState(true);
  const [isMinimap, setIsMinimap] = useState(false);

  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  const vimRef = useRef<IVimMode | null>(null);
  const completionProviderRef = useRef<ReturnType<Monaco['languages']['registerInlineCompletionsProvider']> | null>(null);

  const handleEditorDidMount = useCallback(async (
    editor: editor.IStandaloneCodeEditor,
    monaco: Monaco
  ) => {
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      allowNonTsExtensions: true,
      jsx: monaco.languages.typescript.JsxEmit.React,
    });

    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      allowNonTsExtensions: true,
      jsx: monaco.languages.typescript.JsxEmit.React,
      moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
      module: monaco.languages.typescript.ModuleKind.CommonJS,
    });

    try {
      // Load ARESLib types
      const aresRes = await fetch('/types/areslib.d.ts');
      if (aresRes.ok) {
        const aresLibStr = await aresRes.text();
        monaco.languages.typescript.javascriptDefaults.addExtraLib(
          aresLibStr,
          'file:///node_modules/@types/areslib/index.d.ts'
        );
        monaco.languages.typescript.typescriptDefaults.addExtraLib(
          aresLibStr,
          'file:///node_modules/@types/areslib/index.d.ts'
        );
      }

      // Load minimal React types
      const reactLibStr = `declare module "react" {
        export function useState<T>(initialState: T | (() => T)): [T, (newState: T | ((prevState: T) => T)) => void];
        export function useEffect(effect: () => void | (() => void), deps?: unknown[]): void;
        export function useRef<T>(initialValue: T): { current: T };
        export function useCallback<T extends (...args: unknown[]) => unknown>(callback: T, deps: unknown[]): T;
        export function useMemo<T>(factory: () => T, deps: unknown[]): T;
        export function Suspense(props: { children: React.ReactNode; fallback: React.ReactNode }): React.ReactNode;
        export function lazy<T>(factory: () => Promise<{ default: T }>): T;
      }
      declare namespace React {
        export function useState<T>(initialState: T | (() => T)): [T, (newState: T | ((prevState: T) => T)) => void];
        export function useEffect(effect: () => void | (() => void), deps?: unknown[]): void;
        export function useRef<T>(initialValue: T): { current: T };
        export function useCallback<T extends (...args: unknown[]) => unknown>(callback: T, deps: unknown[]): T;
        export function useMemo<T>(factory: () => T, deps: unknown[]): T;
        export function Suspense(props: { children: React.ReactNode; fallback: React.ReactNode }): React.ReactNode;
        export function lazy<T>(factory: () => Promise<{ default: T }>): T;
      }`;
      
      monaco.languages.typescript.javascriptDefaults.addExtraLib(
        reactLibStr,
        'file:///node_modules/@types/react/index.d.ts'
      );
      monaco.languages.typescript.typescriptDefaults.addExtraLib(
        reactLibStr,
        'file:///node_modules/@types/react/index.d.ts'
      );

    } catch (e) {
      logger.error('[SimPlayground] Failed to load intellisense types:', e);
    }

    editorRef.current = editor;
    monacoRef.current = monaco;

    // Clean up previous completion provider if it exists
    if (completionProviderRef.current) {
      completionProviderRef.current.dispose();
      completionProviderRef.current = null;
    }

    // Ghost text provider
    completionProviderRef.current = monaco.languages.registerInlineCompletionsProvider('javascript', {
      provideInlineCompletions: async (
        model: editor.ITextModel,
        position: Position,
        context: languages.InlineCompletionContext,
        _token: CancellationToken
      ): Promise<languages.InlineCompletions<languages.InlineCompletion>> => {
        if (context.triggerKind !== monaco.languages.InlineCompletionTriggerKind.Explicit) {
          return { items: [] };
        }

        const code = model.getValue();
        const offset = model.getOffsetAt(position);

        try {
          const res = await fetch('/api/ai/sim-playground', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              systemPrompt: 'You are an inline code completion engine. Only output the code that follows the cursor. DO NOT include markdown blocks. Only return the direct text to insert.',
              messages: [
                { role: 'user', content: `Code so far:\n${code.slice(0, offset)}\n\nComplete the next lines:` }
              ]
            }),
          });

          if (!res.ok) return { items: [] };
          let text = '';
          const reader = res.body?.getReader();
          if (reader) {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const chunk = new TextDecoder().decode(value);
              const lines = chunk.split('\\n');
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try { text += JSON.parse(line.slice(6)).chunk; } catch { /* ignore */ }
                }
              }
            }
          }

          return {
            items: [{
              insertText: text.replace(/^```[a-z]*\\n/, '').replace(/\\n```$/, ''),
              range: new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column)
            }]
          };
        } catch {
          return { items: [] };
        }
      },
      disposeInlineCompletions: () => { /* no-op cleanup */ }
    });
  }, []);

  // Cleanup completion provider on unmount
  useEffect(() => {
    return () => {
      if (completionProviderRef.current) {
        completionProviderRef.current.dispose();
        completionProviderRef.current = null;
      }
    };
  }, []);

  // Vim Mode Effect
  useEffect(() => {
    if (isVimMode && editorRef.current) {
      import('monaco-vim').then((vim) => {
        if (editorRef.current) {
          vimRef.current = vim.initVimMode(editorRef.current, document.createElement('div'));
        }
      });
    } else {
      if (vimRef.current) {
        vimRef.current.dispose();
        vimRef.current = null;
      }
    }
  }, [isVimMode]);

  // Note: Live error squiggles are handled in the parent component (SimulationPlayground.tsx)
  // which has direct access to compileError state.

  return {
    editorRef,
    monacoRef,
    isVimMode,
    setIsVimMode,
    isWordWrap,
    setIsWordWrap,
    isMinimap,
    setIsMinimap,
    handleEditorDidMount,
  };
}
