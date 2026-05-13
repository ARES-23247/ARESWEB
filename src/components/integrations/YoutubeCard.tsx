import { Unplug, CheckCircle, XCircle } from "lucide-react";
import { useGetYoutubeAuthStatus, useDisconnectYoutubeMutation } from "../../api/youtube";

const YoutubeIcon = ({ size = 24, className }: { size?: number; className?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
  >
    <path
      d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"
      fill="currentColor"
    />
  </svg>
);
import { toastApiError } from "../../api/honoClient";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export function YoutubeCard() {
  const queryClient = useQueryClient();
  const { data: authStatus, isLoading } = useGetYoutubeAuthStatus();
  const disconnectMutation = useDisconnectYoutubeMutation();

  const handleDisconnect = async () => {
    if (!window.confirm("Are you sure you want to disconnect YouTube? This will remove the ability to upload and sync videos directly from the dashboard.")) {
      return;
    }

    try {
      await disconnectMutation.mutateAsync();
      queryClient.invalidateQueries({ queryKey: ["youtube-auth-status"] });
      toast.success("YouTube integration disconnected successfully.");
    } catch (err) {
      toastApiError(err, "Failed to disconnect YouTube");
    }
  };

  return (
    <div className="bg-ares-black border border-ares-gray-dark p-6 flex flex-col gap-6 relative shadow-xl ares-cut-sm">
      {/* Decorative Brand Accent */}
      <div className="absolute top-0 right-0 w-16 h-1 bg-[#FF0000]" />
      
      <div className="flex items-start gap-4">
        <div className="p-3 bg-obsidian border border-ares-gray-dark/50 ares-cut-sm shadow-inner group-hover:bg-ares-gray-dark transition-colors shrink-0">
          <YoutubeIcon size={24} className="text-[#FF0000] transition-colors" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white tracking-wide uppercase">YouTube Integration</h3>
          <p className="text-ares-gray text-sm mt-1 leading-relaxed">
            Manage the connection to your team's YouTube channel. Disconnecting will require a coach to re-authenticate via the Video Hub to restore upload and sync capabilities.
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-xs font-bold text-marble/60 uppercase tracking-wider">Status</span>
        <div className="bg-obsidian border border-white/10 p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : authStatus?.isAuthenticated ? (
              <>
                <CheckCircle size={16} className="text-ares-cyan" />
                <span className="text-sm font-bold text-white">Connected</span>
              </>
            ) : (
              <>
                <XCircle size={16} className="text-ares-red" />
                <span className="text-sm font-bold text-white/50">Disconnected</span>
              </>
            )}
          </div>
          {authStatus?.isAuthenticated && (
            <span className="text-xs text-marble/60 font-mono">
              Authorized ({authStatus.memberType || "unknown"})
            </span>
          )}
        </div>
      </div>

      <div className="mt-auto flex justify-end gap-3 pt-4 border-t border-white/5">
        <button
          onClick={handleDisconnect}
          disabled={!authStatus?.isAuthenticated || disconnectMutation.isPending || isLoading}
          className={`flex items-center gap-2 px-6 py-2.5 ares-cut-sm font-bold transition-all disabled:opacity-50
              bg-ares-red/10 text-ares-red hover:bg-ares-red hover:text-white hover:scale-105 border border-ares-red/30 shadow-lg focus:outline-none focus:ring-2 focus:ring-ares-red`}
        >
          {disconnectMutation.isPending ? (
             <div className="w-4 h-4 border-2 border-ares-red border-t-current rounded-full animate-spin"></div>
          ) : (
             <Unplug size={18} />
          )}
          {disconnectMutation.isPending ? "DISCONNECTING..." : "DISCONNECT YOUTUBE"}
        </button>
      </div>
    </div>
  );
}
