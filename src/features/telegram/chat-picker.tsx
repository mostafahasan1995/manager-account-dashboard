import { Alert, Badge, Button, Skeleton } from '@/components/ui';
import { useT } from '@/lib/i18n/use-translation';
import type { DiscoveredChat } from '@/types/telegram-destination';

import { telegramMessages } from './messages';

/**
 * THE GROUPS THE BOT IS ALREADY IN — and the only way a PRIVATE group can be added.
 *
 * ── WHY A LIST AND NOT ANOTHER TEXT FIELD ─────────────────────────────────────────────────────
 * Binding resolves what the operator types, and Telegram will only resolve a handle it can look up:
 * an @username, or a chat id. A public group has a username. A private group has NEITHER. Its only
 * shareable handle is an invite link, and no bot can follow or resolve one — there is no Bot API
 * method for it — while no API lists the chats a bot belongs to either. So for a private group the
 * text field was a dead end with no correct answer: the operator pastes the only link the group has
 * and is told, accurately, that it cannot be used.
 *
 * Telegram does hand over the chat id once, unprompted, when the bot is added. The server keeps
 * that; this is the list. Picking a row puts the id into the field the operator can already see, so
 * what is about to be submitted stays visible rather than becoming hidden state.
 *
 * ── WHY NOTHING HERE IS DISABLED BY A STATUS ──────────────────────────────────────────────────
 * `isAdministrator`, `canPost` and `isPresent` are a SNAPSHOT of the last thing Telegram told us,
 * which can be minutes or weeks old. An operator who promoted the bot thirty seconds ago would be
 * locked out of a group that now works perfectly if this treated that snapshot as current. So a
 * status annotates the row and the server — which asks Telegram again, at the moment of binding —
 * decides. The one exception is `alreadyBound`, which the console knows for certain because it is
 * computed from the operator's own destination list.
 */
export function ChatPicker({
  chats,
  isLoading,
  isError,
  selectedChatId,
  onPick,
}: {
  chats: DiscoveredChat[] | undefined;
  isLoading: boolean;
  isError: boolean;
  /** The chat id currently in the group field, so the chosen row can show as chosen. */
  selectedChatId: string | null;
  onPick: (chat: DiscoveredChat) => void;
}) {
  const t = useT(telegramMessages);

  if (isLoading) {
    return (
      <section className="space-y-2" aria-busy="true">
        <p className="text-sm font-medium">{t('telegram.picker.title')}</p>
        <p className="text-xs text-[var(--muted-foreground)]">{t('telegram.picker.loading')}</p>
        <Skeleton className="h-16 w-full" />
      </section>
    );
  }

  // A failure here is NOT a failure of the dialog: pasting a link still works, and for a public
  // group it always did. Saying so keeps a degraded list from reading as a broken screen.
  if (isError) {
    return (
      <section className="space-y-2">
        <p className="text-sm font-medium">{t('telegram.picker.title')}</p>
        <Alert tone="warning">{t('telegram.picker.error')}</Alert>
      </section>
    );
  }

  const rows = chats ?? [];

  return (
    <section className="space-y-2">
      <p className="text-sm font-medium">{t('telegram.picker.title')}</p>
      <p className="text-xs text-[var(--muted-foreground)]">{t('telegram.picker.hint')}</p>

      {rows.length === 0 ? (
        // The empty state carries the instructions, because an operator who reaches this dialog with
        // nothing in the list is exactly the person who has not yet added the bot anywhere.
        <div className="rounded-lg border border-dashed border-[var(--border)] p-4 text-center">
          <p className="text-sm font-medium">{t('telegram.picker.empty.title')}</p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            {t('telegram.picker.empty.body')}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
          {rows.map((chat) => (
            <ChatRow
              key={chat.chatId}
              chat={chat}
              selected={chat.chatId === selectedChatId}
              onPick={onPick}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function ChatRow({
  chat,
  selected,
  onPick,
}: {
  chat: DiscoveredChat;
  selected: boolean;
  onPick: (chat: DiscoveredChat) => void;
}) {
  const t = useT(telegramMessages);

  // The chat id is the fallback name, not a blank: a group Telegram sent us no title for is still
  // pickable, and showing nothing would make it look like a rendering fault.
  const name = chat.title ?? chat.chatId;
  const handle = chat.username === null ? t('telegram.picker.private') : `@${chat.username}`;

  return (
    <li className="flex items-center justify-between gap-3 p-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="truncate font-mono text-xs text-[var(--muted-foreground)]">{handle}</p>
        <p className="mt-1 text-xs text-[var(--muted-foreground)]">
          {t(`telegram.picker.status.${chat.status}` as 'telegram.picker.status.ADMINISTRATOR')}
        </p>
      </div>

      {chat.alreadyBound ? (
        // The one certainty on this screen — computed from the operator's own destinations rather
        // than from a Telegram snapshot — so it is the one thing allowed to take the button away.
        <Badge tone="muted">{t('telegram.picker.bound')}</Badge>
      ) : (
        <Button
          type="button"
          size="sm"
          variant={selected ? 'primary' : 'secondary'}
          onClick={() => {
            onPick(chat);
          }}
          aria-label={`${t('telegram.picker.use')}: ${name}`}
        >
          {t('telegram.picker.use')}
        </Button>
      )}
    </li>
  );
}
