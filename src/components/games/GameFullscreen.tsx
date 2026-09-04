import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import "./game-fullscreen.css";

const ignoreFullscreenExitError = () => undefined;

export function useGameFullscreen() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const targetRef = useRef<HTMLElement>(null);
  const ownsNativeFullscreen = useRef(false);
  const isActive = useRef(false);

  const exitFullscreen = useCallback(() => {
    isActive.current = false;
    setIsFullscreen(false);
    if (
      ownsNativeFullscreen.current &&
      document.fullscreenElement &&
      typeof document.exitFullscreen === "function"
    ) {
      void document.exitFullscreen().catch(ignoreFullscreenExitError);
    }
    ownsNativeFullscreen.current = false;
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (isFullscreen) {
      exitFullscreen();
      return;
    }

    isActive.current = true;
    setIsFullscreen(true);
    const requestFullscreen = document.documentElement.requestFullscreen;
    if (typeof requestFullscreen !== "function") return;

    void requestFullscreen.call(document.documentElement).then(
      () => {
        if (!isActive.current) {
          if (document.fullscreenElement && typeof document.exitFullscreen === "function") {
            void document.exitFullscreen().catch(ignoreFullscreenExitError);
          }
          return;
        }
        if (!document.fullscreenElement) {
          isActive.current = false;
          setIsFullscreen(false);
          return;
        }
        ownsNativeFullscreen.current = true;
      },
      () => {
        // Mobile Safari and embedded browsers may reject the native API.
        // The fixed, viewport-sized game shell remains active as a fallback.
        ownsNativeFullscreen.current = false;
      },
    );
  }, [exitFullscreen, isFullscreen]);

  useEffect(() => {
    if (!isFullscreen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.fullscreenElement) {
        exitFullscreen();
      }
    };
    const handleFullscreenChange = () => {
      if (ownsNativeFullscreen.current && !document.fullscreenElement) {
        ownsNativeFullscreen.current = false;
        isActive.current = false;
        setIsFullscreen(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, [exitFullscreen, isFullscreen]);

  useEffect(
    () => () => {
      if (
        ownsNativeFullscreen.current &&
        document.fullscreenElement &&
        typeof document.exitFullscreen === "function"
      ) {
        void document.exitFullscreen().catch(ignoreFullscreenExitError);
      }
    },
    [],
  );

  return { isFullscreen, targetRef, toggleFullscreen };
}

interface GameFullscreenButtonProps {
  isFullscreen: boolean;
  onToggle: () => void;
  className?: string;
}

export function GameFullscreenButton({
  isFullscreen,
  onToggle,
  className,
}: GameFullscreenButtonProps) {
  const label = isFullscreen ? "Exit full screen" : "Enter full screen";
  const Icon = isFullscreen ? Minimize2 : Maximize2;

  return (
    <Button
      variant="secondary"
      className={className}
      aria-label={label}
      aria-pressed={isFullscreen}
      onClick={onToggle}
    >
      <Icon aria-hidden="true" className="h-4 w-4" />
      <span>{label}</span>
    </Button>
  );
}
