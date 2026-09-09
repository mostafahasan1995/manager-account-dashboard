import { useState } from 'react';
import { toast } from 'sonner';

import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from '@/components/ui';
import { errorMessage } from '@/lib/api/errors';
import { useCreateMenuButton, useUpdateMenuButton } from '@/lib/api/queries';
import { useT } from '@/lib/i18n/use-translation';
import type { BotMenuButton, BotMenuButtonKind, BotMenuNode, BotMenuTree } from '@/types';

import { botConfigMessages } from './messages';

/**
 * Create or edit one button.
 *
 * ── WHY THE FORM CHANGES SHAPE WITH `kind` ────────────────────────────────────────────────────
 * A button carries exactly one payload: an action, a destination, a message, or nothing. Showing
 * all four fields at once and ignoring three would let an operator fill in a message on a
 * navigation button and reasonably expect it to be sent. The backend nulls the unused columns and
 * a CHECK constraint refuses any row that carries the wrong one, so the form matches that shape
 * rather than papering over it.
 *
 * ── WHY THE LABEL WARNING IS ON THE LABEL FIELD ───────────────────────────────────────────────
 * The bot routes a tap by matching the label text — it is the routing key, not a caption. Renaming
 * a button therefore changes what a player's tap resolves to, and any player still looking at the
 * old keyboard taps a label that no longer exists. That sentence belongs beside the field it is
 * about, not in a page-level note somebody read once.
 */
