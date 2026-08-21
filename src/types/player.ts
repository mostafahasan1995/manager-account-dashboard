import { z } from 'zod';

import { isoDateTime } from './api';
import { playerStatusSchema, type PlayerStatus } from './enums';

export const adminPlayerSchema = z.looseObject({
  id: z.string(),
  telegramUserId: z.string(),
  telegramUsername: z.string().nullable(),
  firstName: z.string().nullable(),
  lastName: z.string().nullable(),
  languageCode: z.string().nullable(),
  status: playerStatusSchema,
  currencyCode: z.string(),
  ichancyLinked: z.boolean(),
  createdAt: isoDateTime,
  lastSeenAt: isoDateTime.nullable(),
  // Present on the admin views; the player's own view omits them.
  ichancyPlayerId: z.string().nullable().optional(),
  ichancyLogin: z.string().nullable().optional(),
  ichancyRegisteredAt: isoDateTime.nullable().optional(),
  phone: z.string().nullable().optional(),
});
export type AdminPlayer = z.infer<typeof adminPlayerSchema>;

export const ichancyAccountSchema = z.looseObject({
  playerId: z.string(),
  ichancyPlayerId: z.string(),
  ichancyLogin: z.string(),
  /** false = the player already had an account; the call was a no-op, not a failure. */
  created: z.boolean(),
  agentId: z.string(),
});
export type IchancyAccount = z.infer<typeof ichancyAccountSchema>;

export interface PlayerListQuery {
  status?: PlayerStatus;
  telegramUserId?: string;
  linked?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

/** `firstName lastName`, falling back to the @username and then to the Telegram id. */
export function playerDisplayName(player: AdminPlayer): string {
  const name = [player.firstName, player.lastName].filter(Boolean).join(' ').trim();
  if (name.length > 0) return name;
  if (player.telegramUsername != null && player.telegramUsername.length > 0) {
    return `@${player.telegramUsername}`;
  }
  return `Telegram ${player.telegramUserId}`;
}
