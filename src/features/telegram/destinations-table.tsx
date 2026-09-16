import { CheckCircle2, Send, XCircle } from 'lucide-react';

import { Can, CopyableValue, TimeAgo } from '@/components/common';
import {
  Badge,
  Button,
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { useT } from '@/lib/i18n/use-translation';
import { cn } from '@/lib/utils';
import type { TelegramDestination } from '@/types/telegram-destination';

import { telegramMessages } from './messages';

/**
 * Where the bot publishes, one row per group or channel.
 *
 * ── THE COLUMN THAT EARNS ITS PLACE IS "STATUS" ───────────────────────────────────────────────
 * Not whether the row is enabled — that is a switch the operator set themselves and already knows
 * about — but whether the LAST attempt worked. A destination that has quietly stopped delivering
 * looks exactly like a healthy one in every other column, which is the failure this screen exists
 * to make visible. So a row carrying `lastError` is tinted and prints Telegram's own words, and a
 * row that has never been verified says that rather than showing a reassuring blank.
 *
 * ── WHY THE GROUP'S NAME, NOT ITS ID ──────────────────────────────────────────────────────────
 * The id is a signed 64-bit number nobody recognises. The server caches the title from getChat at
 * bind time and refreshes it on every verify, so the operator reads the same name they see in
 * Telegram. The id is still there, copyable, for when they need to give it to someone.
 */
export function DestinationsTable({
  destinations,
  onEdit,
  onRemove,
  onTest,
  onCheck,
  testingId,
  checkingId,
}: {
  destinations: readonly TelegramDestination[];
  onEdit: (destination: TelegramDestination) => void;
  onRemove: (destination: TelegramDestination) => void;
  onTest: (destination: TelegramDestination) => void;
  /**
   * Re-verify WITHOUT posting. Offered to readers as well as writers, deliberately: "is this still
   * working?" is a support question, and answering it should not require the authority to change
   * anything or the willingness to put a test message in the operator's group.
   */
  onCheck: (destination: TelegramDestination) => void;
  /** The row whose test is in flight, so only that button spins. */
  testingId: string | null;
  checkingId: string | null;
}) {
  const t = useT(telegramMessages);

  return (
    <Table>
      <TableCaption className="sr-only">
        {t('telegram.caption', { count: destinations.length })}
      </TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>{t('telegram.col.destination')}</TableHead>
          <TableHead>{t('telegram.col.type')}</TableHead>
          <TableHead>{t('telegram.col.categories')}</TableHead>
          <TableHead>{t('telegram.col.status')}</TableHead>
          <TableHead>{t('telegram.col.lastPublished')}</TableHead>
          <TableHead className="text-end">{t('telegram.col.actions')}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {destinations.map((destination) => {
          const name = destination.displayName ?? destination.title ?? destination.chatId;
          const failing = destination.lastError !== null;

          return (
            <TableRow
              key={destination.id}
              className={cn(
                failing && 'bg-[var(--danger-muted)]/40',
                !destination.isActive && 'opacity-60',
              )}
            >
              <TableCell>
                <p className="font-medium">{name}</p>
                {destination.username === null ? null : (
                  <p className="text-xs text-[var(--muted-foreground)]">@{destination.username}</p>
                )}
                <CopyableValue value={destination.chatId} />
              </TableCell>

              <TableCell>
                <Badge tone="neutral">{destination.chatType}</Badge>
              </TableCell>

              <TableCell>
                <div className="flex flex-wrap gap-1">
                  {destination.categories.map((category) => (
                    <Badge key={category} tone="neutral">
                      {t(`telegram.category.${category}` as 'telegram.category.DEPOSIT')}
                    </Badge>
                  ))}
                </div>
              </TableCell>

              <TableCell>
                <div className="space-y-1">
                  {/* A word plus a colour, never a colour alone. */}
                  <Badge tone={destination.isActive ? 'success' : 'neutral'}>
                    {destination.isActive
                      ? t('telegram.status.active')
                      : t('telegram.status.inactive')}
                  </Badge>

                  {failing ? (
                    <p className="flex items-start gap-1 text-xs text-[var(--danger)]">
                      <XCircle aria-hidden="true" className="mt-0.5 size-3 shrink-0" />
                      {/* Telegram's own words, verbatim. A paraphrase here would be one more layer
                          between the operator and whatever is actually wrong. */}
                      <span>{destination.lastError}</span>
                    </p>
                  ) : destination.lastVerifiedAt === null ? (
                    <p className="text-xs text-[var(--muted-foreground)]">
                      {t('telegram.status.neverVerified')}
                    </p>
                  ) : (
                    <p className="flex items-center gap-1 text-xs text-[var(--muted-foreground)]">
                      <CheckCircle2 aria-hidden="true" className="size-3 shrink-0" />
                      <TimeAgo value={destination.lastVerifiedAt} />
                    </p>
                  )}
                </div>
              </TableCell>

              <TableCell>
                {destination.lastPublishedAt === null ? (
                  <span className="text-xs text-[var(--muted-foreground)]">
                    {t('telegram.status.neverPublished')}
                  </span>
                ) : (
                  <TimeAgo
                    value={destination.lastPublishedAt}
                    className="text-[var(--muted-foreground)]"
                  />
                )}
              </TableCell>

              <TableCell className="text-end">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  {/* Outside the Can: a reader may re-check, because it sends nothing and changes
                      nothing an operator can see except how fresh the verification is. */}
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={checkingId === destination.id}
                    onClick={() => {
                      onCheck(destination);
                    }}
                    aria-label={`${t('telegram.action.check')} — ${name}`}
                  >
                    {t('telegram.action.check')}
                  </Button>

                  <Can capability="telegramDestinations.write">
                    <Button
                      variant="secondary"
                      size="sm"
                      loading={testingId === destination.id}
                      onClick={() => {
                        onTest(destination);
                      }}
                      aria-label={`${t('telegram.action.test')} — ${name}`}
                    >
                      <Send aria-hidden="true" />
                      {t('telegram.action.test')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        onEdit(destination);
                      }}
                      aria-label={`${t('telegram.action.edit')} — ${name}`}
                    >
                      {t('telegram.action.edit')}
                    </Button>
                    {destination.isActive ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          onRemove(destination);
                        }}
                        aria-label={`${t('telegram.action.remove')} — ${name}`}
                      >
                        {t('telegram.action.remove')}
                      </Button>
                    ) : null}
                  </Can>
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
