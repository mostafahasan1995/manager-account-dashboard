import { useCallback } from 'react';

import { defineMessages } from '@/lib/i18n/messages';
import { useT } from '@/lib/i18n/use-translation';
import { humanizeEnum } from '@/lib/utils';

/**
 * The player directory's strings.
 *
 * Ichancy stays in English everywhere: it is the name of the betting platform the cashiers talk
 * about by name all day, and an Arabic rendering of it would be a word nobody says out loud.
 *
 * The Arabic register is the one used at the desk — "لا يمكن إضافة الرصيد" rather than a literary
 * paraphrase — because these lines are read aloud to a player waiting on the phone.
 */
export const playerMessages = defineMessages({
  en: {
    'players.description':
      'Find an account by name, @username, Telegram id or phone. A player with no Ichancy account cannot be credited, however far their deposit gets.',
    'players.empty.title': 'No players match these filters',
    'players.empty.description':
      'Search spans name, username, Telegram id and phone — try a shorter fragment, or clear the status and Ichancy filters.',

    'players.table.caption': 'Players matching the current filters',
    'players.table.action': 'Action',

    'players.field.playerId': 'Player id',
    'players.field.firstName': 'First name',
    'players.field.lastName': 'Last name',
    'players.field.phone': 'Phone',
    'players.field.language': 'Language',
    'players.field.lastSeen': 'Last seen',
    'players.field.balance': 'Balance',
    'players.balance.loading': 'Reading…',
    /*
     * A WORD, never a figure. A balance that failed to read and a balance of zero look identical as
     * "0" in a table cell, and this column sits beside buttons that move real money — one reading
     * says the account is empty, the other says nothing is known.
     */
    'players.balance.unknown': 'Unknown',
    'players.balance.notLinked': 'No account',
    'players.balance.load': 'Load balances',
    'players.balance.retryFor': 'Retry the balance for {name}',
    'players.field.linked': 'Linked',
    'players.field.ichancyPlayerId': 'Ichancy player id',
    'players.field.ichancyLogin': 'Ichancy login',
    'players.field.registered': 'Registered',
    'players.field.deposit': 'Deposit',

    'players.ichancy.linked': 'Linked',
    'players.ichancy.notLinked': 'Not linked',
    'players.ichancy.playerId': 'id {id}',
    'players.ichancy.login': 'Login',
    'players.ichancy.agent': 'Agent',
    'players.cannotBeCredited': 'Cannot be credited',

    'players.filters.search': 'Search players',
    'players.filters.searchPlaceholder': 'Name, @username, Telegram id or phone',
    'players.filters.clearSearch': 'Clear search',
    'players.filters.anyStatus': 'Any status',
    'players.filters.linked': 'Ichancy linked',
    'players.filters.waitingForIchancy': 'Waiting for Ichancy',

    'players.backToList': 'Back to players',
    'players.identity.title': 'Identity',
    'players.identity.ichancyAccount': 'Ichancy account',

    'players.link.action': 'Create Ichancy account',
    'players.link.forPlayer': 'Create Ichancy account for {name}',
    // Row actions name the player, because a table of identical buttons is unusable with a
    // screen reader and ambiguous with a mouse.
    'players.credit.forPlayer': 'Deposit to {name}',
    'players.debit.forPlayer': 'Withdraw from {name}',
    'players.link.confirmTitle': 'Create an Ichancy account?',
    'players.link.confirmDescription':
      "{name} gets a betting account on the tenant's Ichancy agent, which is what lets their approved deposits be credited.",
    'players.link.confirmLabel': 'Create account',
    'players.link.notWaitingTitle': 'This player is not waiting for an account',
    'players.link.notWaitingBody':
      'Their status is not “{status}”, so somebody either closed the account or the link already failed for a reason worth checking first.',
    'players.link.idempotentNote':
      'Safe to repeat: if the account already exists this changes nothing and says so.',
    'players.link.created': 'Ichancy account created',
    'players.link.createdDescription': '{name} can be credited now. Login {login}, agent {agent}.',
    'players.link.alreadyLinked': 'Already linked',
    'players.link.alreadyLinkedDescription':
      'Nothing was created — {name} already has login {login} on agent {agent}.',
    'players.link.nothingCreated': ' — this player already had an account, so nothing was created.',
    'players.link.failed': 'Could not create the Ichancy account',

    'players.deposits.title': 'Recent deposits',
    'players.deposits.hint': 'Newest first. Open one to review it in the queue.',
    'players.deposits.showing': {
      one: 'Showing the most recent deposit.',
      other: 'Showing the {count} most recent deposits.',
    },
    'players.deposits.emptyTitle': 'No deposits yet',
    'players.deposits.emptyDescription': 'This player has never submitted one.',
    'players.deposits.caption': "The player's most recent deposits",

    // ── Manual debit ─────────────────────────────────────────────────────────────────────────
    'players.debit.action': 'Debit player',
    'players.debit.title': 'Debit {name}',
    'players.debit.description':
      "Takes money OUT of this player's Ichancy account and back into the agent float. Nobody asked for this and nobody else approves it, so read the amount twice.",
    'players.debit.amountLabel': 'Amount to take out ({currency})',
    'players.debit.amountPlaceholder': '0.00',
    'players.debit.amountRequired': 'Enter the amount to take out.',
    'players.debit.amountFormat': 'Digits and at most two decimals — 1500.00, not 1,500 or 1.5e3.',
    'players.debit.amountTooSmall': 'The amount has to be more than zero.',
    'players.debit.reasonLabel': 'Reason',
    'players.debit.reasonPlaceholder': 'Why the money is coming back out.',
    'players.debit.reasonRequired':
      'Say why. Whoever answers this player’s complaint reads it months from now.',
    'players.debit.reasonTooLong': 'Keep it to {max} characters; this is {length}.',
    'players.debit.reasonCounter': '{length} of {max}',
    'players.debit.review': 'Review this debit',
    'players.debit.confirmTitle': 'Take this money out of {name}’s casino account?',
    'players.debit.confirmBody':
      'On confirm, the chips leave their Ichancy account and the amount goes back into the agent float. It hands them no cash: until a separate settlement pays them, we owe them this money.',
    'players.debit.takingOut': 'Taking out',
    'players.debit.fromPlayer': 'from {name}',
    'players.debit.noUndoTitle': 'The console cannot undo this',
    'players.debit.noUndoBody':
      'A debit is a real movement on a live account. Putting it back means crediting them again by hand, and the player sees both.',
    'players.debit.back': 'Back',
    'players.debit.stop': 'Stop here',
    'players.debit.confirmLabel': 'Debit {amount}',
    'players.debit.sending': 'Sending it to Ichancy. Do not close this — it cannot be repeated.',
    'players.debit.notLinkedTitle': 'This player has no Ichancy account',
    'players.debit.notLinkedBody':
      'There is no casino balance to take anything out of. Create the account first, or check you are on the right player.',
    'players.debit.failedTitle': 'The debit did not go through',
    'players.debit.failedHint': 'Nothing was taken. Fix what the message says and send it again.',
    'players.debit.maybeLandedTitle': 'This may already have gone through',
    'players.debit.maybeLandedBody':
      'The request failed on the way back, which says nothing about whether it failed on the way in. Read the balance in Ichancy before anybody sends this again — a repeat takes the money twice.',
    'players.debit.doneTitle': 'Took {amount} out of this account',
    'players.debit.doneBody':
      '{name} held {before} and now holds {after}. We owe them {amount} until a settlement pays it.',
    'players.debit.refusedTitle': 'Ichancy refused this debit',
    'players.debit.refusedBody':
      'Nothing moved — {name} still holds {after}. The usual reason is that the balance is no longer there.',
    'players.debit.unsureTitle': 'Nobody knows yet whether this debit landed',
    'players.debit.unsureBody':
      'Ichancy did not answer, and re-reading the balance did not settle it either. It is recorded as “{status}” for a human to check against Ichancy. Do not send it again from here — a repeat takes the money twice.',
    'players.debit.field.debitId': 'Debit id',
    'players.debit.field.balanceBefore': 'Balance before',
    'players.debit.field.balanceAfter': 'Balance after',
    'players.debit.field.verifiedBy': 'Confirmed by',
    'players.debit.verifiedBy.unconfirmed': 'Not confirmed',
    'players.debit.verifiedBy.API_OK': 'Ichancy confirmed',
    'players.debit.verifiedBy.BALANCE_DELTA': 'Proved by balance re-read',
    'players.debit.verifiedBy.MANUAL': 'Confirmed by a human',
    'players.debit.status.DEBITED': 'Debited',
    'players.debit.status.REJECTED': 'Refused by Ichancy',
    'players.debit.status.NEEDS_RECONCILIATION': 'Needs reconciliation',

    'players.credit.action': 'Credit player',
    'players.credit.title': 'Credit {name}',
    'players.credit.description':
      'Give this player points, recorded as a manual deposit. They are credited by Ichancy shortly after — a large one goes to a second approver first.',
    'players.credit.amountLabel': 'Amount to give ({currency})',
    'players.credit.amountPlaceholder': '0.00',
    'players.credit.amountRequired': 'Enter the amount to give.',
    'players.credit.amountFormat':
      'Digits and at most two decimals — 25000.00, not 25,000 or 2.5e4.',
    'players.credit.amountTooSmall': 'The amount has to be more than zero.',
    'players.credit.reasonLabel': 'Reason',
    'players.credit.reasonPlaceholder': 'Why the player is being credited.',
    'players.credit.reasonRequired':
      'Give a reason. Whoever reconciles the office cash reads it against this credit later.',
    'players.credit.reasonTooLong': 'Keep it to {max} characters; this is {length}.',
    'players.credit.reasonCounter': '{length} of {max}',
    'players.credit.review': 'Review this credit',
    'players.credit.confirmTitle': 'Give this to {name}?',
    'players.credit.confirmBody':
      'Read it back before it is recorded. The player is credited by Ichancy a moment later.',
    'players.credit.giving': 'Giving',
    'players.credit.toPlayer': 'to {name}',
    'players.credit.back': 'Back',
    'players.credit.stop': 'Stop here',
    'players.credit.confirmLabel': 'Credit {amount}',
    'players.credit.sending': 'Recording the credit…',
    'players.credit.queuedTitle': 'Queued {amount} for this player',
    'players.credit.queuedBody': 'Ichancy credits {name} with {amount} in a moment.',
    'players.credit.secondApprovalTitle': 'Sent for a second approval',
    'players.credit.secondApprovalBody':
      'Crediting {name} with {amount} is large enough to need another admin. It is waiting in the deposit queue.',
    'players.credit.failedTitle': 'The credit did not go through',
    'players.credit.failedHint': 'Nothing was recorded. Fix what the message says and try again.',
    'players.credit.maybeQueuedTitle': 'This may already have been queued',
    'players.credit.maybeQueuedBody':
      'The server did not answer cleanly, so a credit may have been recorded. Check the deposit queue before recording it again.',

    // ── The segmented view above the filters ─────────────────────────────────────────────────
    'players.segment.label': 'Show',
    'players.segment.all': 'All',
    'players.segment.telegram': 'Telegram',
    // "Old players": the owner's own name for the accounts that predate the bot.
    'players.segment.imported': 'Old players',
    'players.segment.blocked': 'Blocked',

    // ── Registering a player from the console ────────────────────────────────────────────────
    'players.register.action': 'Register player',
    'players.register.title': 'Register a player',
    'players.register.description':
      'Creates the player here, without them pressing Start. Every field is optional, but give at least one thing to find them by later.',
    'players.register.field.telegramUserId': 'Telegram ID',
    'players.register.hint.telegramUserId':
      'The numeric id, digits only — not the @username. Leave it empty and attach one later.',
    'players.register.hint.phone': 'With the country code, as the player would write it.',
    'players.register.createIchancy': 'Create the Ichancy account now',
    'players.register.createIchancyHint':
      'Calls Ichancy after the player is saved. If that call fails the player still exists, and the account can be created from their row later.',
    'players.register.submit': 'Register',
    'players.register.validation.telegramUserId': 'Digits only — the numeric Telegram id.',
    'players.register.validation.tooLong': 'Keep it to {max} characters.',
    'players.register.validation.nothing':
      'Give at least one of a Telegram id, a name or a phone number, or nobody will ever find this player again.',
    'players.register.successTitle': 'Registered {name}',
    'players.register.ichancy.created': 'Ichancy account created: login {login} on agent {agent}.',
    'players.register.ichancy.existing': 'Ichancy already had this player: login {login}.',
    'players.register.ichancy.notRequested':
      'No Ichancy account was asked for. Create one from the row when the player needs it.',
    'players.register.ichancy.failedTitle': 'Registered {name}, but the Ichancy account failed',
    'players.register.ichancy.failedBody':
      'The player exists without an account. Ichancy said: {error}. Create the account from their row once Ichancy answers again.',
    'players.register.failedTitle': 'Could not register the player',
    'players.register.open': 'Open {name}',

    // ── Importing the agent's existing players ───────────────────────────────────────────────
    'players.import.action': 'Import from Ichancy',
    'players.import.hint': 'Safe to repeat: rows already known are counted, not duplicated.',
    'players.import.doneTitle': 'Import finished',
    'players.import.summary': 'Scanned {scanned} · created {created} · already known {existing}.',
    'players.import.stoppedTitle': 'Import stopped early',
    'players.import.stoppedBody':
      'Ichancy said: {error}. The rows written before it stopped are kept; run it again once Ichancy answers.',
    'players.import.failedTitle': 'Could not import players',

    // ── Blocking and unblocking ──────────────────────────────────────────────────────────────
    'players.block.action': 'Block player',
    'players.block.forPlayer': 'Block {name}',
    'players.block.title': 'Block {name}',
    'players.block.description':
      "A blocked player can do nothing in this operator's bot — no deposit, no withdrawal, no menu. Their Ichancy account and balance are untouched.",
    'players.block.reasonLabel': 'Reason',
    'players.block.reasonPlaceholder': 'Why this player is being locked out.',
    'players.block.reasonRequired':
      'Say why. It is shown to whoever unblocks them, and to nobody else.',
    'players.block.reasonTooLong': 'Keep it to {max} characters; this is {length}.',
    'players.block.reasonCounter': '{length} of {max}',
    'players.block.review': 'Review this block',
    'players.block.confirmTitle': 'Block {name} from the bot?',
    'players.block.confirmBody':
      'The bot stops answering them the moment this is confirmed. Unblocking is one click, but they will have seen the refusal.',
    'players.block.back': 'Back',
    'players.block.confirmLabel': 'Block {name}',
    'players.block.sending': 'Blocking…',
    'players.block.doneTitle': 'Blocked {name}',
    'players.block.doneBody': 'The bot refuses them from now on.',
    'players.block.failedTitle': 'Could not block the player',
    'players.block.failedHint': 'Nothing changed. Fix what the message says and try again.',

    'players.unblock.action': 'Unblock player',
    'players.unblock.forPlayer': 'Unblock {name}',
    'players.unblock.confirmTitle': 'Unblock {name}?',
    'players.unblock.confirmDescription':
      'They can use the bot again at once — as an active player when they have an Ichancy account, otherwise waiting for one.',
    'players.unblock.confirmLabel': 'Unblock',
    'players.unblock.doneTitle': 'Unblocked {name}',
    'players.unblock.doneBody': 'Their status is now “{status}”.',
    'players.unblock.failedTitle': 'Could not unblock the player',

    'players.blocked.title': 'Blocked from the bot',
    'players.blocked.body': 'The bot refuses every message and button from this player.',
    'players.blocked.reason': 'Reason',
    'players.blocked.when': 'Blocked',
    'players.blocked.by': 'By admin',
    'players.blocked.noReason': 'No reason was recorded.',

    // ── Attaching a Telegram account to a row that has none ──────────────────────────────────
    'players.attach.action': 'Attach Telegram',
    'players.attach.forPlayer': 'Attach Telegram to {name}',
    'players.attach.title': 'Attach a Telegram account to {name}',
    'players.attach.description':
      'This row has no Telegram id — it was imported from Ichancy or registered here. Type the numeric id of the account that belongs to this player, and the bot will know them from then on.',
    'players.attach.field': 'Telegram ID',
    'players.attach.hint': 'Digits only. Not the @username.',
    'players.attach.validation': 'Enter the numeric Telegram id — digits only.',
    'players.attach.submit': 'Attach',
    'players.attach.doneTitle': 'Attached Telegram {id}',
    'players.attach.doneBody': 'The bot recognises {name} now.',
    'players.attach.failedTitle': 'Could not attach the Telegram account',

    'players.field.source': 'Source',
    'players.source.importedOn': 'Imported from Ichancy — registered there on {date}',
    'players.telegram.none': 'No Telegram account',
  },

  ar: {
    'players.description':
      'ابحث عن حساب بالاسم أو @username أو معرّف تلغرام أو رقم الهاتف. اللاعب الذي لا يملك حساب Ichancy لا يمكن إضافة الرصيد له، مهما تقدّم إيداعه.',
    'players.empty.title': 'لا يوجد لاعبون يطابقون هذه التصفية',
    'players.empty.description':
      'البحث يشمل الاسم واسم المستخدم ومعرّف تلغرام ورقم الهاتف — جرّب جزءاً أقصر، أو امسح تصفية الحالة والربط مع Ichancy.',

    'players.table.caption': 'اللاعبون المطابقون للتصفية الحالية',
    'players.table.action': 'الإجراء',

    'players.field.playerId': 'معرّف اللاعب',
    'players.field.firstName': 'الاسم الأول',
    'players.field.lastName': 'اسم العائلة',
    'players.field.phone': 'رقم الهاتف',
    'players.field.language': 'اللغة',
    'players.field.lastSeen': 'آخر ظهور',
    'players.field.balance': 'الرصيد',
    'players.balance.loading': '...جاري القراءة',
    // "غير معروف" — not "صفر", for the reason in the English entry.
    'players.balance.unknown': 'غير معروف',
    'players.balance.notLinked': 'لا يوجد حساب',
    'players.balance.load': 'عرض الأرصدة',
    'players.balance.retryFor': 'إعادة قراءة رصيد {name}',
    'players.field.linked': 'الربط',
    'players.field.ichancyPlayerId': 'معرّف اللاعب في Ichancy',
    'players.field.ichancyLogin': 'اسم الدخول في Ichancy',
    'players.field.registered': 'تاريخ التسجيل',
    'players.field.deposit': 'الإيداع',

    'players.ichancy.linked': 'مرتبط',
    'players.ichancy.notLinked': 'غير مرتبط',
    'players.ichancy.playerId': 'المعرّف {id}',
    'players.ichancy.login': 'اسم الدخول',
    'players.ichancy.agent': 'الوكيل',
    'players.cannotBeCredited': 'لا يمكن إضافة الرصيد',

    'players.filters.search': 'بحث عن لاعب',
    'players.filters.searchPlaceholder': 'الاسم أو @username أو معرّف تلغرام أو الهاتف',
    'players.filters.clearSearch': 'مسح البحث',
    'players.filters.anyStatus': 'كل الحالات',
    'players.filters.linked': 'الربط مع Ichancy',
    'players.filters.waitingForIchancy': 'بانتظار Ichancy',

    'players.backToList': 'رجوع إلى اللاعبين',
    'players.identity.title': 'بيانات اللاعب',
    'players.identity.ichancyAccount': 'حساب Ichancy',

    'players.link.action': 'إنشاء حساب Ichancy',
    'players.link.forPlayer': 'إنشاء حساب Ichancy لـ {name}',
    'players.credit.forPlayer': 'إيداع إلى {name}',
    'players.debit.forPlayer': 'سحب من {name}',
    'players.link.confirmTitle': 'إنشاء حساب Ichancy؟',
    'players.link.confirmDescription':
      'سيحصل {name} على حساب لعب على وكيل Ichancy الخاص بالمشغّل، وهو ما يسمح بإضافة رصيد إيداعاته الموافق عليها.',
    'players.link.confirmLabel': 'إنشاء الحساب',
    'players.link.notWaitingTitle': 'هذا اللاعب ليس بانتظار حساب',
    'players.link.notWaitingBody':
      'حالته ليست «{status}»، أي أن أحدهم أغلق الحساب أو أن الربط فشل سابقاً لسبب يستحق التحقق منه أولاً.',
    'players.link.idempotentNote':
      'التكرار آمن: إذا كان الحساب موجوداً فلن يتغيّر شيء وسيُقال لك ذلك.',
    'players.link.created': 'تم إنشاء حساب Ichancy',
    'players.link.createdDescription':
      'يمكن الآن إضافة الرصيد لـ {name}. اسم الدخول {login}، الوكيل {agent}.',
    'players.link.alreadyLinked': 'مرتبط مسبقاً',
    'players.link.alreadyLinkedDescription':
      'لم يُنشأ شيء — {name} يملك أصلاً اسم الدخول {login} على الوكيل {agent}.',
    'players.link.nothingCreated': ' — هذا اللاعب كان يملك حساباً أصلاً، فلم يُنشأ شيء.',
    'players.link.failed': 'تعذّر إنشاء حساب Ichancy',

    'players.deposits.title': 'آخر الإيداعات',
    'players.deposits.hint': 'الأحدث أولاً. افتح أحدها لمراجعته في القائمة.',
    // Arabic counts in six categories, and a player panel showing exactly two deposits is ordinary.
    'players.deposits.showing': {
      zero: 'لا توجد إيداعات.',
      one: 'يظهر آخر إيداع.',
      two: 'يظهر آخر إيداعين.',
      few: 'تظهر آخر {count} إيداعات.',
      many: 'يظهر آخر {count} إيداعاً.',
      other: 'يظهر آخر {count} إيداع.',
    },
    'players.deposits.emptyTitle': 'لا توجد إيداعات بعد',
    'players.deposits.emptyDescription': 'هذا اللاعب لم يقدّم أي إيداع.',
    'players.deposits.caption': 'آخر إيداعات هذا اللاعب',

    // ── السحب اليدوي ─────────────────────────────────────────────────────────────────────────
    'players.debit.action': 'سحب رصيد من اللاعب',
    'players.debit.title': 'سحب رصيد من {name}',
    'players.debit.description':
      'يسحب الأموال من حساب اللاعب في Ichancy ويعيدها إلى رصيد الوكيل. لا يوجد طلب من اللاعب ولا موافقة ثانية، فاقرأ المبلغ مرتين.',
    'players.debit.amountLabel': 'المبلغ المطلوب سحبه ({currency})',
    'players.debit.amountPlaceholder': '0.00',
    'players.debit.amountRequired': 'أدخل المبلغ المطلوب سحبه.',
    'players.debit.amountFormat':
      'أرقام وخانتان عشريتان على الأكثر — 1500.00 وليس 1,500 ولا 1.5e3.',
    'players.debit.amountTooSmall': 'يجب أن يكون المبلغ أكبر من صفر.',
    'players.debit.reasonLabel': 'السبب',
    'players.debit.reasonPlaceholder': 'لماذا يُسحب هذا المبلغ.',
    'players.debit.reasonRequired': 'اذكر السبب. من سيردّ على شكوى هذا اللاعب سيقرأه بعد أشهر.',
    'players.debit.reasonTooLong': 'اجعله ضمن {max} حرفاً؛ هذا {length}.',
    'players.debit.reasonCounter': '{length} من {max}',
    'players.debit.review': 'مراجعة عملية السحب',
    'players.debit.confirmTitle': 'سحب هذا المبلغ من حساب {name} في الكازينو؟',
    'players.debit.confirmBody':
      'عند التأكيد يخرج الرصيد من حساب اللاعب في Ichancy ويعود المبلغ إلى رصيد الوكيل. هذا لا يسلّمه أي نقد: نبقى مدينين له بهذا المبلغ إلى أن تدفعه تسوية منفصلة.',
    'players.debit.takingOut': 'المبلغ المسحوب',
    'players.debit.fromPlayer': 'من {name}',
    'players.debit.noUndoTitle': 'لا يمكن التراجع عن هذا من اللوحة',
    'players.debit.noUndoBody':
      'السحب حركة حقيقية على حساب فعّال. إعادته تعني إضافة الرصيد يدوياً من جديد، واللاعب يرى العمليتين.',
    'players.debit.back': 'رجوع',
    'players.debit.stop': 'توقّف هنا',
    'players.debit.confirmLabel': 'سحب {amount}',
    'players.debit.sending':
      'يجري إرسال الطلب إلى Ichancy. لا تغلق النافذة — العملية غير قابلة للتكرار.',
    'players.debit.notLinkedTitle': 'هذا اللاعب لا يملك حساب Ichancy',
    'players.debit.notLinkedBody':
      'لا يوجد رصيد في الكازينو ليُسحب منه شيء. أنشئ الحساب أولاً، أو تأكد أنك على اللاعب الصحيح.',
    'players.debit.failedTitle': 'لم تتم عملية السحب',
    'players.debit.failedHint': 'لم يُسحب أي مبلغ. صحّح ما تذكره الرسالة ثم أعد الإرسال.',
    'players.debit.maybeLandedTitle': 'قد تكون العملية قد تمّت فعلاً',
    'players.debit.maybeLandedBody':
      'فشل الطلب في طريق العودة، وهذا لا يقول شيئاً عن طريق الذهاب. اقرأ رصيد اللاعب في Ichancy قبل أن يعيد أحد إرسال العملية — التكرار يسحب المال مرتين.',
    'players.debit.doneTitle': 'تم سحب {amount} من هذا الحساب',
    'players.debit.doneBody':
      'كان لدى {name} {before} وأصبح لديه الآن {after}. نبقى مدينين له بـ {amount} إلى أن تدفعه تسوية.',
    'players.debit.refusedTitle': 'رفض Ichancy عملية السحب',
    'players.debit.refusedBody':
      'لم يتغيّر شيء — ما زال لدى {name} {after}. السبب المعتاد أن الرصيد لم يعد موجوداً.',
    'players.debit.unsureTitle': 'لا أحد يعرف بعد إن كانت عملية السحب قد تمت',
    'players.debit.unsureBody':
      'لم يُجب Ichancy، وإعادة قراءة الرصيد لم تحسم الأمر. سُجّلت الحالة «{status}» ليتحقق منها موظف مقابل Ichancy. لا تُعد إرسالها من هنا — التكرار يسحب المال مرتين.',
    'players.debit.field.debitId': 'معرّف السحب',
    'players.debit.field.balanceBefore': 'الرصيد قبل',
    'players.debit.field.balanceAfter': 'الرصيد بعد',
    'players.debit.field.verifiedBy': 'أُكِّد بواسطة',
    'players.debit.verifiedBy.unconfirmed': 'غير مؤكد',
    'players.debit.verifiedBy.API_OK': 'تأكيد من Ichancy',
    'players.debit.verifiedBy.BALANCE_DELTA': 'مثبت بإعادة قراءة الرصيد',
    'players.debit.verifiedBy.MANUAL': 'أكّده موظف',
    'players.debit.status.DEBITED': 'تم السحب',
    'players.debit.status.REJECTED': 'رفضه Ichancy',
    'players.debit.status.NEEDS_RECONCILIATION': 'يحتاج تسوية',

    'players.credit.action': 'إضافة رصيد للاعب',
    'players.credit.title': 'إضافة رصيد إلى {name}',
    'players.credit.description':
      'امنح هذا اللاعب رصيداً، يُسجَّل كإيداع يدوي. يضيفه Ichancy بعد قليل — والمبلغ الكبير يمرّ على موافقة ثانية أولاً.',
    'players.credit.amountLabel': 'المبلغ المطلوب منحه ({currency})',
    'players.credit.amountPlaceholder': '0.00',
    'players.credit.amountRequired': 'أدخل المبلغ المطلوب منحه.',
    'players.credit.amountFormat':
      'أرقام وخانتان عشريتان على الأكثر — 25000.00 وليس 25,000 أو 2.5e4.',
    'players.credit.amountTooSmall': 'يجب أن يكون المبلغ أكبر من صفر.',
    'players.credit.reasonLabel': 'السبب',
    'players.credit.reasonPlaceholder': 'لماذا يُضاف الرصيد لهذا اللاعب.',
    'players.credit.reasonRequired':
      'اذكر السبب. من يسوّي نقد المكتب سيقرأه مقابل هذا الرصيد لاحقاً.',
    'players.credit.reasonTooLong': 'اجعله ضمن {max} حرفاً؛ هذا {length}.',
    'players.credit.reasonCounter': '{length} من {max}',
    'players.credit.review': 'مراجعة إضافة الرصيد',
    'players.credit.confirmTitle': 'منح هذا المبلغ إلى {name}؟',
    'players.credit.confirmBody': 'راجعه قبل تسجيله. يُضاف الرصيد للاعب عبر Ichancy بعد لحظات.',
    'players.credit.giving': 'المبلغ الممنوح',
    'players.credit.toPlayer': 'إلى {name}',
    'players.credit.back': 'رجوع',
    'players.credit.stop': 'توقّف هنا',
    'players.credit.confirmLabel': 'منح {amount}',
    'players.credit.sending': 'جارٍ تسجيل الرصيد…',
    'players.credit.queuedTitle': 'تمّت جدولة {amount} لهذا اللاعب',
    'players.credit.queuedBody': 'يضيف Ichancy إلى {name} مبلغ {amount} بعد لحظات.',
    'players.credit.secondApprovalTitle': 'أُرسل لموافقة ثانية',
    'players.credit.secondApprovalBody':
      'منح {name} مبلغ {amount} كبير بما يكفي ليحتاج موافقة مسؤول آخر. إنه بانتظارها في قائمة الإيداعات.',
    'players.credit.failedTitle': 'لم تتم إضافة الرصيد',
    'players.credit.failedHint': 'لم يُسجَّل شيء. صحّح ما تذكره الرسالة ثم أعد المحاولة.',
    'players.credit.maybeQueuedTitle': 'قد تكون قد جُدولت فعلاً',
    'players.credit.maybeQueuedBody':
      'لم يردّ الخادم بوضوح، لذا قد يكون الرصيد قد سُجِّل. تحقّق من قائمة الإيداعات قبل تسجيله مجدداً.',

    // ── العرض المقسّم فوق التصفية ─────────────────────────────────────────────────────────────
    'players.segment.label': 'عرض',
    'players.segment.all': 'الكل',
    'players.segment.telegram': 'تلغرام',
    'players.segment.imported': 'اللاعبون القدامى',
    'players.segment.blocked': 'المحظورون',

    // ── تسجيل لاعب من اللوحة ─────────────────────────────────────────────────────────────────
    'players.register.action': 'تسجيل لاعب',
    'players.register.title': 'تسجيل لاعب جديد',
    'players.register.description':
      'ينشئ اللاعب هنا دون أن يضغط Start. كل الحقول اختيارية، لكن أدخل شيئاً واحداً على الأقل يمكن العثور عليه به لاحقاً.',
    'players.register.field.telegramUserId': 'معرّف تلغرام',
    'players.register.hint.telegramUserId':
      'المعرّف الرقمي، أرقام فقط — وليس @username. اتركه فارغاً وأضفه لاحقاً.',
    'players.register.hint.phone': 'مع رمز الدولة، كما يكتبه اللاعب.',
    'players.register.createIchancy': 'إنشاء حساب Ichancy الآن',
    'players.register.createIchancyHint':
      'يتصل بـ Ichancy بعد حفظ اللاعب. إذا فشل الاتصال يبقى اللاعب موجوداً، ويمكن إنشاء الحساب من صفّه لاحقاً.',
    'players.register.submit': 'تسجيل',
    'players.register.validation.telegramUserId': 'أرقام فقط — معرّف تلغرام الرقمي.',
    'players.register.validation.tooLong': 'اجعله ضمن {max} حرفاً.',
    'players.register.validation.nothing':
      'أدخل معرّف تلغرام أو اسماً أو رقم هاتف على الأقل، وإلا فلن يجد أحد هذا اللاعب مجدداً.',
    'players.register.successTitle': 'تم تسجيل {name}',
    'players.register.ichancy.created':
      'تم إنشاء حساب Ichancy: اسم الدخول {login} على الوكيل {agent}.',
    'players.register.ichancy.existing': 'كان لدى Ichancy هذا اللاعب أصلاً: اسم الدخول {login}.',
    'players.register.ichancy.notRequested':
      'لم يُطلب حساب Ichancy. أنشئ واحداً من صف اللاعب عندما يحتاجه.',
    'players.register.ichancy.failedTitle': 'تم تسجيل {name}، لكن حساب Ichancy فشل',
    'players.register.ichancy.failedBody':
      'اللاعب موجود بلا حساب. قال Ichancy: {error}. أنشئ الحساب من صفّه عندما يعود Ichancy للاستجابة.',
    'players.register.failedTitle': 'تعذّر تسجيل اللاعب',
    'players.register.open': 'فتح {name}',

    // ── استيراد لاعبي الوكيل الحاليين ─────────────────────────────────────────────────────────
    'players.import.action': 'استيراد من Ichancy',
    'players.import.hint': 'التكرار آمن: الصفوف المعروفة تُحسب ولا تُكرَّر.',
    'players.import.doneTitle': 'انتهى الاستيراد',
    'players.import.summary': 'تم فحص {scanned} · أُنشئ {created} · معروف مسبقاً {existing}.',
    'players.import.stoppedTitle': 'توقّف الاستيراد مبكراً',
    'players.import.stoppedBody':
      'قال Ichancy: {error}. الصفوف التي كُتبت قبل التوقف محفوظة؛ أعد التشغيل عندما يستجيب Ichancy.',
    'players.import.failedTitle': 'تعذّر استيراد اللاعبين',

    // ── الحظر ورفع الحظر ──────────────────────────────────────────────────────────────────────
    'players.block.action': 'حظر اللاعب',
    'players.block.forPlayer': 'حظر {name}',
    'players.block.title': 'حظر {name}',
    'players.block.description':
      'اللاعب المحظور لا يستطيع فعل أي شيء في بوت هذا المشغّل — لا إيداع ولا سحب ولا قائمة. حسابه ورصيده في Ichancy لا يتأثران.',
    'players.block.reasonLabel': 'السبب',
    'players.block.reasonPlaceholder': 'لماذا يُمنع هذا اللاعب.',
    'players.block.reasonRequired': 'اذكر السبب. يظهر لمن يرفع الحظر عنه، ولا لأحد غيره.',
    'players.block.reasonTooLong': 'اجعله ضمن {max} حرفاً؛ هذا {length}.',
    'players.block.reasonCounter': '{length} من {max}',
    'players.block.review': 'مراجعة الحظر',
    'players.block.confirmTitle': 'حظر {name} من البوت؟',
    'players.block.confirmBody':
      'يتوقف البوت عن الرد عليه فور التأكيد. رفع الحظر بضغطة واحدة، لكنه سيكون قد رأى الرفض.',
    'players.block.back': 'رجوع',
    'players.block.confirmLabel': 'حظر {name}',
    'players.block.sending': '...جارٍ الحظر',
    'players.block.doneTitle': 'تم حظر {name}',
    'players.block.doneBody': 'البوت يرفضه من الآن.',
    'players.block.failedTitle': 'تعذّر حظر اللاعب',
    'players.block.failedHint': 'لم يتغيّر شيء. صحّح ما تذكره الرسالة ثم أعد المحاولة.',

    'players.unblock.action': 'رفع الحظر',
    'players.unblock.forPlayer': 'رفع الحظر عن {name}',
    'players.unblock.confirmTitle': 'رفع الحظر عن {name}؟',
    'players.unblock.confirmDescription':
      'يستطيع استخدام البوت فوراً — كلاعب نشط إن كان لديه حساب Ichancy، وإلا فبانتظار واحد.',
    'players.unblock.confirmLabel': 'رفع الحظر',
    'players.unblock.doneTitle': 'تم رفع الحظر عن {name}',
    'players.unblock.doneBody': 'حالته الآن «{status}».',
    'players.unblock.failedTitle': 'تعذّر رفع الحظر عن اللاعب',

    'players.blocked.title': 'محظور من البوت',
    'players.blocked.body': 'يرفض البوت كل رسالة وزر من هذا اللاعب.',
    'players.blocked.reason': 'السبب',
    'players.blocked.when': 'تاريخ الحظر',
    'players.blocked.by': 'بواسطة المسؤول',
    'players.blocked.noReason': 'لم يُسجَّل سبب.',

    // ── ربط حساب تلغرام بصف لا يملك واحداً ────────────────────────────────────────────────────
    'players.attach.action': 'ربط تلغرام',
    'players.attach.forPlayer': 'ربط تلغرام بـ {name}',
    'players.attach.title': 'ربط حساب تلغرام بـ {name}',
    'players.attach.description':
      'هذا الصف لا يملك معرّف تلغرام — استُورد من Ichancy أو سُجِّل هنا. اكتب المعرّف الرقمي للحساب الذي يخص هذا اللاعب، وسيعرفه البوت من الآن فصاعداً.',
    'players.attach.field': 'معرّف تلغرام',
    'players.attach.hint': 'أرقام فقط. وليس @username.',
    'players.attach.validation': 'أدخل معرّف تلغرام الرقمي — أرقام فقط.',
    'players.attach.submit': 'ربط',
    'players.attach.doneTitle': 'تم ربط تلغرام {id}',
    'players.attach.doneBody': 'البوت يعرف {name} الآن.',
    'players.attach.failedTitle': 'تعذّر ربط حساب تلغرام',

    'players.field.source': 'المصدر',
    'players.source.importedOn': 'مستورد من Ichancy — مسجّل هناك بتاريخ {date}',
    'players.telegram.none': 'لا يوجد حساب تلغرام',
  },
});

export type PlayerMessageKey = keyof (typeof playerMessages)['en'];

/** The two debit enums this screen renders that the shared enum table does not carry. */
export type PlayerEnumGroup = 'debit.status' | 'debit.verifiedBy';

/**
 * `useEnumLabel` for the enums that live in this bundle rather than the shared one.
 *
 * Same contract as the shared hook, including the part that matters: a status the backend adds
 * tomorrow has no key here, so it renders as itself humanised instead of vanishing off the panel
 * that is telling an operator whether a live account was just emptied.
 */
export function usePlayerEnumLabel(): (group: PlayerEnumGroup, value: string) => string {
  const t = useT(playerMessages);

  return useCallback(
    (group: PlayerEnumGroup, value: string) => {
      const key = `players.${group}.${value}`;
      const label = t(key as PlayerMessageKey);
      return label === key ? humanizeEnum(value) : label;
    },
    [t],
  );
}
