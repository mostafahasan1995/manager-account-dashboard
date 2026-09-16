import { AlertTriangle, Wallet } from 'lucide-react';

import { Can } from '@/components/common/can';
import { MinorAmount } from '@/components/common/money-amount';
import { Badge } from '@/components/ui/badge';
import { Tooltip } from '@/components/ui/tooltip';
import { useAgentFloat } from '@/lib/api/queries';
import { useT } from '@/lib/i18n/use-translation';
import { formatMinorString } from '@/lib/money';

/** Minor units as the wire is supposed to send them. See `readableMinor` for why this is checked. */
const MINOR_INTEGER = /^-?\d+$/;

/**
 * `MinorAmount` parses through `BigInt`, which THROWS on anything that is not an integer string —
 * and this component renders inside the top bar, on every screen, above every route. A backend that
 * one day answers `balanceMinor: 1320000` as a number, or `"1320000.00"`, would take the whole
 * console down rather than one panel. The zod schema cannot stop that on its own: `parseResponse`
 * deliberately warns and passes the value through instead of throwing, so that a field the backend
 * renamed never blanks the screen a cashier is working in.
 */
const readableMinor = (minor: string): string | null =>
  MINOR_INTEGER.test(minor.trim()) ? minor : null;

/**
 * The operator's Ichancy agent balance, in the top bar of every screen.
 *
 * WHY IT IS CHROME AND NOT A PANEL: this is the pool player credits are paid out of. When it runs
 * dry the backend refuses the credit with `AGENT_FLOAT_INSUFFICIENT` and the deposit fails at the
 * Ichancy step — on a player who has already sent their money. Before this pill the only way to
 * learn the float was empty was that failure itself, on somebody else's deposit. A number that is
 * only true on one screen is a number nobody sees in time, which is the entire reason it is here
 * rather than on the reconciliation page next to the float sync.
 *
 * Shaped after `HealthPill`, its neighbour: badge, icon, tooltip, and silence while it is loading.
 */
export function AgentFloatPill() {
  return (
    // The same capability that gates the float sync and the break list — the ledger money figures.
    // SUPPORT answers players and has no business reading the operator's own balance.
    <Can capability="reconciliation.read">
      <AgentFloatBadge />
    </Can>
  );
}

function AgentFloatBadge() {
  const { data, isPending, isError } = useAgentFloat();
  const t = useT();

  /*
   * Nothing while it loads, and nothing when it fails.
   *
   * A missing pill says nothing. A pill that reported the failure would be a permanent red mark on
   * every screen in the console, about a request the operator cannot do anything about — and the
   * endpoint behind this does not exist on the backend yet, so today that is exactly what it would
   * be, everywhere, for everyone. Red is reserved for the one thing somebody can act on: a float
   * that is genuinely low.
   */
  if (isPending || isError) return null;

  const balanceMinor = readableMinor(data.balanceMinor);
  if (balanceMinor === null) return null;

  /*
   * An unreadable floor becomes the em dash every other missing amount in this console shows, NOT a
   * zero. `?? '0'` would have the tooltip say "it counts as low below 0.00 NSP" — a floor no balance
   * can ever cross, invented here, about the one figure an operator tops up against.
   */
  const watermark = formatMinorString(readableMinor(data.lowWatermarkMinor), data.currencyCode);
  const detail = data.isLow
    ? t('agentFloat.lowDetail', { watermark })
    : t('agentFloat.detail', { watermark });

  return (
    <Tooltip content={detail}>
      {/*
        `role="status"` ONLY while it is low. A live region on every screen would re-announce the
        balance to a screen-reader user each time the poll changed a digit; the float crossing its
        floor is the one change worth interrupting somebody for.
      */}
      {/*
        `shrink-0` because everything in this bar is `whitespace-nowrap`: without it flex takes the
        width out of whatever CAN shrink, and what shrank was the icon buttons — the theme and
        language toggles were measured squeezed from 36px to 16px by this pill's arrival. A control
        too narrow to hit is a worse failure than a bar one badge too wide.
      */}
      <span className="shrink-0" {...(data.isLow ? { role: 'status' } : {})}>
        <Badge
          tone={data.isLow ? 'danger' : 'neutral'}
          // A ring on top of the danger tone: this badge sits beside three other badges, and the
          // difference between "noticed at a glance" and "read if you were looking" is the point.
          className={data.isLow ? 'cursor-help ring-2 ring-[var(--danger)]' : 'cursor-help'}
        >
          {data.isLow ? (
            <AlertTriangle className="size-3 shrink-0" />
          ) : (
            <Wallet className="size-3 shrink-0" />
          )}
          {/*
            `sr-only` and not `hidden` below `md`. The label costs ~60px the phone bar does not
            have, but hiding it with `display:none` takes it out of the accessibility tree too — and
            an unlabelled money figure announced on its own is the one reading of this pill that is
            worse than no pill. Absolute positioning costs no layout width, so the screen reader
            keeps the label at every size while the eye gets it back at `md`.
          */}
          <span className="sr-only md:not-sr-only md:inline">{t('agentFloat.label')}</span>
          {/* Always visible, at every width: the number IS the reason this component exists. */}
          <MinorAmount
            minor={balanceMinor}
            currency={data.currencyCode}
            className="font-semibold"
          />
          {data.isLow ? <span className="font-semibold">{t('agentFloat.low')}</span> : null}
        </Badge>
      </span>
    </Tooltip>
  );
}
