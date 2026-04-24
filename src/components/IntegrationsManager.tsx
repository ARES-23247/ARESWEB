import { useState, useEffect } from "react";

import { useQueryClient } from "@tanstack/react-query";
import { Settings, Save } from "lucide-react";
import { ZulipCard } from "./integrations/ZulipCard";
import { GithubCard } from "./integrations/GithubCard";
import { SocialCard } from "./integrations/SocialCard";
import { DataBackupCard } from "./integrations/DataBackupCard";
import { api } from "../api/client";
import { useForm, useWatch } from "react-hook-form";

type SettingsData = Record<string, string>;

export default function IntegrationsManager() {
  const queryClient = useQueryClient();
  const [successMsg, setSuccessMsg] = useState("");

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { register, handleSubmit, reset, setValue, control, formState: { isDirty } } = useForm<SettingsData>();
  const localSettings = useWatch({ control });

  const { data, isLoading, isError } = api.settings.getSettings.useQuery({}, {
    queryKey: ["admin_settings"],
  });

  useEffect(() => {
    if (data?.body?.settings) {
      const merged: SettingsData = { ...data.body.settings };
      if (merged["CALENDAR_ID"] && !merged["CALENDAR_ID_INTERNAL"]) {
        merged["CALENDAR_ID_INTERNAL"] = merged["CALENDAR_ID"];
      }
      reset(merged);
    }
  }, [data?.body?.settings, reset]);

  const saveMutation = api.settings.updateSettings.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_settings"] });
      setSuccessMsg("Integrations synchronized securely.");
      setTimeout(() => setSuccessMsg(""), 3000);
    }
  });

  const onFormSubmit = (data: SettingsData) => {
    saveMutation.mutate({ body: data });
  };

  const handleChange = (key: string, value: string) => {
    setValue(key, value, { shouldDirty: true });
  };

  if (isLoading) {
    return (
      <div className="w-full h-64 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-white/10 border-t-ares-gold rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      <form onSubmit={handleSubmit(onFormSubmit)}>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Settings className="text-marble/40" /> API &amp; Integrations
            </h2>
            <p className="text-marble/90 mt-1">
              Manage your Zero Trust configuration tokens securely. Keys are safely obscured upon save.
            </p>
          </div>
          <button
            type="submit"
            disabled={!isDirty || saveMutation.isPending}
            className={`flex items-center gap-2 px-6 py-2.5 ares-cut-sm font-bold transition-all shadow-lg backdrop-blur ${
              isDirty
                ? "bg-gradient-to-r from-ares-gold to-yellow-600 text-black hover:scale-105"
                : "bg-white/5 text-marble/40 cursor-not-allowed border border-white/5"
            }`}
          >
            {saveMutation.isPending ? (
              <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
            ) : (
              <Save size={18} />
            )}
            Save Changes
          </button>
        </div>

        {isError && (
          <div className="bg-ares-red/10 border border-ares-red/30 p-4 ares-cut-sm text-ares-red text-xs font-bold mb-6 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-ares-red animate-pulse" />
            TELEMETRY FAULT: Failed to synchronize Zero Trust secrets. Access denied.
          </div>
        )}

        {successMsg && (
          <div className="absolute top-0 right-0 -translate-y-full mb-4 bg-ares-cyan/20 border border-ares-cyan/50 text-ares-cyan px-4 py-2 ares-cut-sm font-medium text-sm">
            {successMsg}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <ZulipCard localSettings={localSettings as any} handleChange={handleChange} />
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <GithubCard localSettings={localSettings as any} handleChange={handleChange} />
          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
          <SocialCard localSettings={localSettings as any} handleChange={handleChange} />
          <DataBackupCard />
        </div>
      </form>
    </div>
  );
}
