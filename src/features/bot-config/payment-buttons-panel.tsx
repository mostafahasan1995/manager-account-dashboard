import { useState } from 'react';
import { toast } from 'sonner';
import { Save } from 'lucide-react';

import { Can, EmptyState, ErrorState, TableSkeleton } from '@/components/common';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  Input,
  Label,
  Switch,
  Textarea,
} from '@/components/ui';
import { errorMessage } from '@/lib/api/errors';
import { useUpdatePaymentMethod } from '@/lib/api/queries';
import { useAuth } from '@/lib/auth/use-auth';
import { useT } from '@/lib/i18n/use-translation';
import { parseDecimalToMinor } from '@/lib/money';
import type { PaymentMethod, UpdatePaymentMethodBody } from '@/types';

import { BotPreview } from './bot-preview';
import {
  CALLBACK_DATA_MAX_BYTES,
  MAIN_MENU_BUTTONS,
  compareBotOrder,
  depositCallbackData,
  utf8Bytes,
} from './bot-surface';
import { botConfigMessages } from './messages';
import { SectionHeader } from './surface-state';

/**
 * The one genuinely editable part of the bot's button surface.
 *
 * ── WHY THIS IS THE ONLY LIVE EDITOR ON THE SCREEN ────────────────────────────────────────────
 * A payment method already carries everything a button is: `displayName` IS the text on it,
 * `sortOrder` IS the row it sits in, `isActive` IS whether it appears, and `instructions` IS what
 * the player reads once they have tapped it. All four round-trip through the same PATCH the rails
 * screen uses. Nothing here is a new capability — it is the bot's own view of records that already
 * existed, put where somebody thinking about their bot would look for them.
 *
 * ── WHY IT DOES NOT DUPLICATE THE RAILS SCREEN ────────────────────────────────────────────────
 * It shows four fields out of a rail's twenty, and it is the four a player sees. The limits, the
 * fees, the reference pattern and the verification mode stay on the rails screen where the money
 * questions are. Two screens over one record is a risk worth naming: there is exactly one copy of
 * the data, both screens read it live, and a save here invalidates the same cache — so they cannot
 * disagree, they can only be opened at the same time.
 *
 * ── THE 64-BYTE CAVEAT, AND WHY IT IS STATED AS REASSURANCE ───────────────────────────────────
 * The bot drops a method from the keyboard when its callback payload exceeds Telegram's 64 bytes,
 * and that is a real silent failure. But the LABEL is not in that payload — the id and the amount
 * are — so the thing an operator would naturally be careful about (emoji, long names) is the thing
 * that costs nothing. Saying only "there is a 64-byte limit" would leave every operator with plain
 * buttons for a reason that does not apply to them, so each row prints what its payload actually
 * measures at the previewed amount.
 */

/** The bot's own example amount, from `/methods`: "to start, send the amount with the command". */
const DEFAULT_PREVIEW_AMOUNT = '50000';

