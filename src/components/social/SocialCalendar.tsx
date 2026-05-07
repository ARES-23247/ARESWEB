import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { ChevronLeft, ChevronRight, Trash2, Edit } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useGetSocialCalendar, useDeleteSocialPost, type SocialQueuePost } from "../../api/socialQueue";

interface SocialCalendarProps {
  onEditPost?: (post: SocialQueuePost) => void;
}

// Status colors
const STATUS_COLORS: Record<string, string> = {
  pending: "bg-ares-gold text-black",
  processing: "bg-ares-cyan text-black",
  sent: "bg-green-500 text-white",
  failed: "bg-ares-red text-white",
  cancelled: "bg-marble/40 text-marble",
};

export default function SocialCalendar({ onEditPost }: SocialCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const startOfCurrentMonth = startOfMonth(currentDate);
  const endOfCurrentMonth = endOfMonth(currentDate);
  const startOfCalendar = startOfWeek(startOfCurrentMonth, { weekStartsOn: 0 });
  const endOfCalendar = endOfWeek(endOfCurrentMonth, { weekStartsOn: 0 });

  const calendarDays = eachDayOfInterval({ start: startOfCalendar, end: endOfCalendar });

  // Fetch posts for the calendar month
  const monthStart = format(startOfCurrentMonth, "yyyy-MM-dd");
  const monthEnd = format(endOfCurrentMonth, "yyyy-MM-dd");

  const { data: calendarData, isLoading } = useGetSocialCalendar(
    { start: monthStart, end: monthEnd }
  );

  const posts = useMemo(() => calendarData?.posts || [], [calendarData?.posts]);

  // Group posts by day - optimized memoization with explicit dependencies
  const postsByDay = useMemo<Record<string, SocialQueuePost[]>>(() => {
    const grouped: Record<string, SocialQueuePost[]> = {};
    for (const post of posts) {
      const day = format(new Date(post.scheduled_for), "yyyy-MM-dd");
      if (!grouped[day]) {
        grouped[day] = [];
      }
      grouped[day].push(post);
    }
    return grouped;
  }, [posts]);

  const handlePreviousMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  const deleteMutation = useDeleteSocialPost({
    onSuccess: () => {
      // Query invalidation is handled by the hook
    },
  });

  const handleDelete = (postId: string) => {
    if (confirm("Cancel this scheduled post?")) {
      deleteMutation.mutate(postId);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-end">
        <div className="flex items-center gap-2">
          <button
            onClick={handlePreviousMonth}
            className="p-2 bg-white/5 hover:bg-white/10 text-white ares-cut-sm transition-colors"
          >
            <ChevronLeft size={20} />
          </button>
          <span className="px-4 py-2 bg-white/5 text-white font-bold ares-cut min-w-[150px] text-center">
            {format(currentDate, "MMMM yyyy")}
          </span>
          <button
            onClick={handleNextMonth}
            className="p-2 bg-white/5 hover:bg-white/10 text-white ares-cut-sm transition-colors"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-obsidian border border-white/10 ares-cut-lg overflow-hidden">
        {/* Day Headers */}
        <div className="grid grid-cols-7 border-b border-white/10">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div
              key={day}
              className="p-3 text-center text-xs font-bold text-marble/60 uppercase tracking-wider bg-white/5"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Days */}
        {isLoading ? (
          <div className="p-8 text-center text-marble/60">Loading calendar...</div>
        ) : (
          <div className="grid grid-cols-7">
            {calendarDays.map((day) => {
              const dayKey = format(day, "yyyy-MM-dd");
              const dayPosts = postsByDay[dayKey] || [];
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isDaySelected = selectedDay && isSameDay(day, selectedDay);
              const isDayToday = isToday(day);

              return (
                <button
                  type="button"
                  key={dayKey}
                  onClick={() => setSelectedDay(day)}
                  className={`min-h-[100px] border-b border-r border-white/5 p-2 cursor-pointer transition-all text-left ${
                    !isCurrentMonth ? "bg-black/30 opacity-50" : "bg-obsidian"
                  } ${isDaySelected ? "ring-2 ring-ares-cyan" : ""} hover:bg-white/5`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-sm font-bold ${
                        isDayToday
                          ? "bg-ares-cyan text-black w-6 h-6 rounded-full flex items-center justify-center"
                          : isCurrentMonth
                          ? "text-white"
                          : "text-marble/60"
                      }`}
                    >
                      {format(day, "d")}
                    </span>
                    {dayPosts.length > 0 && (
                      <span className="text-xs text-ares-gold font-bold">{dayPosts.length}</span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {dayPosts.slice(0, 2).map((post) => (
                      <div
                        key={post.id}
                        className={`p-1.5 ares-cut text-[10px] font-bold uppercase tracking-tighter truncate ${STATUS_COLORS[post.status]}`}
                      >
                        {post.content.slice(0, 20)}...
                      </div>
                    ))}
                    {dayPosts.length > 2 && (
                      <div className="text-[10px] text-marble/60 font-bold">
                        +{dayPosts.length - 2} more
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Selected Day Detail */}
      <AnimatePresence>
        {selectedDay && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-obsidian border border-ares-cyan/30 ares-cut-lg overflow-hidden"
          >
            <div className="p-4 border-b border-white/10 flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">
                {format(selectedDay, "EEEE, MMMM d, yyyy")}
              </h3>
              <button
                onClick={() => setSelectedDay(null)}
                className="text-marble/60 hover:text-white transition-colors"
              >
                ×
              </button>
            </div>
            <div className="p-4 space-y-3">
              {postsByDay[format(selectedDay, "yyyy-MM-dd")]?.length ? (
                postsByDay[format(selectedDay, "yyyy-MM-dd")]?.map((post) => (
                  <div
                    key={post.id}
                    className="bg-white/5 border border-white/10 ares-cut-sm p-4 flex items-start justify-between gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-tighter ares-cut-sm ${STATUS_COLORS[post.status]}`}>
                          {post.status}
                        </span>
                        <span className="text-xs text-marble/60 font-mono">
                          {format(new Date(post.scheduled_for), "h:mm a")}
                        </span>
                      </div>
                      <p className="text-sm text-white line-clamp-2 mb-2">{post.content}</p>
                      {post.linked_type && (
                        <div className="text-xs text-ares-cyan">
                          Linked to: {post.linked_type}/{post.linked_id}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {post.status === "pending" && (
                        <>
                          {onEditPost && (
                            <button
                              onClick={() => onEditPost(post)}
                              className="p-2 text-marble/60 hover:text-ares-cyan transition-colors"
                              title="Edit"
                            >
                              <Edit size={16} />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(post.id)}
                            className="p-2 text-marble/60 hover:text-ares-red transition-colors"
                            title="Cancel"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-marble/60 py-8">
                  No posts scheduled for this day
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(STATUS_COLORS).map(([status, className]) => (
          <div key={status} className="flex items-center gap-2">
            <span className={`w-3 h-3 ares-cut-sm ${className}`}></span>
            <span className="text-marble/60 capitalize">{status}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
