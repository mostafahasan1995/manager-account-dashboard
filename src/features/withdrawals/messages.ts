import { defineMessages } from '@/lib/i18n/messages';
import type { Translator } from '@/lib/i18n/use-translation';

/**
 * Everything the withdrawal queue, its detail panel and its three dialogs say out loud.
 *
 * Same register as the deposit queue's bundle — a cashier's, not a lawyer's. The one word this
 * screen has to get right in both languages is DEBITED: the player has been charged and nobody has
 * been paid. English calls that state "Ready to pay" (the shared enum label) and every sentence
 * here that touches it says who still owes what, because a row that reads as finished when money
 * is still owed is the one mistake this screen must never make.
 *
 * Short ids, addresses, references, ledger ids and every amount stay exactly as the backend sent
 * them, in Western digits, in both languages: this screen is read next to a wallet app.
 */
export const withdrawalMessages = defineMessages({
  en: {
    // ── The queue screen ─────────────────────────────────────────────────────────────────────
    'withdrawals.description':
      'Player cash-outs: what is waiting for a decision, what has been debited and is ready to pay, and what was paid.',
    'withdrawals.queue.refreshing': 'Refreshing…',
    'withdrawals.queue.notLoaded': 'Not loaded yet',
    'withdrawals.queue.updated': 'Live · updated {time}',
    'withdrawals.queue.settled': 'Updated {time} · nothing here is still moving',
    'withdrawals.queue.showAll': 'Show the open queue',

    // ── The table ────────────────────────────────────────────────────────────────────────────
    'withdrawals.table.caption':
      'Withdrawals still moving, newest first unless another sort is chosen',
    'withdrawals.table.emptyBody':
      'No withdrawal matches these filters. Widen them, or come back when the next request lands.',
    'withdrawals.copyShortId': 'Copy short ID {shortId}',
    'withdrawals.copyAddress': 'Copy payout address',
    'withdrawals.feePrefix': 'fee',
    'withdrawals.player.noUsername': 'No Telegram username',
    'withdrawals.player.noTelegramId': 'Telegram id unknown',
    'withdrawals.player.login': 'Ichancy login',
    'withdrawals.player.open': 'Open player',
    'withdrawals.walletCheck.notTaken': 'Not checked',

    // ── Fields ───────────────────────────────────────────────────────────────────────────────
    'withdrawals.field.shortId': 'Short ID',
    'withdrawals.field.method': 'Method',
    'withdrawals.field.payoutAddress': 'Payout address',
    'withdrawals.field.network': 'Network',
    'withdrawals.field.mode': 'Mode',
    'withdrawals.field.walletCheck': 'Wallet check',
    'withdrawals.field.requested': 'Requested',
    'withdrawals.field.playerId': 'Player id',
    'withdrawals.field.fee': 'Fee',
    'withdrawals.field.balanceAtRequest': 'Balance when asked',
    'withdrawals.field.source': 'Came from',
    'withdrawals.field.debitId': 'Debit id',
    'withdrawals.field.ledgerTx': 'Ledger payout',
    'withdrawals.field.payoutReference': 'Payout reference',
    'withdrawals.field.decidedBy': 'Decided by',
    'withdrawals.field.paidBy': 'Paid by',
    'withdrawals.field.withdrawalId': 'Withdrawal id',
    'withdrawals.field.paymentMethodId': 'Payment method id',
    'withdrawals.field.failureCode': 'Failure code',
    'withdrawals.field.failureMessage': 'What Ichancy said',
    'withdrawals.field.available': 'Wallet holds',
    'withdrawals.field.checkedAt': 'Checked',

    // ── Filters ──────────────────────────────────────────────────────────────────────────────
    'withdrawals.filters.open': 'Still moving',
    'withdrawals.filters.readyToPay': 'Ready to pay',
    'withdrawals.filters.attention': 'Needs a person',
    'withdrawals.filters.all': 'Everything',
    'withdrawals.filters.sort': 'Sort',
    'withdrawals.filters.createdFrom': 'Requested from',
    'withdrawals.filters.createdTo': 'Requested to',
    'withdrawals.filters.statusHint':
      'Untick everything to go back to the open queue. "Ready to pay" means the player has been charged and nobody has been paid yet.',

    // ── The detail panel ─────────────────────────────────────────────────────────────────────
    'withdrawals.sheet.title': 'Withdrawal {shortId}',
    'withdrawals.sheet.loading': 'Loading the withdrawal…',
    'withdrawals.sheet.summary': '{status} · {mode} mode · {method}',
    'withdrawals.section.money': 'Money',
    'withdrawals.section.payout': 'Where to send it',
    'withdrawals.section.player': 'Player',
    'withdrawals.section.walletCheck': 'The payout wallet',
    'withdrawals.section.ledger': 'Records',
    'withdrawals.section.failure': 'Why the debit did not land',
    'withdrawals.section.rejection': 'Why it was rejected',
    'withdrawals.section.timeline': 'Timeline',
    'withdrawals.nobodyYet': 'Nobody yet',
    'withdrawals.platform': 'The platform (automatic mode)',
    'withdrawals.source.unknown': 'Not recorded',
    'withdrawals.mode.autoHint':
      'Automatic mode: the platform approves and debits by itself, then checks the payout wallet. A person still sends the money and marks it paid.',
    'withdrawals.mode.manualHint':
      'Manual mode: nothing moves until a person approves. The debit follows the approval; the payout is still sent by hand.',
    'withdrawals.walletCheck.none':
      'Not checked yet. The payout wallet is read once, right after the player has been debited.',
    'withdrawals.walletCheck.noFigure':
      'No figure: a wallet that did not answer is not an empty wallet.',
    'withdrawals.walletCheck.insufficientBody':
      'The wallet held less than this payout when it was checked. Top it up, or pay from elsewhere, before marking this paid.',

    // ── The timeline ─────────────────────────────────────────────────────────────────────────
    'withdrawals.timeline.step.requested': 'Requested',
    'withdrawals.timeline.step.decided': 'Decided',
    'withdrawals.timeline.step.debited': 'Debited',
    'withdrawals.timeline.step.paid': 'Paid',
    'withdrawals.timeline.requested': 'The player asked for this amount.',
    'withdrawals.timeline.awaitingDecision': 'Waiting for a person to approve or reject.',
    'withdrawals.timeline.approvedByAdmin': 'Approved by an admin.',
    'withdrawals.timeline.approvedByPlatform': 'Approved by the platform — automatic mode.',
    'withdrawals.timeline.rejected': 'Rejected. Nothing was taken from the player.',
    'withdrawals.timeline.cancelled': 'The player cancelled before anyone decided.',
    'withdrawals.timeline.debitQueued': 'The debit is queued; the worker has not run it yet.',
    'withdrawals.timeline.debiting': 'The worker is taking the amount from the player now.',
    'withdrawals.timeline.debited':
      'The casino balance was reduced. The player is owed the payout.',
    'withdrawals.timeline.debitFailed': 'Ichancy refused the debit. Nothing moved.',
    'withdrawals.timeline.needsReconciliation':
      'Ichancy neither confirmed nor denied the debit. Check Ichancy by hand; nothing retries.',
    'withdrawals.timeline.notReached': 'Not reached.',
    'withdrawals.timeline.awaitingPayout':
      'Waiting for a person to send the money and mark it paid.',
    'withdrawals.timeline.paid': 'The money was sent and the payout posted to the ledger.',

    // ── Actions ──────────────────────────────────────────────────────────────────────────────
    'withdrawals.actions.readOnly': 'Your role can read withdrawals but not decide them.',
    'withdrawals.actions.settled': '{status} — nothing more to do here.',
    'withdrawals.actions.approve': 'Approve',
    'withdrawals.actions.reject': 'Reject',
    'withdrawals.actions.markPaid': 'Mark paid',
    'withdrawals.actions.debitedTitle': 'The player has been charged. Nobody has been paid.',
    'withdrawals.actions.debitedBody':
      'Send {amount} to the address above, then record the transfer reference here. Until you do, this row stays open.',
    'withdrawals.actions.inFlightTitle': 'The worker has it',
    'withdrawals.actions.inFlightBody':
      'The debit is in progress. Nothing to do until it lands; this panel refreshes on its own.',
    'withdrawals.actions.attentionTitle': 'A person has to look at Ichancy',
    'withdrawals.actions.attentionBody':
      'This console cannot retry a debit. Read the failure below, check the player in Ichancy, and settle it from there.',

    // ── Approve ──────────────────────────────────────────────────────────────────────────────
    'withdrawals.approve.title': 'Approve withdrawal {shortId}?',
    'withdrawals.approve.description':
      '{player} asked to cash out {amount} to {method}. Approving starts the debit; it does not send any money.',
    'withdrawals.approve.manualBody':
      'Manual mode: nothing has moved yet. Your approval takes {amount} from the player’s casino balance, then the row shows as "Ready to pay" with what the payout wallet holds — and a person sends the money and marks it paid.',
    'withdrawals.approve.autoBody':
      'Automatic mode: the platform normally approves these by itself, but this one is still waiting on a person. Your approval takes {amount} from the player’s casino balance, then the row shows as "Ready to pay" — and a person still sends the money and marks it paid.',
    'withdrawals.approve.balanceNote': 'The player held {balance} when they asked.',
    'withdrawals.approve.confirm': 'Approve and debit {amount}',

    // ── Reject ───────────────────────────────────────────────────────────────────────────────
    'withdrawals.reject.title': 'Reject withdrawal {shortId}?',
    'withdrawals.reject.description':
      'Nothing has been taken from the player. The reason is what the player is told, and what whoever answers the complaint reads later.',
    'withdrawals.reject.reasonPlaceholder': 'Why this cash-out is refused, in plain words',
    'withdrawals.reject.reasonRequired': 'Say why. A rejection without a reason cannot be sent.',
    'withdrawals.reject.reasonTooLong': 'Keep the reason under {max} characters.',
    'withdrawals.reject.confirm': 'Reject withdrawal',

    // ── Mark paid ────────────────────────────────────────────────────────────────────────────
    'withdrawals.markPaid.title': 'Mark withdrawal {shortId} paid',
    'withdrawals.markPaid.description':
      'Only after you have actually sent the money. This posts the payout to the ledger against the reference you type, and the row closes as paid.',
    'withdrawals.markPaid.sendThis': 'Send',
    'withdrawals.markPaid.toThis': 'To',
    'withdrawals.markPaid.referenceLabel': 'Payout reference',
    'withdrawals.markPaid.referenceHint':
      'The transaction hash, the Sham Cash operation number, or the bank reference — whatever proves the transfer.',
    'withdrawals.markPaid.referencePlaceholder': 'e.g. TRX-88112 or a tx hash',
    'withdrawals.markPaid.referenceRequired': 'Type the reference of the transfer you made.',
    'withdrawals.markPaid.referenceTooLong': 'Keep the reference under {max} characters.',
    'withdrawals.markPaid.continue': 'Continue',
    'withdrawals.markPaid.back': 'Back',
    'withdrawals.markPaid.confirmTitle': 'Post the payout to the ledger?',
    'withdrawals.markPaid.confirmBody':
      'You are recording that {amount} was sent to {address} under reference {reference}. This cannot be undone from this console.',
    'withdrawals.markPaid.confirm': 'Yes, it was paid',
    'withdrawals.markPaid.walletShort':
      'The payout wallet was short when it was checked. Only confirm if you paid from somewhere that had the money.',

    // ── Results ──────────────────────────────────────────────────────────────────────────────
    'withdrawals.toast.approvedTitle': '{shortId} approved',
    'withdrawals.toast.approvedBody':
      'The debit is queued. The row will show as ready to pay once it lands.',
    'withdrawals.toast.debitedTitle': '{shortId} debited — ready to pay',
    'withdrawals.toast.debitedBody':
      'The player has been charged {amount}. Send it to the payout address, then mark it paid. {walletCheck}.',
    'withdrawals.toast.debitFailedTitle': '{shortId}: the debit was refused',
    'withdrawals.toast.debitFailedBody': 'Nothing moved. {message}',
    'withdrawals.toast.reconcileTitle': '{shortId} needs reconciliation',
    'withdrawals.toast.reconcileBody':
      'Ichancy neither confirmed nor denied the debit. Check the player in Ichancy before anything else.',
    'withdrawals.toast.rejectedTitle': '{shortId} rejected',
    'withdrawals.toast.rejectedBody': 'The player keeps their balance and is told why.',
    'withdrawals.toast.paidTitle': '{shortId} marked paid',
    'withdrawals.toast.paidBody': 'Payout posted to the ledger as {transaction}.',
    'withdrawals.toast.changedTitle': '{shortId} is now {status}',
    'withdrawals.toast.changedBody': 'The server answered with a state this screen did not expect.',
    'withdrawals.toast.alreadyTitle': 'Already handled',
    'withdrawals.toast.alreadyBody':
      'Somebody got to {shortId} first. The panel now shows its current state.',
    'withdrawals.error.approve': 'The withdrawal could not be approved',
    'withdrawals.error.reject': 'The withdrawal could not be rejected',
    'withdrawals.error.markPaid': 'The payout could not be recorded',
    'withdrawals.charCount': '{count} / {max}',
  },

  ar: {
    'withdrawals.description':
      'سحوبات اللاعبين: ما ينتظر قراراً، وما خُصم وصار جاهزاً للدفع، وما دُفع فعلاً.',
    'withdrawals.queue.refreshing': 'جارٍ التحديث…',
    'withdrawals.queue.notLoaded': 'لم تُحمَّل بعد',
    'withdrawals.queue.updated': 'مباشر · آخر تحديث {time}',
    'withdrawals.queue.settled': 'آخر تحديث {time} · لا شيء هنا ما زال يتحرك',
    'withdrawals.queue.showAll': 'عرض القائمة المفتوحة',

    'withdrawals.table.caption': 'السحوبات التي ما زالت تتحرك، الأحدث أولاً ما لم يُختر ترتيب آخر',
    'withdrawals.table.emptyBody':
      'لا يوجد سحب يطابق هذه الفلاتر. وسّعها، أو عُد حين يصل الطلب التالي.',
    'withdrawals.copyShortId': 'نسخ المعرّف القصير {shortId}',
    'withdrawals.copyAddress': 'نسخ عنوان الدفع',
    'withdrawals.feePrefix': 'رسوم',
    'withdrawals.player.noUsername': 'لا يوجد اسم مستخدم Telegram',
    'withdrawals.player.noTelegramId': 'معرّف Telegram غير معروف',
    'withdrawals.player.login': 'حساب Ichancy',
    'withdrawals.player.open': 'فتح اللاعب',
    'withdrawals.walletCheck.notTaken': 'لم تُفحص',

    'withdrawals.field.shortId': 'المعرّف القصير',
    'withdrawals.field.method': 'الطريقة',
    'withdrawals.field.payoutAddress': 'عنوان الدفع',
    'withdrawals.field.network': 'الشبكة',
    'withdrawals.field.mode': 'الوضع',
    'withdrawals.field.walletCheck': 'فحص المحفظة',
    'withdrawals.field.requested': 'وقت الطلب',
    'withdrawals.field.playerId': 'معرّف اللاعب',
    'withdrawals.field.fee': 'الرسوم',
    'withdrawals.field.balanceAtRequest': 'الرصيد عند الطلب',
    'withdrawals.field.source': 'مصدر الطلب',
    'withdrawals.field.debitId': 'معرّف الخصم',
    'withdrawals.field.ledgerTx': 'قيد الدفع في الدفاتر',
    'withdrawals.field.payoutReference': 'مرجع الدفع',
    'withdrawals.field.decidedBy': 'قرّره',
    'withdrawals.field.paidBy': 'دفعه',
    'withdrawals.field.withdrawalId': 'معرّف السحب',
    'withdrawals.field.paymentMethodId': 'معرّف طريقة الدفع',
    'withdrawals.field.failureCode': 'رمز الفشل',
    'withdrawals.field.failureMessage': 'ما قاله Ichancy',
    'withdrawals.field.available': 'رصيد المحفظة',
    'withdrawals.field.checkedAt': 'وقت الفحص',

    'withdrawals.filters.open': 'ما زال يتحرك',
    'withdrawals.filters.readyToPay': 'جاهز للدفع',
    'withdrawals.filters.attention': 'يحتاج شخصاً',
    'withdrawals.filters.all': 'الكل',
    'withdrawals.filters.sort': 'الترتيب',
    'withdrawals.filters.createdFrom': 'طُلب من',
    'withdrawals.filters.createdTo': 'طُلب حتى',
    'withdrawals.filters.statusHint':
      'ألغِ تحديد الكل للعودة إلى القائمة المفتوحة. «جاهز للدفع» يعني أن اللاعب خُصم منه ولم يُدفع لأحد بعد.',

    'withdrawals.sheet.title': 'السحب {shortId}',
    'withdrawals.sheet.loading': 'جارٍ تحميل السحب…',
    'withdrawals.sheet.summary': '{status} · وضع {mode} · {method}',
    'withdrawals.section.money': 'المبلغ',
    'withdrawals.section.payout': 'إلى أين يُرسل',
    'withdrawals.section.player': 'اللاعب',
    'withdrawals.section.walletCheck': 'محفظة الدفع',
    'withdrawals.section.ledger': 'السجلات',
    'withdrawals.section.failure': 'لماذا لم يتم الخصم',
    'withdrawals.section.rejection': 'سبب الرفض',
    'withdrawals.section.timeline': 'التسلسل الزمني',
    'withdrawals.nobodyYet': 'لا أحد بعد',
    'withdrawals.platform': 'المنصة (الوضع التلقائي)',
    'withdrawals.source.unknown': 'غير مسجّل',
    'withdrawals.mode.autoHint':
      'الوضع التلقائي: المنصة توافق وتخصم بنفسها ثم تفحص محفظة الدفع. ما زال شخص يرسل المال ويعلّمه مدفوعاً.',
    'withdrawals.mode.manualHint':
      'الوضع اليدوي: لا شيء يتحرك حتى يوافق شخص. الخصم يلي الموافقة؛ والدفع ما زال يُرسل يدوياً.',
    'withdrawals.walletCheck.none':
      'لم تُفحص بعد. تُقرأ محفظة الدفع مرة واحدة، بعد خصم المبلغ من اللاعب مباشرة.',
    'withdrawals.walletCheck.noFigure': 'لا رقم: المحفظة التي لم تُجب ليست محفظة فارغة.',
    'withdrawals.walletCheck.insufficientBody':
      'كان رصيد المحفظة أقل من هذا الدفع عند فحصها. اشحنها، أو ادفع من مكان آخر، قبل تعليمه مدفوعاً.',

    'withdrawals.timeline.step.requested': 'الطلب',
    'withdrawals.timeline.step.decided': 'القرار',
    'withdrawals.timeline.step.debited': 'الخصم',
    'withdrawals.timeline.step.paid': 'الدفع',
    'withdrawals.timeline.requested': 'طلب اللاعب هذا المبلغ.',
    'withdrawals.timeline.awaitingDecision': 'بانتظار شخص يوافق أو يرفض.',
    'withdrawals.timeline.approvedByAdmin': 'وافق عليه مشرف.',
    'withdrawals.timeline.approvedByPlatform': 'وافقت عليه المنصة — الوضع التلقائي.',
    'withdrawals.timeline.rejected': 'رُفض. لم يُؤخذ شيء من اللاعب.',
    'withdrawals.timeline.cancelled': 'ألغاه اللاعب قبل أن يقرر أحد.',
    'withdrawals.timeline.debitQueued': 'الخصم في الطابور؛ لم يشغّله العامل بعد.',
    'withdrawals.timeline.debiting': 'العامل يخصم المبلغ من اللاعب الآن.',
    'withdrawals.timeline.debited': 'خُفّض رصيد الكازينو. اللاعب مستحق للدفع.',
    'withdrawals.timeline.debitFailed': 'رفض Ichancy الخصم. لم يتحرك شيء.',
    'withdrawals.timeline.needsReconciliation':
      'لم يؤكد Ichancy الخصم ولم ينفه. راجع Ichancy يدوياً؛ لا شيء يُعاد تلقائياً.',
    'withdrawals.timeline.notReached': 'لم يصل إليها.',
    'withdrawals.timeline.awaitingPayout': 'بانتظار شخص يرسل المال ويعلّمه مدفوعاً.',
    'withdrawals.timeline.paid': 'أُرسل المال وقُيّد الدفع في الدفاتر.',

    'withdrawals.actions.readOnly': 'دورك يستطيع قراءة السحوبات لا البتّ فيها.',
    'withdrawals.actions.settled': '{status} — لا شيء آخر يُفعل هنا.',
    'withdrawals.actions.approve': 'موافقة',
    'withdrawals.actions.reject': 'رفض',
    'withdrawals.actions.markPaid': 'تعليم كمدفوع',
    'withdrawals.actions.debitedTitle': 'خُصم من اللاعب. لم يُدفع لأحد بعد.',
    'withdrawals.actions.debitedBody':
      'أرسل {amount} إلى العنوان أعلاه، ثم سجّل مرجع التحويل هنا. حتى تفعل، يبقى هذا السطر مفتوحاً.',
    'withdrawals.actions.inFlightTitle': 'العامل يعالجه',
    'withdrawals.actions.inFlightBody':
      'الخصم قيد التنفيذ. لا شيء يُفعل حتى يكتمل؛ هذه اللوحة تتحدث وحدها.',
    'withdrawals.actions.attentionTitle': 'يجب أن يراجع شخص Ichancy',
    'withdrawals.actions.attentionBody':
      'لا تستطيع هذه اللوحة إعادة الخصم. اقرأ سبب الفشل أدناه، وراجع اللاعب في Ichancy، وسوِّه من هناك.',

    'withdrawals.approve.title': 'الموافقة على السحب {shortId}؟',
    'withdrawals.approve.description':
      'طلب {player} سحب {amount} عبر {method}. الموافقة تبدأ الخصم؛ ولا ترسل أي مال.',
    'withdrawals.approve.manualBody':
      'الوضع اليدوي: لم يتحرك شيء بعد. موافقتك تأخذ {amount} من رصيد اللاعب في الكازينو، ثم يظهر السطر «جاهز للدفع» مع ما تحويه محفظة الدفع — ويرسل شخص المال ويعلّمه مدفوعاً.',
    'withdrawals.approve.autoBody':
      'الوضع التلقائي: المنصة توافق عادة على هذه بنفسها، لكن هذا ما زال ينتظر شخصاً. موافقتك تأخذ {amount} من رصيد اللاعب في الكازينو، ثم يظهر السطر «جاهز للدفع» — وما زال شخص يرسل المال ويعلّمه مدفوعاً.',
    'withdrawals.approve.balanceNote': 'كان رصيد اللاعب {balance} حين طلب.',
    'withdrawals.approve.confirm': 'موافقة وخصم {amount}',

    'withdrawals.reject.title': 'رفض السحب {shortId}؟',
    'withdrawals.reject.description':
      'لم يُؤخذ شيء من اللاعب. السبب هو ما يُقال للاعب، وما يقرؤه لاحقاً من يرد على الشكوى.',
    'withdrawals.reject.reasonPlaceholder': 'لماذا يُرفض هذا السحب، بكلمات واضحة',
    'withdrawals.reject.reasonRequired': 'اذكر السبب. لا يمكن إرسال رفض بلا سبب.',
    'withdrawals.reject.reasonTooLong': 'أبقِ السبب أقل من {max} حرفاً.',
    'withdrawals.reject.confirm': 'رفض السحب',

    'withdrawals.markPaid.title': 'تعليم السحب {shortId} كمدفوع',
    'withdrawals.markPaid.description':
      'فقط بعد أن ترسل المال فعلاً. هذا يقيّد الدفع في الدفاتر بالمرجع الذي تكتبه، ويُغلق السطر كمدفوع.',
    'withdrawals.markPaid.sendThis': 'أرسل',
    'withdrawals.markPaid.toThis': 'إلى',
    'withdrawals.markPaid.referenceLabel': 'مرجع الدفع',
    'withdrawals.markPaid.referenceHint':
      'رمز المعاملة، أو رقم عملية Sham Cash، أو مرجع البنك — أيّ ما يثبت التحويل.',
    'withdrawals.markPaid.referencePlaceholder': 'مثلاً TRX-88112 أو رمز معاملة',
    'withdrawals.markPaid.referenceRequired': 'اكتب مرجع التحويل الذي أجريته.',
    'withdrawals.markPaid.referenceTooLong': 'أبقِ المرجع أقل من {max} حرفاً.',
    'withdrawals.markPaid.continue': 'متابعة',
    'withdrawals.markPaid.back': 'رجوع',
    'withdrawals.markPaid.confirmTitle': 'تقييد الدفع في الدفاتر؟',
    'withdrawals.markPaid.confirmBody':
      'أنت تسجّل أن {amount} أُرسل إلى {address} بالمرجع {reference}. لا يمكن التراجع عن هذا من اللوحة.',
    'withdrawals.markPaid.confirm': 'نعم، دُفع',
    'withdrawals.markPaid.walletShort':
      'كانت محفظة الدفع ناقصة عند فحصها. لا تؤكد إلا إن دفعت من مكان فيه المال.',

    'withdrawals.toast.approvedTitle': 'تمت الموافقة على {shortId}',
    'withdrawals.toast.approvedBody': 'الخصم في الطابور. سيظهر السطر جاهزاً للدفع حين يكتمل.',
    'withdrawals.toast.debitedTitle': 'خُصم {shortId} — جاهز للدفع',
    'withdrawals.toast.debitedBody':
      'خُصم من اللاعب {amount}. أرسله إلى عنوان الدفع، ثم علّمه مدفوعاً. {walletCheck}.',
    'withdrawals.toast.debitFailedTitle': '{shortId}: رُفض الخصم',
    'withdrawals.toast.debitFailedBody': 'لم يتحرك شيء. {message}',
    'withdrawals.toast.reconcileTitle': '{shortId} يحتاج تسوية',
    'withdrawals.toast.reconcileBody':
      'لم يؤكد Ichancy الخصم ولم ينفه. راجع اللاعب في Ichancy قبل أي شيء آخر.',
    'withdrawals.toast.rejectedTitle': 'رُفض {shortId}',
    'withdrawals.toast.rejectedBody': 'يحتفظ اللاعب برصيده ويُخبر بالسبب.',
    'withdrawals.toast.paidTitle': 'عُلّم {shortId} مدفوعاً',
    'withdrawals.toast.paidBody': 'قُيّد الدفع في الدفاتر برقم {transaction}.',
    'withdrawals.toast.changedTitle': '{shortId} الآن {status}',
    'withdrawals.toast.changedBody': 'أجاب الخادم بحالة لم تتوقعها هذه الشاشة.',
    'withdrawals.toast.alreadyTitle': 'عولج مسبقاً',
    'withdrawals.toast.alreadyBody': 'سبقك أحد إلى {shortId}. تعرض اللوحة الآن حالته الحالية.',
    'withdrawals.error.approve': 'تعذّرت الموافقة على السحب',
    'withdrawals.error.reject': 'تعذّر رفض السحب',
    'withdrawals.error.markPaid': 'تعذّر تسجيل الدفع',
    'withdrawals.charCount': '{count} / {max}',
  },
});

export type WithdrawalMessageKey = keyof (typeof withdrawalMessages)['en'];

export type WithdrawalTranslator = Translator<(typeof withdrawalMessages)['en']>;
