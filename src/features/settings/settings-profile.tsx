import { LogOut } from 'lucide-react';

import { CopyableValue } from '@/components/common/copy-button';
import { DetailList, DetailRow } from '@/components/common/page-header';
import { RoleBadge } from '@/components/common/status-badge';
import { Countdown } from '@/components/common/time';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/auth/use-auth';
import { useT } from '@/lib/i18n/use-translation';

import { settingsMessages } from './messages';

/**
 * Who this tab is signed in as, and how long that lasts.
 *
 * The expiry is a live countdown rather than a timestamp because the admin path has no refresh
 * token: when it reaches zero the only way back is a fresh `/console` code from the bot. Saying
 * that out loud here is the difference between an operator who plans around it and one who loses
 * a half-written rejection note to a surprise sign-out.
 */
export function SettingsProfile() {
  const { admin, role, session, expiringSoon, signOut } = useAuth();
  const t = useT(settingsMessages);

  if (admin === null || role === null || session === null) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.profile.title')}</CardTitle>
          <CardDescription>{t('settings.profile.noSession')}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.profile.title')}</CardTitle>
        <CardDescription>{t('settings.profile.description')}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <DetailList>
          <DetailRow label={t('field.displayName')}>{admin.displayName}</DetailRow>

          <DetailRow label={t('field.telegramId')}>
            <CopyableValue value={admin.telegramUserId} />
          </DetailRow>

          <DetailRow label={t('field.role')}>
            <span className="flex flex-col items-end gap-1">
              <RoleBadge role={role} />
              <span className="text-xs text-[var(--muted-foreground)]">
                {t(`settings.role.${role}`)}
              </span>
            </span>
          </DetailRow>

          <DetailRow label={t('settings.profile.sessionEndsIn')}>
            <Countdown
              target={session.expiresAt}
              {...(expiringSoon ? { className: 'text-[var(--warning)]' } : {})}
            />
          </DetailRow>
        </DetailList>

        <Alert
          tone={expiringSoon ? 'warning' : 'neutral'}
          title={t('settings.profile.noRefreshTitle')}
        >
          {/* The command is split out of the sentence rather than interpolated into it: it has to
              stay a <code> element so it reads as something you type, and it stays left-to-right
              inside an Arabic paragraph. */}
          {t('settings.profile.noRefreshBefore')} <code className="font-mono">/console</code>{' '}
          {t('settings.profile.noRefreshAfter')}
        </Alert>

        <Button
          variant="secondary"
          onClick={() => {
            signOut('manual');
          }}
        >
          {/* The door stays where it is and the arrow leaves through it — mirrored, not rotated,
              which would stand the door on its head. */}
          <LogOut className="size-4 rtl:-scale-x-100" />
          {t('account.signOut')}
        </Button>
      </CardContent>
    </Card>
  );
}
