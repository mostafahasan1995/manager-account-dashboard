import { z } from 'zod';

/**
 * What the backend answers at GET /v1/system/egress-status.
 *
 * A loose schema on purpose, exactly like `health.ts`: this is a diagnostic read whose value is in
 * the numbers it reports, so a field the backend grows tomorrow must not make the whole panel — and
 * every screen that renders it — fail to parse. The fields the panel actually draws are pinned; the
 * rest ride along.
 */

export const egressPublicIpSchema = z.looseObject({
  ip: z.string().nullable(),
  /** `fresh` and `cached` are both real answers; `unreachable` is "the probe itself failed". */
  source: z.enum(['fresh', 'cached', 'unreachable']),
  error: z.string().nullable(),
});
export type EgressPublicIp = z.infer<typeof egressPublicIpSchema>;

export const vpnInterfaceSchema = z.looseObject({
  name: z.string(),
  kind: z.enum(['wireguard', 'tunnel', 'ppp', 'other']),
});
export type VpnInterface = z.infer<typeof vpnInterfaceSchema>;

export const egressStatusSchema = z.looseObject({
  evaluatedAt: z.string(),
  transport: z.enum(['browser', 'fetch']),
  publicIp: egressPublicIpSchema,
  vpn: z.looseObject({
    /** A tunnel interface is UP **and** holds the default route — i.e. actually carrying traffic. */
    active: z.boolean(),
    tunnelDefaultRoute: z.boolean(),
    interfaces: z.array(vpnInterfaceSchema),
    note: z.string().nullable(),
  }),
  proxy: z.looseObject({
    configured: z.boolean(),
    scheme: z.string().nullable(),
    hostport: z.string().nullable(),
    authenticated: z.boolean(),
    /** Where Ichancy's egress actually goes for the configured transport. */
    route: z.enum(['direct', 'relay', 'inline', 'undici']),
  }),
});
export type EgressStatus = z.infer<typeof egressStatusSchema>;
