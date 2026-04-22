import { useState } from "react";
import { signIn } from "@/utils/auth-client";
import { Key, LogIn, AlertCircle, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";

export default function Login() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async (provider: "google" | "github" | "zulip") => {
    setErrorMessage(null);
    try {
      if (provider === "zulip") {
        const { error } = await signIn.oauth2({ providerId: "zulip", callbackURL: "/dashboard" });
        if (error) throw error;
        return;
      }

      const { error } = await signIn.social({
        provider,
        callbackURL: "/dashboard",
      });
      if (error) {
        console.error("Login Error:", error);
        setErrorMessage(`Login failed: ${error.message || error.statusText || "Server misconfiguration or unhandled exception"} (${error.status})`);
      }
    } catch (e: unknown) {
      console.error("Critical Login Exception:", e);
      const err = e as Error;
      setErrorMessage(err.message || "Authentication system unreachable.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-ares-black p-6 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-ares-red/10 blur-[120px] rounded-full animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-ares-gold/10 blur-[120px] rounded-full" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-obsidian/50 backdrop-blur-xl border border-white/10 p-10 ares-cut-lg shadow-2xl relative z-10"
      >
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 bg-ares-red ares-cut flex items-center justify-center mb-6 shadow-lg shadow-ares-red/20">
            <LogIn className="text-white w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">ARES Portal</h1>
          <p className="text-ares-gray text-center text-sm">
            Appalachian Robotics & Engineering Society <br/> Admin Authentication
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => handleLogin("google")}
            className="w-full group flex items-center justify-center gap-3 px-6 py-4 bg-white hover:bg-ares-offwhite text-black font-semibold ares-cut transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
            Sign in with Google
          </button>

          <button
            onClick={() => handleLogin("github")}
            className="w-full group flex items-center justify-center gap-3 px-6 py-4 bg-ares-gray-dark hover:bg-obsidian text-white font-semibold ares-cut border border-white/10 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <Key className="w-5 h-5" />
            Sign in with GitHub
          </button>

          <button
            onClick={() => handleLogin("zulip")}
            className="w-full group flex items-center justify-center gap-3 px-6 py-4 bg-ares-gold hover:bg-ares-gold/80 text-black font-semibold ares-cut border border-ares-gold transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <MessageSquare className="w-5 h-5" />
            Sign in with Zulip
          </button>

        </div>

        {errorMessage && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-6 p-4 bg-ares-danger/10 border border-ares-danger/50 ares-cut-sm flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 text-ares-danger flex-shrink-0 mt-0.5" />
            <p className="text-sm text-ares-danger-soft leading-relaxed font-medium">
              {errorMessage}
            </p>
          </motion.div>
        )}

        <p className="mt-10 text-center text-ares-gray text-xs text-balance">
          Protected by ARES Authentication Architecture. <br/>
          By signing in, you agree to our Code of Conduct.
        </p>
      </motion.div>
    </div>
  );
}
