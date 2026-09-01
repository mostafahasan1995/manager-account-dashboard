import { Link } from '@tanstack/react-router';

import { Can } from '@/components/common';
import {
  Alert,
  Badge,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui';
import { useT } from '@/lib/i18n/use-translation';

import { BOT_COMMANDS } from './bot-surface';
import { botConfigMessages } from './messages';
import { SectionHeader } from './surface-state';

/**
 * What the bot advertises behind Telegram's / button — shown, and not offered as a form.
 *
 * ── WHY THERE IS NO "ADD A COMMAND" HERE, AND WHY THAT IS NOT A GAP ───────────────────────────
 * The menu is a frozen constant in the bot, and a spec fails the BUILD if a listed command has no
 * handler answering it. That rule exists because a menu entry that answers nothing does not read as
 * "unimplemented" to the person who taps it — it reads as a broken bot, and that person is a player
 * trying to hand over money. So a new command is not a missing column on this screen; it is a
 * dispatch mechanism that does not exist. Renaming an existing one is the only edit that would even
 * be coherent, and it has no column to store the new name in, no DTO to carry it and no endpoint to
 * send it to.
 *
 * Showing the list is still worth doing: "what does my bot advertise, and to whom" has a correct
 * answer, an operator cannot get it anywhere else, and the answer to "who sees /queue" is a
 * security property rather than a detail.
 */
export function CommandMenuPanel() {
  const t = useT(botConfigMessages);

  return (
    <div className="space-y-4">
      <Card>
        <SectionHeader title={t('botConfig.commands.title')} state="reading">
          {t('botConfig.commands.body')}
        </SectionHeader>
        <CardContent className="space-y-4">
          <Alert tone="neutral" title={t('botConfig.commands.frozenTitle')}>
            {t('botConfig.commands.frozenBody')}
          </Alert>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('botConfig.commands.col.command')}</TableHead>
                  <TableHead>{t('botConfig.commands.col.description')}</TableHead>
                  <TableHead>{t('botConfig.commands.col.audience')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {BOT_COMMANDS.map((row) => (
                  <TableRow key={row.command}>
                    {/* `dir="ltr"`, because the cell is a leading ASCII slash — bidi-neutral — in
                        front of a Latin run. On the Arabic console the neutral takes the paragraph's
                        direction and lands at the far end: `start/`, which is not a command anyone
                        can type. Same fix as the login page's /console. */}
                    <TableCell dir="ltr" className="font-mono text-xs text-start whitespace-nowrap">
                      /{row.command}
                    </TableCell>
                    {/* The bot's own words, in the bot's own direction. Quoted, never translated:
                        this column reports what Telegram shows a player, and a translated copy
                        would report something nobody is shown. */}
                    <TableCell dir="rtl" lang="ar">
                      {row.description}
                    </TableCell>
                    <TableCell>
                      <Badge tone={row.audience === 'ADMIN' ? 'warning' : 'muted'}>
                        {t(`botConfig.commands.audience.${row.audience}`)}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <p className="text-sm text-[var(--muted-foreground)]">{t('botConfig.commands.arabic')}</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <SectionHeader title={t('botConfig.commands.staffTitle')} state="reading" />
          <CardContent>
            <p className="text-sm text-[var(--muted-foreground)]">
              {t('botConfig.commands.staffBody')}
            </p>
          </CardContent>
        </Card>

        <Card>
          <SectionHeader title={t('botConfig.commands.pushTitle')} state="reading" />
          <CardContent className="space-y-3">
            <p className="text-sm text-[var(--muted-foreground)]">
              {t('botConfig.commands.pushBody')}
            </p>
            {/* The push already exists, on the screen that owns the operator. A second button for
                it here would be a second place to wonder which one was pressed last. */}
            <Can capability="tenants.manage">
              <Button asChild variant="secondary" size="sm">
                <Link to="/tenants">{t('botConfig.commands.pushLink')}</Link>
              </Button>
            </Can>
          </CardContent>
        </Card>
      </div>

      <Alert tone="warning" title={t('botConfig.commands.copyTitle')}>
        {t('botConfig.commands.copyBody')}
      </Alert>
    </div>
  );
}
