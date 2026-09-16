import { FlaskConical } from 'lucide-react';
import { useState, type SyntheticEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { errorMessage } from '@/lib/api/errors';
import { useShamCashParse } from '@/lib/api/queries';
import { useT } from '@/lib/i18n/use-translation';

import { shamCashDevMessages } from './messages';
import { ParsedBalances, ParsedTransactions } from './parsed-tables';

/**
 * THE DIAGNOSTIC THAT SURVIVED THE REWRITE.
 *
 * ══ WHY IT IS STILL HERE WHEN THE REST OF THE BENCH IS GONE ═══════════════════════════════════
 * The screen this sits under used to be five fields of pasted browser cookies. Those are gone —
 * scanning a QR cannot mistype a token. This half stayed, because it answers a question the account
 * view cannot: when a read comes back looking wrong, was the session refused, or did Sham Cash
 * redesign the page so our parser no longer recognises it?
 *
 * Those two look identical from outside and have completely different fixes. This one tells them
 * apart in seconds, with no browser, no network and no session — page text in, balances out. It
 * earned its place three times over while this feature was being built: the Create PIN screen, the
 * Confirm PIN step, and the white-on-transparent QR were all found by reading what the page
 * actually said rather than guessing.
 */
export function ParserBench() {
  const t = useT(shamCashDevMessages);
  const parse = useShamCashParse();

  const [text, setText] = useState('');
  const [missing, setMissing] = useState(false);

  const run = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (text.trim().length === 0) {
      setMissing(true);
      return;
    }
    setMissing(false);
    parse.mutate({ text });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('shamDev.parse.title')}</CardTitle>
        <CardDescription>{t('shamDev.parse.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={run} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sham-dev-text">{t('shamDev.parse.label')}</Label>
            <textarea
              id="sham-dev-text"
              dir="ltr"
              rows={8}
              value={text}
              onChange={(event) => {
                setText(event.target.value);
              }}
              spellCheck={false}
              className="w-full rounded-md border border-[var(--border-strong)] bg-[var(--surface)] p-3 font-mono text-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
            />
            <p className="text-xs text-[var(--muted-foreground)]">{t('shamDev.parse.hint')}</p>
            {missing ? (
              <p role="alert" className="text-xs text-[var(--danger)]">
                {t('shamDev.parse.required')}
              </p>
            ) : null}
          </div>

          <Button type="submit" variant="secondary" loading={parse.isPending}>
            <FlaskConical className="size-4" />
            {t('shamDev.parse.submit')}
          </Button>

          {parse.isError ? (
            <Alert tone="danger" title={t('shamDev.parse.title')}>
              {errorMessage(parse.error)}
            </Alert>
          ) : null}
        </form>

        {parse.data === undefined ? null : (
          <div className="mt-6 space-y-4 border-t border-[var(--border)] pt-6">
            {parse.data.balances.length === 0 && parse.data.transactions.length === 0 ? (
              <Alert tone="warning" title={t('shamDev.parse.nothing')}>
                {t('shamDev.parse.nothingBody')}
              </Alert>
            ) : (
              <>
                <ParsedBalances balances={parse.data.balances} />
                <ParsedTransactions transactions={parse.data.transactions} />
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
