import { Landmark, Pencil, Plus, Power, Wallet } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import {
  ActiveBadge,
  Can,
  ConfirmDialog,
  CopyableValue,
  EmptyState,
  ErrorState,
} from '@/components/common';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Skeleton,
  Tooltip,
} from '@/components/ui';
import { errorMessage } from '@/lib/api/errors';
import {
  usePaymentDestinations,
  useUpdateDestination,
  useUpdatePaymentMethod,
} from '@/lib/api/queries';
import { useEnumLabel, useT } from '@/lib/i18n/use-translation';
import type { PaymentDestination, PaymentMethod } from '@/types';

import { useFormatters } from '@/lib/i18n/use-format';

import { DeclaredBalanceDialog } from './declared-balance-dialog';
import { DestinationFormDialog } from './destination-form-dialog';
import { railMessages } from './messages';
import { isSeedPlaceholder } from './seed-placeholder';
import { detectWalletNetwork } from './wallet-address';
import { WalletBalance } from './wallet-balance';

/**
 * One payment method, as the operator has to think about it: what it is called, where its money
 * lands, and whether it can take a deposit right now.
 *
 * ── WHY EVERY METHOD AND NOT ONLY THE CRYPTO ONES ─────────────────────────────────────────────
 * This card started life as `UsdtRailCard` and was shown only for methods whose CODE was one of the
 * two this system seeds. An operator who created their own rails — `USDT`, `SHAM` — saw an empty
 * financial screen and asked where their rails had gone. A code is a name somebody types, so it can
 * never decide what appears. Every method gets a card; what differs between them is what a card can
 * truthfully say, which is decided by the RAIL and by the ADDRESS.
 *
 * ── WHY THREE WARNINGS AND NOT ONE ────────────────────────────────────────────────────────────
 * Entering an account is what an operator comes here to do, and on its own it changes nothing a
 * player can see. A crypto rail is provisioned INACTIVE, and the placeholder destination beside it
 * is provisioned ACTIVE — so after the paste the bot still offers nothing, and once the rail IS on,
 * the address a player is handed is a coin toss between theirs and a string. Neither leftover is
 * visible from the rails screen, which is how "I entered my wallet and nothing happened" happens.
 * This card names all three, and refuses to let the first one look finished.
 *
 * ── WHY THE ACCOUNT FORM IS NOT REBUILT HERE ──────────────────────────────────────────────────
 * `DestinationFormDialog` already carries the chain-address check, the read-it-back tick and the
 * locked-on-edit identifier. A second form would be a second place for those to be wrong, on the
 * one field in this console where being wrong cannot be undone.
 */
