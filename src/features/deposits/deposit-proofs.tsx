import { ImageOff, ZoomIn } from 'lucide-react';
import { useState } from 'react';

import { CopyableValue } from '@/components/common/copy-button';
import { DetailList, DetailRow } from '@/components/common/page-header';
import { TimeAgo } from '@/components/common/time';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { errorMessage } from '@/lib/api/errors';
import { useProofObjectUrl } from '@/lib/api/queries';
import { formatBytes } from '@/lib/format';
import { useEnumLabel, useT } from '@/lib/i18n/use-translation';
import type { DepositProof } from '@/types';

import { depositMessages, useDepositEnumLabel } from './messages';

/**
 * The receipts, which are the whole reason a human is looking at this deposit.
 *
 * Proof bytes are bearer-protected, so an `<img src>` pointed at the API would 401 — the bytes are
 * fetched with the token and handed to the DOM as an object URL instead. `useProofObjectUrl` owns
 * that URL's lifetime and revokes it; nothing here may hold on to one past its component.
 */
export function DepositProofs({
  depositId,
  shortId,
  proofs,
}: {
  depositId: string;
  shortId: string;
  proofs: readonly DepositProof[];
}) {
  const t = useT(depositMessages);
  const enumLabel = useEnumLabel();

  if (proofs.length === 0) {
    return (
      <Alert tone="warning" title={t('deposits.proofs.noneTitle')}>
        {/* The rejection code is named with the same words the reject dialog offers, so the
            instruction and the option a reviewer then clicks read identically. */}
        {t('deposits.proofs.noneBody', {
          reason: enumLabel('rejectionCode', 'PROOF_MISSING'),
        })}
      </Alert>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {proofs.map((proof, index) => (
        <ProofCard
          key={proof.id}
          depositId={depositId}
          proof={proof}
          alt={t('deposits.proofs.alt', {
            index: index + 1,
            total: proofs.length,
            shortId,
          })}
        />
      ))}
    </div>
  );
}

function ProofCard({
  depositId,
  proof,
  alt,
}: {
  depositId: string;
  proof: DepositProof;
  alt: string;
}) {
  const t = useT(depositMessages);
  const depositEnumLabel = useDepositEnumLabel();
  const { url, error, loading, reload } = useProofObjectUrl(depositId, proof.id);
  const [broken, setBroken] = useState(false);
  const [zoomed, setZoomed] = useState(false);

  return (
    <div className="space-y-3 rounded-lg border border-[var(--border)] p-3">
      {loading ? <Skeleton className="h-44 w-full" /> : null}

      {error !== null ? (
        <Alert tone="danger" title={t('deposits.proofs.fetchFailed')}>
          <p>{errorMessage(error)}</p>
          <Button variant="secondary" size="sm" className="mt-2" onClick={reload}>
            {t('common.retry')}
          </Button>
        </Alert>
      ) : null}

      {url !== null && broken ? (
        <Alert tone="danger" title={t('deposits.proofs.decodeFailedTitle')}>
          {t('deposits.proofs.decodeFailedBody', { mimeType: proof.mimeType })}
        </Alert>
      ) : null}

      {url !== null && !broken ? (
        <button
          type="button"
          onClick={() => {
            setZoomed(true);
          }}
          className="group relative block w-full overflow-hidden rounded-md border border-[var(--border)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
          aria-label={t('deposits.proofs.enlargeLabel', { alt })}
        >
          <img
            src={url}
            alt={alt}
            className="h-44 w-full bg-[var(--surface-muted)] object-contain"
            onError={() => {
              setBroken(true);
            }}
          />
          {/* `end-2`: the badge sits in the corner the language ends on, over either image. */}
          <span className="absolute end-2 bottom-2 flex items-center gap-1 rounded bg-[var(--surface)]/90 px-1.5 py-0.5 text-xs text-[var(--muted-foreground)]">
            <ZoomIn className="size-3" />
            {t('deposits.proofs.enlarge')}
          </span>
        </button>
      ) : null}

      <DetailList>
        {/* The algorithm's own name, written the same way everywhere it is printed. */}
        <DetailRow label="SHA-256">
          <CopyableValue value={proof.sha256} display={`${proof.sha256.slice(0, 12)}…`} />
        </DetailRow>
        <DetailRow label={t('deposits.proofs.size')}>
          <span className="tabular">{formatBytes(proof.sizeBytes)}</span>
        </DetailRow>
        <DetailRow label={t('deposits.proofs.dimensions')}>
          {proof.width === null || proof.height === null ? (
            <span className="text-[var(--muted-foreground)]">{t('common.unknown')}</span>
          ) : (
            <span className="tabular">
              {proof.width} × {proof.height}
            </span>
          )}
        </DetailRow>
        <DetailRow label={t('deposits.proofs.source')}>
          {depositEnumLabel('proofSource', proof.source)}
        </DetailRow>
        <DetailRow label={t('deposits.proofs.uploaded')}>
          <TimeAgo value={proof.createdAt} />
        </DetailRow>
      </DetailList>

      <Dialog open={zoomed} onOpenChange={setZoomed}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{alt}</DialogTitle>
            <DialogDescription>
              {formatBytes(proof.sizeBytes)} · {proof.mimeType}
            </DialogDescription>
          </DialogHeader>
          {url === null ? (
            <Alert tone="danger" title={t('deposits.proofs.nothingToShow')}>
              <ImageOff className="size-4" aria-hidden="true" />
            </Alert>
          ) : (
            <img
              src={url}
              alt={alt}
              className="max-h-[70vh] w-full rounded-md bg-[var(--surface-muted)] object-contain"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
