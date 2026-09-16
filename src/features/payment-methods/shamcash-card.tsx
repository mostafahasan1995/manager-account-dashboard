import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';

import { Can } from '@/components/common';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
} from '@/components/ui';
import { errorMessage } from '@/lib/api/errors';
import {
  useCheckShamCashBalance,
  useClearShamCashSession,
  useSetShamCashSession,
  useShamCashStatus,
} from '@/lib/api/queries';
import { useFormatters } from '@/lib/i18n/use-format';
import { useT } from '@/lib/i18n/use-translation';
import type { ShamCashReadResult } from '@/types';

import { Field } from './form-field';
import { railMessages, type RailTranslator } from './messages';

/**
 * Linking a Sham Cash account by pasting its browser-session cookies.
 *
 * ── WHY COOKIES AND NOT A PASSWORD ────────────────────────────────────────────────────────────
 * Every Sham Cash API call is encrypted with a key their own front-end mints per request, which we
 * cannot reproduce. But the operator's logged-in BROWSER already runs that crypto — so the balance
 * is read by replaying their session in a headless browser and reading the rendered page, and the
 * session is these cookies. There is nothing to "log in" to here; there is a session to carry.
 *
 * ── WHY THE COOKIES ARE NEVER SHOWN BACK ──────────────────────────────────────────────────────
 * They are sealed on the backend the instant they arrive and no endpoint returns them. So this form
 * can say "linked, an hour ago" but can never re-display what was pasted — a leak of the console
 * would expose the status, not the session.
 */
/**
 * The outcome of a balance check. Four shapes, and the two that are NOT a balance —expired and
 * unavailable— are rendered as what they are, never as a wallet of zeros. Expired is the operator's
 * to fix (re-link); unavailable is ours (a browser or a bot check), and says so.
 */
