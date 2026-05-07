import { useState, useCallback, useRef, useEffect } from 'react';
import { transformCode } from '../utils/lazyBabel';
import { logger as _logger } from '../utils/logger';

export function useCodeCompiler() {
  const [compiledFiles, setCompiledFiles] = useState<Record<string, string>>({});
  const [compileError, setCompileError] = useState<string | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const compileTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const compileCode = useCallback(async (sourceFiles: Record<string, string>): Promise<string | null> => {
    setIsCompiling(true);
    setCompileError(null);
    try {
      const compiled: Record<string, string> = {};
      for (const [filename, content] of Object.entries(sourceFiles)) {
        if (filename.match(/\.(tsx?|jsx?)$/)) {
          const result = await transformCode(content, ['env', 'react', ['typescript', { isTSX: true, allExtensions: true }]] as unknown as string[]);
          compiled[filename] = result || '';
        } else {
          compiled[filename] = content;
        }
      }
      setCompiledFiles(compiled);
      return null;
    } catch (e) {
      const errMsg = (e as Error).message;
      setCompileError(errMsg);
      return errMsg;
    } finally {
      setIsCompiling(false);
    }
  }, []);

  const scheduleCompile = useCallback((files: Record<string, string>, delay = 800) => {
    if (compileTimeoutRef.current) clearTimeout(compileTimeoutRef.current);
    compileTimeoutRef.current = setTimeout(() => compileCode(files), delay);
  }, [compileCode]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (compileTimeoutRef.current) clearTimeout(compileTimeoutRef.current);
    };
  }, []);

  return {
    compiledFiles,
    setCompiledFiles,
    compileError,
    setCompileError,
    isCompiling,
    compileCode,
    scheduleCompile,
  };
}
