import { Info } from 'lucide-react';

import { config } from '@/config';
import { useT } from '@/lib/i18n/use-translation';

/**
 * The honest label on the tenant gap.
 *
 * When the backend does not read a tenant claim on HTTP requests, everything except the operator
 * screen answers for tenant zero. That is stated here rather than hidden, because the alternative —
 * a console that looks multi-tenant and silently shows one operator's money under another's name —
 * is the exact failure this notice exists to prevent. See docs/API-CONTRACT.md section 5.
 */
export function TenantNotice() {
  const t = useT();
  if (config.tenantHeaderEnabled) return null;

  return (
    <div className="flex items-start gap-2 border-b border-[var(--border)] bg-[var(--info-muted)] px-4 py-2 text-xs">
      <Info className="mt-0.5 size-3.5 shrink-0 text-[var(--info)]" />
      <p className="text-[var(--foreground)]">
        <span className="font-medium">{t('tenant.singleTenantTitle')}</span>{' '}
        {t('tenant.singleTenantBody')}
      </p>
    </div>
  );
}
