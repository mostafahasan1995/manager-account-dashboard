import { screen } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { describe, expect, it } from 'vitest';

import { config } from '@/config';
import { server } from '@/test/msw-server';
import { renderPlain } from '@/test/utils';

import { SettingsEgress } from './settings-egress';

/**
 * The card exists to answer one question honestly: what IP is leaving this box, and is the tunnel
 * actually in front of it. So the cases pinned here are the ones where a lazier panel would lie —
 * a tunnel that is up but not routing, a probe that failed, and a proxy that does not change the
 * host IP at all.
 */

interface EgressFixture {
  evaluatedAt?: string;
  transport?: 'browser' | 'fetch';
  publicIp?: {
    ip: string | null;
    source: 'fresh' | 'cached' | 'unreachable';
    error: string | null;
  };
  vpn?: {
    active: boolean;
    tunnelDefaultRoute: boolean;
    interfaces: { name: string; kind: string }[];
    note: string | null;
  };
  proxy?: {
    configured: boolean;
    scheme: string | null;
    hostport: string | null;
    authenticated: boolean;
    route: 'direct' | 'relay' | 'inline' | 'undici';
  };
}

const egressReturns = (data: EgressFixture) => {
  server.use(
    http.get(`${config.apiBaseUrl}/v1/system/egress-status`, () =>
      HttpResponse.json({
        success: true,
        data: {
          evaluatedAt: new Date().toISOString(),
          transport: 'browser',
          publicIp: { ip: '198.51.100.7', source: 'fresh', error: null },
          vpn: {
            active: true,
            tunnelDefaultRoute: true,
            interfaces: [{ name: 'wg0', kind: 'wireguard' }],
            note: 'a tunnel interface is the default route — egress is via the VPN',
          },
          proxy: {
            configured: true,
            scheme: 'socks5',
            hostport: 'proxy.exit:1080',
            authenticated: true,
            route: 'relay',
          },
          ...data,
        },
        error: null,
        meta: { correlationId: 'test', timestamp: new Date().toISOString() },
      }),
    ),
  );
};

describe('SettingsEgress', () => {
  it('shows the server public IP, the active VPN and where Ichancy egress goes', async () => {
    egressReturns({});
    renderPlain(<SettingsEgress />);

    expect(await screen.findByText('198.51.100.7')).toBeInTheDocument();
    expect(screen.getByText('Active — carrying the default route')).toBeInTheDocument();
    expect(screen.getByText('Via the proxy through the local relay')).toBeInTheDocument();
    expect(screen.getByText(/wg0/)).toBeInTheDocument();
    expect(screen.getByText('measured just now')).toBeInTheDocument();
  });

  it('does NOT call a tunnel that is up but not routing "active"', async () => {
    egressReturns({
      vpn: {
        active: false,
        tunnelDefaultRoute: false,
        interfaces: [{ name: 'tun0', kind: 'tunnel' }],
        note: 'tunnel interface(s) up but NOT the default route — egress is still the host network',
      },
    });
    renderPlain(<SettingsEgress />);

    expect(await screen.findByText('Up, not routing')).toBeInTheDocument();
    expect(screen.queryByText('Active — carrying the default route')).not.toBeInTheDocument();
  });

  it('reads off and direct when there is no tunnel and no proxy', async () => {
    egressReturns({
      vpn: {
        active: false,
        tunnelDefaultRoute: false,
        interfaces: [],
        note: 'no tunnel interface is up',
      },
      proxy: {
        configured: false,
        scheme: null,
        hostport: null,
        authenticated: false,
        route: 'direct',
      },
    });
    renderPlain(<SettingsEgress />);

    expect(await screen.findByText('Off')).toBeInTheDocument();
    expect(screen.getByText(/None/)).toBeInTheDocument();
    expect(screen.getByText('Direct — no proxy configured')).toBeInTheDocument();
    expect(screen.getByText('Not configured')).toBeInTheDocument();
  });

  it('says the probe failed instead of inventing an IP', async () => {
    egressReturns({
      publicIp: { ip: null, source: 'unreachable', error: 'ECONNRESET' },
    });
    renderPlain(<SettingsEgress />);

    expect(await screen.findByText('No answer')).toBeInTheDocument();
    expect(screen.getByText('the probe itself failed')).toBeInTheDocument();
  });

  it('reports a failed read rather than showing an empty card', async () => {
    server.use(
      http.get(`${config.apiBaseUrl}/v1/system/egress-status`, () => HttpResponse.error()),
    );
    renderPlain(<SettingsEgress />);

    expect(await screen.findByText('The egress status could not be read.')).toBeInTheDocument();
  });

  it('speaks Arabic, including the honest non-routing VPN state', async () => {
    egressReturns({
      vpn: {
        active: false,
        tunnelDefaultRoute: false,
        interfaces: [{ name: 'tun0', kind: 'tunnel' }],
        note: null,
      },
    });
    renderPlain(<SettingsEgress />, { locale: 'ar' });

    expect(await screen.findByText('تعمل دون توجيه')).toBeInTheDocument();
    expect(screen.getByText('مسار خروج Ichancy')).toBeInTheDocument();
  });
});
