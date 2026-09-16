import { useState, type SyntheticEvent } from 'react';

import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Switch,
} from '@/components/ui';
import { errorMessage } from '@/lib/api/errors';
import {
  useCreateTelegramDestination,
  useDiscoveredTelegramChats,
  useUpdateTelegramDestination,
} from '@/lib/api/queries';
import { useT } from '@/lib/i18n/use-translation';
import {
  LIVE_CATEGORIES,
  NOTIFICATION_CATEGORIES,
  type DiscoveredChat,
  type NotificationCategory,
  type TelegramDestination,
} from '@/types/telegram-destination';

import { ChatPicker } from './chat-picker';
import { telegramMessages } from './messages';
import { failureSentence } from './failure-sentence';

/**
 * Adding a destination, and editing one.
 *
 * ── WHY ONE COMPONENT FOR BOTH, AND WHERE THEY DIVERGE ────────────────────────────────────────
 * They share the categories picker and the enabled switch, which is most of the form. They differ
 * in exactly one field, and it is the important one: ADD asks for the group, EDIT does not offer it.
 * Repointing a destination at a different chat is not an edit — the row's whole meaning is "the bot
 * proved it can post HERE", and letting the URL change would either carry that proof to a chat it
 * was never made about, or silently re-verify behind an update the operator thought was cosmetic.
 * Remove and add instead; both are one click, and the remove is reversible.
 *
 * ── TWO WAYS TO NAME A GROUP, AND WHY THERE HAD TO BE TWO ─────────────────────────────────────
 * Pasting a link works for a PUBLIC group, because it has an @username Telegram will resolve. A
 * PRIVATE group has none — its only shareable handle is an invite link, which no bot can follow or
 * resolve — so the text field alone had no correct answer for one, and an operator with a private
 * group was simply stuck. The pick-list above it is that answer: the bot reports the chats it has
 * been added to, and choosing one fills this same field with the chat id. Deliberately the SAME
 * field, so what is about to be submitted stays visible instead of becoming hidden state.
 *
 * ── THE ERROR IS THE FEATURE ──────────────────────────────────────────────────────────────────
 * Four of the ways this can fail look identical from outside — nothing arrives — and are fixed by
 * four different people. The server answers with a machine `reason`; `failureSentence` turns it into
 * the sentence that names who fixes it. A generic "could not add destination" would be the whole
 * problem this screen exists to solve, restated.
 */
