/**
 * Calculate estimated reading time for content
 * Based on average reading speed of 200-250 words per minute
 */
export function calculateReadingTime(text: string): number {
  const wordsPerMinute = 225;
  const words = text.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / wordsPerMinute));
}

/**
 * Format reading time for display
 */
export function formatReadingTime(minutes: number): string {
  if (minutes === 1) return "1 min read";
  return `${minutes} min read`;
}