export function PaymentButtonsPanel({
  methods,
  isPending,
  error,
  onRetry,
}: {
  methods: readonly PaymentMethod[] | undefined;
  isPending: boolean;
  error: unknown;
  onRetry: () => void;
}) {
  const t = useT(botConfigMessages);
  const { can } = useAuth();
  const [amountText, setAmountText] = useState(DEFAULT_PREVIEW_AMOUNT);

  // In the BOT's order, not the API's. The card says "in this order" a line above the list, and the
  // list endpoint promises no ordering at all — so sorting here is what makes that sentence true.
  const rows = [...(methods ?? [])].sort(compareBotOrder);
  const mayWrite = can('paymentMethods.write');
  // The currency the preview is drawn in. In the bot the PLAYER's own currency decides it; here the
  // first method the bot would actually offer stands in for that, which is the same answer for
  // every operator running one currency and an honest one for the rest.
  const currency =
    rows.find((row) => row.isActive && row.rail !== 'INTERNAL')?.currencyCode ?? null;

  const amountMinor = amountText.length === 0 ? 0n : parseDecimalToMinor(amountText);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <Card>
          <SectionHeader title={t('botConfig.buttons.title')} state="live">
            {t('botConfig.buttons.body')}
          </SectionHeader>
          <CardContent className="space-y-4">
            <Alert tone="info" title={t('botConfig.buttons.emojiTitle')}>
              {t('botConfig.buttons.emojiBody')}
            </Alert>

            {mayWrite ? null : <Alert tone="neutral">{t('botConfig.buttons.readOnly')}</Alert>}

            {isPending ? <TableSkeleton rows={3} columns={3} /> : null}

            {error == null ? null : <ErrorState error={error} onRetry={onRetry} />}

            {!isPending && error == null && rows.length === 0 ? (
              <EmptyState
                title={t('botConfig.buttons.empty.title')}
                description={t('botConfig.buttons.empty.body')}
              />
            ) : null}

            {rows.map((method) => (
              <MethodButtonRow
                key={method.id}
                method={method}
                amountMinor={amountMinor}
                mayWrite={mayWrite}
              />
            ))}
          </CardContent>
        </Card>

        {/* "Reading", never "live", however live the data feeding it is. Nothing in a preview saves,
            and its four rules are a hand-copy of the bot's logic rather than something the bot
            serves — so the strongest badge on the page, whose tooltip reads "Saved here", is the one
            badge this card must not carry. */}
        <Card className="h-fit">
          <SectionHeader title={t('botConfig.preview.title')} state="reading" />
          <CardContent>
            <BotPreview
              methods={rows}
              currency={currency}
              amountText={amountText}
              onAmountChange={(value) => {
                // Digits only, so the amount always parses and the preview never has to render a
                // third state for "that is not a number".
                setAmountText(value.replace(/\D/g, ''));
              }}
            />
          </CardContent>
        </Card>
      </div>

      <MainMenuCard />
    </div>
  );
}

