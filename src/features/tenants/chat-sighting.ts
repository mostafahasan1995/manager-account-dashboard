import type { BoundChatHealth } from '@/types';

/**
 * The health sighting of the chat that is bound RIGHT NOW, or null when there is nothing to trust.
 *
 * Health is read less often than the operator row, so right after a bind the health block can still
 * describe the previous group. A group bound a moment ago must never inherit that group's "the bot was
 * removed", so a sighting counts only while its `chatId` is the one the row holds.
 */
export function sightingFor(
  boundChatId: string | null,
  health: BoundChatHealth,
): BoundChatHealth | null {
  return boundChatId !== null && health.chatId === boundChatId ? health : null;
}