export function ButtonFormDialog({
  open,
  button,
  node,
  tree,
  onOpenChange,
}: {
  open: boolean;
  /** Null creates. */
  button: BotMenuButton | null;
  node: BotMenuNode;
  tree: BotMenuTree;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        {/*
          KEYED, so opening the dialog on a different button REMOUNTS the form rather than syncing
          six pieces of state from an effect. The row is the form's initial value, and a remount is
          how React expresses "this is a different thing now" — an effect doing the same job runs a
          render late, which is visible as the previous button's label flashing in the field.
        */}
        {open ? (
          <ButtonForm
            key={button?.id ?? 'new'}
            button={button}
            node={node}
            tree={tree}
            onDone={() => {
              onOpenChange(false);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/** Whether a kind's payload has been filled in. */
function payloadReady(
  kind: BotMenuButtonKind,
  values: { action: string; target: string; body: string },
): boolean {
  switch (kind) {
    case 'BUILTIN':
      return values.action.length > 0;
    case 'NAVIGATE':
      return values.target.length > 0;
    case 'TEXT':
      return values.body.trim().length > 0;
    case 'BACK':
      // Carries nothing on purpose — where it returns to is the player's own path.
      return true;
  }
}

function ButtonForm({
  button,
  node,
  tree,
  onDone,
}: {
  button: BotMenuButton | null;
  node: BotMenuNode;
  tree: BotMenuTree;
  onDone: () => void;
}) {
  const t = useT(botConfigMessages);
  const create = useCreateMenuButton();
  const update = useUpdateMenuButton();

  const [label, setLabel] = useState(button?.label ?? '');
  const [kind, setKind] = useState<BotMenuButtonKind>(button?.kind ?? 'BUILTIN');
  const [action, setAction] = useState(
    button?.builtinAction ?? tree.builtinActions[0]?.action ?? '',
  );
  const [target, setTarget] = useState(button?.targetNodeId ?? '');
  const [body, setBody] = useState(button?.bodyText ?? '');
  const [rowIndex, setRowIndex] = useState(String(button?.rowIndex ?? 0));

  // Screens this button may open. Its own is excluded because a button cannot open the screen it is
  // already on — the backend refuses it and the database has a CHECK for it.
  const targets = tree.nodes.filter((candidate) => candidate.id !== node.id);

  const rowValue = /^\d+$/.test(rowIndex.trim()) ? Number(rowIndex.trim()) : null;
  const valid =
    label.trim().length > 0 && rowValue !== null && payloadReady(kind, { action, target, body });

  const submit = () => {
    // `valid` carries `rowValue !== null`, and TypeScript narrows through the alias — so `rowValue`
    // is a number below without a second check that could never fire.
    if (!valid) return;

    // Only the field this kind uses is sent. The backend nulls the rest anyway; sending them would
    // mean the request said one thing and the row meant another.
    const payload = {
      label: label.trim(),
      kind,
      rowIndex: rowValue,
      ...(kind === 'BUILTIN' ? { builtinAction: action } : {}),
      ...(kind === 'NAVIGATE' ? { targetNodeId: target } : {}),
      ...(kind === 'TEXT' ? { bodyText: body.trim() } : {}),
    };

    void (async () => {
      try {
        if (button === null) {
          await create.mutateAsync({ nodeId: node.id, ...payload });
          toast.success(t('botConfig.flow.buttonCreated', { label: label.trim() }));
        } else {
          await update.mutateAsync({ id: button.id, body: payload });
          toast.success(t('botConfig.flow.buttonSaved', { label: label.trim() }));
        }
        onDone();
      } catch (caught) {
        // The dialog STAYS OPEN: a duplicate label or a rejected payload is something the operator
        // is about to fix, and closing would make them retype it.
        toast.error(t('botConfig.flow.saveFailed'), { description: errorMessage(caught) });
      }
    })();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {button === null ? t('botConfig.flow.newButton') : t('botConfig.flow.editButton')}
        </DialogTitle>
        <DialogDescription>{t('botConfig.flow.dialogBody', { name: node.name })}</DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="button-label">{t('botConfig.field.label')}</Label>
          <Input
            id="button-label"
            value={label}
            autoComplete="off"
            aria-invalid={label.trim().length === 0}
            onChange={(event) => {
              setLabel(event.target.value);
            }}
          />
          <p className="text-xs text-[var(--muted-foreground)]">{t('botConfig.flow.labelHint')}</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="button-kind">{t('botConfig.flow.kind')}</Label>
          <Select
            value={kind}
            onValueChange={(value) => {
              setKind(value as BotMenuButtonKind);
            }}
          >
            <SelectTrigger id="button-kind">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="BUILTIN">{t('botConfig.flow.kind.builtin')}</SelectItem>
              <SelectItem value="NAVIGATE">{t('botConfig.flow.kind.navigate')}</SelectItem>
              <SelectItem value="TEXT">{t('botConfig.flow.kind.text')}</SelectItem>
              <SelectItem value="BACK">{t('botConfig.flow.kind.back')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {kind === 'BUILTIN' ? (
          <div className="space-y-1.5">
            <Label htmlFor="button-action">{t('botConfig.flow.action')}</Label>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger id="button-action">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tree.builtinActions.map((entry) => (
                  <SelectItem key={entry.action} value={entry.action}>
                    {entry.description}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-[var(--muted-foreground)]">
              {t('botConfig.flow.actionHint')}
            </p>
          </div>
        ) : null}

        {kind === 'NAVIGATE' ? (
          targets.length === 0 ? (
            <Alert tone="info">{t('botConfig.flow.noTargets')}</Alert>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="button-target">{t('botConfig.flow.target')}</Label>
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger id="button-target">
                  <SelectValue placeholder={t('botConfig.flow.targetPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {targets.map((candidate) => (
                    <SelectItem key={candidate.id} value={candidate.id}>
                      {candidate.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )
        ) : null}

        {kind === 'TEXT' ? (
          <div className="space-y-1.5">
            <Label htmlFor="button-body">{t('botConfig.flow.body')}</Label>
            <Textarea
              id="button-body"
              value={body}
              aria-invalid={body.trim().length === 0}
              onChange={(event) => {
                setBody(event.target.value);
              }}
            />
            <p className="text-xs text-[var(--muted-foreground)]">{t('botConfig.flow.bodyHint')}</p>
          </div>
        ) : null}

        {kind === 'BACK' ? <Alert tone="info">{t('botConfig.flow.backBody')}</Alert> : null}

        <div className="space-y-1.5">
          <Label htmlFor="button-row">{t('botConfig.flow.rowIndex')}</Label>
          <Input
            id="button-row"
            value={rowIndex}
            inputMode="numeric"
            autoComplete="off"
            className="tabular-nums"
            aria-invalid={rowValue === null}
            onChange={(event) => {
              setRowIndex(event.target.value);
            }}
          />
          <p className="text-xs text-[var(--muted-foreground)]">
            {t('botConfig.flow.rowIndexHint')}
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onDone}>
          {t('common.cancel')}
        </Button>
        <Button
          variant="primary"
          loading={create.isPending || update.isPending}
          disabled={!valid}
          onClick={submit}
        >
          {t('common.save')}
        </Button>
      </DialogFooter>
    </>
  );
}