export function MethodAccountCard({ method }: { method: PaymentMethod }) {
  const t = useT(railMessages);
  const enumLabel = useEnumLabel();

  /*
   * The rail, never the code, decides whether this method pays on a chain. `CRYPTO` is a value the
   * backend's own enum defines; `USDT_TRC20` was only ever a guess about what an operator types.
   */
  const isChainRail = method.rail === 'CRYPTO';

  /*
   * ACTIVE destinations only. This card answers "can this method take money right now", and only an
   * active destination is ever handed to a player. Deactivated accounts are history, and history
   * belongs on the rails screen, where it can be filtered.
   */
  const destinations = usePaymentDestinations(method.id, false);
  const updateDestination = useUpdateDestination();
  const activateRail = useUpdatePaymentMethod();

  const [form, setForm] = useState<{ open: boolean; destination: PaymentDestination | null }>({
    open: false,
    destination: null,
  });
  const [pendingPlaceholder, setPendingPlaceholder] = useState<PaymentDestination | null>(null);

  const rows = destinations.data ?? [];
  const accounts = rows.filter((row) => !isSeedPlaceholder(row));
  const placeholders = rows.filter((row) => isSeedPlaceholder(row));

  const stopPlaceholder = async () => {
    if (pendingPlaceholder === null) return;
    try {
      await updateDestination.mutateAsync({ id: pendingPlaceholder.id, body: { isActive: false } });
      toast.success(t('financial.placeholder.stopped'), {
        description: t('financial.placeholder.stoppedBody'),
      });
      setPendingPlaceholder(null);
    } catch (caught) {
      toast.error(t('financial.placeholder.stopFailed'), { description: errorMessage(caught) });
    }
  };

  const activate = async () => {
    try {
      await activateRail.mutateAsync({ id: method.id, body: { isActive: true } });
      toast.success(t('financial.activate.done', { name: method.displayName }), {
        description: t('financial.activate.doneBody'),
      });
    } catch (caught) {
      toast.error(t('financial.activate.failed', { name: method.displayName }), {
        description: errorMessage(caught),
      });
    }
  };

  /*
   * The page is now a long list of these, so each one is a landmark named after the method. Without
   * it a screen-reader user arrives at "Edit Damascus office" with no way to tell which of a dozen
   * cards they are inside.
   */
  const headingId = `method-account-${method.id}`;

  return (
    <Card role="region" aria-labelledby={headingId}>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <CardTitle id={headingId}>{method.displayName}</CardTitle>
          <CardDescription>
            {isChainRail ? t('financial.card.cryptoDescription') : t('financial.card.description')}
          </CardDescription>
          {/* The code is what the operator typed and what every other screen keys off; the rail is
              what the console actually behaves on. Both are on the card so the two cannot be
              confused for one another again. */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <code className="font-mono text-xs text-[var(--muted-foreground)]">{method.code}</code>
            <Badge tone="muted">{enumLabel('paymentRail', method.rail)}</Badge>
          </div>
        </div>
        <ActiveBadge isActive={method.isActive} />
      </CardHeader>

      <CardContent className="space-y-4">
        {destinations.isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-9 w-full" />
          </div>
        ) : destinations.error != null ? (
          <ErrorState
            error={destinations.error}
            onRetry={() => {
              void destinations.refetch();
            }}
          />
        ) : accounts.length === 0 ? (
          <>
            {/* Danger, not warning: while this is on screen the method either shows a player
                nothing or shows them a placeholder, and the second ending is money nobody can
                recover. */}
            <Alert tone="danger" title={t('financial.notReady.title')}>
              {placeholders.length === 0
                ? t('financial.notReady.body')
                : t('financial.notReady.placeholderBody')}
            </Alert>
            <EmptyState
              icon={isChainRail ? <Wallet className="size-5" /> : <Landmark className="size-5" />}
              title={
                isChainRail ? t('financial.address.emptyTitle') : t('financial.account.emptyTitle')
              }
              description={
                isChainRail ? t('financial.address.emptyBody') : t('financial.account.emptyBody')
              }
              action={
                <Can capability="paymentMethods.write">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setForm({ open: true, destination: null });
                    }}
                  >
                    <Plus className="size-4" />
                    {isChainRail ? t('financial.address.set') : t('financial.account.set')}
                  </Button>
                </Can>
              }
            />
          </>
        ) : (
          <>
            <div className="space-y-2">
              <p className="text-xs font-medium text-[var(--muted-foreground)]">
                {isChainRail ? t('financial.address.heading') : t('financial.account.heading')}
              </p>
              <ul className="space-y-2">
                {accounts.map((destination) => (
                  <AccountRow
                    key={destination.id}
                    destination={destination}
                    isChainRail={isChainRail}
                    onEdit={() => {
                      setForm({ open: true, destination });
                    }}
                  />
                ))}
              </ul>
            </div>

            {placeholders.length === 0 ? null : (
              <Alert tone="danger" title={t('financial.placeholder.title')}>
                <p>{t('financial.placeholder.body')}</p>
                <Can capability="paymentMethods.write">
                  <Button
                    variant="danger"
                    size="sm"
                    className="mt-2"
                    onClick={() => {
                      setPendingPlaceholder(placeholders[0] ?? null);
                    }}
                  >
                    <Power className="size-4" />
                    {t('financial.placeholder.stop')}
                  </Button>
                </Can>
              </Alert>
            )}

            {method.isActive ? null : (
              <Alert tone="warning" title={t('financial.activate.title')}>
                <p>{t('financial.activate.body')}</p>
                <Can capability="paymentMethods.write">
                  <Button
                    variant="primary"
                    size="sm"
                    className="mt-2"
                    loading={activateRail.isPending}
                    onClick={() => {
                      void activate();
                    }}
                  >
                    {t('financial.activate.action')}
                  </Button>
                </Can>
              </Alert>
            )}

            <Can capability="paymentMethods.write">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setForm({ open: true, destination: null });
                }}
              >
                <Plus className="size-4" />
                {isChainRail
                  ? t('financial.address.addAnother')
                  : t('financial.account.addAnother')}
              </Button>
            </Can>
          </>
        )}
      </CardContent>

      {/* The same dialog the rails screen uses, for both adding and editing. Reused rather than
          rebuilt because it is the piece that locks `accountIdentifier` on edit — an account number
          cannot be corrected in place without silently redirecting the money already pointed at
          it. */}
      <DestinationFormDialog
        open={form.open}
        onOpenChange={(open) => {
          setForm((current) => ({ ...current, open }));
        }}
        method={method}
        destination={form.destination}
      />

      <ConfirmDialog
        open={pendingPlaceholder !== null}
        onOpenChange={(open) => {
          if (!open) setPendingPlaceholder(null);
        }}
        title={t('financial.placeholder.confirmTitle')}
        description={
          <>
            {t('financial.placeholder.confirmLead')}{' '}
            {/* Isolated, so an Arabic sentence cannot pull the full stop into the middle of an
                account identifier. */}
            <code dir="ltr" className="font-mono">
              {pendingPlaceholder?.accountIdentifier ?? ''}
            </code>
            {'. '}
            {t('financial.placeholder.confirmRest')}
          </>
        }
        confirmLabel={t('common.deactivate')}
        destructive
        loading={updateDestination.isPending}
        onConfirm={stopPlaceholder}
      />
    </Card>
  );
}

