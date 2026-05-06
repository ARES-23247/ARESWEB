/**
 * @deprecated Import from individual domain modules instead.
 * This file now re-exports from the modular structure for backward compatibility.
 *
 * Recommended migration:
 * - Replace: import { useGetEvents, Event } from '@/api/honoReactQuery'
 * - With: import { useGetEvents, type Event } from '@/api'
 */

// Re-export everything from the new modular structure
export * from "./index";
