import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';

import { Can, EmptyState, ErrorState, TableSkeleton } from '@/components/common';
import { Alert, Badge, Button, Card, CardContent, Input, Label, Switch } from '@/components/ui';
import { errorMessage } from '@/lib/api/errors';
import {
  useBotMenuTree,
  useCreateMenuNode,
  useDeleteMenuButton,
  useDeleteMenuNode,
  useReorderMenuButtons,
  useUpdateMenuButton,
  useUpdateMenuGate,
  useUpdateMenuNode,
} from '@/lib/api/queries';
import { useAuth } from '@/lib/auth/use-auth';
import { useT } from '@/lib/i18n/use-translation';
import type { BotMenuButton, BotMenuNode, BotMenuTree } from '@/types';

import { ButtonFormDialog } from './button-form-dialog';
import { botConfigMessages } from './messages';
import { SectionHeader } from './surface-state';

/**
 * The flow editor.
 *
 * ── WHY A SCREEN PICKER AND NOT A CANVAS ──────────────────────────────────────────────────────
 * The obvious rendering of a graph is a node canvas with arrows. It is also the wrong one here: the
 * thing an operator is actually arranging is ONE Telegram keyboard at a time — rows of buttons, in
 * an order that maps directly onto what a player will see. A canvas shows the topology and hides the
 * layout, which is backwards for a tool whose whole job is "what does this screen look like on a
 * phone". So: pick a screen on the left, arrange its keyboard on the right, and let the NAVIGATE
 * buttons state the edges in words.
 *
 * ── WHY MOVE UP/DOWN AND NOT DRAG-AND-DROP ────────────────────────────────────────────────────
 * Position is two integers (row, order within row) and the rows are meaningful — Telegram draws
 * each as a row. Drag-and-drop across a two-dimensional grid needs a drop-target model to be
 * unambiguous, and a wrong drop silently rearranges a live bot. The arrows say exactly what they
 * do, and each one sends the whole layout in a single transaction.
 *
 * ── WHAT THIS SCREEN REFUSES TO HIDE ──────────────────────────────────────────────────────────
 * That a label is a routing key. Renaming a button is not cosmetic here the way it is everywhere
 * else in this console: the bot matches a tap by the label's text, so a rename changes behaviour.
 * The panel says so once, plainly, rather than letting an operator discover it.
 */