export function DestinationFormDialog({
  destination,
  open,
  onOpenChange,
}: {
  /** Null to add a new destination; a row to edit it. */
  destination: TelegramDestination | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/* Mounted only while open, so every opening starts from the row's own values rather than
            from whichever destination was edited last. */}
        <DestinationForm
          destination={destination}
          onDone={() => {
            onOpenChange(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

function DestinationForm({
  destination,
  onDone,
}: {
  destination: TelegramDestination | null;
  onDone: () => void;
}) {
  const t = useT(telegramMessages);
  const create = useCreateTelegramDestination();
  const update = useUpdateTelegramDestination();
  const editing = destination !== null;

  const [url, setUrl] = useState('');
  const [displayName, setDisplayName] = useState(destination?.displayName ?? '');
  const [categories, setCategories] = useState<NotificationCategory[]>(
    destination?.categories ?? [...LIVE_CATEGORIES],
  );
  const [isActive, setIsActive] = useState(destination?.isActive ?? true);
  const [submitted, setSubmitted] = useState(false);
  /** The row that was clicked, kept ONLY to confirm it by name — the id itself lives in `url`. */
  const [picked, setPicked] = useState<DiscoveredChat | null>(null);

  // Fetched only in the add flow. Editing cannot change the chat, so the list would be a request
  // for a section that is not rendered.
  const chats = useDiscoveredTelegramChats(!editing);

  const mutation = editing ? update : create;
  const trimmedUrl = url.trim();

  const urlError = editing || trimmedUrl.length > 0 ? null : t('telegram.field.url.hint');
  // Enforced here AND by the server AND by a database CHECK. A destination subscribed to nothing
  // is a row that silently does nothing, which is the failure this whole screen removes.
  const categoriesError = categories.length === 0 ? t('telegram.field.categories.hint') : null;

  const toggle = (category: NotificationCategory) => {
    setCategories((current) =>
      current.includes(category)
        ? current.filter((member) => member !== category)
        : [...current, category],
    );
  };

  /**
   * Choosing a group from the list.
   *
   * The chat id goes into the visible field rather than into a hidden variable, because that field
   * is what the operator is about to submit and hiding it would make the form lie. The label is
   * filled in only when it is EMPTY — an operator who typed their own name for the group meant it,
   * and a click on a row is not a request to discard it.
   */
  const pick = (chat: DiscoveredChat) => {
    setPicked(chat);
    setUrl(chat.chatId);
    setDisplayName((current) => (current.trim().length === 0 ? (chat.title ?? '') : current));
  };

  const submit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitted(true);
    if (urlError !== null || categoriesError !== null) return;

    void (async () => {
      try {
        if (destination === null) {
          await create.mutateAsync({
            url: trimmedUrl,
            categories,
            isActive,
            ...(displayName.trim().length === 0 ? {} : { displayName: displayName.trim() }),
          });
        } else {
          await update.mutateAsync({
            id: destination.id,
            body: {
              categories,
              isActive,
              displayName: displayName.trim(),
            },
          });
        }
        onDone();
      } catch {
        // Left on screen, rendered from `mutation.error` below. Nothing was saved — the server
        // resolves and verifies before it writes — so the form stays exactly as it was typed.
      }
    })();
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{editing ? t('telegram.edit.title') : t('telegram.add.title')}</DialogTitle>
        <DialogDescription>
          {editing ? t('telegram.field.displayName.hint') : t('telegram.description')}
        </DialogDescription>
      </DialogHeader>

      {editing ? (
        // The chat itself, read-only: what this row is about, so an operator editing categories can
        // see which group they are editing without going back to the table.
        <div className="rounded-lg border border-[var(--border)] bg-[var(--muted)] p-3">
          <p className="font-medium">{destination.title ?? destination.chatId}</p>
          <p className="font-mono text-xs text-[var(--muted-foreground)]">
            {destination.username === null ? destination.chatId : `@${destination.username}`}
          </p>
        </div>
      ) : (
        <>
          <ChatPicker
            chats={chats.data}
            isLoading={chats.isPending}
            isError={chats.isError}
            selectedChatId={picked === null ? null : picked.chatId}
            onPick={pick}
          />

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-[var(--border)]" />
            <span className="text-xs text-[var(--muted-foreground)]">
              {t('telegram.picker.or')}
            </span>
            <span className="h-px flex-1 bg-[var(--border)]" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="destination-url">{t('telegram.field.url')}</Label>
            <Input
              id="destination-url"
              value={url}
              autoComplete="off"
              placeholder={t('telegram.field.url.placeholder')}
              onChange={(event) => {
                setUrl(event.target.value);
                // Typing over a picked id means the operator is naming a different chat. Keeping
                // the confirmation line would then credit the submission to the wrong group.
                setPicked(null);
              }}
              aria-invalid={submitted && urlError !== null}
              {...(submitted && urlError !== null
                ? { 'aria-describedby': 'destination-url-error' }
                : {})}
            />
            {picked === null ? (
              <p className="text-xs text-[var(--muted-foreground)]">
                {t('telegram.field.url.hint')}
              </p>
            ) : (
              // Says which group the opaque number belongs to, and says out loud that picking it
              // is not the same as proving it — the server still asks Telegram before saving.
              <p className="text-xs text-[var(--muted-foreground)]">
                {t('telegram.picker.selected', { name: picked.title ?? picked.chatId })}
              </p>
            )}
            {submitted && urlError !== null ? (
              <p id="destination-url-error" role="alert" className="text-sm text-[var(--danger)]">
                {urlError}
              </p>
            ) : null}
          </div>
        </>
      )}

      <div className="space-y-1.5">
        <Label htmlFor="destination-name">{t('telegram.field.displayName')}</Label>
        <Input
          id="destination-name"
          value={displayName}
          autoComplete="off"
          onChange={(event) => {
            setDisplayName(event.target.value);
          }}
        />
        <p className="text-xs text-[var(--muted-foreground)]">
          {t('telegram.field.displayName.hint')}
        </p>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t('telegram.field.categories')}</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {NOTIFICATION_CATEGORIES.map((category) => {
            const live = LIVE_CATEGORIES.includes(category);
            return (
              <label
                key={category}
                className="flex items-start gap-2 text-sm"
                htmlFor={`category-${category}`}
              >
                <Checkbox
                  id={`category-${category}`}
                  checked={categories.includes(category)}
                  onCheckedChange={() => {
                    toggle(category);
                  }}
                />
                <span>
                  {t(`telegram.category.${category}` as 'telegram.category.DEPOSIT')}
                  {/* Said out loud rather than hidden or disabled: subscribing to a category with
                      no producer yet is a legitimate thing to do — it starts arriving when the
                      platform starts emitting it — but an operator who ticks it and hears nothing
                      deserves to know why. */}
                  {live ? null : (
                    <span className="block text-xs text-[var(--muted-foreground)]">
                      {t('telegram.category.notLive')}
                    </span>
                  )}
                </span>
              </label>
            );
          })}
        </div>
        <p className="text-xs text-[var(--muted-foreground)]">
          {t('telegram.field.categories.hint')}
        </p>
        {submitted && categoriesError !== null ? (
          <p role="alert" className="text-sm text-[var(--danger)]">
            {categoriesError}
          </p>
        ) : null}
      </fieldset>

      <div className="flex items-center justify-between rounded-lg border border-[var(--border)] p-3">
        <Label htmlFor="destination-active">{t('telegram.field.active')}</Label>
        <Switch id="destination-active" checked={isActive} onCheckedChange={setIsActive} />
      </div>

      {mutation.error == null ? null : (
        <Alert tone="danger" title={t('telegram.test.failed')}>
          {failureSentence(mutation.error, t) ?? errorMessage(mutation.error)}
        </Alert>
      )}

      <DialogFooter>
        <Button type="button" variant="ghost" disabled={mutation.isPending} onClick={onDone}>
          {t('common.cancel')}
        </Button>
        <Button type="submit" variant="primary" loading={mutation.isPending}>
          {editing ? t('telegram.edit.submit') : t('telegram.add.submit')}
        </Button>
      </DialogFooter>
    </form>
  );
}
