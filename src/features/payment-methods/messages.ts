import { defineMessages } from '@/lib/i18n/messages';
import type { Translator } from '@/lib/i18n/use-translation';

/**
 * The payment-rails bundle.
 *
 * Nothing here is a number: limits, fees, caps, basis points and account identifiers stay in
 * Western digits in both languages, because this screen is read side by side with a bank statement.
 * What is translated is everything around them — the words that say which number is which.
 *
 * The Arabic is the register a cashier actually uses: قناة for a rail, وجهة for the account a
 * player is sent to, إيقاف rather than تعطيل. Ichancy, Telegram and NSP stay in English, as they are
 * said in the trade.
 */
export const railMessages = defineMessages({
  en: {
    // ── The screen ───────────────────────────────────────────────────────────────────────────
    'rails.page.description':
      'The methods players can choose, and the accounts each one sends them to. A wrong account number here is a direct loss, so codes, rails, currencies and account identifiers are fixed once created.',
    'rails.page.hiddenSelectionTitle': 'That method is not in this list',
    'rails.page.hiddenSelectionBody':
      'The link you followed points at a method the current filters hide. Clear the filters to see it and its destinations.',

    // ── Columns and form labels ──────────────────────────────────────────────────────────────
    'rails.field.code': 'Code',
    'rails.field.method': 'Method',
    'rails.field.rail': 'Rail',
    'rails.field.verification': 'Verification',
    'rails.field.limits': 'Limits',
    'rails.field.fee': 'Fee',
    'rails.field.reference': 'Reference',
    'rails.field.state': 'State',
    'rails.field.order': 'Order',
    'rails.field.actions': 'Actions',
    'rails.field.priority': 'Priority',
    'rails.field.label': 'Label',
    'rails.field.account': 'Account identifier',
    'rails.field.accountHolder': 'Account holder',
    'rails.field.dailyCap': 'Daily cap',
    'rails.field.notes': 'Notes',
    'rails.field.minAmount': 'Minimum amount',
    'rails.field.maxAmount': 'Maximum amount',
    'rails.field.feeFixed': 'Fixed fee',
    'rails.field.feeBps': 'Percentage fee (basis points)',
    'rails.field.sortOrder': 'Sort order',
    'rails.field.referencePattern': 'Reference pattern',
    'rails.field.instructions': 'Instructions',
    'rails.field.requiresReference': 'Reference required',
    'rails.field.requiresProof': 'Receipt photo required',

    // ── Filters ──────────────────────────────────────────────────────────────────────────────
    'rails.filter.allRails': 'All rails',
    'rails.filter.anyState': 'Active and inactive',
    'rails.filter.activeOnly': 'Active only',
    'rails.filter.inactiveOnly': 'Inactive only',

    // ── What a row says ──────────────────────────────────────────────────────────────────────
    'rails.limits.to': 'to',
    'rails.fee.none': 'No fee',
    'rails.reference.required': 'Required',
    'rails.reference.notRequired': 'Not required',

    // The enum LABELS are shared; only these descriptions are ours, and only this screen shows them.
    'rails.verification.MANUAL_PROOF': 'A reviewer reads the uploaded receipt.',
    'rails.verification.REFERENCE_MATCH':
      'The player types the rail reference and it is matched against a statement.',
    'rails.verification.AUTO_STATEMENT': 'Statements are ingested automatically (future rails).',
    'rails.verification.NONE': 'No verification step.',

    // ── Methods ──────────────────────────────────────────────────────────────────────────────
    'rails.method.new': 'New method',
    'rails.method.create': 'Create method',
    'rails.method.newTitle': 'New payment method',
    'rails.method.editTitle': 'Edit {name}',
    'rails.method.createHint':
      'A method is the rail a player picks. The accounts they actually pay into are added afterwards, as destinations.',
    'rails.method.editHint':
      'What players see, and the limits every deposit through this rail is checked against.',
    'rails.method.emptyTitle': 'No payment methods yet',
    'rails.method.emptyBody':
      'A payment method is the rail a player picks before they are shown an account to pay into.',
    'rails.method.emptyFilteredTitle': 'No method matches these filters',
    'rails.method.emptyFilteredBody':
      'Nothing on this rail, or nothing in that state. Clear the filters to see them all.',
    'rails.method.showAll': 'Show every rail',
    'rails.method.addFirst': 'Add the first method',
    'rails.method.tableCaption':
      'Payment methods, with the limits and fees applied to every deposit through them.',
    'rails.method.showDestinations': ', show destinations',
    'rails.method.deactivateAria': 'Deactivate {name}',
    'rails.method.confirmTitle': 'Deactivate {name}?',
    'rails.method.thisMethod': 'this method',
    'rails.method.confirmBody':
      'Players will stop being offered this method, and none of its destinations will be handed out again. Deposits already submitted through it carry on as normal, and nothing is deleted — editing the method turns it back on.',
    'rails.method.deactivated': '{name} deactivated',
    'rails.method.deactivatedBody':
      'Players will not be offered this method on their next deposit.',
    'rails.method.deactivateFailed': 'Could not deactivate {name}',
    'rails.method.created': '{name} created',
    'rails.method.createdBody': 'Add at least one destination before players can pay into it.',
    'rails.method.saved': '{name} saved',
    'rails.method.savedBody': 'The new limits apply to deposits started from now on.',
    'rails.method.createFailed': 'Could not create the method',
    'rails.method.saveFailed': 'Could not save the method',

    // ── Destinations ─────────────────────────────────────────────────────────────────────────
    'rails.destination.title': 'Destinations',
    'rails.destination.titleFor': 'Destinations for {name}',
    'rails.destination.description':
      'The accounts a player is handed after choosing this method, offered in priority order.',
    'rails.destination.count': {
      one: '{count} account',
      other: '{count} accounts',
    },
    'rails.destination.includeInactive': 'Include inactive',
    'rails.destination.add': 'Add destination',
    'rails.destination.addFirst': 'Add the first destination',
    'rails.destination.noMethodTitle': 'No method selected',
    'rails.destination.noMethodBody':
      'Pick a payment method above to see the accounts its players are sent to.',
    'rails.destination.emptyTitle': 'No destinations on this method',
    'rails.destination.emptyBody':
      'Nobody can deposit through this rail until it has an account to pay into.',
    'rails.destination.emptyActiveTitle': 'No active destinations on this method',
    'rails.destination.emptyActiveBody':
      'There may be deactivated ones. Turn on "Include inactive" to see them.',
    'rails.destination.tableCaption':
      'Destinations for {name}, in the order players are offered them.',
    'rails.destination.newTitle': 'New destination for {name}',
    'rails.destination.editTitle': 'Edit {name}',
    'rails.destination.createHint':
      'Players who pick this method are handed one of its destinations. Check the account against the bank statement before you save it.',
    'rails.destination.editHint': 'Everything about this account except the account itself.',
    'rails.destination.deactivateAria': 'Deactivate {name}',
    'rails.destination.confirmTitle': 'Deactivate {name}?',
    'rails.destination.thisDestination': 'this destination',
    // Split around the account number, which has to stay in its own element to be copyable and to
    // be isolated from the surrounding bidi run. Both halves are whole clauses in either language.
    'rails.destination.confirmLead': 'New deposits will stop being pointed at',
    'rails.destination.confirmRest':
      'Deposits already waiting on it keep it, so anything already in flight still reconciles. Nothing is deleted.',
    'rails.destination.deactivated': '{name} deactivated',
    'rails.destination.deactivatedBody': 'No new deposit will be pointed at this account.',
    'rails.destination.deactivateFailed': 'Could not deactivate {name}',
    'rails.destination.added': '{name} added',
    'rails.destination.addedBody': 'Players choosing {method} can now be handed this account.',
    'rails.destination.saved': '{name} saved',
    'rails.destination.savedBody': 'The account number itself is unchanged.',
    'rails.destination.addFailed': 'Could not add the destination',
    'rails.destination.saveFailed': 'Could not save the destination',

    // ── The two forms ────────────────────────────────────────────────────────────────────────
    'rails.form.saveFailedTitle': 'That did not save',
    'rails.form.saveChanges': 'Save changes',
    'rails.form.codeHint': 'How every deposit and every ledger entry will refer to this method.',
    'rails.form.codeLocked': 'Deposits already point at this code; changing it would orphan them.',
    'rails.form.namePlaceholder': 'Bank transfer',
    'rails.form.railLocked':
      'The rail decides how the money physically arrives, so a different one is a different method.',
    'rails.form.currencyHint': 'Three-letter code, uppercase.',
    'rails.form.currencyLocked':
      "The ledger already holds this method's balances in this currency.",
    'rails.form.minHint': 'The smallest deposit this method accepts.',
    'rails.form.maxHint': 'The largest deposit this method accepts.',
    'rails.form.feeFixedHint': 'Taken from every deposit, on top of the percentage.',
    'rails.form.feeBpsHint': '100 basis points is 1%. 10000 is the whole deposit.',
    'rails.form.sortOrderHint': "Lower shows first in the player's list.",
    'rails.form.referencePatternHint':
      "Optional regular expression the player's reference must match. Only read when a reference is required.",
    'rails.form.instructionsHint': 'Shown to the player in the bot, word for word.',
    'rails.form.instructionsPlaceholder': 'Transfer to the account shown, then upload the receipt.',
    'rails.form.requiresReferenceHint':
      "The player must type the rail's transaction reference before they can submit.",
    'rails.form.requiresProofHint':
      'The player must attach a photo of the receipt. Turn this off only where a reference is ' +
      'required — a reference can be checked against a statement and cannot be claimed twice, ' +
      'but a claim with neither leaves a reviewer nothing to look at.',
    'rails.form.methodActiveHint':
      'An inactive method stays on record but is not offered to players.',
    'rails.form.labelHint': 'Internal: how staff will refer to this account.',
    'rails.form.labelPlaceholder': 'Main branch account',
    'rails.form.priorityHint': 'Lower is offered first while the account is under its cap.',
    'rails.form.accountHint':
      'The IBAN, wallet number or office code players will pay into. Read it back before saving.',
    'rails.form.accountLocked':
      "Editing this would silently redirect players' money to a different account. Add a new destination and deactivate this one instead.",
    'rails.form.accountHolderHint': 'The name the player will see on the receiving side.',
    'rails.form.accountHolderPlaceholder': 'Cashier Holdings LLC',
    'rails.form.dailyCapHint':
      'In {currency}. Leave empty for no cap; a cap already set can be changed here but not removed.',
    'rails.form.notesHint': 'Staff only. Players never see this.',
    'rails.form.notesPlaceholder': 'Use for amounts above 500,000.',
    'rails.form.destinationActiveHint':
      'An inactive destination is never handed to a player, but stays attached to the deposits that used it.',

    // ── What the forms refuse ────────────────────────────────────────────────────────────────
    'rails.validation.required': 'Required.',
    'rails.validation.tooLong': 'Too long.',
    'rails.validation.wholeNumber': 'Whole numbers only.',
    'rails.validation.atMost': '{max} at most.',
    'rails.validation.amountFormat':
      'A plain decimal, like 50000.00 — no separators and no currency code.',
    'rails.validation.amountNegative': 'An amount cannot be negative.',
    'rails.validation.amountScale': 'Two decimal places at most.',
    'rails.validation.code':
      'SCREAMING_SNAKE_CASE: 2 to 48 characters, starting with a letter, then letters, digits or underscores.',
    'rails.validation.displayName': 'Players see this name, so it needs one.',
    'rails.validation.currency': 'Three capital letters, like NSP.',
    'rails.validation.maxBelowMin':
      'The maximum has to be at least the minimum, or nobody can deposit anything.',
    'rails.validation.destinationLabel': 'Cashiers pick this account by its label.',
    'rails.validation.accountRequired':
      'This is the number players will pay into. It cannot be blank.',
    // Describes both shapes rather than naming one: this rail's chain is read off the address, so
    // until there is a valid address there is no "expected" network to name. Saying what an address
    // looks like is what somebody staring at a rejected paste actually needs.
    'rails.validation.walletShape':
      'This is not a wallet address. A TRC20 address is 34 characters starting with T; a BEP20 address is 42 characters starting with 0x. Paste it again from your wallet app.',
    'rails.form.walletHint':
      'Paste it from your wallet app — do not type it. Then read every character back against your phone before saving: this cannot be changed afterwards, and USDT sent to a wrong address is gone.',
    'rails.form.walletConfirm': 'I have read this address back against my wallet app',
    // The chain read off what was just pasted. It is here, beside the tick, because this is the one
    // moment a human is looking at the address — and "BEP20" under a rail they think of as TRC20 is
    // the whole warning.
    'rails.form.walletDetected':
      'This is a {network} address. Players on this rail will be told to send on {network}, and USDT sent on any other network is lost.',
    'rails.validation.walletUnconfirmed':
      'Read the address back against your wallet app and tick the box. Every player on this rail will pay into it.',
    'rails.validation.capFormat':
      'A plain decimal, like 20000000.00 — or leave it empty for no cap.',
    'rails.validation.capNegative': 'A cap cannot be negative.',

    // ── The rate that prices a crypto deposit ────────────────────────────────────────────────
    'rails.rate.title': 'USDT rate',
    'rails.rate.description':
      'What one USDT is worth. It multiplies every deposit on the USDT rails, so read the example below before saving — a wrong decimal point is invisible in a rate and obvious in a credit.',
    'rails.rate.field': 'One USDT is worth',
    'rails.rate.noteField': 'Where you read it (optional)',
    'rails.rate.noteHint':
      'Kept with the rate, so a credit can be re-checked against the same source months later.',
    'rails.rate.setLabel': 'Set',
    'rails.rate.submit': 'Save rate',
    'rails.rate.submitConfirm': 'Yes, save this rate',
    'rails.rate.saved': 'Rate saved. Deposits from now on are priced with it.',
    'rails.rate.readOnly': 'Your role can see this rate but not change it.',
    'rails.rate.noneTitle': 'No rate is set',
    'rails.rate.noneBody':
      'The USDT rails cannot price a deposit until one is. Nothing on them is offered to players meanwhile.',
    'rails.rate.staleTitle': 'This rate is too old to use',
    'rails.rate.staleBody':
      'The USDT rails are refusing deposits rather than pricing them at an old number. A rate is usable for {hours} hours; set a current one.',
    'rails.rate.previewTitle': 'Check this before saving',
    'rails.rate.previewHint':
      'Exactly what a player would be credited, using the same arithmetic the server does.',
    'rails.rate.previewEmpty': 'Enter a rate to see what it would credit.',
    'rails.rate.jumpTitle': 'That is a long way from the current rate',
    'rails.rate.jumpBody':
      'Further than a rate normally moves. Check the decimal point, and check you have not mixed up the new pound with the old — they differ by a factor of a hundred. Press again only if it is genuinely right.',

    // ── Financial settings ───────────────────────────────────────────────────────────────────
    'financial.page.description':
      'Every method a player can pay with, the accounts each one pays into, and the rate every USDT deposit is priced at.',
    'financial.methods.emptyTitle': 'This operator has no payment method',
    'financial.methods.emptyBody':
      'Nothing can be paid in until there is one. Create it on the payment rails screen, then enter the account it pays into here.',
    'financial.card.description':
      'The accounts players are told to pay into when they pick this method.',
    'financial.card.cryptoDescription':
      'Players who pick this method send USDT to the address below, on the chain that address is on.',
    'financial.address.heading': 'Wallet address',
    'financial.address.emptyTitle': 'No wallet address yet',
    'financial.address.emptyBody':
      'Paste it from your own wallet app. Until it is here, nobody can pay into this rail.',
    'financial.address.set': 'Enter the wallet address',
    'financial.address.addAnother': 'Add another address',
    'financial.account.heading': 'Accounts players pay into',
    'financial.account.emptyTitle': 'No account yet',
    'financial.account.emptyBody':
      'Enter the account players will pay into. Until it is here, a player who picks this method is shown nothing.',
    'financial.account.set': 'Enter the account',
    'financial.account.addAnother': 'Add another account',
    // Not a figure, and deliberately not a zero: this rail has no balance the console can read.
    // Declared balances are what will fill this line — see `AccountBalance`.
    'financial.balance.untracked': 'No balance is tracked for this account yet.',
    'financial.declared.recordedLabel': 'Recorded balance',
    'financial.declared.updatedAt': 'updated {when}',
    'financial.declared.add': 'Add balance',
    'financial.declared.title': 'Recorded balance — {name}',
    'financial.declared.hint':
      'A balance you type in for an account no chain or API can be asked. It is shown with when you last set it, and never moves money on its own.',
    'financial.declared.amountLabel': 'Amount',
    'financial.declared.amountHint':
      'As you read it from the account. Leave empty to remove the recorded balance.',
    'financial.declared.currencyLabel': 'Currency',
    'financial.declared.amountFormat': 'A plain amount, like 200 or 2000000.00.',
    'financial.declared.amountNegative': 'A balance cannot be negative.',
    'financial.declared.currencyFormat': 'A 2–8 letter code, like USD or NSP.',
    'financial.declared.pairRequired':
      'Enter both an amount and its currency, or leave both empty to remove it.',
    'financial.declared.clearNote': 'Leaving both fields empty removes the recorded balance.',
    'financial.declared.saved': 'Recorded balance updated',
    'financial.declared.cleared': 'Recorded balance removed',
    'financial.declared.saveFailed': 'That balance did not save',
    'financial.shamcash.title': 'Sham Cash account',
    'financial.shamcash.description':
      'Link your Sham Cash account by its browser session, so the balance can be read here.',
    'financial.shamcash.linkedBadge': 'Linked',
    'financial.shamcash.notLinkedBadge': 'Not linked',
    'financial.shamcash.linkedSince': 'Linked {when}.',
    'financial.shamcash.howTitle': 'Where these come from',
    'financial.shamcash.howBody':
      'On shamcash.sy while signed in, open DevTools → Application. From Cookies → shamcash.sy copy accessToken, authToken and forge; from Local Storage → shamcash.sy copy shamcash-pin-code-hash. They are a login session — paste them here and nowhere else.',
    'financial.shamcash.accessTokenLabel': 'accessToken cookie',
    'financial.shamcash.authTokenLabel': 'authToken cookie',
    'financial.shamcash.forgeLabel': 'forge cookie',
    'financial.shamcash.forgeHint': 'Optional, but paste it if it is there.',
    'financial.shamcash.pinCodeHashLabel': 'shamcash-pin-code-hash',
    'financial.shamcash.pinCodeHashHint':
      'From Local Storage, not Cookies. The account will not load without it.',
    'financial.shamcash.accessTokenRequired': 'Paste the accessToken cookie value.',
    'financial.shamcash.authTokenRequired': 'Paste the authToken cookie value.',
    'financial.shamcash.pinCodeHashRequired':
      'Paste shamcash-pin-code-hash from Local Storage — the page stays blank without it.',
    'financial.shamcash.pinLabel': 'PIN code',
    'financial.shamcash.pinHint':
      'The 4-digit PIN you type on Sham Cash after signing in. Needed so the balance can be read.',
    'financial.shamcash.pinRequired': 'Enter your 4-digit Sham Cash PIN.',
    'financial.shamcash.link': 'Link account',
    'financial.shamcash.relink': 'Update session',
    'financial.shamcash.unlink': 'Unlink',
    'financial.shamcash.linked': 'Sham Cash account linked',
    'financial.shamcash.linkedBody': 'The balance can now be read from your session.',
    'financial.shamcash.linkFailed': 'Could not link the account',
    'financial.shamcash.unlinked': 'Sham Cash account unlinked',
    'financial.shamcash.unlinkFailed': 'Could not unlink the account',
    'financial.shamcash.check': 'Check balance',
    'financial.shamcash.checkFailed': 'Could not check the balance',
    'financial.shamcash.locked': 'Locked: {amount}',
    'financial.shamcash.recent': 'Recent transfers',
    'financial.shamcash.expiredTitle': 'Session expired',
    'financial.shamcash.expiredBody':
      'Your Sham Cash session has lapsed. Paste a fresh set of cookies above to re-link it.',
    'financial.shamcash.unavailableTitle': 'Could not read the balance',
    'financial.notReady.title': 'This rail is not ready to take money',
    'financial.notReady.body':
      'It has no account to pay into, so a player who picked it would be shown nothing.',
    'financial.notReady.placeholderBody':
      'The only account on it is the one created automatically when this operator was set up. That is a marker, not a wallet: USDT sent to it is never received and nobody can recover it — not even us. Enter your own address before you take a single deposit.',
    'financial.placeholder.title': 'Players are still being sent to the placeholder',
    'financial.placeholder.body':
      'The account created automatically when this operator was set up is still active, so players are still handed it — at least as often as the address you added, because it is offered ahead of it. USDT sent there is never received. Stop it before the next deposit.',
    'financial.placeholder.stop': 'Stop sending players to the placeholder',
    'financial.placeholder.confirmTitle': 'Stop sending players to the placeholder?',
    // Split around the identifier, which stays in its own element so it can be bidi-isolated.
    'financial.placeholder.confirmLead': 'No new deposit will be pointed at',
    'financial.placeholder.confirmRest':
      'Your own address keeps taking them. Nothing is deleted, and any deposit already waiting on it is untouched.',
    'financial.placeholder.stopped': 'The placeholder is off',
    'financial.placeholder.stoppedBody': 'Players are now handed only the addresses you entered.',
    'financial.placeholder.stopFailed': 'Could not stop the placeholder',
    'financial.activate.title': 'This rail is not on the menu yet',
    'financial.activate.body':
      'It has an address now and players are still not offered it. The USDT rails start switched off on purpose — a rail that cannot be priced must not be on the menu. Check the rate at the bottom of this page, then turn it on.',
    'financial.activate.action': 'Activate this rail',
    'financial.activate.done': '{name} is live',
    'financial.activate.doneBody': 'Players are offered it from their next deposit.',
    'financial.activate.failed': 'Could not activate {name}',

    // ── What the wallet behind a rail actually holds ─────────────────────────────────────────
    'rails.walletBalance.label': 'On-chain balance',
    'rails.walletBalance.hint':
      'What the chain reports for this address. It is not the Ichancy float players are credited from.',
    'rails.walletBalance.loading': 'Reading the chain…',
    'rails.walletBalance.checked': 'Checked',
    'rails.walletBalance.refresh': 'Check again',
    'rails.walletBalance.unavailableTitle': 'This balance could not be read',
    // The sentence the whole feature exists for. It has to say what the blank is NOT.
    'rails.walletBalance.unavailableBody':
      'The chain was not reached, so how much this wallet holds is unknown. Unknown is not zero — nothing here says the wallet is empty.',
  },

  ar: {
    'rails.page.description':
      'الطرق التي يختار منها اللاعب، والحسابات التي تُرسل إليها أمواله. رقم حساب خاطئ هنا خسارة مباشرة، لذلك لا يمكن تعديل الرمز ولا القناة ولا العملة ولا رقم الحساب بعد إنشائها.',
    'rails.page.hiddenSelectionTitle': 'هذه الطريقة ليست ضمن القائمة',
    'rails.page.hiddenSelectionBody':
      'الرابط الذي فتحته يشير إلى طريقة تخفيها عوامل التصفية الحالية. امسح عوامل التصفية لرؤيتها ورؤية وجهاتها.',

    'rails.field.code': 'الرمز',
    'rails.field.method': 'الطريقة',
    'rails.field.rail': 'القناة',
    'rails.field.verification': 'التحقق',
    'rails.field.limits': 'الحدود',
    'rails.field.fee': 'العمولة',
    'rails.field.reference': 'المرجع',
    'rails.field.state': 'الوضع',
    'rails.field.order': 'الترتيب',
    'rails.field.actions': 'إجراءات',
    'rails.field.priority': 'الأولوية',
    'rails.field.label': 'التسمية',
    'rails.field.account': 'رقم الحساب',
    'rails.field.accountHolder': 'صاحب الحساب',
    'rails.field.dailyCap': 'الحد اليومي',
    'rails.field.notes': 'ملاحظات',
    'rails.field.minAmount': 'أقل مبلغ',
    'rails.field.maxAmount': 'أكبر مبلغ',
    'rails.field.feeFixed': 'عمولة ثابتة',
    'rails.field.feeBps': 'عمولة نسبية (نقاط أساس)',
    'rails.field.sortOrder': 'ترتيب العرض',
    'rails.field.referencePattern': 'نمط المرجع',
    'rails.field.instructions': 'التعليمات',
    'rails.field.requiresReference': 'المرجع مطلوب',
    'rails.field.requiresProof': 'صورة الإيصال مطلوبة',

    'rails.filter.allRails': 'كل القنوات',
    'rails.filter.anyState': 'النشط والموقوف',
    'rails.filter.activeOnly': 'النشط فقط',
    'rails.filter.inactiveOnly': 'الموقوف فقط',

    'rails.limits.to': 'إلى',
    'rails.fee.none': 'بلا عمولة',
    'rails.reference.required': 'مطلوب',
    'rails.reference.notRequired': 'غير مطلوب',

    'rails.verification.MANUAL_PROOF': 'يقرأ المراجع الإيصال المرفوع.',
    'rails.verification.REFERENCE_MATCH':
      'يكتب اللاعب مرجع العملية من القناة ويُطابَق مع كشف الحساب.',
    'rails.verification.AUTO_STATEMENT': 'تُستورد كشوف الحساب تلقائياً (قنوات مستقبلية).',
    'rails.verification.NONE': 'بلا خطوة تحقق.',

    'rails.method.new': 'طريقة جديدة',
    'rails.method.create': 'إنشاء الطريقة',
    'rails.method.newTitle': 'طريقة دفع جديدة',
    'rails.method.editTitle': 'تعديل {name}',
    'rails.method.createHint':
      'الطريقة هي القناة التي يختارها اللاعب. أما الحسابات التي يدفع إليها فعلياً فتُضاف بعدها كوجهات.',
    'rails.method.editHint': 'ما يراه اللاعبون، والحدود التي يُفحص بها كل إيداع عبر هذه القناة.',
    'rails.method.emptyTitle': 'لا توجد طرق دفع بعد',
    'rails.method.emptyBody':
      'طريقة الدفع هي القناة التي يختارها اللاعب قبل أن يُعرض عليه حساب يدفع إليه.',
    'rails.method.emptyFilteredTitle': 'لا توجد طريقة تطابق هذه التصفية',
    'rails.method.emptyFilteredBody':
      'لا شيء على هذه القناة، أو لا شيء بهذا الوضع. امسح عوامل التصفية لعرضها كلها.',
    'rails.method.showAll': 'عرض كل القنوات',
    'rails.method.addFirst': 'أضف أول طريقة',
    'rails.method.tableCaption': 'طرق الدفع، مع الحدود والعمولات المطبّقة على كل إيداع يمر بها.',
    'rails.method.showDestinations': '، عرض الوجهات',
    'rails.method.deactivateAria': 'إيقاف {name}',
    'rails.method.confirmTitle': 'إيقاف {name}؟',
    'rails.method.thisMethod': 'هذه الطريقة',
    'rails.method.confirmBody':
      'لن تُعرض هذه الطريقة على اللاعبين بعد الآن، ولن تُسلَّم أي من وجهاتها مرة أخرى. الإيداعات المُقدَّمة عبرها تكمل مسارها كالمعتاد، ولا يُحذف شيء — تعديل الطريقة يعيد تشغيلها.',
    'rails.method.deactivated': 'تم إيقاف {name}',
    'rails.method.deactivatedBody': 'لن تُعرض هذه الطريقة على اللاعبين في إيداعهم القادم.',
    'rails.method.deactivateFailed': 'تعذّر إيقاف {name}',
    'rails.method.created': 'تم إنشاء {name}',
    'rails.method.createdBody': 'أضف وجهة واحدة على الأقل قبل أن يتمكن اللاعبون من الدفع إليها.',
    'rails.method.saved': 'تم حفظ {name}',
    'rails.method.savedBody': 'الحدود الجديدة تسري على الإيداعات التي تبدأ من الآن.',
    'rails.method.createFailed': 'تعذّر إنشاء الطريقة',
    'rails.method.saveFailed': 'تعذّر حفظ الطريقة',

    'rails.destination.title': 'الوجهات',
    'rails.destination.titleFor': 'وجهات {name}',
    'rails.destination.description':
      'الحسابات التي تُسلَّم للاعب بعد اختياره هذه الطريقة، مرتّبة حسب الأولوية.',
    'rails.destination.count': {
      zero: 'لا حسابات',
      one: 'حساب واحد',
      two: 'حسابان',
      few: '{count} حسابات',
      many: '{count} حساباً',
      other: '{count} حساب',
    },
    'rails.destination.includeInactive': 'إظهار الموقوفة',
    'rails.destination.add': 'إضافة وجهة',
    'rails.destination.addFirst': 'أضف أول وجهة',
    'rails.destination.noMethodTitle': 'لم تُختر أي طريقة',
    'rails.destination.noMethodBody':
      'اختر طريقة دفع من الأعلى لترى الحسابات التي يُرسَل إليها لاعبوها.',
    'rails.destination.emptyTitle': 'لا توجد وجهات لهذه الطريقة',
    'rails.destination.emptyBody':
      'لا يستطيع أحد الإيداع عبر هذه القناة قبل أن يكون لها حساب يدفع إليه.',
    'rails.destination.emptyActiveTitle': 'لا توجد وجهات نشطة لهذه الطريقة',
    'rails.destination.emptyActiveBody': 'قد تكون هناك وجهات موقوفة. فعّل «إظهار الموقوفة» لعرضها.',
    'rails.destination.tableCaption': 'وجهات {name}، بالترتيب الذي تُعرض به على اللاعبين.',
    'rails.destination.newTitle': 'وجهة جديدة لـ {name}',
    'rails.destination.editTitle': 'تعديل {name}',
    'rails.destination.createHint':
      'اللاعب الذي يختار هذه الطريقة يُسلَّم إحدى وجهاتها. طابِق رقم الحساب مع كشف البنك قبل الحفظ.',
    'rails.destination.editHint': 'كل ما يخص هذا الحساب عدا رقم الحساب نفسه.',
    'rails.destination.deactivateAria': 'إيقاف {name}',
    'rails.destination.confirmTitle': 'إيقاف {name}؟',
    'rails.destination.thisDestination': 'هذه الوجهة',
    'rails.destination.confirmLead': 'لن تُوجَّه الإيداعات الجديدة بعد الآن إلى',
    'rails.destination.confirmRest':
      'الإيداعات التي تنتظره تحتفظ به، فيبقى كل ما هو قيد التنفيذ قابلاً للتسوية. ولا يُحذف شيء.',
    'rails.destination.deactivated': 'تم إيقاف {name}',
    'rails.destination.deactivatedBody': 'لن يُوجَّه أي إيداع جديد إلى هذا الحساب.',
    'rails.destination.deactivateFailed': 'تعذّر إيقاف {name}',
    'rails.destination.added': 'تمت إضافة {name}',
    'rails.destination.addedBody': 'صار بالإمكان تسليم هذا الحساب للاعبين الذين يختارون {method}.',
    'rails.destination.saved': 'تم حفظ {name}',
    'rails.destination.savedBody': 'رقم الحساب نفسه لم يتغيّر.',
    'rails.destination.addFailed': 'تعذّرت إضافة الوجهة',
    'rails.destination.saveFailed': 'تعذّر حفظ الوجهة',

    'rails.form.saveFailedTitle': 'لم يُحفظ',
    'rails.form.saveChanges': 'حفظ التعديلات',
    'rails.form.codeHint': 'هكذا سيشير كل إيداع وكل قيد محاسبي إلى هذه الطريقة.',
    'rails.form.codeLocked': 'هناك إيداعات تشير إلى هذا الرمز، وتغييره يقطع صلتها بها.',
    'rails.form.namePlaceholder': 'حوالة بنكية',
    'rails.form.railLocked':
      'القناة تحدد كيف يصل المال فعلياً، فالقناة المختلفة تعني طريقة مختلفة.',
    'rails.form.currencyHint': 'رمز من ثلاثة أحرف كبيرة.',
    'rails.form.currencyLocked': 'الدفاتر تحتفظ بأرصدة هذه الطريقة بهذه العملة.',
    'rails.form.minHint': 'أصغر إيداع تقبله هذه الطريقة.',
    'rails.form.maxHint': 'أكبر إيداع تقبله هذه الطريقة.',
    'rails.form.feeFixedHint': 'تُقتطع من كل إيداع، فوق النسبة المئوية.',
    'rails.form.feeBpsHint': '100 نقطة أساس تساوي 1%، و10000 تعني الإيداع كله.',
    'rails.form.sortOrderHint': 'الرقم الأصغر يظهر أولاً في قائمة اللاعب.',
    'rails.form.referencePatternHint':
      'تعبير نمطي اختياري يجب أن يطابقه مرجع اللاعب. لا يُقرأ إلا عندما يكون المرجع مطلوباً.',
    'rails.form.instructionsHint': 'تُعرض للاعب في البوت كما هي حرفياً.',
    'rails.form.instructionsPlaceholder': 'حوّل إلى الحساب الظاهر، ثم ارفع صورة الإيصال.',
    'rails.form.requiresReferenceHint':
      'على اللاعب كتابة مرجع العملية من القناة قبل أن يتمكن من الإرسال.',
    'rails.form.requiresProofHint':
      'على اللاعب إرفاق صورة الإيصال. لا توقف هذا الخيار إلا عندما يكون المرجع مطلوباً — يمكن ' +
      'مطابقة المرجع مع كشف الحساب ولا يمكن استخدامه مرتين، أما الطلب بلا صورة وبلا مرجع فلا ' +
      'يترك للمراجع شيئاً يفحصه.',
    'rails.form.methodActiveHint': 'الطريقة الموقوفة تبقى مسجّلة لكنها لا تُعرض على اللاعبين.',
    'rails.form.labelHint': 'للاستخدام الداخلي: هكذا يشير الموظفون إلى هذا الحساب.',
    'rails.form.labelPlaceholder': 'حساب الفرع الرئيسي',
    'rails.form.priorityHint': 'الرقم الأصغر يُعرض أولاً ما دام الحساب دون حدّه اليومي.',
    'rails.form.accountHint':
      'رقم الآيبان أو رقم المحفظة أو رمز المكتب الذي سيدفع إليه اللاعبون. أعد قراءته قبل الحفظ.',
    'rails.form.accountLocked':
      'تعديله يحوّل أموال اللاعبين بصمت إلى حساب آخر. أضف وجهة جديدة وأوقف هذه بدلاً من ذلك.',
    'rails.form.accountHolderHint': 'الاسم الذي سيراه اللاعب في الطرف المستلم.',
    'rails.form.accountHolderPlaceholder': 'شركة الصرّاف القابضة',
    'rails.form.dailyCapHint':
      'بعملة {currency}. اتركه فارغاً لبلا حدّ؛ والحد المضبوط سابقاً يمكن تغييره هنا لا إزالته.',
    'rails.form.notesHint': 'للموظفين فقط. لا يراها اللاعبون أبداً.',
    'rails.form.notesPlaceholder': 'استخدمه للمبالغ فوق 500,000.',
    'rails.form.destinationActiveHint':
      'الوجهة الموقوفة لا تُسلَّم للاعب أبداً، لكنها تبقى مرتبطة بالإيداعات التي استخدمتها.',

    'rails.validation.required': 'مطلوب.',
    'rails.validation.tooLong': 'طويل جداً.',
    'rails.validation.wholeNumber': 'أرقام صحيحة فقط.',
    'rails.validation.atMost': '{max} على الأكثر.',
    'rails.validation.amountFormat': 'رقم عشري بسيط، مثل 50000.00 — بلا فواصل وبلا رمز عملة.',
    'rails.validation.amountNegative': 'لا يمكن أن يكون المبلغ سالباً.',
    'rails.validation.amountScale': 'منزلتان عشريتان على الأكثر.',
    'rails.validation.code':
      'بصيغة SCREAMING_SNAKE_CASE: من حرفين إلى 48 حرفاً، يبدأ بحرف ثم حروف أو أرقام أو شرطات سفلية.',
    'rails.validation.displayName': 'اللاعبون يرون هذا الاسم، فلا يمكن تركه فارغاً.',
    'rails.validation.currency': 'ثلاثة أحرف كبيرة، مثل NSP.',
    'rails.validation.maxBelowMin':
      'يجب ألا يقل الحد الأعلى عن الحد الأدنى، وإلا لن يستطيع أحد الإيداع.',
    'rails.validation.destinationLabel': 'الصرّافون يختارون هذا الحساب من تسميته.',
    'rails.validation.accountRequired':
      'هذا هو الرقم الذي سيدفع إليه اللاعبون. لا يمكن تركه فارغاً.',
    'rails.validation.walletShape':
      'هذا ليس عنوان محفظة. عنوان TRC20 من 34 خانة ويبدأ بحرف T، وعنوان BEP20 من 42 خانة ويبدأ بـ 0x. الصقه مرة أخرى من تطبيق محفظتك.',
    'rails.form.walletHint':
      'الصقه من تطبيق محفظتك ولا تكتبه يدوياً. ثم أعد قراءة كل حرف منه على هاتفك قبل الحفظ: لا يمكن تعديله لاحقاً، وأي USDT يُرسل إلى عنوان خاطئ يضيع.',
    'rails.form.walletConfirm': 'راجعتُ هذا العنوان وطابقته مع تطبيق محفظتي',
    'rails.form.walletDetected':
      'هذا عنوان {network}. سيُطلب من اللاعبين على هذه القناة الإرسال على شبكة {network}، وأي USDT يُرسل على شبكة أخرى يضيع.',
    'rails.validation.walletUnconfirmed':
      'طابق العنوان مع تطبيق محفظتك ثم علّم الخانة. كل لاعب على هذه القناة سيدفع إليه.',
    'rails.validation.capFormat': 'رقم عشري بسيط، مثل 20000000.00 — أو اتركه فارغاً لبلا حدّ.',
    'rails.validation.capNegative': 'لا يمكن أن يكون الحد سالباً.',

    'rails.rate.title': 'سعر صرف USDT',
    'rails.rate.description':
      'كم يساوي USDT واحد. يُضرب بهذا الرقم كل إيداع على قنوات USDT، فاقرأ المثال أدناه قبل الحفظ — خطأ الفاصلة العشرية لا يُرى في السعر ويُرى في المبلغ المُضاف.',
    'rails.rate.field': 'USDT واحد يساوي',
    'rails.rate.noteField': 'من أين قرأته (اختياري)',
    'rails.rate.noteHint': 'يُحفظ مع السعر، ليتسنى التحقق من أي إضافة لاحقاً من المصدر نفسه.',
    'rails.rate.setLabel': 'حُدِّد',
    'rails.rate.submit': 'حفظ السعر',
    'rails.rate.submitConfirm': 'نعم، احفظ هذا السعر',
    'rails.rate.saved': 'حُفظ السعر. الإيداعات من الآن تُسعَّر به.',
    'rails.rate.readOnly': 'دورك يرى هذا السعر ولا يغيّره.',
    'rails.rate.noneTitle': 'لا يوجد سعر محدَّد',
    'rails.rate.noneBody':
      'قنوات USDT لا تستطيع تسعير أي إيداع قبل تحديده، ولا تُعرض على اللاعبين حتى ذلك الحين.',
    'rails.rate.staleTitle': 'هذا السعر قديم ولا يصلح للاستخدام',
    'rails.rate.staleBody':
      'قنوات USDT ترفض الإيداعات بدل تسعيرها برقم قديم. السعر صالح {hours} ساعة؛ حدِّد سعراً حالياً.',
    'rails.rate.previewTitle': 'تحقّق من هذا قبل الحفظ',
    'rails.rate.previewHint': 'ما سيُضاف للاعب بالضبط، بالحساب نفسه الذي يستخدمه الخادم.',
    'rails.rate.previewEmpty': 'أدخل سعراً لترى ما سيُضاف.',
    'rails.rate.jumpTitle': 'هذا بعيد كثيراً عن السعر الحالي',
    'rails.rate.jumpBody':
      'أبعد مما يتحرك السعر عادةً. تحقّق من الفاصلة العشرية، وتحقّق من أنك لم تخلط بين الليرة الجديدة والقديمة — بينهما فرق مئة ضعف. اضغط مرة أخرى فقط إذا كان صحيحاً فعلاً.',

    'financial.page.description':
      'كل طريقة يستطيع اللاعب الدفع بها، والحسابات التي تدفع إليها كل طريقة، والسعر الذي يُسعَّر به كل إيداع USDT.',
    'financial.methods.emptyTitle': 'لا توجد طريقة دفع لدى هذا المشغّل',
    'financial.methods.emptyBody':
      'لا يمكن استقبال أي مبلغ قبل وجود طريقة واحدة على الأقل. أنشئها من شاشة قنوات الدفع، ثم أدخل هنا الحساب الذي تدفع إليه.',
    'financial.card.description':
      'الحسابات التي يُطلب من اللاعبين الدفع إليها عند اختيار هذه الطريقة.',
    'financial.card.cryptoDescription':
      'اللاعب الذي يختار هذه الطريقة يرسل USDT إلى العنوان أدناه، على الشبكة التي ينتمي إليها ذلك العنوان.',
    'financial.address.heading': 'عنوان المحفظة',
    'financial.address.emptyTitle': 'لا يوجد عنوان محفظة بعد',
    'financial.address.emptyBody':
      'الصقه من تطبيق محفظتك. قبل وجوده هنا لا يستطيع أحد الدفع على هذه القناة.',
    'financial.address.set': 'أدخل عنوان المحفظة',
    'financial.address.addAnother': 'أضف عنواناً آخر',
    'financial.account.heading': 'الحسابات التي يدفع إليها اللاعبون',
    'financial.account.emptyTitle': 'لا يوجد حساب بعد',
    'financial.account.emptyBody':
      'أدخل الحساب الذي سيدفع إليه اللاعبون. قبل وجوده هنا لن يُعرض شيء على من يختار هذه الطريقة.',
    'financial.account.set': 'أدخل الحساب',
    'financial.account.addAnother': 'أضف حساباً آخر',
    'financial.balance.untracked': 'لا يوجد رصيد متابَع لهذا الحساب بعد.',
    'financial.declared.recordedLabel': 'الرصيد المُسجَّل',
    'financial.declared.updatedAt': 'حُدّث {when}',
    'financial.declared.add': 'أضف رصيداً',
    'financial.declared.title': 'الرصيد المُسجَّل — {name}',
    'financial.declared.hint':
      'رصيد تُدخله يدوياً لحساب لا يمكن سؤال أي شبكة أو واجهة برمجية عنه. يظهر مع وقت آخر تحديث، ولا يُحرّك أي أموال بنفسه.',
    'financial.declared.amountLabel': 'المبلغ',
    'financial.declared.amountHint': 'كما تقرأه من الحساب. اتركه فارغاً لإزالة الرصيد المُسجَّل.',
    'financial.declared.currencyLabel': 'العملة',
    'financial.declared.amountFormat': 'مبلغ بسيط، مثل 200 أو 2000000.00.',
    'financial.declared.amountNegative': 'لا يمكن أن يكون الرصيد سالباً.',
    'financial.declared.currencyFormat': 'رمز من 2 إلى 8 أحرف، مثل USD أو NSP.',
    'financial.declared.pairRequired': 'أدخل المبلغ وعملته معاً، أو اترك كليهما فارغين لإزالته.',
    'financial.declared.clearNote': 'ترك الحقلين فارغين يزيل الرصيد المُسجَّل.',
    'financial.declared.saved': 'حُدّث الرصيد المُسجَّل',
    'financial.declared.cleared': 'أُزيل الرصيد المُسجَّل',
    'financial.declared.saveFailed': 'لم يُحفظ الرصيد',
    'financial.shamcash.title': 'حساب شام كاش',
    'financial.shamcash.description':
      'اربط حساب شام كاش عبر جلسة المتصفح، ليُقرأ الرصيد هنا.',
    'financial.shamcash.linkedBadge': 'مربوط',
    'financial.shamcash.notLinkedBadge': 'غير مربوط',
    'financial.shamcash.linkedSince': 'رُبط {when}.',
    'financial.shamcash.howTitle': 'من أين تأتي هذه القيم',
    'financial.shamcash.howBody':
      'على shamcash.sy وأنت مسجّل الدخول، افتح أدوات المطوّر → Application. من Cookies → shamcash.sy انسخ accessToken وauthToken وforge؛ ومن Local Storage → shamcash.sy انسخ shamcash-pin-code-hash. إنها جلسة دخول — الصقها هنا فقط لا غير.',
    'financial.shamcash.accessTokenLabel': 'كوكي accessToken',
    'financial.shamcash.authTokenLabel': 'كوكي authToken',
    'financial.shamcash.forgeLabel': 'كوكي forge',
    'financial.shamcash.forgeHint': 'اختياري، لكن الصقه إن وُجد.',
    'financial.shamcash.pinCodeHashLabel': 'shamcash-pin-code-hash',
    'financial.shamcash.pinCodeHashHint':
      'من Local Storage وليس من الكوكيز. لن يُحمَّل الحساب بدونه.',
    'financial.shamcash.accessTokenRequired': 'الصق قيمة كوكي accessToken.',
    'financial.shamcash.authTokenRequired': 'الصق قيمة كوكي authToken.',
    'financial.shamcash.pinCodeHashRequired':
      'الصق shamcash-pin-code-hash من Local Storage — تبقى الصفحة فارغة بدونه.',
    'financial.shamcash.pinLabel': 'رمز PIN',
    'financial.shamcash.pinHint':
      'رمز PIN المكوّن من 4 أرقام الذي تُدخله في شام كاش بعد تسجيل الدخول. مطلوب لقراءة الرصيد.',
    'financial.shamcash.pinRequired': 'أدخل رمز PIN المكوّن من 4 أرقام.',
    'financial.shamcash.link': 'اربط الحساب',
    'financial.shamcash.relink': 'حدّث الجلسة',
    'financial.shamcash.unlink': 'إلغاء الربط',
    'financial.shamcash.linked': 'تم ربط حساب شام كاش',
    'financial.shamcash.linkedBody': 'يمكن الآن قراءة الرصيد من جلستك.',
    'financial.shamcash.linkFailed': 'تعذّر ربط الحساب',
    'financial.shamcash.unlinked': 'أُلغي ربط حساب شام كاش',
    'financial.shamcash.unlinkFailed': 'تعذّر إلغاء ربط الحساب',
    'financial.shamcash.check': 'تحقّق من الرصيد',
    'financial.shamcash.checkFailed': 'تعذّر التحقّق من الرصيد',
    'financial.shamcash.locked': 'محجوز: {amount}',
    'financial.shamcash.recent': 'آخر التحويلات',
    'financial.shamcash.expiredTitle': 'انتهت الجلسة',
    'financial.shamcash.expiredBody':
      'انتهت صلاحية جلسة شام كاش. الصق مجموعة كوكيز جديدة أعلاه لإعادة الربط.',
    'financial.shamcash.unavailableTitle': 'تعذّرت قراءة الرصيد',
    'financial.notReady.title': 'هذه القناة غير جاهزة لاستقبال الأموال',
    'financial.notReady.body':
      'لا يوجد عليها حساب للدفع إليه، واللاعب الذي يختارها لن يُعرض عليه شيء.',
    'financial.notReady.placeholderBody':
      'الحساب الوحيد عليها هو الحساب الذي أُنشئ تلقائياً عند تجهيز هذا المشغّل. هذا علامة وليس محفظة: أي USDT يُرسل إليه لا يصل إلى أحد ولا يستطيع أحد استرجاعه، ولا نحن. أدخل عنوانك قبل أن تقبل أي إيداع.',
    'financial.placeholder.title': 'اللاعبون ما زالوا يُوجَّهون إلى الحساب المؤقت',
    'financial.placeholder.body':
      'الحساب الذي أُنشئ تلقائياً عند تجهيز هذا المشغّل ما زال نشطاً، فما زال يُعطى للاعبين — بمعدل لا يقل عن العنوان الذي أضفته، لأنه يُعرض قبله. أي USDT يُرسل إليه لا يصل إلى أحد. أوقفه قبل الإيداع التالي.',
    'financial.placeholder.stop': 'أوقف توجيه اللاعبين إلى الحساب المؤقت',
    'financial.placeholder.confirmTitle': 'إيقاف توجيه اللاعبين إلى الحساب المؤقت؟',
    'financial.placeholder.confirmLead': 'لن يُوجَّه أي إيداع جديد إلى',
    'financial.placeholder.confirmRest':
      'عنوانك يبقى يستقبلها. لا يُحذف شيء، وأي إيداع معلّق عليه يبقى كما هو.',
    'financial.placeholder.stopped': 'أُوقف الحساب المؤقت',
    'financial.placeholder.stoppedBody': 'لن يُعطى اللاعبون سوى العناوين التي أدخلتها.',
    'financial.placeholder.stopFailed': 'تعذّر إيقاف الحساب المؤقت',
    'financial.activate.title': 'هذه القناة ليست معروضة على اللاعبين بعد',
    'financial.activate.body':
      'صار لها عنوان ومع ذلك لا تُعرض على اللاعبين. قنوات USDT تبدأ موقوفة عن قصد — قناة لا يمكن تسعيرها يجب ألّا تكون على القائمة. تأكّد من السعر في أسفل هذه الصفحة ثم شغّلها.',
    'financial.activate.action': 'تشغيل هذه القناة',
    'financial.activate.done': '{name} تعمل الآن',
    'financial.activate.doneBody': 'ستُعرض على اللاعبين ابتداءً من الإيداع التالي.',
    'financial.activate.failed': 'تعذّر تشغيل {name}',

    'rails.walletBalance.label': 'الرصيد على الشبكة',
    'rails.walletBalance.hint':
      'ما تُظهره الشبكة لهذا العنوان. ليس رصيد الوكيل لدى Ichancy الذي يُضاف منه للاعبين.',
    'rails.walletBalance.loading': 'جارٍ قراءة الشبكة…',
    'rails.walletBalance.checked': 'قُرئ',
    'rails.walletBalance.refresh': 'أعد القراءة',
    'rails.walletBalance.unavailableTitle': 'تعذّرت قراءة هذا الرصيد',
    'rails.walletBalance.unavailableBody':
      'لم يُتَّصل بالشبكة، فما تحمله هذه المحفظة غير معروف. غير معروف لا يعني صفراً — لا شيء هنا يقول إن المحفظة فارغة.',
  },
});

/**
 * The translator these screens hand to their zod factories. The schemas are built at render, not at
 * module load, so a message is in the language the operator is reading right now.
 */
export type RailTranslator = Translator<typeof railMessages.en>;
