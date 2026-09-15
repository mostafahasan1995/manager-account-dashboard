import { useQueryClient } from '@tanstack/react-query';
import { ExternalLink, ListChecks, Send, Unlink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Countdown } from '@/components/common/time';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage } from '@/lib/api/errors';
import {
  TENANT_CHAT_POLL_MS,
  useBindTenantChat,
  useIssueTenantBindLink,
  useTenant,
  useTenantDiscoveredChats,
  useUnbindTenantChat,
} from '@/lib/api/queries';
import { tenantHealthKeys, tenantKeys } from '@/lib/api/query-keys';
import { useT } from '@/lib/i18n/use-translation';
import type {
  TelegramBindLink,
  TelegramChatPurpose,
  Tenant,
  TenantChatsHealth,
  TenantDiscoveredChat,
} from '@/types';

import { chatRejectionReasonOf, useChatRejectionSentence } from './chat-rejection';
import { sightingFor } from './chat-sighting';
import { tenantMessages } from './messages';

/**
 * Binding an operator's staff group or feed group (owner decisions 2 and 5, 2026-09-15).
 *
 * ── THE BUTTON IS THE PRIMARY PATH ────────────────────────────────────────────────────────────
 * "Add bot to staff group" asks the backend for a one-time `t.me/<bot>?startgroup=<nonce>&admin=…`
 * link and opens it. Telegram then asks the owner which group, adds the bot there as an
 * administrator, and the backend binds that exact group when the bot's `/start <nonce>` arrives. Nobody
 * types a chat id and nobody picks from a list of strangers' groups, which is why it comes first.
 *
 * The result is never pushed to the console, so while a link is out this re-reads the operator every
 * few seconds, and stops the moment the bound chat changes, the link expires, or the admin dismisses
 * it. Without the last two it would poll forever: a link nobody uses, or one opened in the group that
 * is already bound (the backend changes nothing), never changes the row. At `expiresAt` the step
 * reads the operator once more, so a bind that landed in the final seconds still shows as bound.
 *
 * The link is a bearer credential for pointing review cards (player names, amounts) at a chat. It is
 * held only while the step shows it — in this component's state and the mutation's result, both
 * dropped on dismiss and on unmount (`reset()`, and `gcTime: 0` on the mutation) — and never stored
 * or logged. Dismissing does not revoke it: it still works in Telegram until it expires.
 *
 * ── THE LIST IS THE FALLBACK ──────────────────────────────────────────────────────────────────
 * A group the bot joined any other way is in this operator's chat directory — read from
 * `/v1/admin/tenants/:id/telegram/chats`, which names the operator in the path, never from the
 * switcher-scoped `/v1/admin/telegram/chats`. Rows show who added the bot, because picking a stranger's
 * group would leak money data into it. Being listed is never permission: the server asks Telegram
 * again at the moment of binding, so snapshot flags annotate rows rather than disable them. Only a
 * channel and a group's dead pre-supergroup id lose the button: neither can ever be bound as itself.
 */
