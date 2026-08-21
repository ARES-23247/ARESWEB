import { useState, useCallback, useRef, useEffect } from "react";
import { transformSimulationSource } from "../utils/lazySucrase";
import { logger as _logger } from "../utils/logger";

export function useCodeCompiler() {
  const [compiledFiles, setCompiledFiles] = useState<Record<string, string>>(
    {},
  );
  const [compileError, setCompileError] = useState<string | null>(null);
  const [isCompiling, setIsCompiling] = useState(false);
  const compileTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);

  // Track mount state to prevent state updates after unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const compileCode = useCallback(
    async (sourceFiles: Record<string, string>): Promise<string | null> => {
      setIsCompiling(true);
      setCompileError(null);
      try {
        const compiled: Record<string, string> = {};
        for (const [filename, content] of Object.entries(sourceFiles)) {
          if (filename.match(/\.(tsx?|jsx?)$/)) {
            const result = await transformSimulationSource(content, filename);
            compiled[filename] = result || "";
          } else {
            compiled[filename] = content;
          }
        }
        // Only update state if component is still mounted
        if (isMountedRef.current) {
          setCompiledFiles(compiled);
        }
        return null;
      } catch (e) {
        const errMsg = (e as Error).message;
        // Only update state if component is still mounted
        if (isMountedRef.current) {
          setCompileError(errMsg);
        }
        return errMsg;
      } finally {
        // Only update state if component is still mounted
        if (isMountedRef.current) {
          setIsCompiling(false);
        }
      }
    },
    [],
  );

  const scheduleCompile = useCallback(
    (files: Record<string, string>, delay = 800) => {
      if (compileTimeoutRef.current) clearTimeout(compileTimeoutRef.current);
      compileTimeoutRef.current = setTimeout(() => compileCode(files), delay);
    },
    [compileCode],
  );

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
