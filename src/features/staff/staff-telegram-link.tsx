import { ExternalLink, Link2, Unlink } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { CopyableValue } from '@/components/common/copy-button';
import { Countdown } from '@/components/common/time';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { config } from '@/config';
import { errorMessage } from '@/lib/api/errors';
import {
  TENANT_CHAT_POLL_MS,
  useAdmin,
  useIssueStaffTelegramLinkCode,
  useUnlinkStaffTelegram,
} from '@/lib/api/queries';
import { mayGrantRole, worksInTenantZero } from '@/lib/auth/permissions';
import { useAuth } from '@/lib/auth/use-auth';
import { useT } from '@/lib/i18n/use-translation';
import { isAgentPrincipal, type AdminUser } from '@/types/admin';

import { staffMessages } from './messages';

/**
 * Whether this staff account's taps in the staff group count, and the two controls that change it
 * (owner decision 4, 2026-09-15).
 *
 * ── WHO SEES WHICH BUTTON ─────────────────────────────────────────────────────────────────────
 * "Link Telegram" is offered to the person themselves and to a platform admin, and to nobody else —
 * a super admin included. Whoever is shown a code can send it from THEIR Telegram and have their taps
 * count as this person's, so the backend refuses anybody else and this only mirrors that. "Unlink"
 * also goes to a super admin, because removing a link only takes authority away — except on a
 * PLATFORM_ADMIN row, which only someone who could grant that role may change (`mayGrantRole`: a
 * platform admin with no tenant override). Neither button is offered on the agent principal, whose
 * reserved Telegram id "0" is how its sign-in finds it, not a link (422 AGENT_PRINCIPAL). Hiding is
 * a courtesy; the server enforces all of it.
 *
 * ── NOTHING TO LINK IN TENANT ZERO ────────────────────────────────────────────────────────────
 * Tenant zero is the platform and has no bot, so while the console works in it the backend refuses a
 * code for every account (422 PLATFORM) and "Link Telegram" is not offered. "Unlink" is not refused
 * there and stays. An unlinked row would then read "taps are refused until linked" with no way to
 * link, so it says why instead.
 *
 * ── WHY THE CODE LIVES IN A MUTATION, AND DIES WITH THE DIALOG ────────────────────────────────
 * Each request revokes the previous code, and the code is a credential for ten minutes. So it is
 * asked for only by a click, never re-fetched by a re-render, and `reset()` drops it from memory the
 * moment the dialog closes or the page unmounts; `gcTime: 0` on the mutation keeps TanStack's cache
 * from holding it after that. While the dialog is open the account is re-read every few seconds, so
 * "linked" appears as soon as the bot has taken the code — nothing pushes that to the console.
 */