export function TenantChatBinding({
  tenant,
  purpose,
}: {
  tenant: Tenant;
  purpose: TelegramChatPurpose;
}) {
  const t = useT(tenantMessages);
  const rejectionSentence = useChatRejectionSentence();
  const queryClient = useQueryClient();
  const issue = useIssueTenantBindLink();
  const bind = useBindTenantChat();
  const unbind = useUnbindTenantChat();

  const [pending, setPending] = useState<{
    link: TelegramBindLink;
    boundBefore: string | null;
    /** Past `expiresAt`: the link can no longer bind anything, so nothing is waited for. */
    expired: boolean;
  } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [refusal, setRefusal] = useState<unknown>(null);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  // Whether the bind already landed decides whether to keep polling, so it is read from the cache
  // BEFORE the polling query is declared. Reading is all this does; the query below subscribes.
  const cached = queryClient.getQueryData<Tenant>(tenantKeys.detail(tenant.id)) ?? tenant;
  const landed = pending !== null && chatOf(cached, purpose) !== pending.boundBefore;
  const waiting = pending !== null && !pending.expired && !landed;
  const live = useTenant(tenant.id, {
    refetchIntervalMs: waiting || pickerOpen ? TENANT_CHAT_POLL_MS : false,
  });
  const current = live.data ?? tenant;
  const boundChatId = chatOf(current, purpose);
  const arrived = pending !== null && boundChatId !== pending.boundBefore && boundChatId !== null;

  // A bind that happened in Telegram also changed what health says about this group.
  useEffect(() => {
    if (arrived)
      void queryClient.invalidateQueries({ queryKey: tenantHealthKeys.detail(tenant.id) });
  }, [arrived, queryClient, tenant.id]);

  const chats = useTenantDiscoveredChats(tenant.id, {
    enabled: pickerOpen,
    refetchIntervalMs: TENANT_CHAT_POLL_MS,
  });

  // At `expiresAt` the link stops being worth waiting for. The timer flips the flag, not the render,
  // and asks for the operator once more so a bind from the last seconds is not reported as expired.
  const liveLink = pending?.expired === false ? pending.link : null;
  useEffect(() => {
    if (liveLink === null) return;
    const timer = window.setTimeout(() => {
      setPending((current) =>
        current !== null && current.link === liveLink ? { ...current, expired: true } : current,
      );
      void queryClient.invalidateQueries({ queryKey: tenantKeys.detail(tenant.id) });
    }, msUntil(liveLink.expiresAt));
    return () => {
      window.clearTimeout(timer);
    };
  }, [liveLink, queryClient, tenant.id]);

  // The URL leaves memory with the step, not five minutes later with TanStack's mutation cache.
  const { reset: resetIssue } = issue;
  useEffect(
    () => () => {
      resetIssue();
    },
    [resetIssue],
  );

  const dismiss = () => {
    setPending(null);
    resetIssue();
  };

  const openLink = () => {
    setRefusal(null);
    issue.mutate(
      { id: tenant.id, purpose },
      {
        onSuccess: (link) => {
          setPending({ link, boundBefore: boundChatId, expired: false });
          // A popup blocker may refuse a tab opened after a request; the link is also on screen.
          window.open(link.url, '_blank', 'noopener,noreferrer');
        },
        onError: (error) => {
          toast.error(t('tenants.bind.linkErrorTitle'), { description: errorMessage(error) });
        },
      },
    );
  };

  const pick = (chat: TenantDiscoveredChat) => {
    setRefusal(null);
    const name = chat.title ?? chat.chatId;
    bind.mutate(
      { id: tenant.id, purpose, chatId: chat.chatId },
      {
        onSuccess: () => {
          setPickerOpen(false);
          toast.success(
            purpose === 'STAFF'
              ? t('tenants.bind.boundStaffToast', { name })
              : t('tenants.bind.boundFeedToast', { name }),
          );
        },
        onError: (error) => {
          setRefusal(error);
        },
      },
    );
  };

  const remove = () => {
    setRemoveError(null);
    unbind.mutate(
      { id: tenant.id, purpose },
      {
        onSuccess: () => {
          setRemoveOpen(false);
          toast.success(t('tenants.bind.removedToast'));
        },
        onError: (error) => {
          setRemoveError(errorMessage(error));
        },
      },
    );
  };

  const addLabel =
    boundChatId !== null
      ? t('tenants.bind.another')
      : purpose === 'STAFF'
        ? t('tenants.bind.addStaff')
        : t('tenants.bind.addFeed');

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Button
          variant={boundChatId === null && purpose === 'STAFF' ? 'primary' : 'secondary'}
          size="sm"
          loading={issue.isPending}
          onClick={openLink}
        >
          <Send className="size-3.5 rtl:-scale-x-100" />
          {addLabel}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          aria-expanded={pickerOpen}
          onClick={() => {
            setRefusal(null);
            setPickerOpen(!pickerOpen);
          }}
        >
          <ListChecks className="size-3.5" />
          {pickerOpen ? t('tenants.bind.pickerHide') : t('tenants.bind.pickerToggle')}
        </Button>
        {boundChatId === null ? null : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setRemoveError(null);
              setRemoveOpen(true);
            }}
          >
            <Unlink className="size-3.5" />
            {t('tenants.bind.remove')}
          </Button>
        )}
      </div>

      {pending === null ? null : arrived ? (
        <Alert tone="success" title={t('tenants.bind.boundTitle')}>
          <p>
            {purpose === 'STAFF'
              ? t('tenants.bind.boundStaff', { name: boundChatId })
              : t('tenants.bind.boundFeed', { name: boundChatId })}
          </p>
          <div className="pt-2">
            <Button variant="secondary" size="sm" onClick={dismiss}>
              {t('tenants.bind.done')}
            </Button>
          </div>
        </Alert>
      ) : pending.expired ? (
        <Alert tone="warning" title={t('tenants.bind.expiredTitle')}>
          <p>{t('tenants.bind.expiredBody')}</p>
          <div className="flex flex-wrap gap-2 pt-2">
            <Button variant="secondary" size="sm" loading={issue.isPending} onClick={openLink}>
              <Send className="size-3.5 rtl:-scale-x-100" />
              {t('tenants.bind.newLink')}
            </Button>
            <Button variant="ghost" size="sm" onClick={dismiss}>
              {t('tenants.bind.dismiss')}
            </Button>
          </div>
        </Alert>
      ) : (
        <Alert tone="info" title={t('tenants.bind.openedTitle')}>
          <p>{t('tenants.bind.openedBody')}</p>
          <p className="mt-1 flex flex-wrap items-center gap-1.5">
            <span>{t('tenants.bind.timeLeft')}</span>
            <Countdown target={pending.link.expiresAt} />
          </p>
          <p className="mt-2">
            <a
              href={pending.link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-[var(--primary)] underline underline-offset-4"
            >
              <ExternalLink className="size-3.5" />
              {t('tenants.bind.openAgain')}
            </a>
          </p>
          <div className="pt-2">
            <Button variant="ghost" size="sm" onClick={dismiss}>
              {t('tenants.bind.dismiss')}
            </Button>
          </div>
        </Alert>
      )}

      {pickerOpen ? (
        <ChatDirectory
          purpose={purpose}
          chats={chats.data}
          isLoading={chats.isPending}
          isError={chats.isError}
          binding={bind.isPending}
          onPick={pick}
        />
      ) : null}

      {refusal === null ? null : (
        <Alert
          tone="danger"
          title={
            chatRejectionReasonOf(refusal) === null
              ? t('tenants.bind.errorTitle')
              : t('tenants.bind.refusedTitle')
          }
        >
          {rejectionSentence(refusal)}
        </Alert>
      )}

      <ConfirmDialog
        open={removeOpen}
        onOpenChange={setRemoveOpen}
        title={
          purpose === 'STAFF'
            ? t('tenants.bind.removeStaffTitle', { name: current.displayName })
            : t('tenants.bind.removeFeedTitle', { name: current.displayName })
        }
        description={
          purpose === 'STAFF' ? t('tenants.bind.removeStaffBody') : t('tenants.bind.removeFeedBody')
        }
        confirmLabel={t('tenants.bind.removeLabel')}
        destructive
        loading={unbind.isPending}
        onConfirm={remove}
      >
        {removeError === null ? null : (
          <Alert tone="danger" title={t('tenants.bind.removeErrorTitle')}>
            {removeError}
          </Alert>
        )}
      </ConfirmDialog>
    </div>
  );
}

