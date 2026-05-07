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

  const handleEditorDidMount = useCallback(async (
    editor: editor.IStandaloneCodeEditor,
    monaco: Monaco
  ) => {
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
      target: monaco.languages.typescript.ScriptTarget.ESNext,
      allowNonTsExtensions: true,
      jsx: monaco.languages.typescript.JsxEmit.React,
    });

    try {
      // Load ARESLib types
      const aresRes = await fetch('/types/areslib.d.ts');
      if (aresRes.ok) {
        monaco.languages.typescript.javascriptDefaults.addExtraLib(
          await aresRes.text(),
          'file:///node_modules/@types/areslib/index.d.ts'
        );
      }

      // Load minimal React types
      monaco.languages.typescript.javascriptDefaults.addExtraLib(
        `declare module "react" {
          export function useState<T>(initialState: T | (() => T)): [T, (newState: T | ((prevState: T) => T)) => void];
          export function useEffect(effect: () => void | (() => void), deps?: any[]): void;
          export function useRef<T>(initialValue: T): { current: T };
          export function useCallback<T extends (...args: any[]) => any>(callback: T, deps: any[]): T;
          export function useMemo<T>(factory: () => T, deps: any[]): T;
        }
        declare namespace React {
          export function useState<T>(initialState: T | (() => T)): [T, (newState: T | ((prevState: T) => T)) => void];
          export function useEffect(effect: () => void | (() => void), deps?: any[]): void;
          export function useRef<T>(initialValue: T): { current: T };
          export function useCallback<T extends (...args: any[]) => any>(callback: T, deps: any[]): T;
          export function useMemo<T>(factory: () => T, deps: any[]): T;
        }`,
        'file:///node_modules/@types/react/index.d.ts'
      );

    } catch (e) {
      logger.error('[SimPlayground] Failed to load intellisense types:', e);
    }

    editorRef.current = editor;
    monacoRef.current = monaco;

    // Ghost text provider
    monaco.languages.registerInlineCompletionsProvider('javascript', {
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
