import { QrCode, RefreshCw } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { errorMessage } from '@/lib/api/errors';
import {
  useCancelShamCashPairing,
  useShamCashPairing,
  useStartShamCashPairing,
} from '@/lib/api/queries';
import { useT } from '@/lib/i18n/use-translation';
import type { ShamCashBrowserCheckBody } from '@/types/shamcash-dev';

import { shamCashDevMessages } from './messages';

/**
 * LINKING BY QR — what the site's own web login does, driven from here.
 *
 * ══ WHY THIS EXISTS BESIDE THE PASTE FORM ═════════════════════════════════════════════════════
 * Copying five values out of browser developer tools is the most error-prone step on this screen:
 * one wrong character produces a ninety-second failure that looks exactly like an expired session.
 * This asks Sham Cash to do what it already does for its own web client — draw a QR, wait for the
 * phone to approve it, and write the cookies itself. What comes back is a session that is correct
 * by construction.
 *
 * ══ THE API IS HOLDING A BROWSER OPEN WHILE THIS IS ON SCREEN ═════════════════════════════════
 * That is the mechanism, and it is also a resource. This component cancels the pairing when it
 * unmounts, so navigating away closes the browser rather than leaving it to time out. The API caps
 * it at one and closes it on a timer regardless — this is the polite path, not the only one.
 */