function chatOf(tenant: Tenant, purpose: TelegramChatPurpose): string | null {
  return purpose === 'STAFF' ? tenant.adminChatId : tenant.feedChatId;
}

/** `setTimeout`'s ceiling: a longer delay fires at once. A bind link lives fifteen minutes. */
const MAX_TIMER_MS = 2_147_483_647;

/** Milliseconds until an ISO instant, never negative. An unreadable instant counts as already past. */
function msUntil(iso: string): number {
  const left = Date.parse(iso) - Date.now();
  return Number.isFinite(left) ? Math.min(Math.max(left, 0), MAX_TIMER_MS) : 0;
}

function ChatDirectory({
  purpose,
  chats,
  isLoading,
  isError,
  binding,
  onPick,
}: {
  purpose: TelegramChatPurpose;
  chats: TenantDiscoveredChat[] | undefined;
  isLoading: boolean;
  isError: boolean;
  binding: boolean;
  onPick: (chat: TenantDiscoveredChat) => void;
}) {
  const t = useT(tenantMessages);

  if (isLoading) {
    return (
      <section className="space-y-2" aria-busy="true">
        <p className="text-sm font-medium">{t('tenants.bind.pickerTitle')}</p>
        <p className="text-xs text-[var(--muted-foreground)]">{t('tenants.bind.pickerLoading')}</p>
        <Skeleton className="h-16 w-full" />
      </section>
    );
  }

  if (isError) {
    return (
      <section className="space-y-2">
        <p className="text-sm font-medium">{t('tenants.bind.pickerTitle')}</p>
        <Alert tone="warning">{t('tenants.bind.pickerError')}</Alert>
      </section>
    );
  }

  const rows = chats ?? [];

  return (
    <section className="space-y-2">
      <p className="text-sm font-medium">{t('tenants.bind.pickerTitle')}</p>
      <p className="text-xs text-[var(--muted-foreground)]">{t('tenants.bind.pickerHint')}</p>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] p-4 text-center">
          <p className="text-sm font-medium">{t('tenants.bind.pickerEmptyTitle')}</p>
          <p className="mt-1 text-xs text-[var(--muted-foreground)]">
            {t('tenants.bind.pickerEmptyBody')}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--border)] rounded-lg border border-[var(--border)]">
          {rows.map((chat) => (
            <DirectoryRow
              key={chat.chatId}
              chat={chat}
              purpose={purpose}
              binding={binding}
              onPick={onPick}
            />
          ))}
        </ul>
      )}
      <p className="text-xs text-[var(--muted-foreground)]">{t('tenants.bind.laptopHint')}</p>
    </section>
  );
}

