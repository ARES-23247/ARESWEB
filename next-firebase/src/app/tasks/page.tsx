"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function TasksRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/tasks");
  }, [router]);

  return (
    <div className="min-h-[60vh] bg-obsidian text-marble flex flex-col items-center justify-center">
      <div className="z-10 flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-ares-gold/20 border-t-ares-gold rounded-full animate-spin"></div>
        <p className="text-[10px] uppercase tracking-widest font-black text-ares-gold animate-pulse">
          Routing to Secure Dashboard Workspace...
        </p>
      </div>
    </div>
  );
}