export function QrLinkPanel({
  onLinked,
}: {
  onLinked: (session: ShamCashBrowserCheckBody) => void;
}) {
  const t = useT(shamCashDevMessages);

  const start = useStartShamCashPairing();
  const cancel = useCancelShamCashPairing();
  const [pairingId, setPairingId] = useState<string | null>(null);
  const poll = useShamCashPairing(pairingId);

  /*
   * THE PIN IS ASKED FOR BEFORE THE CODE IS SHOWN, and that ordering is the point.
   *
   * A newly linked browser does not meet "enter your PIN" — it meets **Create PIN**, seconds after
   * the scan, and Sham Cash writes `shamcash-pin-code-hash` only once one is saved. There is no
   * time to come back and ask. Observed live on 2026-09-08: a linked session with no hash, and the
   * digits sitting in the boxes unsaved.
   *
   * It is also the value the form below needs, and no cookie can carry it — so this is where it
   * enters the screen, once, and is passed on with the harvested session.
   */
  const [pin, setPin] = useState('');

  const started = start.data;

  /*
   * HAND THE SESSION UP EXACTLY ONCE.
   *
   * The poll query keeps its last answer after it stops refetching, so without this guard every
   * re-render of the parent would re-fill the form — and, if the parent ever auto-submitted, would
   * fire a check per render. `handled` is the pairing id already delivered, not a boolean, so a
   * SECOND pairing in the same session still gets through.
   */
  const handled = useRef<string | null>(null);
  const result = poll.data;

  useEffect(() => {
    if (result?.status !== 'linked' || pairingId === null || handled.current === pairingId) return;
    // A REF and not state: the guard is bookkeeping, not something the screen renders, and setting
    // state inside an effect would schedule a second render for a value nothing reads.
    handled.current = pairingId;
    onLinked({
      accessToken: result.session.accessToken,
      authToken: result.session.authToken,
      ...(result.session.forge === undefined ? {} : { forge: result.session.forge }),
      ...(result.session.pinCodeHash === undefined
        ? {}
        : { pinCodeHash: result.session.pinCodeHash }),
      // Carried from this panel, not from the server: the PIN was never in a cookie, and sending it
      // back down only to send it up again would put a secret through a round trip for nothing.
      ...(pin === '' ? {} : { pin }),
    });
  }, [result, pairingId, onLinked, pin]);

  /*
   * Close the browser on the way out. The cleanup reads the id from a ref-like closure over the
   * current render's value, which is correct here because the effect re-runs whenever it changes.
   */
  useEffect(() => {
    if (pairingId === null) return;
    return () => {
      cancel.mutate(pairingId);
    };
    // `cancel` is a stable mutation object; including it would re-run this on every render and
    // cancel the pairing it just created.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairingId]);

  const begin = () => {
    handled.current = null;
    start.mutate(
      // Omitted rather than sent blank: the API validates a present PIN as digits, so an empty box
      // would be a 400 about a field somebody deliberately skipped.
      pin === '' ? {} : { pin },
      {
        onSuccess: (data) => {
          setPairingId(data.pairingId);
        },
      },
    );
  };

  const waiting = result === undefined || result.status === 'pending';

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('shamDev.qr.title')}</CardTitle>
        <CardDescription>{t('shamDev.qr.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="max-w-xs space-y-1.5">
          <Label htmlFor="sham-qr-pin">{t('shamDev.qr.pin')}</Label>
          <Input
            id="sham-qr-pin"
            dir="ltr"
            inputMode="numeric"
            maxLength={8}
            value={pin}
            onChange={(event) => {
              // Digits only, because that is all the OTP boxes accept and a stray character here
              // becomes a 400 from the API rather than anything visible on screen.
              setPin(event.target.value.replace(/\D/g, ''));
            }}
            autoComplete="off"
            className="font-mono"
          />
          <p className="text-xs text-[var(--muted-foreground)]">{t('shamDev.qr.pinHint')}</p>
        </div>

        <Button type="button" loading={start.isPending} onClick={begin}>
          {started === undefined ? <QrCode className="size-4" /> : <RefreshCw className="size-4" />}
          {started === undefined ? t('shamDev.qr.start') : t('shamDev.qr.restart')}
        </Button>

        {/* Said out loud: opening the login page is itself a browser launch against a slow site, so
            the button can sit in its loading state for the best part of a minute. */}
        {start.isPending ? (
          <p className="text-xs text-[var(--muted-foreground)]">{t('shamDev.qr.opening')}</p>
        ) : null}

        {start.isError ? (
          <Alert tone="danger" title={t('shamDev.qr.title')}>
            {errorMessage(start.error)}
          </Alert>
        ) : null}

        {started === undefined ? null : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-start gap-6">
              {/*
               * TWO THINGS MAKE THIS SCANNABLE, and the first run had neither.
               *
               * THE IMAGE CARRIES ITS OWN GROUND AND ITS OWN QUIET ZONE. It arrives opaque, on a
               * backdrop the API picked from the modules' own brightness, with a margin already
               * around it — because shamcash.sy is dark-themed and draws a WHITE code, which on a
               * white card is a grey smudge rather than something a phone can read. Adding padding
               * or a background here would fight that: white padding around an inverted code is a
               * border of exactly the wrong colour.
               *
               * `imageRendering: pixelated`, because the site draws the code at around 200px and
               * this shows it larger. The browser default is a smooth (bilinear) upscale — which
               * softens every
               * module edge — it looked visibly blurry on the first live run. A QR is a hard-edged
               * bitmap, so nearest-neighbour is not a compromise here: it is the correct filter,
               * and it keeps the blocks square at any size.
               */}
              <img
                src={started.qrImage}
                alt={t('shamDev.qr.alt')}
                width={288}
                height={288}
                style={{ imageRendering: 'pixelated' }}
                className="size-72 rounded-lg border border-[var(--border)]"
              />

              <ol className="list-inside list-decimal space-y-1 text-sm">
                <li>{t('shamDev.qr.step1')}</li>
                <li>{t('shamDev.qr.step2')}</li>
                <li>{t('shamDev.qr.step3')}</li>
              </ol>
            </div>

            {/*
             * THE TUNING SIGNAL. The selector list was written without being able to reach
             * shamcash.sy, so `page` means "we did not recognise the QR element and this is the
             * whole screen". Still usable — the code is in the picture — and it is the one thing
             * somebody with access needs to report back to fix it properly.
             */}
            {started.strategy === 'page' ? (
              <Alert tone="warning" title={t('shamDev.qr.fallbackTitle')}>
                {t('shamDev.qr.fallbackBody')}
              </Alert>
            ) : (
              <p className="text-xs text-[var(--muted-foreground)]">
                {t('shamDev.qr.matched', { strategy: started.strategy })}
              </p>
            )}

            {waiting ? (
              <p className="text-sm text-[var(--muted-foreground)]">{t('shamDev.qr.waiting')}</p>
            ) : null}

            {result?.status === 'linked' ? (
              <Alert tone="success" title={t('shamDev.qr.linked')}>
                {result.pinRequired ? t('shamDev.qr.linkedPin') : t('shamDev.qr.linkedBody')}
              </Alert>
            ) : null}

            {result?.status === 'expired' ? (
              <Alert tone="warning" title={t('shamDev.qr.expired')}>
                {t('shamDev.qr.expiredBody')}
              </Alert>
            ) : null}

            {result?.status === 'failed' ? (
              <Alert tone="danger" title={t('shamDev.qr.failed')}>
                {result.detail}
              </Alert>
            ) : null}

            {poll.isError ? (
              <Alert tone="danger" title={t('shamDev.qr.failed')}>
                {errorMessage(poll.error)}
              </Alert>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