export function FlowPanel() {
  const t = useT(botConfigMessages);
  const { can } = useAuth();
  const mayWrite = can('paymentMethods.write');

  const tree = useBotMenuTree();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const nodes = useMemo(() => tree.data?.nodes ?? [], [tree.data]);
  // Root first, then alphabetically: the screen /start draws is the one an operator opens most, and
  // a list that reorders itself as screens are renamed is a list you have to re-find your place in.
  const ordered = useMemo(
    () =>
      [...nodes].sort((a, b) =>
        a.isRoot === b.isRoot ? a.name.localeCompare(b.name) : a.isRoot ? -1 : 1,
      ),
    [nodes],
  );

  const selected = ordered.find((node) => node.id === selectedId) ?? ordered[0] ?? null;

  return (
    <div className="space-y-4">
      <Card>
        <SectionHeader title={t('botConfig.flow.title')} state="live">
          {t('botConfig.flow.body')}
        </SectionHeader>
        <CardContent className="space-y-4">
          <Alert tone="info" title={t('botConfig.flow.labelTitle')}>
            {t('botConfig.flow.labelBody')}
          </Alert>

          {mayWrite ? null : <Alert tone="neutral">{t('botConfig.buttons.readOnly')}</Alert>}

          {tree.isPending ? <TableSkeleton rows={4} columns={3} /> : null}
          {tree.error == null ? null : (
            <ErrorState
              error={tree.error}
              onRetry={() => {
                void tree.refetch();
              }}
            />
          )}

          {!tree.isPending && tree.error == null && ordered.length === 0 ? (
            <EmptyState
              title={t('botConfig.flow.empty.title')}
              description={t('botConfig.flow.empty.body')}
            />
          ) : null}

          {selected === null || tree.data === undefined ? null : (
            <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
              <ScreenList
                nodes={ordered}
                selectedId={selected.id}
                mayWrite={mayWrite}
                onSelect={setSelectedId}
              />
              {/* KEYED on the screen: the editor holds the prompt as local state, and a remount is
                  how "this is a different screen now" is expressed — without it, picking another
                  screen kept the previous one's prompt in the field and offered to save it there. */}
              <ScreenEditor
                key={selected.id}
                node={selected}
                tree={tree.data}
                mayWrite={mayWrite}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mounted only once the tree has landed: the card seeds its fields from the saved gate on
          first render, and mounting it while the tree was still loading seeded them empty. */}
      {tree.data === undefined ? null : <GateCard tree={tree.data} mayWrite={mayWrite} />}
    </div>
  );
}

// ── The screen list ───────────────────────────────────────────────────────────────────────────

function ScreenList({
  nodes,
  selectedId,
  mayWrite,
  onSelect,
}: {
  nodes: readonly BotMenuNode[];
  selectedId: string;
  mayWrite: boolean;
  onSelect: (id: string) => void;
}) {
  const t = useT(botConfigMessages);
  const create = useCreateMenuNode();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');

  const submit = () => {
    const trimmed = name.trim();
    if (trimmed.length === 0) return;

    // The key is derived, never typed. It is a machine handle an operator has no reason to choose,
    // and a free-text field for one is a field they can collide.
    const base =
      trimmed
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40) || 'screen';
    const key = `${base}-${Math.random().toString(36).slice(2, 6)}`;

    void (async () => {
      try {
        const node = await create.mutateAsync({ key, name: trimmed, promptText: trimmed });
        toast.success(t('botConfig.flow.screenCreated', { name: trimmed }));
        setName('');
        setAdding(false);
        onSelect(node.id);
      } catch (caught) {
        toast.error(t('botConfig.flow.screenCreateFailed'), { description: errorMessage(caught) });
      }
    })();
  };

  return (
    <nav aria-label={t('botConfig.flow.screens')} className="space-y-2">
      <ul className="space-y-1">
        {nodes.map((node) => (
          <li key={node.id}>
            <button
              type="button"
              aria-current={node.id === selectedId ? 'true' : undefined}
              onClick={() => {
                onSelect(node.id);
              }}
              className={
                node.id === selectedId
                  ? 'w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface-muted)] px-3 py-2 text-start text-sm font-medium'
                  : 'w-full rounded-lg border border-transparent px-3 py-2 text-start text-sm hover:border-[var(--border)]'
              }
            >
              <span className="block truncate">{node.name}</span>
              <span className="mt-0.5 flex items-center gap-1.5">
                {node.isRoot ? <Badge tone="info">{t('botConfig.flow.root')}</Badge> : null}
                <span className="text-xs text-[var(--muted-foreground)]">
                  {t('botConfig.flow.buttonCount', { count: node.buttons.length })}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      {!mayWrite ? null : adding ? (
        <div className="space-y-2 rounded-lg border border-[var(--border)] p-2">
          <Label htmlFor="new-screen">{t('botConfig.flow.screenName')}</Label>
          <Input
            id="new-screen"
            value={name}
            autoComplete="off"
            onChange={(event) => {
              setName(event.target.value);
            }}
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="primary"
              loading={create.isPending}
              disabled={name.trim().length === 0}
              onClick={submit}
            >
              {t('common.save')}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setAdding(false);
                setName('');
              }}
            >
              {t('common.cancel')}
            </Button>
          </div>
        </div>
      ) : (
        <Button
          size="sm"
          variant="secondary"
          className="w-full"
          onClick={() => {
            setAdding(true);
          }}
        >
          <Plus className="size-4" aria-hidden="true" />
          {t('botConfig.flow.addScreen')}
        </Button>
      )}
    </nav>
  );
}

// ── One screen's keyboard ─────────────────────────────────────────────────────────────────────

function ScreenEditor({
  node,
  tree,
  mayWrite,
}: {
  node: BotMenuNode;
  tree: BotMenuTree;
  mayWrite: boolean;
}) {
  const t = useT(botConfigMessages);
  const updateNode = useUpdateMenuNode();
  const deleteNode = useDeleteMenuNode();
  const reorder = useReorderMenuButtons();
  const updateButton = useUpdateMenuButton();
  const deleteButton = useDeleteMenuButton();

  const [editing, setEditing] = useState<{ open: boolean; button: BotMenuButton | null }>({
    open: false,
    button: null,
  });
  const [prompt, setPrompt] = useState(node.promptText ?? '');
  const promptDirty = prompt !== (node.promptText ?? '');

  // Sorted the way Telegram will draw them, so the table IS the keyboard.
  const rows = useMemo(() => {
    const byRow = new Map<number, BotMenuButton[]>();
    for (const button of [...node.buttons].sort(
      (a, b) => a.rowIndex - b.rowIndex || a.sortOrder - b.sortOrder,
    )) {
      byRow.set(button.rowIndex, [...(byRow.get(button.rowIndex) ?? []), button]);
    }
    return [...byRow.entries()].sort(([a], [b]) => a - b);
  }, [node.buttons]);

  const flat = rows.flatMap(([, row]) => row);

  /**
   * Move a button one place earlier or later in the drawing order, then renumber EVERYTHING.
   *
   * Renumbering the whole screen rather than swapping two rows is deliberate: sort orders drift
   * apart as buttons are added and deleted, and a swap on a drifted layout can be a no-op the
   * operator sees as a broken arrow.
   */
  const move = (button: BotMenuButton, delta: -1 | 1) => {
    const index = flat.findIndex((candidate) => candidate.id === button.id);
    const target = index + delta;
    if (index < 0 || target < 0 || target >= flat.length) return;

    const next = [...flat];
    const [moved] = next.splice(index, 1);
    if (moved === undefined) return;
    next.splice(target, 0, moved);

    void (async () => {
      try {
        await reorder.mutateAsync({
          nodeId: node.id,
          body: {
            positions: next.map((candidate, position) => ({
              id: candidate.id,
              // Layout preserved: the same buttons stay on the same rows, only their order changes.
              rowIndex: candidate.rowIndex,
              sortOrder: position,
            })),
          },
        });
      } catch (caught) {
        toast.error(t('botConfig.flow.reorderFailed'), { description: errorMessage(caught) });
      }
    })();
  };

  const describe = (button: BotMenuButton): string => {
    switch (button.kind) {
      case 'BUILTIN':
        return (
          tree.builtinActions.find((entry) => entry.action === button.builtinAction)?.description ??
          button.builtinAction ??
          ''
        );
      case 'NAVIGATE':
        return t('botConfig.flow.opens', {
          name: tree.nodes.find((n) => n.id === button.targetNodeId)?.name ?? '—',
        });
      case 'TEXT':
        return t('botConfig.flow.sendsText');
      case 'BACK':
        return t('botConfig.flow.goesBack');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{node.name}</h3>
        <div className="flex gap-2">
          <Can capability="paymentMethods.write">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                setEditing({ open: true, button: null });
              }}
            >
              <Plus className="size-4" aria-hidden="true" />
              {t('botConfig.flow.addButton')}
            </Button>
          </Can>
          {node.isRoot ? null : (
            <Can capability="paymentMethods.write">
              <Button
                size="sm"
                variant="ghost"
                loading={deleteNode.isPending}
                onClick={() => {
                  void (async () => {
                    try {
                      await deleteNode.mutateAsync(node.id);
                      toast.success(t('botConfig.flow.screenDeleted', { name: node.name }));
                    } catch (caught) {
                      // The API refuses a screen other buttons still open, and names them. That
                      // message is the whole value of the failure, so it is shown, not summarised.
                      toast.error(t('botConfig.flow.screenDeleteFailed'), {
                        description: errorMessage(caught),
                      });
                    }
                  })();
                }}
              >
                <Trash2 className="size-4" aria-hidden="true" />
                {t('botConfig.flow.deleteScreen')}
              </Button>
            </Can>
          )}
        </div>
      </div>

      {node.isRoot ? (
        <p className="text-xs text-[var(--muted-foreground)]">{t('botConfig.flow.rootBody')}</p>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor={`prompt-${node.id}`}>{t('botConfig.flow.prompt')}</Label>
          <Input
            id={`prompt-${node.id}`}
            value={prompt}
            disabled={!mayWrite}
            onChange={(event) => {
              setPrompt(event.target.value);
            }}
          />
          <p className="text-xs text-[var(--muted-foreground)]">{t('botConfig.flow.promptHint')}</p>
          {promptDirty ? (
            <Button
              size="sm"
              variant="primary"
              loading={updateNode.isPending}
              onClick={() => {
                void (async () => {
                  try {
                    await updateNode.mutateAsync({
                      id: node.id,
                      body: { promptText: prompt.trim().length === 0 ? null : prompt.trim() },
                    });
                    toast.success(t('botConfig.flow.promptSaved'));
                  } catch (caught) {
                    toast.error(t('botConfig.flow.promptFailed'), {
                      description: errorMessage(caught),
                    });
                  }
                })();
              }}
            >
              {t('common.save')}
            </Button>
          ) : null}
        </div>
      )}

      {node.buttons.length === 0 ? (
        <EmptyState
          title={t('botConfig.flow.noButtons.title')}
          description={t('botConfig.flow.noButtons.body')}
        />
      ) : (
        <div className="space-y-3">
          {rows.map(([rowIndex, row]) => (
            <div key={rowIndex} className="space-y-2">
              <p className="text-xs font-medium text-[var(--muted-foreground)]">
                {t('botConfig.flow.row', { n: rowIndex + 1 })}
              </p>
              {row.map((button) => (
                <div
                  key={button.id}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{button.label}</p>
                    <p className="truncate text-xs text-[var(--muted-foreground)]">
                      {describe(button)}
                    </p>
                  </div>

                  {button.isActive ? null : (
                    <Badge tone="muted">{t('botConfig.buttons.hidden')}</Badge>
                  )}

                  <Can capability="paymentMethods.write">
                    <div className="flex items-center gap-1">
                      <Switch
                        aria-label={t('botConfig.flow.shown', { label: button.label })}
                        checked={button.isActive}
                        onCheckedChange={(checked) => {
                          void updateButton
                            .mutateAsync({ id: button.id, body: { isActive: checked } })
                            .catch((caught: unknown) => {
                              toast.error(t('botConfig.flow.saveFailed'), {
                                description: errorMessage(caught),
                              });
                            });
                        }}
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={t('botConfig.flow.moveUp', { label: button.label })}
                        onClick={() => {
                          move(button, -1);
                        }}
                      >
                        <ArrowUp className="size-4" aria-hidden="true" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={t('botConfig.flow.moveDown', { label: button.label })}
                        onClick={() => {
                          move(button, 1);
                        }}
                      >
                        <ArrowDown className="size-4" aria-hidden="true" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={t('botConfig.flow.edit', { label: button.label })}
                        onClick={() => {
                          setEditing({ open: true, button });
                        }}
                      >
                        <Pencil className="size-4" aria-hidden="true" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={t('botConfig.flow.delete', { label: button.label })}
                        onClick={() => {
                          void deleteButton
                            .mutateAsync(button.id)
                            .then(() => {
                              toast.success(t('botConfig.flow.buttonDeleted'));
                            })
                            .catch((caught: unknown) => {
                              toast.error(t('botConfig.flow.saveFailed'), {
                                description: errorMessage(caught),
                              });
                            });
                        }}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </Can>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      <ButtonFormDialog
        open={editing.open}
        button={editing.button}
        node={node}
        tree={tree}
        onOpenChange={(open) => {
          setEditing((previous) => ({ ...previous, open }));
        }}
      />
    </div>
  );
}

// ── The channel gate ──────────────────────────────────────────────────────────────────────────

/**
 * "Join the channel to continue", configured.
 *
 * The warning about the bot needing to be an ADMINISTRATOR is not a footnote. `getChatMember` only
 * answers for an admin bot, so a gate configured without that silently lets everybody through —
 * the operator sees a saved setting and no effect, with nothing on this screen able to detect it.
 */
function GateCard({ tree, mayWrite }: { tree: BotMenuTree; mayWrite: boolean }) {
  const t = useT(botConfigMessages);
  const update = useUpdateMenuGate();

  const [channelId, setChannelId] = useState(tree.gate.channelId ?? '');
  const [username, setUsername] = useState(tree.gate.channelUsername ?? '');

  const bothEmpty = channelId.trim().length === 0 && username.trim().length === 0;
  const bothFilled = channelId.trim().length > 0 && username.trim().length > 0;

  return (
    <Card>
      <SectionHeader title={t('botConfig.gate.title')} state="live">
        {t('botConfig.gate.body')}
      </SectionHeader>
      <CardContent className="space-y-4">
        <Alert tone="warning" title={t('botConfig.gate.adminTitle')}>
          {t('botConfig.gate.adminBody')}
        </Alert>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="gate-username">{t('botConfig.gate.username')}</Label>
            <Input
              id="gate-username"
              value={username}
              placeholder="rocco_gaming"
              autoComplete="off"
              disabled={!mayWrite}
              onChange={(event) => {
                setUsername(event.target.value);
              }}
            />
            <p className="text-xs text-[var(--muted-foreground)]">
              {t('botConfig.gate.usernameHint')}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="gate-id">{t('botConfig.gate.channelId')}</Label>
            <Input
              id="gate-id"
              value={channelId}
              placeholder="-1001234567890"
              inputMode="numeric"
              autoComplete="off"
              className="tabular-nums"
              disabled={!mayWrite}
              onChange={(event) => {
                setChannelId(event.target.value);
              }}
            />
            <p className="text-xs text-[var(--muted-foreground)]">
              {t('botConfig.gate.channelIdHint')}
            </p>
          </div>
        </div>

        <Can capability="paymentMethods.write">
          <Button
            variant="primary"
            size="sm"
            loading={update.isPending}
            // Both or neither. Half a gate has either nothing tappable to show or no way to check.
            disabled={!bothEmpty && !bothFilled}
            onClick={() => {
              void (async () => {
                try {
                  await update.mutateAsync(
                    bothEmpty
                      ? { channelId: null, channelUsername: null }
                      : { channelId: channelId.trim(), channelUsername: username.trim() },
                  );
                  toast.success(
                    bothEmpty ? t('botConfig.gate.cleared') : t('botConfig.gate.saved'),
                  );
                } catch (caught) {
                  toast.error(t('botConfig.gate.failed'), { description: errorMessage(caught) });
                }
              })();
            }}
          >
            {bothEmpty ? t('botConfig.gate.turnOff') : t('common.save')}
          </Button>
        </Can>
      </CardContent>
    </Card>
  );
}