export function StaffTelegramLink({ admin }: { admin: AdminUser }) {
  const t = useT(staffMessages);
  const { admin: me, role, can, tenantId, session } = useAuth();
  const issue = useIssueStaffTelegramLinkCode();
  const unlink = useUnlinkStaffTelegram();
  const [open, setOpen] = useState(false);
  const [unlinkOpen, setUnlinkOpen] = useState(false);
  const [unlinkError, setUnlinkError] = useState<string | null>(null);

  const isSelf = me?.id === admin.id;
  const agentPrincipal = isAgentPrincipal(admin);
  const inPlatform = worksInTenantZero({
    role,
    homeTenantId: session?.tenantId,
    tenantOverride: tenantId,
    headerEnabled: config.tenantHeaderEnabled,
  });
  const mayLink =
    !admin.telegramLinked &&
    !agentPrincipal &&
    !inPlatform &&
    (isSelf || role === 'PLATFORM_ADMIN');
  const mayUnlink =
    admin.telegramLinked &&
    !agentPrincipal &&
    (isSelf ||
      (can('admins.write') &&
        (admin.role !== 'PLATFORM_ADMIN' || mayGrantRole(role, 'PLATFORM_ADMIN', tenantId))));

  // Leaving the page drops the code too, not only closing the dialog.
  const { reset: resetIssue } = issue;
  useEffect(
    () => () => {
      resetIssue();
    },
    [resetIssue],
  );

  // Polls only while a code is out and not yet redeemed; the page's own read shares this cache.
  const live = useAdmin(admin.id, {
    refetchIntervalMs:
      open && issue.data !== undefined && !admin.telegramLinked ? TENANT_CHAT_POLL_MS : false,
  });
  const linkedNow = (live.data ?? admin).telegramLinked;

  const requestCode = () => {
    issue.mutate(admin.id);
  };

  const close = (next: boolean) => {
    setOpen(next);
    if (!next) issue.reset();
  };

  const runUnlink = () => {
    setUnlinkError(null);
    unlink.mutate(admin.id, {
      onSuccess: () => {
        setUnlinkOpen(false);
        toast.success(t('staff.telegram.unlinkedToast', { name: admin.displayName }));
      },
      onError: (error) => {
        setUnlinkError(errorMessage(error));
      },
    });
  };

  const code = issue.data;

  return (
    <div className="flex flex-col items-end gap-1.5">
      <span className="inline-flex flex-wrap items-center justify-end gap-2">
        <Badge tone={admin.telegramLinked ? 'success' : 'muted'}>
          {admin.telegramLinked ? t('staff.telegram.linked') : t('staff.telegram.notLinked')}
        </Badge>
        {mayLink ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              setOpen(true);
              requestCode();
            }}
          >
            <Link2 className="size-3.5" />
            {t('staff.telegram.link')}
          </Button>
        ) : null}
        {mayUnlink ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setUnlinkError(null);
              setUnlinkOpen(true);
            }}
          >
            <Unlink className="size-3.5" />
            {t('staff.telegram.unlink')}
          </Button>
        ) : null}
      </span>
      <span className="text-xs text-[var(--muted-foreground)]">
        {admin.telegramLinked
          ? t('staff.telegram.linkedHint')
          : inPlatform
            ? t('staff.telegram.platformHint')
            : t('staff.telegram.notLinkedHint')}
      </span>

      <Dialog open={open} onOpenChange={close}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t('staff.telegram.dialogTitle', { name: admin.displayName })}
            </DialogTitle>
            <DialogDescription>
              {t('staff.telegram.dialogBody', { name: admin.displayName })}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 text-sm">
            {issue.isPending ? (
              <p className="text-[var(--muted-foreground)]">{t('staff.telegram.issuing')}</p>
            ) : null}

            {issue.isError ? (
              <Alert tone="danger" title={t('staff.telegram.errorTitle')}>
                {errorMessage(issue.error)}
              </Alert>
            ) : null}

            {linkedNow && code !== undefined ? (
              <Alert
                tone="success"
                title={t('staff.telegram.linkedTitle', { name: admin.displayName })}
              >
                {t('staff.telegram.linkedBody')}
              </Alert>
            ) : null}

            {code === undefined || linkedNow ? null : (
              <>
                <div className="space-y-1">
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {t('staff.telegram.codeLabel')}
                  </p>
                  <CopyableValue value={code.code} className="text-base" />
                </div>
                <p>
                  {code.botUsername === null
                    ? t('staff.telegram.stepOpenAnyBot')
                    : t('staff.telegram.stepOpenBot', { bot: code.botUsername })}
                </p>
                {code.botUrl === null || code.botUsername === null ? null : (
                  <a
                    href={code.botUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-[var(--primary)] underline underline-offset-4"
                  >
                    <ExternalLink className="size-3.5" />
                    {t('staff.telegram.openBot', { bot: code.botUsername })}
                  </a>
                )}
                <div className="space-y-1">
                  <p>{t('staff.telegram.stepSend')}</p>
                  {/* Left to right in both languages: it is a command the bot parses, not prose. */}
                  <span dir="ltr">
                    <CopyableValue value={code.command} />
                  </span>
                </div>
                <p className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
                  <span>{t('staff.telegram.timeLeft')}</span>
                  <Countdown target={code.expiresAt} />
                </p>
                <Alert tone="warning">{t('staff.telegram.neverInGroup')}</Alert>
                <p className="text-xs text-[var(--muted-foreground)]">
                  {t('staff.telegram.waiting')}
                </p>
              </>
            )}
          </div>

          <DialogFooter>
            {linkedNow ? null : (
              <Button variant="ghost" loading={issue.isPending} onClick={requestCode}>
                {t('staff.telegram.newCode')}
              </Button>
            )}
            <Button
              variant="primary"
              onClick={() => {
                close(false);
              }}
            >
              {t('staff.telegram.done')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={unlinkOpen}
        onOpenChange={setUnlinkOpen}
        title={t('staff.telegram.unlinkTitle', { name: admin.displayName })}
        description={t('staff.telegram.unlinkBody')}
        confirmLabel={t('staff.telegram.unlink')}
        destructive
        loading={unlink.isPending}
        onConfirm={runUnlink}
      >
        {unlinkError === null ? null : (
          <Alert tone="danger" title={t('staff.telegram.unlinkErrorTitle')}>
            {unlinkError}
          </Alert>
        )}
      </ConfirmDialog>
    </div>
  );
}
