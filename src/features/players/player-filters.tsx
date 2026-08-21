import { useNavigate, useSearch } from '@tanstack/react-router';
import { Search, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

import { pruneSearch, type PlayerSearch } from '@/app/search-schemas';
import {
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui';
import { useEnumLabel, useT } from '@/lib/i18n/use-translation';
import { PLAYER_STATUSES } from '@/types/enums';

import { playerMessages } from './messages';

/**
 * The filters above the player list.
 *
 * Support staff open this screen with a player on the phone and one thing to go on — a name, a
 * @username, a Telegram id or a phone number — so a single box searches all four at once, which is
 * exactly what the backend's `search` parameter spans.
 *
 * Typing writes to the URL after a short pause instead of on every keystroke. The URL is the state
 * here, and one history entry per character would make the back button useless.
 */

const SEARCH_DEBOUNCE_MS = 300;

/** Radix Select has no empty value, so "no filter" needs a sentinel of its own. */
const ANY = 'any';

export function PlayerFilters() {
  const navigate = useNavigate();
  const search = useSearch({ from: '/players' });
  const t = useT(playerMessages);
  const enumLabel = useEnumLabel();
  const [term, setTerm] = useState(search.search ?? '');

  const update = useCallback(
    (patch: Partial<PlayerSearch>) => {
      void navigate({
        // Naming the route is what types `prev` as this screen's filters rather than as every
        // screen's; `.` then changes the query string without touching the path.
        from: '/players',
        to: '.',
        // Any change to a filter invalidates the page the operator was on: offset 40 of a
        // different result set is a different set of people.
        search: (prev) => pruneSearch({ ...prev, ...patch, offset: undefined }),
      });
    },
    [navigate],
  );

  useEffect(() => {
    const trimmed = term.trim();
    if (trimmed === (search.search ?? '')) return;
    const timer = window.setTimeout(() => {
      update({ search: trimmed === '' ? undefined : trimmed });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [term, search.search, update]);

  // A URL that changed underneath the box — a back button, a pasted link, the clear button — has to
  // land in it. That happens during the render which brings the new value in rather than from an
  // effect, so the box never spends a frame disagreeing with the list it is filtering.
  const [urlTerm, setUrlTerm] = useState(search.search ?? '');
  if (urlTerm !== (search.search ?? '')) {
    setUrlTerm(search.search ?? '');
    setTerm(search.search ?? '');
  }

  const pendingOnly = search.status === 'PENDING_ICHANCY' && search.linked === false;
  const hasFilters =
    search.search !== undefined ||
    search.status !== undefined ||
    search.linked !== undefined ||
    search.telegramUserId !== undefined;

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="min-w-64 flex-1 space-y-1.5">
        <Label htmlFor="player-search">{t('players.filters.search')}</Label>
        <div className="relative">
          {/* Pinned to the edge the text starts at, which is the right-hand one in Arabic. */}
          <Search
            className="pointer-events-none absolute top-2.5 start-3 size-4 text-[var(--muted-foreground)]"
            aria-hidden="true"
          />
          <Input
            id="player-search"
            value={term}
            onChange={(event) => {
              setTerm(event.target.value);
            }}
            placeholder={t('players.filters.searchPlaceholder')}
            autoComplete="off"
            spellCheck={false}
            className="px-9"
          />
          {term === '' ? null : (
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-0.5 end-0.5 size-8"
              aria-label={t('players.filters.clearSearch')}
              onClick={() => {
                setTerm('');
                update({ search: undefined });
              }}
            >
              <X className="size-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div className="w-48 space-y-1.5">
        <Label htmlFor="player-status">{t('field.status')}</Label>
        <Select
          value={search.status ?? ANY}
          onValueChange={(value) => {
            update({ status: PLAYER_STATUSES.find((status) => status === value) });
          }}
        >
          <SelectTrigger id="player-status" aria-label={t('field.status')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>{t('players.filters.anyStatus')}</SelectItem>
            {PLAYER_STATUSES.map((status) => (
              <SelectItem key={status} value={status}>
                {enumLabel('playerStatus', status)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="w-48 space-y-1.5">
        <Label htmlFor="player-linked">{t('players.filters.linked')}</Label>
        <Select
          value={search.linked === undefined ? ANY : String(search.linked)}
          onValueChange={(value) => {
            update({ linked: value === ANY ? undefined : value === 'true' });
          }}
        >
          <SelectTrigger id="player-linked" aria-label={t('players.filters.linked')}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ANY}>{t('common.any')}</SelectItem>
            <SelectItem value="true">{t('players.ichancy.linked')}</SelectItem>
            <SelectItem value="false">{t('players.ichancy.notLinked')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button
        variant={pendingOnly ? 'primary' : 'secondary'}
        aria-pressed={pendingOnly}
        onClick={() => {
          update(
            pendingOnly
              ? { status: undefined, linked: undefined }
              : { status: 'PENDING_ICHANCY', linked: false },
          );
        }}
      >
        {t('players.filters.waitingForIchancy')}
      </Button>

      {hasFilters ? (
        <Button
          variant="ghost"
          onClick={() => {
            setTerm('');
            update({
              search: undefined,
              status: undefined,
              linked: undefined,
              telegramUserId: undefined,
            });
          }}
        >
          {t('common.clearFilters')}
        </Button>
      ) : null}
    </div>
  );
}