const STATUS_KEYS = {
  CREATOR: 'tenants.bind.status.CREATOR',
  ADMINISTRATOR: 'tenants.bind.status.ADMINISTRATOR',
  MEMBER: 'tenants.bind.status.MEMBER',
  RESTRICTED: 'tenants.bind.status.RESTRICTED',
  LEFT: 'tenants.bind.status.LEFT',
  KICKED: 'tenants.bind.status.KICKED',
} as const;

function DirectoryRow({
  chat,
  purpose,
  binding,
  onPick,
}: {
  chat: TenantDiscoveredChat;
  purpose: TelegramChatPurpose;
  binding: boolean;
  onPick: (chat: TenantDiscoveredChat) => void;
}) {
  const t = useT(tenantMessages);
  // The chat id is the fallback name, not a blank: a group with no title is still a real group.
  const name = chat.title ?? chat.chatId;
  const handle = chat.username === null ? t('tenants.bind.private') : `@${chat.username}`;
  const addedBy =
    chat.lastChangedByUsername !== null
      ? t('tenants.bind.addedBy', { username: chat.lastChangedByUsername })
      : chat.lastChangedByTelegramUserId !== null
        ? t('tenants.bind.addedById', { id: chat.lastChangedByTelegramUserId })
        : null;
  const boundHere = chat.boundAs.includes(purpose);
  const unbindable = chat.chatType === 'CHANNEL' || chat.migratedToChatId !== null;

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 p-3">
      <div className="min-w-0 space-y-0.5">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
          <span className="truncate">{name}</span>
          {chat.boundAs.map((bound) => (
            <Badge key={bound} tone={bound === purpose ? 'success' : 'muted'}>
              {bound === 'STAFF' ? t('tenants.bind.boundAsStaff') : t('tenants.bind.boundAsFeed')}
            </Badge>
          ))}
        </p>
        <p className="truncate font-mono text-xs text-[var(--muted-foreground)]">{handle}</p>
        <p className="text-xs text-[var(--muted-foreground)]">{t(STATUS_KEYS[chat.status])}</p>
        {addedBy === null ? null : (
          <p className="text-xs text-[var(--muted-foreground)]">{addedBy}</p>
        )}
        {chat.migratedToChatId === null ? null : (
          <p className="text-xs text-[var(--warning)]">{t('tenants.bind.migrated')}</p>
        )}
        {chat.chatType === 'CHANNEL' ? (
          <p className="text-xs text-[var(--warning)]">{t('tenants.bind.channel')}</p>
        ) : null}
      </div>

      {boundHere || unbindable ? null : (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={binding}
          onClick={() => {
            onPick(chat);
          }}
          aria-label={`${t('tenants.bind.use')}: ${name}`}
        >
          {t('tenants.bind.use')}
        </Button>
      )}
    </li>
  );
}

/**
 * What health knows about the bound groups that the operator row cannot say: the bot was REMOVED from
 * one, or can no longer work it. The binding is kept on purpose, so without this the panel would show
 * a bound group that silently receives nothing.
 *
 * A sighting is trusted only while it is about the chat still bound — health is read less often than
 * the row, and a group bound a moment ago must not inherit the previous group's "removed".
 */
export function TenantChatHealthAlerts({
  tenant,
  chats,
}: {
  tenant: Tenant;
  chats: TenantChatsHealth;
}) {
  const t = useT(tenantMessages);
  const staff = sightingFor(tenant.adminChatId, chats.staff);
  const feed = sightingFor(tenant.feedChatId, chats.feed);

  return (
    <>
      {staff === null ? null : staff.isPresent === false ? (
        <Alert
          tone="danger"
          title={t('tenants.chats.staffRemovedTitle', { name: staff.title ?? staff.chatId ?? '' })}
        >
          {t('tenants.chats.staffRemovedBody')}
        </Alert>
      ) : staff.isAdministrator === false || staff.canPost === false ? (
        <Alert
          tone="warning"
          title={t('tenants.chats.staffNotAdminTitle', { name: staff.title ?? staff.chatId ?? '' })}
        >
          {t('tenants.chats.staffNotAdminBody')}
        </Alert>
      ) : null}

      {feed?.isPresent === false ? (
        <Alert
          tone="warning"
          title={t('tenants.chats.feedRemovedTitle', { name: feed.title ?? feed.chatId ?? '' })}
        >
          {t('tenants.chats.feedRemovedBody')}
        </Alert>
      ) : null}
    </>
  );
}
