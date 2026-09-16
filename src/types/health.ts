import { z } from 'zod';

export const livenessSchema = z.looseObject({
  status: z.string(),
  role: z.string(),
  uptimeSeconds: z.number(),
  timestamp: z.string(),
});
export type Liveness = z.infer<typeof livenessSchema>;

const indicatorMapSchema = z.record(z.string(), z.looseObject({ status: z.string() }));

/**
 * Terminus answers 200 with `status: 'ok'` or **503 with the same body shape**, so the client asks
 * for this one without throwing on a non-2xx: a red readiness panel is the useful answer there.
 */
export const readinessSchema = z.looseObject({
  status: z.string(),
  info: indicatorMapSchema.nullish(),
  error: indicatorMapSchema.nullish(),
  details: indicatorMapSchema.nullish(),
});
export type Readiness = z.infer<typeof readinessSchema>;

export interface HealthSnapshot {
  live: Liveness | null;
  ready: Readiness | null;
  reachable: boolean;
}