function MethodButtonRow({
  method,
  amountMinor,
  mayWrite,
}: {
  method: PaymentMethod;
  amountMinor: bigint;
  mayWrite: boolean;
}) {
  const t = useT(botConfigMessages);
  const update = useUpdatePaymentMethod();

  const [label, setLabel] = useState(method.displayName);
  const [order, setOrder] = useState(String(method.sortOrder));
  const [isActive, setIsActive] = useState(method.isActive);
  const [instructions, setInstructions] = useState(method.instructions ?? '');

  const orderValue = /^\d+$/.test(order.trim()) ? Number(order.trim()) : null;
  const labelValid = label.trim().length > 0;
  const savedInstructions = method.instructions ?? '';
  const dirty =
    label !== method.displayName ||
    order !== String(method.sortOrder) ||
    isActive !== method.isActive ||
    instructions !== savedInstructions;

  const bytes = utf8Bytes(depositCallbackData(method.id, amountMinor));
  const oversized = bytes > CALLBACK_DATA_MAX_BYTES;
  const internal = method.rail === 'INTERNAL';

  const save = () => {
    if (orderValue === null || !labelValid) return;
    const body: UpdatePaymentMethodBody = {
      displayName: label.trim(),
      sortOrder: orderValue,
      isActive,
      // Only when it changed: sending an untouched empty box would write "" over a null and record
      // an edit nobody made.
      ...(instructions === savedInstructions ? {} : { instructions: instructions.trim() }),
    };

    void (async () => {
      try {
        await update.mutateAsync({ id: method.id, body });
        toast.success(t('botConfig.buttons.saved', { name: label.trim() }));
      } catch (caught) {
        toast.error(t('botConfig.buttons.saveFailed', { name: method.displayName }), {
          description: errorMessage(caught),
        });
      }
    })();
  };

  return (
    // A landmark per method, named by the CODE rather than by the label: six near-identical blocks
    // are hard to navigate without one, and the code is the one field on the row that cannot be
    // edited out from under a reader halfway through editing it.
    <section
      aria-label={method.code}
      className="space-y-3 rounded-lg border border-[var(--border)] p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs text-[var(--muted-foreground)]">{method.code}</span>
        {isActive ? null : <Badge tone="muted">{t('botConfig.buttons.hidden')}</Badge>}
        {internal ? <Badge tone="warning">{t('botConfig.buttons.internal')}</Badge> : null}
        {dirty ? <Badge tone="info">{t('botConfig.buttons.unsaved')}</Badge> : null}
      </div>

      {internal ? (
        <p className="text-xs text-[var(--muted-foreground)]">
          {t('botConfig.buttons.internalBody')}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_6rem]">
        <div className="space-y-1.5">
          <Label htmlFor={`label-${method.id}`}>{t('botConfig.field.label')}</Label>
          <Input
            id={`label-${method.id}`}
            value={label}
            autoComplete="off"
            disabled={!mayWrite}
            aria-invalid={!labelValid}
            onChange={(event) => {
              setLabel(event.target.value);
            }}
          />
          <p className="text-xs text-[var(--muted-foreground)]">
            {t('botConfig.field.label.hint')}
          </p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={`order-${method.id}`}>{t('botConfig.field.order')}</Label>
          <Input
            id={`order-${method.id}`}
            value={order}
            inputMode="numeric"
            autoComplete="off"
            className="tabular-nums"
            disabled={!mayWrite}
            aria-invalid={orderValue === null}
            onChange={(event) => {
              setOrder(event.target.value);
            }}
          />
        </div>
      </div>
      <p className="text-xs text-[var(--muted-foreground)]">{t('botConfig.field.order.hint')}</p>

      <div className="flex items-start justify-between gap-4 rounded-lg border border-[var(--border)] p-3">
        <div className="min-w-0">
          <Label htmlFor={`active-${method.id}`}>{t('botConfig.field.shown')}</Label>
          <p className="text-xs text-[var(--muted-foreground)]">
            {t('botConfig.field.shown.hint')}
          </p>
        </div>
        <Switch
          id={`active-${method.id}`}
          checked={isActive}
          disabled={!mayWrite}
          onCheckedChange={setIsActive}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`instructions-${method.id}`}>{t('botConfig.field.instructions')}</Label>
        <Textarea
          id={`instructions-${method.id}`}
          value={instructions}
          disabled={!mayWrite}
          onChange={(event) => {
            setInstructions(event.target.value);
          }}
        />
        <p className="text-xs text-[var(--muted-foreground)]">
          {t('botConfig.field.instructions.hint')}
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p
          className={
            oversized ? 'text-xs text-[var(--danger)]' : 'text-xs text-[var(--muted-foreground)]'
          }
        >
          {t('botConfig.buttons.payload', { bytes, max: CALLBACK_DATA_MAX_BYTES })}
          {oversized ? ` — ${t('botConfig.buttons.payloadOver')}` : ''}
        </p>
        <Can capability="paymentMethods.write">
          <Button
            variant="primary"
            size="sm"
            loading={update.isPending}
            disabled={!dirty || orderValue === null || !labelValid}
            onClick={save}
          >
            <Save aria-hidden="true" />
            {t('common.save')}
          </Button>
        </Can>
      </div>
    </section>
  );
}

/**
 * The /start grid. Eight buttons, read from nothing.
 *
 * It sits under the editable buttons rather than in a tab of its own because an operator asking
 * "can I change the buttons?" means both of these, and answering only about the one they can change
 * leaves the other looking like an oversight rather than an answer.
 */
function MainMenuCard() {
  const t = useT(botConfigMessages);

  return (
    <Card>
      <SectionHeader title={t('botConfig.menu.title')} state="reading">
        {t('botConfig.menu.body')}
      </SectionHeader>
      <CardContent>
        <ul dir="rtl" lang="ar" className="grid gap-2 sm:grid-cols-2">
          {MAIN_MENU_BUTTONS.map((button) => (
            <li
              key={button}
              className="rounded-lg border border-[var(--border-strong)] bg-[var(--surface-muted)] px-3 py-2 text-center text-xs font-medium"
            >
              {button}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
