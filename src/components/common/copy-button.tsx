import { Check, Copy } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Tooltip } from '@/components/ui/tooltip';
import { useT } from '@/lib/i18n/use-translation';
import { cn } from '@/lib/utils';

const FEEDBACK_MS = 1_500;

/**
 * Ids, references and account numbers are read out loud to players and pasted into the agent panel.
 * Copying them by hand is where transcription errors come from, so everything copyable gets this.
 */
export function CopyButton({
  value,
  label,
  className,
}: {
  value: string;
  /** Overrides the generic "Copy", for rows where several things are copyable. */
  label?: string;
  className?: string;
}) {
  const t = useT();
  const [copied, setCopied] = useState(false);
  const action = label ?? t('common.copy');

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => {
      setCopied(false);
    }, FEEDBACK_MS);
    return () => {
      window.clearTimeout(timer);
    };
  }, [copied]);

  const copy = () => {
    void navigator.clipboard
      .writeText(value)
      .then(() => {
        setCopied(true);
      })
      .catch(() => {
        // A denied clipboard permission is not worth an error toast; the value is on screen.
      });
  };

  return (
    <Tooltip content={copied ? t('common.copied') : action}>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className={cn('size-7', className)}
        onClick={copy}
        aria-label={copied ? t('common.copied') : action}
      >
        {copied ? <Check className="size-3.5 text-[var(--success)]" /> : <Copy className="size-3.5" />}
      </Button>
    </Tooltip>
  );
}

/** A monospace value with its copy button — the pattern used for every id in the console. */
export function CopyableValue({
  value,
  className,
  display,
}: {
  value: string;
  className?: string;
  display?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <code className="font-mono text-xs break-all">{display ?? value}</code>
      <CopyButton value={value} />
    </span>
  );
}