/**
 * The chain a destination is on, or null when it is on none.
 *
 * Two independent facts, and both have to hold. The RAIL decides whether this method settles on a
 * chain at all — `CRYPTO` is a value the backend's own enum defines, and it is the only thing
 * allowed to answer that. The ADDRESS then decides WHICH chain, because a `SEED-PLACEHOLDER-…`
 * string sitting on a CRYPTO rail is not an address, and an operator's own `USDT` rail holding a
 * `T…` address is.
 *
 * Neither half is redundant. Dropping the address half is the bug this screen was rebuilt to fix:
 * a rail's NAME cannot say which chain it is on. Dropping the rail half is the same mistake
 * pointing the other way — an account identifier on a cash or bank rail is free text an operator
 * types, and nothing stops one from reading as forty hex digits behind an `0x`. This card would
 * then label a Damascus cashier `BEP20` and ask a chain that has never heard of that office what
 * it holds, then report the inevitable miss as an outage warning on a rail where there was never
 * anything to read.
 */
const chainOf = (isChainRail: boolean, destination: PaymentDestination) =>
  isChainRail ? detectWalletNetwork(destination.accountIdentifier.trim()) : null;

/**
 * One account players are sent to: what it is called, the number itself, and what it holds.
 *
 * The identifier is the value that gets read out to a player, so it is monospace with a copy button
 * rather than something anybody retypes.
 */
