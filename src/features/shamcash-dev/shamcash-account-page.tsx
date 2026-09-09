import { useCallback, useState } from 'react';

import { PageHeader } from '@/components/common/page-header';
import { useShamCashAccount } from '@/lib/api/queries';
import { useT } from '@/lib/i18n/use-translation';

import { ShamCashAccountPanel } from './account-panel';
import { shamCashDevMessages } from './messages';
import { ParserBench } from './parser-bench';
import { QrLinkPanel } from './qr-link-panel';

/**
 * YOUR SHAM CASH ACCOUNT — one button to link it, then the account.
 *
 * ══ WHAT THIS REPLACED, AND WHY ═══════════════════════════════════════════════════════════════
 * The first version of this screen asked for five values copied out of browser developer tools:
 * `accessToken`, `authToken`, `forge`, a localStorage hash, a PIN. It worked, and it was the wrong
 * thing to ask anybody to do — one mistyped character produced a ninety-second failure that looked
 * exactly like an expired session. Those fields are gone. Scanning a QR cannot get a character
 * wrong.
 *
 * ══ THE SHAPE OF THE SCREEN ═══════════════════════════════════════════════════════════════════
 * Nothing linked → the QR panel, and nothing else to think about. Linked → the account, with the
 * QR panel folded away until it is needed again. There is no state in between worth showing,
 * because linking is the only thing you can do before it and reading is the only thing after.
 *
 * ══ AND NO POLLING ════════════════════════════════════════════════════════════════════════════
 * The figures are read when somebody asks, and the last read stays on screen with its age until
 * they ask again — see the account panel for why a timer would be the wrong instrument here.
 */
export function ShamCashAccountPage() {
  const t = useT(shamCashDevMessages);
  const account = useShamCashAccount();

  /*
   * The QR panel is shown when there is nothing to show instead of it, or when somebody asks for
   * it. `relink` is that ask — from the empty state, from a lapsed session, or from a refresh that
   * was refused.
   */
  const [relinking, setRelinking] = useState(false);
  const onRelink = useCallback(() => {
    setRelinking(true);
  }, []);

  const hasAccount = account.data !== undefined && account.data.snapshot !== null;
  const linked = account.data?.linked === true;
  const showQr = relinking || (account.isSuccess && !linked && !hasAccount);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('shamDev.account.pageTitle')}
        description={t('shamDev.account.pageBody')}
      />

      {showQr ? (
        <QrLinkPanel
          onLinked={() => {
            // The API keeps the browser it just signed in, so the account is readable immediately.
            // Folding the QR away is what makes the screen become "your account" rather than
            // staying a setup wizard with the account underneath it.
            setRelinking(false);
            void account.refetch();
          }}
        />
      ) : null}

      <ShamCashAccountPanel onRelink={onRelink} />

      {/* The diagnostic, kept below the account: it answers "did the page change?" when a read
          comes back looking wrong, which the account view itself cannot. */}
      <ParserBench />
    </div>
  );
}
