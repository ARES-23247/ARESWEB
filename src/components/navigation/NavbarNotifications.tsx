import { useRef, useState, useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Bell, Check, X } from "lucide-react";
import { useMarkAllNotificationsRead, useMarkNotificationRead, useDeleteNotification } from "../../api/notifications";
import { useMergedNotifications, MergedNotification } from "../../hooks/useMergedNotifications";
import type { DashboardSession, DashboardPermissions } from "../../hooks/useDashboardSession";

interface NavbarNotificationsProps {
  session: DashboardSession | null;
  permissions: DashboardPermissions;
}

export function NavbarNotifications({ session, permissions }: NavbarNotificationsProps) {
  const navigate = useNavigate();
  const [showNotifs, setShowNotifs] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const { notifications, unreadCount } = useMergedNotifications(session, permissions);
  const markAllRead = useMarkAllNotificationsRead();
  const markRead = useMarkNotificationRead();
  const deleteNotif = useDeleteNotification();

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifs(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const hasUnread = notifications.some((n: MergedNotification) => !n.is_read && !n.is_inquiry);

  const handleNotificationClick = (n: MergedNotification) => {
    if (!n.is_read && !n.is_inquiry) markRead.mutate(n.id);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (n.link) navigate({ to: n.link as any });
    setShowNotifs(false);
  };

  return (
    <div className="relative" ref={notifRef}>
      <button
        onClick={() => setShowNotifs(!showNotifs)}
        className="relative flex items-center justify-center h-9 w-9 ares-cut-sm bg-white/5 hover:bg-white/10 border border-white/10 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
        aria-label="Notifications"
      >
        <Bell size={18} className="text-white" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-ares-red opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-ares-danger text-[9px] font-bold text-white items-center justify-center">
              {unreadCount}
            </span>
          </span>
        )}
      </button>

      {showNotifs && (
        <div className="absolute top-12 right-0 w-80 bg-obsidian border border-white/10 shadow-2xl ares-cut-sm overflow-hidden flex flex-col z-[200]">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-black/20">
            <h3 className="text-sm font-bold text-white">Notifications</h3>
            {hasUnread && (
              <button
                onClick={() => markAllRead.mutate()}
                className="text-xs text-ares-gold hover:text-white flex items-center gap-1"
              >
                <Check size={12} /> Mark Read
              </button>
            )}
          </div>
          <ul className="flex-1 overflow-y-auto max-h-96 w-full list-none p-0 m-0">
            {notifications.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-marble/50">
                No notifications yet.
              </li>
            ) : (
              notifications.map((n: MergedNotification) => (
                <li key={n.id} className="relative group/notif">
                  <div
                    role="button"
                    tabIndex={0}
                    className={`px-4 py-3 border-b border-white/5 flex flex-col gap-1 hover:bg-white/5 cursor-pointer focus:bg-white/5 focus:outline-none focus:ring-1 focus:ring-ares-cyan/50 ${n.is_read ? "opacity-60" : "bg-ares-red/5"}`}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleNotificationClick(n);
                      }
                    }}
                    onClick={() => handleNotificationClick(n)}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <span className="text-sm font-bold text-white pr-4">{n.title}</span>
                      {!n.is_read && <span className="h-2 w-2 rounded-full bg-ares-red flex-shrink-0 mt-1" />}
                    </div>
                    <span className="text-xs text-marble/90 line-clamp-2 pr-4">{n.message}</span>
                  </div>
                  {!n.is_inquiry && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotif.mutate(n.id);
                      }}
                      className="absolute top-2 right-2 p-1 text-marble/60 hover:text-ares-red transition-opacity focus:outline-none focus:text-ares-red"
                      aria-label="Delete notification"
                    >
                      <X size={14} />
                    </button>
                  )}
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