function BalanceResult({ result }: { result: ShamCashReadResult }) {
  const t = useT(railMessages);

  if (result.status === 'expired') {
    return (
      <Alert tone="warning" title={t('financial.shamcash.expiredTitle')}>
        {t('financial.shamcash.expiredBody')}
      </Alert>
    );
  }
  if (result.status === 'unavailable') {
    return (
      <Alert tone="danger" title={t('financial.shamcash.unavailableTitle')}>
        {result.detail}
      </Alert>
    );
  }
  if (result.status === 'not_linked') {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3">
        {result.balances.map((balance) => (
          <div
            key={balance.currency}
            className="rounded-md border border-[var(--border)] bg-[var(--surface-muted)] p-3"
          >
            <p className="text-xs font-medium text-[var(--muted-foreground)]">{balance.currency}</p>
            <p className="text-lg font-semibold tabular">{balance.available}</p>
            {balance.locked === '0' ? null : (
              <p className="text-xs text-[var(--muted-foreground)]">
                {t('financial.shamcash.locked', { amount: balance.locked })}
              </p>
            )}
          </div>
        ))}
      </div>

      {result.transactions.length === 0 ? null : (
        <div className="space-y-1">
          <p className="text-xs font-medium text-[var(--muted-foreground)]">
            {t('financial.shamcash.recent')}
          </p>
          <ul className="divide-y divide-[var(--border)] rounded-md border border-[var(--border)]">
            {result.transactions.map((txn) => (
              <li key={txn.transactionId} className="flex items-center justify-between gap-2 p-2">
                <span className="min-w-0 truncate text-sm">{txn.username}</span>
                <span
                  className={`shrink-0 text-sm font-medium tabular ${
                    txn.direction === 'in' ? 'text-[var(--success)]' : 'text-[var(--danger)]'
                  }`}
                >
                  {txn.direction === 'in' ? '+' : '-'}
                  {txn.amount} {txn.currency}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function sessionSchema(t: RailTranslator) {
  const required = (message: string) => z.string().trim().min(1, message);
  return z.object({
    accessToken: required(t('financial.shamcash.accessTokenRequired')),
    authToken: required(t('financial.shamcash.authTokenRequired')),
    forge: z.string().trim(),
    // Required, because the app renders a blank page without it — a session linked without it reads
    // as "could not read the balance", which is the confusing dead end this field exists to prevent.
    pinCodeHash: required(t('financial.shamcash.pinCodeHashRequired')),
    // The 4-digit PIN the app asks for after sign-in. Required for the same reason: without it the
    // reader gets no further than the PIN screen.
    pin: z
      .string()
      .trim()
      .regex(/^\d{4,8}$/, t('financial.shamcash.pinRequired')),
  });
}

type SessionValues = z.infer<ReturnType<typeof sessionSchema>>;

const EMPTY: SessionValues = {
  accessToken: '',
  authToken: '',
  forge: '',
  pinCodeHash: '',
  pin: '',
};

export function ShamCashCard() {
  const t = useT(railMessages);
  const formatters = useFormatters();
  const status = useShamCashStatus();
  const setSession = useSetShamCashSession();
  const clearSession = useClearShamCashSession();
  const check = useCheckShamCashBalance();
  /**
   * Whether the paste-a-session form is open.
   *
   * A linked account does NOT show it. Five empty boxes under a working link read as "something is
   * missing here", when nothing is — and the one thing a stray keystroke in them can achieve is
   * replacing a session that was working. Re-linking is a deliberate act, so it takes a deliberate
   * click. Nothing is linked yet? Then the form IS the screen, and it opens on its own.
   */
  const [editing, setEditing] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<SessionValues>({ resolver: zodResolver(sessionSchema(t)), defaultValues: EMPTY });

  const submit = handleSubmit(async (values) => {
    try {
      await setSession.mutateAsync({
        accessToken: values.accessToken,
        authToken: values.authToken,
        pinCodeHash: values.pinCodeHash,
        pin: values.pin,
        // An empty forge is left out, not sent as "".
        ...(values.forge === '' ? {} : { forge: values.forge }),
      });
      toast.success(t('financial.shamcash.linked'), {
        description: t('financial.shamcash.linkedBody'),
      });
      reset(EMPTY);
      // Close behind them, and drop what was typed. The session is stored and can never be read
      // back, so leaving the boxes on screen would only show a form that no longer means anything.
      setEditing(false);
    } catch (caught) {
      setError('root', { message: errorMessage(caught) });
      toast.error(t('financial.shamcash.linkFailed'), { description: errorMessage(caught) });
    }
  });

  const unlink = async () => {
    try {
      await clearSession.mutateAsync();
      toast.success(t('financial.shamcash.unlinked'));
    } catch (caught) {
      toast.error(t('financial.shamcash.unlinkFailed'), { description: errorMessage(caught) });
    }
  };

  const cancelEdit = () => {
    reset(EMPTY);
    setEditing(false);
  };

  const linked = status.data?.linked === true;
  /** Open when there is nothing linked (there is nothing else to do) or when asked for. */
  const formOpen = !linked || editing;

  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <CardTitle>{t('financial.shamcash.title')}</CardTitle>
          <CardDescription>{t('financial.shamcash.description')}</CardDescription>
        </div>
        {linked ? (
          <Badge tone="success">{t('financial.shamcash.linkedBadge')}</Badge>
        ) : (
          <Badge tone="muted">{t('financial.shamcash.notLinkedBadge')}</Badge>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {linked ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-[var(--muted-foreground)]">
                {t('financial.shamcash.linkedSince', {
                  when: formatters.relative(status.data?.updatedAt ?? null),
                })}
              </p>
              <Can capability="paymentMethods.write">
                <Button
                  variant="secondary"
                  size="sm"
                  loading={check.isPending}
                  onClick={() => void check.mutateAsync().catch(() => undefined)}
                >
                  {t('financial.shamcash.check')}
                </Button>
              </Can>
            </div>

            {check.isError ? (
              <Alert tone="danger" title={t('financial.shamcash.checkFailed')}>
                {errorMessage(check.error)}
              </Alert>
            ) : check.data === undefined ? null : (
              <BalanceResult result={check.data} />
            )}
          </div>
        ) : null}

        <Can capability="paymentMethods.write">
          {/* The resting state of a linked account: what you can DO, not what you must fill in. */}
          {formOpen ? null : (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setEditing(true);
                }}
              >
                {t('financial.shamcash.relink')}
              </Button>
              <Button
                type="button"
                variant="ghost"
                loading={clearSession.isPending}
                onClick={() => void unlink()}
              >
                {t('financial.shamcash.unlink')}
              </Button>
            </div>
          )}

          {/* Said plainly, because an operator has to know WHERE to get these — DevTools, not a
              password they know. */}
          {formOpen ? (
            <Alert tone="info" title={t('financial.shamcash.howTitle')}>
              {t('financial.shamcash.howBody')}
            </Alert>
          ) : null}

          {formOpen ? (
            <form onSubmit={(event) => void submit(event)} className="space-y-4" noValidate>
              {errors.root === undefined ? null : (
                <Alert tone="danger" title={t('rails.form.saveFailedTitle')}>
                  {errors.root.message}
                </Alert>
              )}

              <Field
                id="shamcash-access-token"
                label={t('financial.shamcash.accessTokenLabel')}
                error={errors.accessToken?.message}
              >
                {(a11y) => (
                  <Input
                    {...a11y}
                    {...register('accessToken')}
                    autoComplete="off"
                    spellCheck={false}
                    className="font-mono break-all"
                  />
                )}
              </Field>

              <Field
                id="shamcash-auth-token"
                label={t('financial.shamcash.authTokenLabel')}
                error={errors.authToken?.message}
              >
                {(a11y) => (
                  <Input
                    {...a11y}
                    {...register('authToken')}
                    autoComplete="off"
                    spellCheck={false}
                    className="font-mono break-all"
                  />
                )}
              </Field>

              <Field
                id="shamcash-forge"
                label={t('financial.shamcash.forgeLabel')}
                hint={t('financial.shamcash.forgeHint')}
                error={errors.forge?.message}
              >
                {(a11y) => (
                  <Input
                    {...a11y}
                    {...register('forge')}
                    autoComplete="off"
                    spellCheck={false}
                    className="font-mono break-all"
                  />
                )}
              </Field>

              <Field
                id="shamcash-pin-hash"
                label={t('financial.shamcash.pinCodeHashLabel')}
                hint={t('financial.shamcash.pinCodeHashHint')}
                error={errors.pinCodeHash?.message}
              >
                {(a11y) => (
                  <Input
                    {...a11y}
                    {...register('pinCodeHash')}
                    autoComplete="off"
                    spellCheck={false}
                    className="font-mono break-all"
                  />
                )}
              </Field>

              <Field
                id="shamcash-pin"
                label={t('financial.shamcash.pinLabel')}
                hint={t('financial.shamcash.pinHint')}
                error={errors.pin?.message}
              >
                {(a11y) => (
                  <Input
                    {...a11y}
                    {...register('pin')}
                    inputMode="numeric"
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="••••"
                    className="tabular"
                  />
                )}
              </Field>

              <div className="flex flex-wrap gap-2">
                {/* "Save", not "Update session" again: that is the button they pressed to get here,
                    and repeating it reads as though the first click did not take. */}
                <Button type="submit" variant="primary" loading={isSubmitting}>
                  {linked ? t('common.save') : t('financial.shamcash.link')}
                </Button>
                {/* Only when there is something to go back TO. With nothing linked, cancelling the
                  form would leave a card that does nothing at all. */}
                {linked ? (
                  <Button type="button" variant="ghost" onClick={cancelEdit}>
                    {t('common.cancel')}
                  </Button>
                ) : null}
              </div>
            </form>
          ) : null}
        </Can>
      </CardContent>
    </Card>
  );
}