function AccountRow({
  destination,
  isChainRail,
  onEdit,
}: {
  destination: PaymentDestination;
  isChainRail: boolean;
  onEdit: () => void;
}) {
  const t = useT(railMessages);
  const network = chainOf(isChainRail, destination);

  return (
    <li className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium">{destination.label}</p>
          <CopyableValue value={destination.accountIdentifier} />
          {destination.accountHolder === null ? null : (
            <p className="text-xs text-[var(--muted-foreground)]">{destination.accountHolder}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {/* The chain, read off the address rather than off the method's name — the same rule the
              deposit verifier follows. Named on the ROW because one method may now hold accounts on
              both chains, and each is verified against its own. */}
          {network === null ? null : <Badge tone="info">{network}</Badge>}
          <Can capability="paymentMethods.write">
            <Tooltip content={t('common.edit')}>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label={t('rails.destination.editTitle', { name: destination.label })}
                onClick={onEdit}
              >
                <Pencil className="size-4" />
              </Button>
            </Tooltip>
          </Can>
        </div>
      </div>
      <AccountBalance destination={destination} isChainRail={isChainRail} />
    </li>
  );
}

/**
 * What this account holds — the one place on the card a balance is allowed to appear.
 *
 * TWO KINDS OF BALANCE, AND THEY ARE NOT THE SAME CLAIM:
 *
 *   - The ON-CHAIN balance, read live from the chain, for a crypto address. It is a fact this
 *     console can verify, and it must NEVER show a zero it did not read — see WalletBalance.
 *   - The RECORDED balance, a figure a human typed, for the rails no chain or API can answer for
 *     (a cash office, a bank). It is only ever as true as the last time somebody updated it, which
 *     is why it always carries WHEN — a recorded balance with no date is a number of unknown age.
 *
 * They are labelled apart on purpose. Collapsing them would let a stale hand-typed figure be read
 * as a verified one, or the reverse, on the screen where an operator decides whether to move money.
 */
function AccountBalance({
  destination,
  isChainRail,
}: {
  destination: PaymentDestination;
  isChainRail: boolean;
}) {
  const t = useT(railMessages);
  const formatters = useFormatters();
  const network = chainOf(isChainRail, destination);
  const [editing, setEditing] = useState(false);

  const recorded =
    destination.declaredBalance !== null && destination.declaredBalanceCurrency !== null;

  return (
    <div className="mt-3 space-y-3 border-t border-[var(--border)] pt-3">
      {network === null ? null : (
        /* Beside the address, because the two are one question: this is where players pay, and this
           is what arrived. The component carries its own read gate, query and failure state. */
        <WalletBalance destinationId={destination.id} />
      )}

      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-[var(--muted-foreground)]">
            {t('financial.declared.recordedLabel')}
          </p>
          {recorded ? (
            <>
              <p className="text-sm font-medium tabular">
                {destination.declaredBalance}{' '}
                <span className="text-[var(--muted-foreground)]">
                  {destination.declaredBalanceCurrency}
                </span>
              </p>
              {/* Always the WHEN: a recorded balance is only as good as its age, and hiding that
                  turns "200 USD, six months ago" into "200 USD". */}
              <p className="text-xs text-[var(--muted-foreground)]">
                {t('financial.declared.updatedAt', {
                  when: formatters.relative(destination.declaredBalanceUpdatedAt),
                })}
              </p>
            </>
          ) : (
            // Not a zero, in words: "we have not recorded one" is a different thing from "empty",
            // and only the operator can turn the first into the second.
            <p className="text-sm text-[var(--muted-foreground)]">
              {t('financial.balance.untracked')}
            </p>
          )}
        </div>

        <Can capability="paymentMethods.write">
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0"
            onClick={() => {
              setEditing(true);
            }}
          >
            {recorded ? (
              <>
                <Pencil className="size-4" />
                {t('common.edit')}
              </>
            ) : (
              <>
                <Plus className="size-4" />
                {t('financial.declared.add')}
              </>
            )}
          </Button>
        </Can>
      </div>

      <DeclaredBalanceDialog open={editing} onOpenChange={setEditing} destination={destination} />
    </div>
  );
}
