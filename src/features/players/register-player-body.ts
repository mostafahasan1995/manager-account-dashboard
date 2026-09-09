import type { RegisterPlayerBody, RegisterPlayerResult } from '@/types/player';

/**
 * What the register form holds, and how it becomes a request. Kept apart from the dialog so the
 * body rule — absent, never `""` — can be tested without mounting a form.
 */
export interface RegisterFormValues {
  telegramUserId: string;
  firstName: string;
  lastName: string;
  phone: string;
  createIchancyAccount: boolean;
}

/**
 * Only the fields that hold something. A blank one is spread in as `{}`, so its key never appears
 * in the JSON: the server would store `""` as a name, and a player called "" is worse than one
 * called nothing.
 */
export function toRegisterBody(values: RegisterFormValues): RegisterPlayerBody {
  const telegramUserId = values.telegramUserId.trim();
  const firstName = values.firstName.trim();
  const lastName = values.lastName.trim();
  const phone = values.phone.trim();
  return {
    ...(telegramUserId === '' ? {} : { telegramUserId }),
    ...(firstName === '' ? {} : { firstName }),
    ...(lastName === '' ? {} : { lastName }),
    ...(phone === '' ? {} : { phone }),
    // Sent only when asked for: a false is the same request as an absent one, and absent is honest.
    ...(values.createIchancyAccount ? { createIchancyAccount: true } : {}),
  };
}

/** The name the toast and the page's outcome alert use. Kept here so both say the same thing. */
export function registeredPlayerName(result: RegisterPlayerResult): string {
  const { player } = result;
  const full = [player.firstName, player.lastName].filter((part) => part !== null).join(' ');
  if (full.length > 0) return full;
  if (player.telegramUserId !== null) return `Telegram ${player.telegramUserId}`;
  if (player.phone != null) return player.phone;
  return `Player ${player.id.slice(0, 8)}`;
}
