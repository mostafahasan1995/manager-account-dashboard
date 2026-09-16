import { z } from 'zod';

import { isoDateTime } from './api';

/**
 * The operator's own Ichancy agent balance — the pool every player credit is paid out of.
 *
 * `isLow` is the SERVER's verdict and not a comparison this console makes. The threshold is
 * `AGENT_FLOAT_LOW_WATERMARK_MINOR`, a per-operator config value the console holds no other copy
 * of, and the backend refuses an approval that would take the float below it (see
 * `deposit-review.service.ts`) — so recomputing the same rule here would be a second
 * implementation of a decision that must have exactly one. `lowWatermarkMinor` still travels, so
 * the pill can say what the floor actually was rather than only that it was crossed.
 *
 * Minor units are a decimal STRING because an NSP float runs past `Number.MAX_SAFE_INTEGER`; see
 * src/lib/money.ts.
 */
export const agentFloatSchema = z.looseObject({
  currencyCode: z.string(),
  balanceMinor: z.string(),
  /** Already formatted by the server, e.g. "1320000.00". The console groups it itself. */
  balance: z.string(),
  lowWatermarkMinor: z.string(),
  isLow: z.boolean(),
  checkedAt: isoDateTime,
});
export type AgentFloat = z.infer<typeof agentFloatSchema>;
