import { CircleDot, Eye, PencilLine } from 'lucide-react';
import type { ReactNode } from 'react';

import { Badge, CardDescription, CardHeader, CardTitle, Tooltip } from '@/components/ui';
import { useT } from '@/lib/i18n/use-translation';
import type { Tone } from '@/types/enums';

import { botConfigMessages } from './messages';

/**
 * THE HONESTY MARKER. Every section of this screen carries exactly one.
 *
 * The destinations screen already does this one category at a time — "Nothing publishes this yet",
 * printed beside a checkbox rather than hiding it or disabling it. This is the same idea at the
 * scale of a section, because on this screen the question is not per-field: a whole surface of the
 * bot is either writable from here or it is not.
 *
 *   live      the control writes to the API and the bot reads the result
 *   reading   an accurate reading of what the bot does, with nothing anywhere to change it
 *   draft     the control works, holds what you type, and nothing anywhere reads it
 *
 * Three, not two, and the third is the one that matters. "Draft" exists so that a text box which
 * accepts typing can still be honest about going nowhere — the failure this screen is written
 * against is a message editor that looks like it saves.
 */
export type SurfaceState = 'live' | 'reading' | 'draft';

const TONES: Record<SurfaceState, Tone> = {
  live: 'success',
  reading: 'muted',
  draft: 'warning',
};

const ICONS = {
  live: CircleDot,
  reading: Eye,
  draft: PencilLine,
} as const;

export function SurfaceBadge({ state }: { state: SurfaceState }) {
  const t = useT(botConfigMessages);
  const Icon = ICONS[state];

  return (
    <Tooltip content={t(`botConfig.state.${state}.hint`)}>
      {/* `tabIndex`, so the sentence behind the badge is reachable without a pointer: on the
          sections that are NOT live it carries the whole explanation of why. */}
      <Badge tone={TONES[state]} tabIndex={0} className="cursor-help">
        <Icon className="size-3" aria-hidden="true" />
        {t(`botConfig.state.${state}`)}
      </Badge>
    </Tooltip>
  );
}

/**
 * A card heading with its marker on the same line.
 *
 * On the same LINE, and never below the description: the state has to be readable in the same
 * glance as the title, or a reader forms an expectation from the heading and meets the correction
 * two paragraphs later.
 */
export function SectionHeader({
  title,
  state,
  children,
}: {
  title: string;
  state: SurfaceState;
  children?: ReactNode;
}) {
  return (
    // A landmark per section, named by its own heading. A marker is only worth something ATTACHED
    // to the surface it describes — "Reading only" floating somewhere on a thirteen-card screen
    // makes no claim about any particular card — so the title and its marker are grouped into one
    // addressable thing. That is how a screen reader asks what THIS section says about itself
    // instead of hearing thirteen badges in a row, and it is the same landmark the payment rows
    // already carry one per method.
    <CardHeader role="region" aria-label={title}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle>{title}</CardTitle>
        <SurfaceBadge state={state} />
      </div>
      {children === undefined ? null : <CardDescription>{children}</CardDescription>}
    </CardHeader>
  );
}
