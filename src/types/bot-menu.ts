import { z } from 'zod';

import {
  depositModeSchema,
  withdrawalModeSchema,
  type DepositMode,
  type WithdrawalMode,
} from './enums';

/**
 * The bot's menu, as a graph the operator edits.
 *
 * ══ WHY A BUTTON'S LABEL IS TREATED AS LOAD-BEARING THROUGHOUT THIS UI ═══════════════════════
 * The bot's menu is a Telegram ReplyKeyboardMarkup, which carries no hidden payload: a tap arrives
 * at the backend as a plain text message whose body IS the label. So a label is not a caption, it
 * is the routing key — which is why it must be unique on a screen, why renaming one changes
 * behaviour rather than appearance, and why the editor says so out loud.
 */

export const botMenuButtonKindSchema = z.enum(['BUILTIN', 'NAVIGATE', 'TEXT', 'BACK']);
export type BotMenuButtonKind = z.infer<typeof botMenuButtonKindSchema>;

export const botMenuButtonSchema = z.looseObject({
  id: z.string(),
  nodeId: z.string(),
  label: z.string(),
  kind: botMenuButtonKindSchema,
  /** BUILTIN only — one of `builtinActions`. */
  builtinAction: z.string().nullable(),
  /** NAVIGATE only — the screen this opens. */
  targetNodeId: z.string().nullable(),
  /** TEXT only — what the bot replies. */
  bodyText: z.string().nullable(),
  /** The keyboard row. Telegram draws each row as a row. */
  rowIndex: z.number(),
  sortOrder: z.number(),
  /** Hidden buttons are not drawn AND not routable — a memorised label stops working. */
  isActive: z.boolean(),
});
export type BotMenuButton = z.infer<typeof botMenuButtonSchema>;

export const botMenuNodeSchema = z.looseObject({
  id: z.string(),
  key: z.string(),
  name: z.string(),
  /** Sent on arrival. Null draws the keyboard with no new message. */
  promptText: z.string().nullable(),
  /** What /start draws. Cannot be deleted. */
  isRoot: z.boolean(),
  /** Hidden buttons INCLUDED — the editor has to show what it can switch back on. */
  buttons: z.array(botMenuButtonSchema),
});
export type BotMenuNode = z.infer<typeof botMenuNodeSchema>;

export const builtinActionSchema = z.looseObject({
  action: z.string(),
  description: z.string(),
});
export type BuiltinAction = z.infer<typeof builtinActionSchema>;

/**
 * `GET` / `PATCH /v1/admin/bot-menu/settings` — the operator settings the bot reads at runtime
 * that are not buttons.
 *
 * `chatMenuButtonSet` reports whether Telegram's own chat menu button was pointed at the mini app
 * (`setChatMenuButton`, best-effort after a URL change). It is reported rather than assumed because
 * that call can fail on its own while the URL still saved — and a screen must be able to say "the
 * URL is set, but the button under the text box is not".
 */
export const botSettingsSchema = z.looseObject({
  miniAppUrl: z.string().nullable(),
  depositMode: depositModeSchema,
  withdrawalMode: withdrawalModeSchema,
  chatMenuButtonSet: z.boolean(),
});
export type BotSettings = z.infer<typeof botSettingsSchema>;

/** A PATCH: an absent key leaves the value alone; `miniAppUrl: null` clears the URL. */
export interface UpdateBotSettingsBody {
  miniAppUrl?: string | null;
  depositMode?: DepositMode;
  withdrawalMode?: WithdrawalMode;
}

export const botMenuTreeSchema = z.looseObject({
  nodes: z.array(botMenuNodeSchema),
  builtinActions: z.array(builtinActionSchema),
  gate: z.looseObject({
    /**
     * A Telegram channel id is a signed 64-bit number, which JSON's number type cannot carry
     * safely, so it crosses the wire as a string in both directions.
     */
    channelId: z.string().nullable(),
    channelUsername: z.string().nullable(),
  }),
  /** Optional: a backend older than the settings endpoint answers the tree without it. */
  settings: botSettingsSchema.optional(),
});
export type BotMenuTree = z.infer<typeof botMenuTreeSchema>;

export const deletedSchema = z.looseObject({ deleted: z.literal(true) });

export const gateSchema = z.looseObject({
  channelId: z.string().nullable(),
  channelUsername: z.string().nullable(),
});
export type BotMenuGate = z.infer<typeof gateSchema>;

export interface CreateNodeBody {
  key: string;
  name: string;
  promptText?: string | null;
}

export interface UpdateNodeBody {
  name?: string;
  promptText?: string | null;
}

export interface CreateButtonBody {
  nodeId: string;
  label: string;
  kind: BotMenuButtonKind;
  builtinAction?: string | null;
  targetNodeId?: string | null;
  bodyText?: string | null;
  rowIndex?: number;
  sortOrder?: number;
  isActive?: boolean;
}

export type UpdateButtonBody = Partial<Omit<CreateButtonBody, 'nodeId'>>;

export interface ReorderButtonsBody {
  positions: { id: string; rowIndex: number; sortOrder: number }[];
}

/** Both fields move together, or both clear. Half a gate is worse than none. */
export interface UpdateGateBody {
  channelId?: string | null;
  channelUsername?: string | null;
}
