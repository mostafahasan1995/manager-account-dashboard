/**
 * Everything a platform admin can do to one operator, as one object.
 *
 * The setup checklist and the two operational cards offer the SAME actions from different places —
 * the checklist because it walks somebody through the order, the cards because that is where the
 * state each action changes is shown. Passing the actions down, rather than letting each surface
 * own its own mutation and its own dialog, is what keeps "register webhook" one button with one
 * pending state instead of two that can disagree with each other on screen.
 */
export interface TenantOperatorActions {
  /** Tells Telegram to deliver this operator's updates here. */
  registerWebhook: () => void;
  registering: boolean;
  /** Asks first: stopped delivery is invisible from the operator's own status. */
  askUnregisterWebhook: () => void;
  unregistering: boolean;
  /** Pushes the command menus, so `/console` and `/start` appear in the bot. */
  pushCommands: () => void;
  pushing: boolean;
  /** Opens the write-only bot token form. */
  replaceBotToken: () => void;
  /** Opens the Ichancy credentials form. */
  editIchancy: () => void;
  /** Re-reads health: a real Ichancy sign-in and a Telegram round trip. */
  recheck: () => void;
  checking: boolean;
}
