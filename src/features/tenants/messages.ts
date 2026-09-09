import { defineMessages } from '@/lib/i18n/messages';

/**
 * The tenants screen, in both languages.
 *
 * Only strings this feature owns live here. Status, Currency, Created, Updated, Cancel, All, None
 * and every `tenantStatus` value already exist in the shared bundle and are reached through `t()`
 * and `useEnumLabel()` rather than copied.
 *
 * The Arabic keeps the wiring vocabulary — Ichancy, Telegram, NSP, webhook, slug — in English. A
 * platform admin reading this screen is looking at the same words in the bot's config file and in
 * the Ichancy agent panel, and translating them would break that match for no gain.
 *
 * Minutes appear twice with different English: the table abbreviates to keep a narrow column, the
 * detail panel spells it out. Arabic has no equivalent abbreviation anyone would recognise on a
 * screen, so both read as دقيقة — the two keys carry that difference rather than hiding it.
 */
export const tenantMessages = defineMessages({
  en: {
    // ── Setup and health: the webhook, the command menus, the agent ──────────────────────────
    'tenants.ops.title': 'Setup and health',
    'tenants.ops.description':
      'What stands between this operator and answering somebody: its bot, the webhook Telegram delivers to, and the Ichancy agent it signs in as.',
    'tenants.ops.recheck': 'Check again',
    'tenants.ops.counts': 'What this operator holds',

    // ── The checklist ────────────────────────────────────────────────────────────────────────
    'tenants.checklist.title': 'Setup checklist',
    'tenants.checklist.remaining': {
      one: '{count} step still to do.',
      other: '{count} steps still to do.',
    },
    'tenants.checklist.allDone': 'Every step this console can check is done.',
    'tenants.checklist.stateDone': 'done',
    'tenants.checklist.stateTodo': 'still to do',
    'tenants.checklist.stateUnknown': 'cannot be checked here',

    'tenants.checklist.botToken': 'Bot token verified',
    'tenants.checklist.botTokenDone': 'Telegram answered for the stored token: the bot is @{bot}.',
    'tenants.checklist.botTokenTodo':
      'Telegram did not answer for the stored token, so this operator has no working bot at all. Create one in @BotFather and put its token in here.',

    'tenants.checklist.webhook': 'Webhook registered',
    'tenants.checklist.webhookDone':
      'Telegram delivers this bot’s updates to this deployment, so its staff can sign in.',
    'tenants.checklist.webhookTodo':
      'Creating an operator generates a webhook path but never tells Telegram about it. Until this is done the bot receives nothing at all.',

    'tenants.checklist.commands': 'Command menus pushed',
    'tenants.checklist.commandsUnknown':
      'Telegram is never asked what a bot’s menu holds, so nothing here can tell you whether this was done. Push them once — repeating it costs nothing, and it is what puts /start and /queue in the bot’s menu.',
    'tenants.checklist.commandsDone': {
      one: '{count} command pushed from here.',
      other: '{count} commands pushed from here.',
    },

    'tenants.checklist.admin': 'An admin who can sign in',
    'tenants.checklist.adminUnknown':
      'Staff belong to one operator, and this operator’s staff list is not readable from the platform screen — so this is the step you confirm yourself. Use “{action}” at the bottom of this panel, then sign in with the username and password you set there.',

    'tenants.checklist.agent': 'Ichancy agent verified',
    'tenants.checklist.agentDone': 'Agent {agent} answered a real sign-in.',
    'tenants.checklist.agentTodo':
      'Ichancy did not accept the stored credentials, so no player can be registered under this operator and no deposit can be credited.',

    'tenants.checklist.active': 'Activated',
    'tenants.checklist.activeDone': 'The operator is serving.',
    'tenants.checklist.activeTodo':
      'A new operator lands suspended and answers nobody. “{action}” is the last step, and the moment the backend signs in to Ichancy for real.',

    // ── Telegram ─────────────────────────────────────────────────────────────────────────────
    'tenants.telegram.title': 'Telegram',
    'tenants.telegram.deliveringTo': 'Delivering to',
    'tenants.telegram.noWebhookUrl': 'Telegram holds no webhook for this bot',
    'tenants.telegram.pending': 'Updates waiting at Telegram',
    'tenants.telegram.pendingTitle': {
      one: 'Telegram is holding {count} update for this bot',
      other: 'Telegram is holding {count} updates for this bot',
    },
    'tenants.telegram.pendingBody':
      'Telegram keeps what it could not deliver and replays it as soon as delivery works. A backlog that stays high while the webhook matches means this deployment is refusing them, not that Telegram is slow.',
    'tenants.telegram.lastErrorTitle': 'The last thing Telegram could not do',

    // ── The webhook, which is the whole operator ─────────────────────────────────────────────
    'tenants.webhook.register': 'Register webhook',
    'tenants.webhook.remove': 'Unregister',
    'tenants.webhook.deliveringTitle': 'Telegram is delivering to this deployment',
    'tenants.webhook.deliveringBody':
      'This bot’s updates reach this console, so its players can start a deposit and its staff see the cards.',
    'tenants.webhook.silentTitle': '{name} receives nothing from Telegram',
    'tenants.webhook.silentNoneBody':
      'No webhook is registered for this bot, so every message sent to it is dropped: no player can start a deposit and no card reaches the admin chat. Signing in to the console is unaffected — that is an ordinary password login and never goes through Telegram. Registering the webhook is what starts delivery.',
    'tenants.webhook.silentElsewhereBody':
      'Telegram delivers this bot’s updates to {url}, which is not this deployment’s path for this operator — so nothing reaches this console and no deposit can be started. Registering the webhook repoints Telegram here, and whatever is listening at that address stops receiving them.',
    'tenants.webhook.whichOne':
      'Register is the one you almost always want: it is what makes a new operator’s bot answer. Unregister stops delivery without suspending the operator — its books stay open and its deposits keep expiring on their own clocks while its bot goes silent — which is what you want only when you are moving this bot to another deployment. To stop the operator trading, suspend it instead.',
    'tenants.webhook.registeredTitle': '{name} is receiving updates',
    'tenants.webhook.registeredBody':
      'Telegram now delivers this bot’s updates to this deployment.',
    'tenants.webhook.registerErrorTitle': 'Could not register the webhook',
    'tenants.webhook.removeConfirmTitle': 'Stop Telegram delivering to {name}?',
    'tenants.webhook.removeConfirmBody':
      'The operator stays exactly as it is — active, with its books open and its deposits still expiring on their own clocks — but its bot stops answering, so no player can start a deposit. Staff can still sign in to the console. If what you want is for the operator to stop trading, suspend it instead.',
    'tenants.webhook.removeConfirmLabel': 'Unregister webhook',
    'tenants.webhook.removedTitle': 'Delivery to {name} stopped',
    'tenants.webhook.removedBody':
      'Its bot no longer reaches this deployment. Register the webhook again whenever you want it back.',
    'tenants.webhook.removeErrorTitle': 'Could not unregister the webhook',

    // ── Command menus ────────────────────────────────────────────────────────────────────────
    'tenants.commands.push': 'Push command menus',
    'tenants.commands.pushedTitle': {
      one: '{count} command set in the bot’s menu',
      other: '{count} commands set in the bot’s menu',
    },
    'tenants.commands.pushedBody': {
      one: '{count} command pushed, in these scopes: {scopes}.',
      other: '{count} commands pushed, in these scopes: {scopes}.',
    },
    'tenants.commands.errorTitle': 'Could not push the command menus',

    // ── Replacing the bot token ──────────────────────────────────────────────────────────────
    'tenants.bot.replace': 'Replace bot token',
    'tenants.bot.title': 'Replace the bot token for {name}',
    'tenants.bot.description':
      'The token is verified with a real getMe before anything is stored, so a bad one never reaches the database. It is sealed on arrival and never returned: this field can replace it, nothing can read it.',
    'tenants.bot.noWebhookTitle': 'The new bot will receive nothing until you register its webhook',
    'tenants.bot.noWebhookBody':
      'Telegram permits one webhook URL per bot, and the new bot has never been told where to deliver. The moment this saves, the operator is as silent as a brand-new one — no player can reach it — until you register the webhook again.',
    'tenants.bot.submit': 'Replace token',
    'tenants.bot.replacedTitle': 'New bot token stored for {name}',
    'tenants.bot.replacedBody': 'Register the webhook now, or this operator stays silent.',
    'tenants.bot.errorTitle': 'Telegram refused this bot token',

    // ── Ichancy ──────────────────────────────────────────────────────────────────────────────
    'tenants.ichancy.title': 'Ichancy',
    'tenants.ichancy.answeredTitle': 'The agent answered',
    'tenants.ichancy.answeredBody':
      'A real sign-in with this operator’s stored credentials succeeded, so players can be registered and deposits credited.',
    'tenants.ichancy.refusedTitle': 'Ichancy did not accept this agent',
    'tenants.ichancy.refusedNoReason':
      'Ichancy refused the sign-in and gave no reason. Nothing can be credited until it answers.',
    'tenants.ichancy.belowTitle': 'The agent float is below the low watermark',
    'tenants.ichancy.belowBody':
      'Player credits start failing when the agent runs out. Top it up before the next approval.',
    'tenants.ichancy.float': 'Agent float',
    'tenants.ichancy.floatUnread': 'not read',
    'tenants.ichancy.aboveWatermark': 'above the watermark',
    'tenants.ichancy.belowWatermark': 'below the watermark',
    'tenants.ichancy.checkedAt': 'Checked',
    'tenants.ichancy.test': 'Test connection',
    'tenants.ichancy.edit': 'Edit credentials',
    'tenants.ichancy.notShared':
      'No other operator is pointed at this Ichancy agent, so this one has its session to itself.',
    'tenants.ichancy.sharedTitle': {
      one: 'This Ichancy agent is shared with {count} other operator',
      other: 'This Ichancy agent is shared with {count} other operators',
    },
    'tenants.ichancy.sharedBody':
      'Ichancy allows one login per agent account, so these operators share ONE session: signing in for one signs in for all of them, and changing the password here changes it for all of them. Pointing several operators at one agent is a legitimate way to test — this notice is here so the coupling is never a surprise.',

    // ── Editing the Ichancy credentials ──────────────────────────────────────────────────────
    'tenants.ichancyEdit.title': 'Ichancy credentials for {name}',
    'tenants.ichancyEdit.description':
      'Saving signs in to Ichancy for real with these values and refuses them if the agent does not answer. Only the fields you change are sent.',
    'tenants.ichancyEdit.passwordHint':
      'Leave empty to keep the stored password. It is sealed and never returned, so it cannot be shown here — only replaced.',
    'tenants.ichancyEdit.agentIdWarning':
      'Cannot be changed once this operator has players: repointing the agent orphans them from the tree their balances live in. The API refuses it, and this is the one field here that can be refused after everything else was accepted.',
    'tenants.ichancyEdit.submit': 'Save and verify',
    'tenants.ichancyEdit.successTitle': 'Ichancy credentials saved for {name}',
    'tenants.ichancyEdit.successBody': 'Ichancy accepted a real sign-in with them.',
    'tenants.ichancyEdit.refusedTitle': 'The API refused this change',
    'tenants.ichancyEdit.errorTitle': 'Could not save the Ichancy credentials',
    'tenants.ichancyEdit.unchangedTitle': 'Nothing to save',
    'tenants.ichancyEdit.unchangedBody':
      'Every field still holds the value it had. Change one, or leave the form.',

    // ── The screen ───────────────────────────────────────────────────────────────────────────
    'tenants.title': 'Tenants',
    'tenants.description':
      'Every operator on the platform: its bot, its Ichancy agent, its review thresholds.',
    'tenants.new': 'New tenant',
    'tenants.showAll': 'Show all tenants',
    'tenants.filterByStatus': 'Filter tenants by status',

    'tenants.crossTenant.title': 'Every operator on the platform',
    'tenants.crossTenant.body':
      'Creating one here registers its Telegram bot and its Ichancy agent. Use the operator picker in the top bar to point the rest of the console at one of them — every other screen then answers for whichever operator is selected.',

    'tenants.empty.noneTitle': 'No tenants yet',
    'tenants.empty.noneBody':
      'A tenant is one operator: one Telegram bot, one Ichancy agent, one currency.',
    'tenants.empty.filteredTitle': 'No tenants with that status',
    'tenants.empty.filteredBody': 'Every tenant is filtered out by the status above.',

    // ── The table ────────────────────────────────────────────────────────────────────────────
    'tenants.list.caption': {
      one: '{count} tenant. Select it to see its Ichancy and Telegram wiring.',
      other: '{count} tenants. Select one to see its Ichancy and Telegram wiring.',
    },
    'tenants.notCounted': 'not counted',
    'tenants.noBotYet': 'no bot yet',
    'tenants.minutesShort': {
      one: '{count} min',
      other: '{count} min',
    },
    'tenants.minutes': {
      one: '{count} minute',
      other: '{count} minutes',
    },

    // ── Fields ───────────────────────────────────────────────────────────────────────────────
    'tenants.field.tenant': 'Tenant',
    'tenants.field.slug': 'Slug',
    'tenants.field.id': 'Tenant id',
    'tenants.field.bot': 'Bot',
    'tenants.field.botToken': 'Bot token',
    'tenants.field.players': 'Players',
    'tenants.field.deposits': 'Deposits',
    'tenants.field.currencyCode': 'Currency code',
    'tenants.field.dualApproval': 'Dual approval above',
    'tenants.field.floatLowWater': 'Float low water',
    'tenants.field.floatWatermark': 'Agent float low watermark',
    'tenants.field.depositExpiry': 'Deposit expiry',
    'tenants.field.depositExpiryMinutes': 'Deposit expiry (minutes)',
    'tenants.field.adminChatId': 'Admin chat id',
    'tenants.field.feedChatId': 'Feed chat id',
    'tenants.field.ichancyBaseUrl': 'Ichancy base URL',
    'tenants.field.ichancyUsername': 'Ichancy username',
    'tenants.field.ichancyPassword': 'Ichancy password',
    'tenants.field.ichancyAgentId': 'Ichancy agent id',
    'tenants.field.webhookPath': 'Webhook path',
    'tenants.field.depositMode': 'Deposit mode',
    'tenants.field.withdrawalMode': 'Withdrawal mode',
    'tenants.field.miniAppUrl': 'Mini app URL',

    // ── The detail panel ─────────────────────────────────────────────────────────────────────
    'tenants.detail.fallbackTitle': 'Tenant',
    'tenants.detail.loading': 'Loading this tenant.',
    'tenants.detail.slug': 'Slug {slug}',
    'tenants.editSettings': 'Edit settings',
    'tenants.section.identity': 'Identity',
    'tenants.section.money': 'Money and review rules',
    'tenants.section.chats': 'Telegram chats and stored secrets',
    'tenants.section.bot': 'Deposits, cash-outs and the mini app',
    'tenants.bot.depositModeExplained':
      'Automatic: the platform checks the player’s claim against Sham Cash or the chain and approves only on a match; anything unmatched waits for a person. Manual: an admin decides every deposit.',
    'tenants.bot.modeExplained':
      'Automatic: the platform approves, debits the player’s casino balance and checks the payout wallet by itself; a person still sends the money and marks it paid. Manual: nothing moves until an admin approves.',
    'tenants.webhook.pathGenerated': 'path token generated',
    'tenants.webhook.noPath': 'no path token',
    'tenants.secretsNote':
      'The webhook path token, the bot token and the Ichancy password are never returned by the API, so they cannot be shown or copied here — only replaced.',

    // ── Activate and suspend ─────────────────────────────────────────────────────────────────
    'tenants.activate.action': 'Activate',
    'tenants.activate.confirmTitle': 'Activate {name}?',
    'tenants.activate.confirmBody':
      "Activating is not a flag flip. The backend signs in to Ichancy with this tenant's stored username, password and agent id, and refuses to activate if that sign-in fails — which is exactly when a wrong agent id gets caught, before a single player is registered under it.",
    'tenants.activate.confirmLabel': 'Activate tenant',
    'tenants.activate.refusedTitle': 'Ichancy refused the sign-in',
    'tenants.activate.successTitle': '{name} is active',
    'tenants.activate.successBody':
      'Ichancy accepted the agent sign-in. The bot is answering again.',
    'tenants.activate.errorTitle': 'Activation failed',

    'tenants.suspend.action': 'Suspend',
    'tenants.suspend.confirmTitle': 'Suspend {name}?',
    'tenants.suspend.confirmBody':
      'The bot stops answering and no new deposit can be started. Credits already in flight still land, nothing already recorded is touched, and you can activate the tenant again at any time.',
    'tenants.suspend.confirmLabel': 'Suspend tenant',
    'tenants.suspend.successTitle': '{name} is suspended',
    'tenants.suspend.successBody':
      'The bot has stopped answering. Activate it again whenever you are ready.',
    'tenants.suspend.errorTitle': 'Could not suspend the tenant',

    // ── Add me as an admin here ──────────────────────────────────────────────────────────────
    'tenants.addMe.action': 'Add me as an admin here',
    'tenants.addMe.title': 'Add yourself to {name}',
    'tenants.addMe.description':
      'Staff belong to one operator, so you hold a separate admin account inside every operator you run. This creates yours inside {name}.',
    'tenants.addMe.target': 'This admin row will be written into',
    'tenants.addMe.usernameLabel': 'Username',
    'tenants.addMe.usernameHint':
      'What you will type to sign in to {name}. A name or an email, unique inside that operator — it may be the same one you use elsewhere.',
    'tenants.addMe.passwordLabel': 'Password',
    'tenants.addMe.passwordHint':
      'A new password, at least 8 characters. It cannot be copied from your current session, because a password is never readable back.',
    'tenants.addMe.usernameInvalid':
      'A username is 3 to 64 characters: letters, digits, and . _ @ + - only.',
    'tenants.addMe.passwordShort': 'Passwords are at least 8 characters.',
    'tenants.addMe.roleHint':
      'Platform admin is not offered here: it runs the platform and sees no operator data, so a platform admin row inside {name} would give you nothing.',
    'tenants.addMe.displayNameRequired': 'Give yourself a name the other staff will recognise.',
    'tenants.addMe.displayNameLong': 'Keep it under 120 characters.',

    'tenants.addMe.selectFirstTitle': 'The console is pointed at a different operator',
    'tenants.addMe.selectFirstBody':
      'An admin row is written into whichever operator the console has selected — the API takes no operator per request, only the one in the header. Selecting {name} is what makes this land inside it, and it is also what every other screen will show until you switch back.',
    'tenants.addMe.selectAction': 'Select {name}, then add me',
    'tenants.addMe.targetedTitle': 'The console is pointed at {name}',
    'tenants.addMe.targetedBody':
      'So this is where the admin row lands. The console stays pointed at {name} afterwards — the strip under the top bar says so for as long as it is.',
    'tenants.addMe.cannotTargetTitle': 'This console cannot aim a write at an operator',
    'tenants.addMe.cannotTargetBody':
      'X-Tenant-Id is switched off in this build, so every admin request answers for the default operator. An admin row created now would land there rather than in {name}, which is exactly the mistake this screen must not make.',
    'tenants.addMe.submit': 'Add me as an admin',
    'tenants.addMe.errorTitle': 'Could not add you as an admin',

    'tenants.addMe.createdTitle': 'You are now {role} in {name}',
    'tenants.addMe.existsTitle': 'You are already an admin there',
    'tenants.addMe.existsBody':
      'That username is already taken inside {name}. Nothing changed — if the existing account is yours, sign in with it.',
    'tenants.addMe.nextStepTitle': 'Next: sign in to {name}',
    'tenants.addMe.nextStepBody':
      'Sign out, then sign in with the username and password you just set. They open {name} and nothing else.',

    'tenants.role.SUPER_ADMIN':
      'Top of one tenant. Everything inside it, including staff and approval limits.',
    'tenants.role.FINANCE_ADMIN':
      'Decides deposits, manages payment rails, and works reconciliation breaks.',
    'tenants.role.REVIEWER': 'Reviews and decides deposits. Cannot change rails or staff.',
    'tenants.role.SUPPORT':
      'Reads players, deposits and rails to answer questions. Decides nothing.',
    'tenants.role.VIEWER': 'Read-only on the deposit queue and reconciliation.',

    // ── Create ───────────────────────────────────────────────────────────────────────────────
    'tenants.create.description':
      'One operator: one Telegram bot, one Ichancy agent, one currency. Four fields are yours; the platform fills in the rest.',
    'tenants.create.submit': 'Create tenant',
    'tenants.create.required': 'What only you can supply',
    'tenants.create.requiredHint':
      'A name, the bot token from BotFather, and the Ichancy login this operator signs in with. Nothing else is needed to create it.',
    'tenants.create.advanced': 'Advanced',
    'tenants.create.advancedHint':
      'Every field in here is left out of the request when it is blank, and the platform resolves it. Open this only for an operator that has to differ from the defaults — each field says what it would otherwise get.',
    'tenants.create.suspendedTitle': 'This tenant will be created suspended',
    'tenants.create.suspendedBody':
      'Nothing on this form can prove the agent id belongs to the Ichancy username, and a correct username paired with the wrong agent id registers real players under another operator. So a new tenant lands suspended and serves nobody until you activate it — which is the moment the backend actually signs in to Ichancy and finds out.',
    'tenants.create.successTitle': '{name} created',
    'tenants.create.successBody': 'It is suspended until you activate it.',
    'tenants.create.errorTitle': 'Could not create the tenant',

    // ── Edit ─────────────────────────────────────────────────────────────────────────────────
    'tenants.edit.title': 'Edit {name}',
    'tenants.edit.description':
      'Two of these settings can never change. They are shown so you can read them, not edit them.',
    'tenants.edit.submit': 'Save changes',
    'tenants.edit.successTitle': '{name} updated',
    'tenants.edit.successBody': 'The new settings apply to deposits started from now on.',
    'tenants.edit.errorTitle': 'Could not save the tenant',
    'tenants.immutable.slug':
      'Immutable: the slug is written into every log line and audit record this tenant has produced. Changing it would orphan all of them.',
    'tenants.immutable.currencyCode':
      'Immutable: every amount already recorded is denominated in it. Changing it would reinterpret that history rather than convert it.',

    // ── Helper text ──────────────────────────────────────────────────────────────────────────
    'tenants.hint.botToken':
      'Stored write-only. It is never returned again, here or anywhere else.',
    'tenants.hint.feedChatId':
      'Leaving this empty keeps the current one: the API has no way to unset a feed chat.',
    'tenants.hint.expiryRange': '{min} to {max}.',
    'tenants.hint.minorUnits': 'Minor units — 150000 means 1,500.00',
    'tenants.hint.minorPreview': '= {preview}',
    'tenants.hint.depositMode':
      'Automatic checks the player’s claim against Sham Cash or the chain and approves only on a match — anything else waits for a person, same as Manual.',
    'tenants.hint.withdrawalMode':
      'Automatic approves, debits the player and checks the payout wallet by itself — a person still sends the money. Manual waits for an admin.',
    'tenants.hint.miniAppUrl':
      'https only. What the bot’s app button opens; empty means the bot answers “coming soon”.',
    'tenants.hint.miniAppUrlClear': 'Clear the field and save to remove the stored URL.',
    'tenants.depositMode.unset': 'Left to the server (manual)',
    'tenants.withdrawalMode.unset': 'Left to the server (manual)',
    'tenants.placeholder.displayName': 'Northern branch',

    // ── What each optional field gets when it is left blank ──────────────────────────────────
    'tenants.default.slug':
      'Left blank: made from the display name — “Northern branch” becomes northern-branch, with -2 added if that one is taken. Permanent either way: it appears in every log line.',
    'tenants.default.adminChatId':
      'Left blank: your own Telegram id, since you are the platform admin creating this operator.',
    'tenants.default.feedChatId':
      'Left blank: no feed chat. This is the one optional field with no platform default, and it can be set later.',
    'tenants.default.ichancyBaseUrl': 'Left blank: the platform default Ichancy URL.',
    'tenants.default.ichancyAgentId':
      'Left blank: the platform default agent id, or tenant zero’s if the platform has none. Ichancy sign-in returns only a token pair, so an agent id cannot be looked up from the credentials — if neither exists the API refuses this create and names this field. Checked for the first time when you activate the tenant.',
    'tenants.default.currencyCode':
      'Left blank: the platform default currency. Permanent: it is the unit of every amount this tenant will ever record.',
    'tenants.default.dualApproval': 'Left blank: the platform default threshold.',
    'tenants.default.floatWatermark': 'Left blank: the platform default watermark.',
    'tenants.default.depositMode': 'Left blank: manual — a person decides every deposit.',
    'tenants.default.withdrawalMode': 'Left blank: manual — a person approves every cash-out.',
    'tenants.default.miniAppUrl': 'Left blank: no app button destination until one is set.',
    'tenants.default.depositExpiryMinutes':
      'Left blank: the platform default expiry. {min} to {max} if you set one.',

    // ── Validation ───────────────────────────────────────────────────────────────────────────
    'tenants.validation.slug':
      'Lowercase letters, digits and hyphens; 3 to 32 characters, starting with a letter and ending with a letter or digit.',
    'tenants.validation.displayName': 'Give the operator a name people will recognise.',
    'tenants.validation.displayNameLong': 'Keep it to 120 characters or fewer.',
    'tenants.validation.botToken':
      'A bot token looks like 123456789:AA… — digits, a colon, then the key.',
    'tenants.validation.chatId':
      'A Telegram chat id is a whole number, and group ids start with a minus.',
    'tenants.validation.httpsUrl': 'Must be an https URL.',
    'tenants.validation.required': 'Required.',
    'tenants.validation.agentId': 'The agent id is digits only.',
    'tenants.validation.currencyCode': 'Three letters, such as NSP.',
    'tenants.validation.minorUnits': 'Minor units: digits only, no decimal point.',
    'tenants.validation.wholeMinutes': 'Whole minutes only.',
    'tenants.validation.expiryRange': 'Between {min} and {max} minutes.',

    // ── What creating an operator actually did ───────────────────────────────────────────────
    'tenants.created.title': '{name} was created. Here is what provisioning managed.',
    'tenants.created.dismiss': 'Dismiss',
    'tenants.created.webhookOk': 'Webhook registered with Telegram.',
    'tenants.created.webhookFailed': 'Webhook not registered: {error}',
    'tenants.created.menusOk': 'Command menus pushed.',
    'tenants.created.menusFailed': 'Command menus not pushed: {error}',
    'tenants.created.activated': 'Activated: the Ichancy agent answered a real sign-in.',
    'tenants.created.notActivated': 'Not activated: {error}',
    'tenants.created.rails': {
      one: '{count} payment method provisioned.',
      other: '{count} payment methods provisioned.',
    },
    'tenants.created.railsFailed': 'Payment methods not provisioned: {error}',
    'tenants.created.placeholders':
      'Every provisioned payment method still points at a placeholder account. Replace them before a player is shown this operator — money sent to a placeholder is gone.',
    'tenants.created.playersImported': 'Players imported: {count}',
    'tenants.created.playersImportError': 'Players were not imported: {error}',
    'tenants.created.noReason': 'no reason given',

    // ── The old players: importing from Ichancy ──────────────────────────────────────────────
    'tenants.import.title': 'Old players',
    'tenants.import.body':
      'Pulls this operator’s existing Ichancy accounts in as players, so they can be handled like anyone who arrived through the bot. Safe to repeat: accounts already known are counted as existing.',
    'tenants.import.action': 'Import players from Ichancy',
    'tenants.import.notRun': 'Not run in this session.',
    'tenants.import.doneTitle': 'Import finished',
    'tenants.import.summary': '{scanned} scanned, {created} created, {existing} already known.',
    'tenants.import.errorTitle': 'Ichancy did not finish the import',
    'tenants.import.finishedAt': 'Finished',
    'tenants.import.successTitle': {
      one: '{count} player imported from Ichancy',
      other: '{count} players imported from Ichancy',
    },
    'tenants.import.failedTitle': 'Could not import players',
  },

  ar: {
    'tenants.ops.title': 'الإعداد والحالة',
    'tenants.ops.description':
      'ما يفصل هذا المشغّل عن أن يردّ على أحد: بوته، والـ webhook الذي يسلّم إليه Telegram، ووكيل Ichancy الذي يسجّل الدخول باسمه.',
    'tenants.ops.recheck': 'افحص من جديد',
    'tenants.ops.counts': 'ما يملكه هذا المشغّل',

    'tenants.checklist.title': 'قائمة خطوات الإعداد',
    'tenants.checklist.remaining': {
      zero: 'لم تبقَ أي خطوة.',
      one: 'بقيت خطوة واحدة.',
      two: 'بقيت خطوتان.',
      few: 'بقيت {count} خطوات.',
      many: 'بقيت {count} خطوة.',
      other: 'بقيت {count} خطوة.',
    },
    'tenants.checklist.allDone': 'تمّت كل خطوة تستطيع هذه اللوحة التحقق منها.',
    'tenants.checklist.stateDone': 'تمّت',
    'tenants.checklist.stateTodo': 'ما زالت مطلوبة',
    'tenants.checklist.stateUnknown': 'لا يمكن التحقق منها هنا',

    'tenants.checklist.botToken': 'التحقق من رمز البوت',
    'tenants.checklist.botTokenDone': 'ردّ Telegram على الرمز المحفوظ: البوت هو @{bot}.',
    'tenants.checklist.botTokenTodo':
      'لم يردّ Telegram على الرمز المحفوظ، أي أن هذا المشغّل بلا بوت عامل أصلاً. أنشئ بوتاً في @BotFather وضَع رمزه هنا.',

    'tenants.checklist.webhook': 'تسجيل الـ webhook',
    'tenants.checklist.webhookDone':
      'يسلّم Telegram تحديثات هذا البوت إلى هذا الخادم، فيستطيع موظفوه تسجيل الدخول.',
    'tenants.checklist.webhookTodo':
      'إنشاء المشغّل يولّد مسار webhook لكنه لا يخبر Telegram به أبداً. وحتى تتم هذه الخطوة لا يصل البوت شيء إطلاقاً.',

    'tenants.checklist.commands': 'إرسال قوائم الأوامر',
    'tenants.checklist.commandsUnknown':
      'لا يُسأل Telegram أبداً عمّا في قائمة أوامر البوت، فلا شيء هنا يستطيع أن يخبرك إن كانت هذه الخطوة قد تمّت. أرسلها مرة واحدة — تكرارها لا يكلّف شيئاً، وهي ما يُظهر /start و/queue في قائمة البوت.',
    'tenants.checklist.commandsDone': {
      zero: 'لم يُرسل أي أمر من هنا.',
      one: 'أُرسل أمر واحد من هنا.',
      two: 'أُرسل أمران من هنا.',
      few: 'أُرسلت {count} أوامر من هنا.',
      many: 'أُرسل {count} أمراً من هنا.',
      other: 'أُرسل {count} أمر من هنا.',
    },

    'tenants.checklist.admin': 'مدير يستطيع تسجيل الدخول',
    'tenants.checklist.adminUnknown':
      'الموظفون يتبعون مشغّلاً واحداً، وقائمة موظفي هذا المشغّل غير مقروءة من شاشة المنصّة — لذلك هذه الخطوة تؤكّدها بنفسك. استخدم «{action}» في أسفل هذه اللوحة، ثم سجّل الدخول باسم المستخدم وكلمة المرور اللذين ضبطتهما هناك.',

    'tenants.checklist.agent': 'التحقق من وكيل Ichancy',
    'tenants.checklist.agentDone': 'الوكيل {agent} قبِل تسجيل دخول حقيقياً.',
    'tenants.checklist.agentTodo':
      'لم يقبل Ichancy البيانات المحفوظة، فلا يمكن تسجيل أي لاعب تحت هذا المشغّل ولا إضافة أي إيداع.',

    'tenants.checklist.active': 'التفعيل',
    'tenants.checklist.activeDone': 'المشغّل يعمل ويخدم.',
    'tenants.checklist.activeTodo':
      'المشغّل الجديد يُنشأ موقوفاً ولا يردّ على أحد. «{action}» هي الخطوة الأخيرة، وعندها يسجّل الخادم الدخول إلى Ichancy فعلياً.',

    'tenants.telegram.title': 'Telegram',
    'tenants.telegram.deliveringTo': 'يسلّم إلى',
    'tenants.telegram.noWebhookUrl': 'لا يحتفظ Telegram بأي webhook لهذا البوت',
    'tenants.telegram.pending': 'تحديثات منتظرة عند Telegram',
    'tenants.telegram.pendingTitle': {
      zero: 'لا يحتفظ Telegram بأي تحديث لهذا البوت',
      one: 'يحتفظ Telegram بتحديث واحد لهذا البوت',
      two: 'يحتفظ Telegram بتحديثين لهذا البوت',
      few: 'يحتفظ Telegram بـ{count} تحديثات لهذا البوت',
      many: 'يحتفظ Telegram بـ{count} تحديثاً لهذا البوت',
      other: 'يحتفظ Telegram بـ{count} تحديث لهذا البوت',
    },
    'tenants.telegram.pendingBody':
      'يحتفظ Telegram بما عجز عن تسليمه ويعيد إرساله فور نجاح التسليم. وبقاء العدد مرتفعاً بينما الـ webhook مطابق يعني أن هذا الخادم يرفضها، لا أن Telegram بطيء.',
    'tenants.telegram.lastErrorTitle': 'آخر ما عجز Telegram عن فعله',

    'tenants.webhook.register': 'تسجيل الـ webhook',
    'tenants.webhook.remove': 'إلغاء التسجيل',
    'tenants.webhook.deliveringTitle': 'Telegram يسلّم إلى هذا الخادم',
    'tenants.webhook.deliveringBody':
      'تصل تحديثات هذا البوت إلى هذه اللوحة، فيستطيع لاعبوه بدء إيداع ويرى موظفوه البطاقات.',
    'tenants.webhook.silentTitle': '{name} لا يصله شيء من Telegram',
    'tenants.webhook.silentNoneBody':
      'لا يوجد webhook مسجّل لهذا البوت، فتُهمَل كل رسالة تُرسل إليه: لا يستطيع أي لاعب بدء إيداع ولا تصل أي بطاقة إلى مجموعة الإدارة. أما تسجيل الدخول إلى اللوحة فلا يتأثر — فهو دخول بكلمة مرور ولا يمر عبر Telegram أصلاً. تسجيل الـ webhook هو ما يبدأ التسليم.',
    'tenants.webhook.silentElsewhereBody':
      'يسلّم Telegram تحديثات هذا البوت إلى {url}، وهو ليس مسار هذا الخادم لهذا المشغّل — فلا يصل هذه اللوحة شيء ولا يمكن بدء أي إيداع. تسجيل الـ webhook يعيد توجيه Telegram إلى هنا، ويتوقف ما يستمع على ذلك العنوان عن استقبالها.',
    'tenants.webhook.whichOne':
      'التسجيل هو ما تريده في كل الأحوال تقريباً: هو ما يجعل بوت المشغّل الجديد يردّ. أما إلغاء التسجيل فيوقف التسليم دون إيقاف المشغّل — تبقى دفاتره مفتوحة وتبقى مهل إيداعاته تجري بينما يصمت بوته — وهو ما تريده فقط حين تنقل هذا البوت إلى خادم آخر. وإن كنت تريد أن يتوقف المشغّل عن العمل، فأوقفه مؤقتاً بدل ذلك.',
    'tenants.webhook.registeredTitle': '{name} يستقبل التحديثات',
    'tenants.webhook.registeredBody': 'صار Telegram يسلّم تحديثات هذا البوت إلى هذا الخادم.',
    'tenants.webhook.registerErrorTitle': 'تعذّر تسجيل الـ webhook',
    'tenants.webhook.removeConfirmTitle': 'إيقاف تسليم Telegram إلى {name}؟',
    'tenants.webhook.removeConfirmBody':
      'يبقى المشغّل كما هو تماماً — نشطاً، بدفاتر مفتوحة ومهل إيداعات تجري — لكن بوته يتوقف عن الرد، فلا يستطيع أي لاعب بدء إيداع. ويبقى بإمكان الموظفين تسجيل الدخول إلى اللوحة. وإن كان مرادك أن يتوقف المشغّل عن العمل، فأوقفه مؤقتاً بدل ذلك.',
    'tenants.webhook.removeConfirmLabel': 'إلغاء تسجيل الـ webhook',
    'tenants.webhook.removedTitle': 'توقّف التسليم إلى {name}',
    'tenants.webhook.removedBody':
      'لم يعد بوته يصل إلى هذا الخادم. سجّل الـ webhook من جديد متى أردت عودته.',
    'tenants.webhook.removeErrorTitle': 'تعذّر إلغاء تسجيل الـ webhook',

    'tenants.commands.push': 'إرسال قوائم الأوامر',
    'tenants.commands.pushedTitle': {
      zero: 'لم يُضبط أي أمر في قائمة البوت',
      one: 'ضُبط أمر واحد في قائمة البوت',
      two: 'ضُبط أمران في قائمة البوت',
      few: 'ضُبطت {count} أوامر في قائمة البوت',
      many: 'ضُبط {count} أمراً في قائمة البوت',
      other: 'ضُبط {count} أمر في قائمة البوت',
    },
    'tenants.commands.pushedBody': {
      zero: 'لم يُرسل أي أمر. النطاقات: {scopes}.',
      one: 'أُرسل أمر واحد، في هذه النطاقات: {scopes}.',
      two: 'أُرسل أمران، في هذه النطاقات: {scopes}.',
      few: 'أُرسلت {count} أوامر، في هذه النطاقات: {scopes}.',
      many: 'أُرسل {count} أمراً، في هذه النطاقات: {scopes}.',
      other: 'أُرسل {count} أمر، في هذه النطاقات: {scopes}.',
    },
    'tenants.commands.errorTitle': 'تعذّر إرسال قوائم الأوامر',

    'tenants.bot.replace': 'استبدال رمز البوت',
    'tenants.bot.title': 'استبدال رمز البوت لـ{name}',
    'tenants.bot.description':
      'يُتحقق من الرمز بنداء getMe حقيقي قبل حفظ أي شيء، فلا يصل رمز خاطئ إلى قاعدة البيانات. ويُختم عند وصوله ولا يُعاد أبداً: هذا الحقل يستبدله، ولا شيء يقرأه.',
    'tenants.bot.noWebhookTitle': 'لن يصل البوت الجديد شيء حتى تسجّل الـ webhook له',
    'tenants.bot.noWebhookBody':
      'يسمح Telegram بعنوان webhook واحد لكل بوت، والبوت الجديد لم يُخبر قط بمكان التسليم. ولحظة الحفظ يصبح المشغّل صامتاً كمشغّل جديد تماماً — لا يستطيع أي لاعب الوصول إليه — إلى أن تسجّل الـ webhook من جديد.',
    'tenants.bot.submit': 'استبدال الرمز',
    'tenants.bot.replacedTitle': 'حُفظ رمز بوت جديد لـ{name}',
    'tenants.bot.replacedBody': 'سجّل الـ webhook الآن، وإلا بقي هذا المشغّل صامتاً.',
    'tenants.bot.errorTitle': 'رفض Telegram رمز البوت هذا',

    'tenants.ichancy.title': 'Ichancy',
    'tenants.ichancy.answeredTitle': 'الوكيل ردّ',
    'tenants.ichancy.answeredBody':
      'نجح تسجيل دخول حقيقي ببيانات هذا المشغّل المحفوظة، فيمكن تسجيل اللاعبين وإضافة الإيداعات.',
    'tenants.ichancy.refusedTitle': 'لم يقبل Ichancy هذا الوكيل',
    'tenants.ichancy.refusedNoReason':
      'رفض Ichancy تسجيل الدخول دون أن يذكر سبباً. لا يمكن إضافة أي مبلغ حتى يردّ.',
    'tenants.ichancy.belowTitle': 'رصيد الوكيل تحت الحد الأدنى',
    'tenants.ichancy.belowBody':
      'تبدأ إضافات اللاعبين بالفشل حين ينفد رصيد الوكيل. اشحنه قبل الموافقة التالية.',
    'tenants.ichancy.float': 'رصيد الوكيل',
    'tenants.ichancy.floatUnread': 'لم يُقرأ',
    'tenants.ichancy.aboveWatermark': 'فوق الحد الأدنى',
    'tenants.ichancy.belowWatermark': 'تحت الحد الأدنى',
    'tenants.ichancy.checkedAt': 'آخر فحص',
    'tenants.ichancy.test': 'اختبار الاتصال',
    'tenants.ichancy.edit': 'تعديل البيانات',
    'tenants.ichancy.notShared': 'لا مشغّل آخر موجَّه إلى وكيل Ichancy هذا، فجلسته له وحده.',
    'tenants.ichancy.sharedTitle': {
      zero: 'لا مشغّل آخر يستخدم وكيل Ichancy هذا',
      one: 'وكيل Ichancy هذا مشترك مع مشغّل آخر واحد',
      two: 'وكيل Ichancy هذا مشترك مع مشغّلَين آخرين',
      few: 'وكيل Ichancy هذا مشترك مع {count} مشغّلين آخرين',
      many: 'وكيل Ichancy هذا مشترك مع {count} مشغّلاً آخر',
      other: 'وكيل Ichancy هذا مشترك مع {count} مشغّل آخر',
    },
    'tenants.ichancy.sharedBody':
      'يسمح Ichancy بتسجيل دخول واحد لكل حساب وكيل، لذلك يتشارك هؤلاء المشغّلون جلسة واحدة: تسجيل الدخول لأحدهم تسجيل لهم جميعاً، وتغيير كلمة المرور هنا يغيّرها لهم جميعاً. وتوجيه عدة مشغّلين إلى وكيل واحد أسلوب اختبار مشروع — وهذا التنبيه موجود كي لا يكون هذا الترابط مفاجأة.',

    'tenants.ichancyEdit.title': 'بيانات Ichancy لـ{name}',
    'tenants.ichancyEdit.description':
      'الحفظ يسجّل الدخول إلى Ichancy فعلياً بهذه القيم ويرفضها إن لم يردّ الوكيل. ولا يُرسل إلا ما غيّرته.',
    'tenants.ichancyEdit.passwordHint':
      'اتركه فارغاً للإبقاء على كلمة المرور المحفوظة. هي مختومة ولا تُعاد أبداً، فلا يمكن عرضها هنا — يمكن استبدالها فقط.',
    'tenants.ichancyEdit.agentIdWarning':
      'لا يمكن تغييره بعد أن يصبح للمشغّل لاعبون: إعادة توجيه الوكيل تفصلهم عن الشجرة التي تعيش فيها أرصدتهم. الخادم يرفض ذلك، وهذا هو الحقل الوحيد هنا الذي يمكن أن يُرفض بعد قبول كل ما عداه.',
    'tenants.ichancyEdit.submit': 'حفظ وتحقق',
    'tenants.ichancyEdit.successTitle': 'حُفظت بيانات Ichancy لـ{name}',
    'tenants.ichancyEdit.successBody': 'قبِل Ichancy تسجيل دخول حقيقياً بها.',
    'tenants.ichancyEdit.refusedTitle': 'رفض الخادم هذا التغيير',
    'tenants.ichancyEdit.errorTitle': 'تعذّر حفظ بيانات Ichancy',
    'tenants.ichancyEdit.unchangedTitle': 'لا شيء لحفظه',
    'tenants.ichancyEdit.unchangedBody': 'كل حقل ما زال يحمل قيمته. غيّر واحداً أو أغلق الاستمارة.',

    'tenants.title': 'المشغّلون',
    'tenants.description': 'كل مشغّل على المنصّة: بوته، ووكيله على Ichancy، وحدود المراجعة عنده.',
    'tenants.new': 'مشغّل جديد',
    'tenants.showAll': 'عرض كل المشغّلين',
    'tenants.filterByStatus': 'تصفية المشغّلين حسب الحالة',

    'tenants.crossTenant.title': 'كل المشغّلين على المنصّة',
    'tenants.crossTenant.body':
      'إنشاء مشغّل هنا يسجّل بوت تلغرام الخاص به ووكيل Ichancy التابع له. استخدم مبدّل المشغّل في الشريط العلوي لتوجيه بقية اللوحة إلى أحدهم — عندها تجيب كل الشاشات الأخرى عن المشغّل المحدَّد.',

    'tenants.empty.noneTitle': 'لا يوجد مشغّلون بعد',
    'tenants.empty.noneBody':
      'المشغّل الواحد هو: بوت Telegram واحد، ووكيل Ichancy واحد، وعملة واحدة.',
    'tenants.empty.filteredTitle': 'لا يوجد مشغّل بهذه الحالة',
    'tenants.empty.filteredBody': 'التصفية بالحالة أعلاه أخفت كل المشغّلين.',

    'tenants.list.caption': {
      zero: 'لا يوجد مشغّلون.',
      one: 'مشغّل واحد. اضغط عليه لعرض ربطه مع Ichancy وTelegram.',
      two: 'مشغّلان. اختر واحداً لعرض ربطه مع Ichancy وTelegram.',
      few: '{count} مشغّلين. اختر واحداً لعرض ربطه مع Ichancy وTelegram.',
      many: '{count} مشغّلاً. اختر واحداً لعرض ربطه مع Ichancy وTelegram.',
      other: '{count} مشغّل. اختر واحداً لعرض ربطه مع Ichancy وTelegram.',
    },
    'tenants.notCounted': 'غير محسوب',
    'tenants.noBotYet': 'لا يوجد بوت بعد',
    'tenants.minutesShort': {
      zero: 'بلا مهلة',
      one: 'دقيقة واحدة',
      two: 'دقيقتان',
      few: '{count} دقائق',
      many: '{count} دقيقة',
      other: '{count} دقيقة',
    },
    'tenants.minutes': {
      zero: 'بلا مهلة',
      one: 'دقيقة واحدة',
      two: 'دقيقتان',
      few: '{count} دقائق',
      many: '{count} دقيقة',
      other: '{count} دقيقة',
    },

    'tenants.field.tenant': 'المشغّل',
    'tenants.field.slug': 'المعرّف النصي',
    'tenants.field.id': 'معرّف المشغّل',
    'tenants.field.bot': 'البوت',
    'tenants.field.botToken': 'رمز البوت',
    'tenants.field.players': 'اللاعبون',
    'tenants.field.deposits': 'الإيداعات',
    'tenants.field.currencyCode': 'رمز العملة',
    'tenants.field.dualApproval': 'موافقة مزدوجة فوق',
    'tenants.field.floatLowWater': 'حد الرصيد الأدنى',
    'tenants.field.floatWatermark': 'الحد الأدنى لرصيد الوكيل',
    'tenants.field.depositExpiry': 'مهلة الإيداع',
    'tenants.field.depositExpiryMinutes': 'مهلة الإيداع (بالدقائق)',
    'tenants.field.adminChatId': 'معرّف محادثة الإدارة',
    'tenants.field.feedChatId': 'معرّف قناة الإشعارات',
    'tenants.field.ichancyBaseUrl': 'رابط Ichancy',
    'tenants.field.ichancyUsername': 'اسم المستخدم على Ichancy',
    'tenants.field.ichancyPassword': 'كلمة المرور على Ichancy',
    'tenants.field.ichancyAgentId': 'معرّف الوكيل على Ichancy',
    'tenants.field.webhookPath': 'مسار الـ webhook',
    'tenants.field.depositMode': 'طريقة التحقق من الإيداع',
    'tenants.field.withdrawalMode': 'طريقة السحب',
    'tenants.field.miniAppUrl': 'رابط التطبيق المصغّر',

    'tenants.detail.fallbackTitle': 'المشغّل',
    'tenants.detail.loading': 'جارٍ تحميل بيانات هذا المشغّل.',
    'tenants.detail.slug': 'المعرّف النصي {slug}',
    'tenants.editSettings': 'تعديل الإعدادات',
    'tenants.section.identity': 'التعريف',
    'tenants.section.money': 'المبالغ وقواعد المراجعة',
    'tenants.section.chats': 'محادثات Telegram والأسرار المحفوظة',
    'tenants.section.bot': 'الإيداعات والسحوبات والتطبيق المصغّر',
    'tenants.bot.depositModeExplained':
      'تلقائي: تتحقق المنصّة من طلب اللاعب مقابل شام كاش أو السلسلة ولا توافق إلا عند التطابق؛ وما لا يتطابق ينتظر شخصاً. يدوي: يقرر مدير كل إيداع.',
    'tenants.bot.modeExplained':
      'تلقائي: توافق المنصّة على الطلب وتخصم من رصيد اللاعب في الكازينو وتتحقق من محفظة الدفع بنفسها؛ ويبقى إرسال المال وتعليمه «مدفوعاً» عمل شخص. يدوي: لا يتحرك شيء حتى يوافق مدير.',
    'tenants.webhook.pathGenerated': 'تم توليد مسار الـ webhook',
    'tenants.webhook.noPath': 'لا يوجد مسار webhook',
    'tenants.secretsNote':
      'رمز مسار الـ webhook ورمز البوت وكلمة مرور Ichancy لا يعيدها الخادم أبداً، لذا لا يمكن عرضها أو نسخها هنا — يمكن استبدالها فقط.',

    'tenants.activate.action': 'تفعيل',
    'tenants.activate.confirmTitle': 'تفعيل {name}؟',
    'tenants.activate.confirmBody':
      'التفعيل ليس مجرد تبديل حالة. الخادم يسجّل الدخول إلى Ichancy باسم المستخدم وكلمة المرور ومعرّف الوكيل المحفوظة لهذا المشغّل، ويرفض التفعيل إذا فشل هذا الدخول — وهنا بالضبط يُكشف معرّف الوكيل الخاطئ، قبل أن يُسجَّل تحته لاعب واحد.',
    'tenants.activate.confirmLabel': 'تفعيل المشغّل',
    'tenants.activate.refusedTitle': 'رفض Ichancy تسجيل الدخول',
    'tenants.activate.successTitle': '{name} أصبح نشطاً',
    'tenants.activate.successBody': 'قبِل Ichancy دخول الوكيل. البوت يردّ من جديد.',
    'tenants.activate.errorTitle': 'فشل التفعيل',

    'tenants.suspend.action': 'إيقاف مؤقت',
    'tenants.suspend.confirmTitle': 'إيقاف {name} مؤقتاً؟',
    'tenants.suspend.confirmBody':
      'يتوقف البوت عن الرد ولا يمكن بدء أي إيداع جديد. الإضافات الجارية تكتمل، ولا يُمسّ شيء مسجّل من قبل، ويمكنك إعادة التفعيل في أي وقت.',
    'tenants.suspend.confirmLabel': 'إيقاف المشغّل',
    'tenants.suspend.successTitle': 'تم إيقاف {name} مؤقتاً',
    'tenants.suspend.successBody': 'توقّف البوت عن الرد. أعد تفعيله متى شئت.',
    'tenants.suspend.errorTitle': 'تعذّر إيقاف المشغّل',

    'tenants.addMe.action': 'أضِفني مديراً هنا',
    'tenants.addMe.title': 'أضِف نفسك إلى {name}',
    'tenants.addMe.description':
      'الموظفون يخصّون مشغّلاً واحداً، فلك حساب مدير مستقل داخل كل مشغّل تديره. هذا ينشئ حسابك داخل {name}.',
    'tenants.addMe.target': 'سيُكتب سجل المدير هذا داخل',
    'tenants.addMe.usernameLabel': 'اسم المستخدم',
    'tenants.addMe.usernameHint':
      'ما ستكتبه لتسجيل الدخول إلى {name}. اسم أو بريد إلكتروني، لا يتكرر داخل ذلك المشغّل — ويمكن أن يكون نفسه الذي تستخدمه في مكان آخر.',
    'tenants.addMe.passwordLabel': 'كلمة المرور',
    'tenants.addMe.passwordHint':
      'كلمة مرور جديدة، 8 أحرف على الأقل. لا يمكن نسخها من جلستك الحالية، لأن كلمة المرور لا تُقرأ مرة أخرى أبداً.',
    'tenants.addMe.usernameInvalid':
      'اسم المستخدم من 3 إلى 64 حرفاً: حروف وأرقام والرموز . _ @ + - فقط.',
    'tenants.addMe.passwordShort': 'كلمة المرور 8 أحرف على الأقل.',
    'tenants.addMe.roleHint':
      'دور مدير المنصّة غير معروض هنا: فهو يدير المنصّة ولا يرى بيانات أي مشغّل، لذا لن يفيدك سجل بهذا الدور داخل {name}.',
    'tenants.addMe.displayNameRequired': 'أعطِ نفسك اسماً يعرفه بقية الموظفين.',
    'tenants.addMe.displayNameLong': 'أبقِه دون 120 خانة.',

    'tenants.addMe.selectFirstTitle': 'اللوحة موجّهة إلى مشغّل آخر',
    'tenants.addMe.selectFirstBody':
      'يُكتب سجل المدير داخل المشغّل المحدَّد في اللوحة — فالخادم لا يقبل تحديد مشغّل مع كل طلب، بل الذي في الترويسة وحده. اختيار {name} هو ما يجعل هذا السجل يقع داخله، وهو أيضاً ما ستعرضه كل الشاشات الأخرى حتى تعود.',
    'tenants.addMe.selectAction': 'اختر {name} ثم أضِفني',
    'tenants.addMe.targetedTitle': 'اللوحة موجّهة إلى {name}',
    'tenants.addMe.targetedBody':
      'وهنا سيقع سجل المدير. تبقى اللوحة موجّهة إلى {name} بعد ذلك — والشريط أسفل الشريط العلوي يذكر ذلك ما دامت كذلك.',
    'tenants.addMe.cannotTargetTitle': 'لا تستطيع هذه اللوحة توجيه الكتابة إلى مشغّل بعينه',
    'tenants.addMe.cannotTargetBody':
      'ترويسة X-Tenant-Id معطّلة في هذه النسخة، لذا تجيب كل طلبات الإدارة عن المشغّل الافتراضي. سجل المدير المنشأ الآن سيقع هناك لا داخل {name}، وهذا بالضبط الخطأ الذي يجب ألّا ترتكبه هذه الشاشة.',
    'tenants.addMe.submit': 'أضِفني مديراً',
    'tenants.addMe.errorTitle': 'تعذّرت إضافتك مديراً',

    'tenants.addMe.createdTitle': 'أصبحت {role} في {name}',
    'tenants.addMe.existsTitle': 'أنت مدير هناك أصلاً',
    'tenants.addMe.existsBody':
      'اسم المستخدم هذا مستخدم داخل {name} من قبل. لم يتغيّر شيء — وإن كان الحساب الموجود لك، فسجّل الدخول به.',
    'tenants.addMe.nextStepTitle': 'الخطوة التالية: سجّل الدخول إلى {name}',
    'tenants.addMe.nextStepBody':
      'سجّل الخروج، ثم ادخل باسم المستخدم وكلمة المرور اللذين ضبطتهما للتو. هما يفتحان {name} ولا شيء غيره.',

    'tenants.role.SUPER_ADMIN':
      'أعلى صلاحية داخل مشغّل واحد. كل ما فيه، بما في ذلك الموظفون وحدود الموافقة.',
    'tenants.role.FINANCE_ADMIN': 'يقرّر في الإيداعات، ويدير قنوات الدفع، ويعالج فروقات التسوية.',
    'tenants.role.REVIEWER':
      'يراجع الإيداعات ويقرّر فيها. لا يستطيع تغيير قنوات الدفع ولا الموظفين.',
    'tenants.role.SUPPORT':
      'يطّلع على اللاعبين والإيداعات وقنوات الدفع للإجابة على الأسئلة. لا يقرّر شيئاً.',
    'tenants.role.VIEWER': 'اطّلاع فقط على قائمة الإيداعات والتسوية.',

    'tenants.create.description':
      'مشغّل واحد: بوت Telegram واحد، ووكيل Ichancy واحد، وعملة واحدة. أربعة حقول منك، والباقي تملؤه المنصّة.',
    'tenants.create.submit': 'إنشاء المشغّل',
    'tenants.create.required': 'ما لا يستطيع أحد سواك تقديمه',
    'tenants.create.requiredHint':
      'اسم، ورمز البوت من BotFather، وبيانات دخول Ichancy التي يسجّل بها هذا المشغّل. لا يلزم غير ذلك لإنشائه.',
    'tenants.create.advanced': 'إعدادات متقدمة',
    'tenants.create.advancedHint':
      'كل حقل هنا يُحذف من الطلب إن تُرك فارغاً، وتتولى المنصّة تحديد قيمته. لا تفتح هذا القسم إلا لمشغّل يجب أن يختلف عن القيم الافتراضية — وكل حقل يذكر ما سيحصل عليه لو تُرك.',
    'tenants.create.suspendedTitle': 'سيُنشأ هذا المشغّل موقوفاً',
    'tenants.create.suspendedBody':
      'لا شيء في هذه الاستمارة يثبت أن معرّف الوكيل يخص اسم المستخدم على Ichancy، واسم مستخدم صحيح مع معرّف وكيل خاطئ يسجّل لاعبين حقيقيين تحت مشغّل آخر. لذلك يُنشأ المشغّل الجديد موقوفاً ولا يخدم أحداً حتى تفعّله — وعندها فقط يسجّل الخادم الدخول فعلياً إلى Ichancy ويتبيّن الأمر.',
    'tenants.create.successTitle': 'تم إنشاء {name}',
    'tenants.create.successBody': 'يبقى موقوفاً حتى تفعّله.',
    'tenants.create.errorTitle': 'تعذّر إنشاء المشغّل',

    'tenants.edit.title': 'تعديل {name}',
    'tenants.edit.description':
      'إعدادان هنا لا يمكن تغييرهما أبداً. يظهران لتقرأهما، لا لتعدّلهما.',
    'tenants.edit.submit': 'حفظ التعديلات',
    'tenants.edit.successTitle': 'تم تحديث {name}',
    'tenants.edit.successBody': 'تسري الإعدادات الجديدة على الإيداعات التي تبدأ من الآن.',
    'tenants.edit.errorTitle': 'تعذّر حفظ المشغّل',
    'tenants.immutable.slug':
      'غير قابل للتغيير: المعرّف النصي مكتوب في كل سطر سجل وكل قيد تدقيق أنتجه هذا المشغّل. تغييره يقطع صلتها به كلها.',
    'tenants.immutable.currencyCode':
      'غير قابل للتغيير: كل مبلغ مسجّل مقوّم بهذه العملة. تغييره يعيد تفسير ما مضى بدل أن يحوّله.',

    'tenants.hint.botToken': 'يُحفظ للكتابة فقط. لا يُعاد إظهاره مرة أخرى، لا هنا ولا في أي مكان.',
    'tenants.hint.feedChatId':
      'ترك الحقل فارغاً يبقي القناة الحالية: الخادم لا يوفّر طريقة لإزالتها.',
    'tenants.hint.expiryRange': 'من {min} إلى {max}.',
    'tenants.hint.minorUnits': 'وحدات صغرى — 150000 تعني 1,500.00',
    'tenants.hint.minorPreview': '= {preview}',
    'tenants.hint.depositMode':
      'تلقائي: تتحقق المنصّة من طلب اللاعب مقابل شام كاش أو السلسلة ولا توافق إلا عند تطابق كامل — أي شيء آخر ينتظر شخصاً، تماماً كما في الوضع اليدوي.',
    'tenants.hint.withdrawalMode':
      'تلقائي: توافق المنصّة وتخصم من اللاعب وتتحقق من محفظة الدفع بنفسها — ويبقى إرسال المال عمل شخص. يدوي: ينتظر موافقة مدير.',
    'tenants.hint.miniAppUrl':
      'https فقط. ما يفتحه زر التطبيق في البوت؛ إن تُرك فارغاً يردّ البوت بـ«قريباً».',
    'tenants.hint.miniAppUrlClear': 'امسح الحقل واحفظ لإزالة الرابط المحفوظ.',
    'tenants.depositMode.unset': 'يقرّره الخادم (يدوي)',
    'tenants.withdrawalMode.unset': 'يقرّره الخادم (يدوي)',
    'tenants.placeholder.displayName': 'الفرع الشمالي',

    'tenants.default.slug':
      'إن تُرك فارغاً: يُشتق من الاسم الظاهر — «الفرع الشمالي» يصبح northern-branch، ويُضاف ‎-2‎ إن كان مأخوذاً. وهو دائم في الحالتين: يظهر في كل سطر سجل.',
    'tenants.default.adminChatId':
      'إن تُرك فارغاً: معرّف حسابك على Telegram، فأنت مدير المنصّة الذي ينشئ هذا المشغّل.',
    'tenants.default.feedChatId':
      'إن تُرك فارغاً: لا توجد قناة إشعارات. هذا هو الحقل الاختياري الوحيد بلا قيمة افتراضية على المنصّة، ويمكن ضبطه لاحقاً.',
    'tenants.default.ichancyBaseUrl': 'إن تُرك فارغاً: رابط Ichancy الافتراضي للمنصّة.',
    'tenants.default.ichancyAgentId':
      'إن تُرك فارغاً: معرّف الوكيل الافتراضي للمنصّة، أو معرّف المشغّل صفر إن لم يكن للمنصّة واحد. تسجيل الدخول إلى Ichancy لا يعيد سوى زوج رموز، فلا يمكن استنتاج معرّف الوكيل من بيانات الدخول — وإن لم يوجد أي منهما رفض الخادم الإنشاء وسمّى هذا الحقل. ويُتحقق منه لأول مرة عند تفعيل المشغّل.',
    'tenants.default.currencyCode':
      'إن تُرك فارغاً: عملة المنصّة الافتراضية. وهي دائمة: وحدة كل مبلغ سيسجّله هذا المشغّل.',
    'tenants.default.dualApproval': 'إن تُرك فارغاً: الحد الافتراضي على المنصّة.',
    'tenants.default.floatWatermark': 'إن تُرك فارغاً: الحد الأدنى الافتراضي على المنصّة.',
    'tenants.default.depositMode': 'إن تُرك فارغاً: يدوي — يقرر شخص كل إيداع.',
    'tenants.default.withdrawalMode': 'إن تُرك فارغاً: يدوي — يوافق شخص على كل سحب.',
    'tenants.default.miniAppUrl': 'إن تُرك فارغاً: لا وجهة لزر التطبيق حتى يُضبط رابط.',
    'tenants.default.depositExpiryMinutes':
      'إن تُرك فارغاً: المهلة الافتراضية على المنصّة. ومن {min} إلى {max} إن ضبطتها بنفسك.',

    'tenants.validation.slug':
      'حروف إنجليزية صغيرة وأرقام وشرطات؛ من 3 إلى 32 خانة، تبدأ بحرف وتنتهي بحرف أو رقم.',
    'tenants.validation.displayName': 'أعطِ المشغّل اسماً يعرفه الناس.',
    'tenants.validation.displayNameLong': 'أبقِه في حدود 120 خانة أو أقل.',
    'tenants.validation.botToken': 'رمز البوت يشبه 123456789:AA… — أرقام، ثم نقطتان، ثم المفتاح.',
    'tenants.validation.chatId':
      'معرّف محادثة Telegram رقم صحيح، ومعرّفات المجموعات تبدأ بإشارة ناقص.',
    'tenants.validation.httpsUrl': 'يجب أن يكون رابط https.',
    'tenants.validation.required': 'مطلوب.',
    'tenants.validation.agentId': 'معرّف الوكيل أرقام فقط.',
    'tenants.validation.currencyCode': 'ثلاثة حروف، مثل NSP.',
    'tenants.validation.minorUnits': 'وحدات صغرى: أرقام فقط، بلا فاصلة عشرية.',
    'tenants.validation.wholeMinutes': 'دقائق صحيحة فقط.',
    'tenants.validation.expiryRange': 'بين {min} و{max} دقيقة.',

    'tenants.created.title': 'تم إنشاء {name}. هذا ما أنجزه الإعداد التلقائي.',
    'tenants.created.dismiss': 'إغلاق',
    'tenants.created.webhookOk': 'تم تسجيل الـ webhook لدى Telegram.',
    'tenants.created.webhookFailed': 'لم يُسجَّل الـ webhook: {error}',
    'tenants.created.menusOk': 'تم إرسال قوائم الأوامر.',
    'tenants.created.menusFailed': 'لم تُرسَل قوائم الأوامر: {error}',
    'tenants.created.activated': 'تم التفعيل: وكيل Ichancy قبِل تسجيل دخول حقيقياً.',
    'tenants.created.notActivated': 'لم يُفعَّل: {error}',
    'tenants.created.rails': {
      zero: 'لم تُجهَّز أي طريقة دفع.',
      one: 'جُهِّزت طريقة دفع واحدة.',
      two: 'جُهِّزت طريقتا دفع.',
      few: 'جُهِّزت {count} طرق دفع.',
      many: 'جُهِّزت {count} طريقة دفع.',
      other: 'جُهِّزت {count} طريقة دفع.',
    },
    'tenants.created.railsFailed': 'لم تُجهَّز طرق الدفع: {error}',
    'tenants.created.placeholders':
      'كل طريقة دفع جُهِّزت ما زالت تشير إلى حساب مؤقت. استبدلها قبل أن يُعرض هذا المشغّل على أي لاعب — المال المرسل إلى حساب مؤقت يضيع.',
    'tenants.created.playersImported': 'اللاعبون المستوردون: {count}',
    'tenants.created.playersImportError': 'لم يُستورَد اللاعبون: {error}',
    'tenants.created.noReason': 'بلا سبب مذكور',

    'tenants.import.title': 'اللاعبون القدامى',
    'tenants.import.body':
      'يسحب حسابات هذا المشغّل الموجودة على Ichancy كلاعبين، ليُتعامل معهم كأي لاعب وصل عبر البوت. آمن للتكرار: الحسابات المعروفة تُحسب موجودة مسبقاً.',
    'tenants.import.action': 'استيراد اللاعبين من Ichancy',
    'tenants.import.notRun': 'لم يُشغَّل في هذه الجلسة.',
    'tenants.import.doneTitle': 'انتهى الاستيراد',
    'tenants.import.summary': '{scanned} فُحِصت، {created} أُنشئت، {existing} معروفة مسبقاً.',
    'tenants.import.errorTitle': 'لم يُكمل Ichancy الاستيراد',
    'tenants.import.finishedAt': 'انتهى',
    'tenants.import.successTitle': {
      zero: 'لم يُستورَد أي لاعب من Ichancy',
      one: 'استُورِد لاعب واحد من Ichancy',
      two: 'استُورِد لاعبان من Ichancy',
      few: 'استُورِد {count} لاعبين من Ichancy',
      many: 'استُورِد {count} لاعباً من Ichancy',
      other: 'استُورِد {count} لاعب من Ichancy',
    },
    'tenants.import.failedTitle': 'تعذّر استيراد اللاعبين',
  },
});
