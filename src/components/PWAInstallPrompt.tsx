import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

// Extend WindowEventMap to include beforeinstallprompt
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Show the customized install prompt
      setShowPrompt(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Hide our user interface that shows our A2HS button
    setShowPrompt(false);
    // Show the prompt
    await deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome: _outcome } = await deferredPrompt.userChoice;
    
    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
  };

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-[100] bg-ares-gray-dark border border-ares-red/30 ares-cut-sm shadow-2xl p-4 flex items-start gap-4"
        >
          <div className="bg-ares-red/20 p-2 ares-cut-sm flex-shrink-0">
            <Download className="text-ares-red" size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-white font-bold font-heading mb-1">Install ARES App</h4>
            <p className="text-white/60 text-sm mb-3">
              Add the ARES Web Portal to your home screen for quick offline access to the roster, tasks, and calendar.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleInstallClick}
                className="flex-1 bg-ares-red text-white py-1.5 px-3 font-bold uppercase tracking-wider text-xs ares-cut-sm hover:bg-ares-red-light transition-colors"
              >
                Install App
              </button>
              <button
                onClick={handleDismiss}
                className="px-3 py-1.5 text-white/60 hover:text-white hover:bg-white/10 ares-cut-sm transition-colors text-xs font-bold uppercase tracking-wider"
              >
                Not Now
              </button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="absolute top-2 right-2 text-white/40 hover:text-white p-1"
          >
            <X size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
