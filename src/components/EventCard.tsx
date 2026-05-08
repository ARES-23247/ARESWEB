import { Link } from "react-router-dom";
import { Calendar, MapPin, Users } from "lucide-react";
import { format } from "date-fns";
import type { Event } from "../api/events";

export interface EventCardProps {
  event: Event;
  onSignup?: (eventId: string) => void;
  onUnsignup?: (eventId: string) => void;
  isSignedUp?: boolean;
  isLoading?: boolean;
  className?: string;
}

/**
 * EventCard - Optimized with React.memo to prevent unnecessary re-renders
 * Only re-renders when event data or signup status changes
 */
export const EventCard = React.memo(function EventCard({
  event,
  onSignup,
  onUnsignup,
  isSignedUp = false,
  isLoading = false,
  className = "",
}: EventCardProps) {
  const startDate = new Date(event.start_time);
  const endDate = new Date(event.end_time);
  const isPast = startDate < new Date();
  const isFull = event.max_attendees !== null && event.attendee_count >= event.max_attendees;

  return (
    <article
      className={`bg-obsidian border border-white/10 rounded-lg p-6 hover:border-ares-gold/50 transition-all ${isPast ? "opacity-60" : ""} ${className}`}
      aria-labelledby={`event-title-${event.id}`}
    >
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1">
          <Link
            to={`/events/${event.id}`}
            id={`event-title-${event.id}`}
            className="text-xl font-bold text-white hover:text-ares-gold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan rounded"
          >
            {event.title}
          </Link>
          <div className="flex flex-wrap gap-4 mt-3 text-sm text-marble">
            <time
              className="flex items-center gap-1.5"
              dateTime={event.start_time}
              aria-label={`Starts ${format(startDate, "MMMM d, yyyy 'at' h:mm a")}`}
            >
              <Calendar size={14} aria-hidden="true" />
              <span>
                {format(startDate, "MMM d, yyyy")}
                {format(endDate, "yyyy") !== format(startDate, "yyyy") && format(startDate, ", yyyy")}
              </span>
              <span className="text-marble/60">
                {format(startDate, "h:mm a")} – {format(endDate, "h:mm a")}
              </span>
            </time>
            {event.location && (
              <span className="flex items-center gap-1.5">
                <MapPin size={14} aria-hidden="true" />
                <span>{event.location}</span>
              </span>
            )}
            <span className="flex items-center gap-1.5" aria-live="polite">
              <Users size={14} aria-hidden="true" />
              <span>
                {event.attendee_count}
                {event.max_attendees !== null && ` / ${event.max_attendees}`}
              </span>
            </span>
          </div>
          {event.description && (
            <p className="mt-3 text-sm text-marble/80 line-clamp-2">{event.description}</p>
          )}
        </div>
        {!isPast && onSignup && (
          <button
            onClick={() => (isSignedUp ? onUnsignup?.(event.id) : onSignup(event.id))}
            disabled={isLoading || isFull}
            className={`px-4 py-2 rounded-md text-sm font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan ${
              isSignedUp
                ? "bg-ares-red text-white hover:bg-ares-red/80"
                : isFull
                ? "bg-marble/20 text-marble/50 cursor-not-allowed"
                : "bg-ares-gold text-black hover:bg-ares-gold/80"
            }`}
            aria-label={isSignedUp ? "Cancel signup" : isFull ? "Event is full" : "Sign up for event"}
            aria-pressed={isSignedUp}
          >
            {isLoading ? "Loading..." : isSignedUp ? "Signed Up" : isFull ? "Full" : "Sign Up"}
          </button>
        )}
      </div>
    </article>
  );
});

import React from "react";

export default EventCard;
