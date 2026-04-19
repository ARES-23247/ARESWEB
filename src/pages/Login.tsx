import { useState } from "react";
import { signIn } from "@/utils/auth-client";
import { Key, LogIn, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

export default function Login() {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleLogin = async (provider: "google" | "github") => {
    setErrorMessage(null);
    try {
      const { data, error } = await signIn.social({
        provider,
        callbackURL: "/dashboard",
      });
      if (error) {
        console.error("Login Error:", error);
        setErrorMessage(`Login failed: ${error.message} (${error.status})`);
      } else {
        console.log("Login initiated:", data);
      }
    } catch (e: unknown) {
      console.error("Critical Login Exception:", e);
      const err = e as Error;
      setErrorMessage(err.message || "Authentication system unreachable.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050505] p-6 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/10 blur-[120px] rounded-full animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-400/10 blur-[120px] rounded-full" />

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-zinc-900/50 backdrop-blur-xl border border-zinc-800 p-10 rounded-3xl shadow-2xl relative z-10"
      >
        <div className="flex flex-col items-center mb-10">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg shadow-blue-600/20">
            <LogIn className="text-white w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight mb-2">ARES Portal</h1>
          <p className="text-zinc-400 text-center text-sm">
            Appalachian Robotics & Engineering Society <br/> Admin Authentication
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={() => handleLogin("google")}
            className="w-full group flex items-center justify-center gap-3 px-6 py-4 bg-white hover:bg-zinc-200 text-black font-semibold rounded-2xl transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
            Sign in with Google
          </button>

          <button
            onClick={() => handleLogin("github")}
            className="w-full group flex items-center justify-center gap-3 px-6 py-4 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-2xl border border-zinc-700 transition-all duration-300 transform hover:scale-[1.02] active:scale-[0.98]"
          >
            <Key className="w-5 h-5" />
            Sign in with GitHub
          </button>

        </div>

        {errorMessage && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-6 p-4 bg-red-500/10 border border-red-500/50 rounded-xl flex items-start gap-3"
          >
            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-200 leading-relaxed font-medium">
              {errorMessage}
            </p>
          </motion.div>
        )}

        <p className="mt-10 text-center text-zinc-500 text-xs text-balance">
          Protected by ARES Zero-Trust Architecture. <br/>
          By signing in, you agree to our Code of Conduct.
        </p>
      </motion.div>
    </div>
  );
}
