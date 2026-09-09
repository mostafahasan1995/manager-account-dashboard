import { useCallback } from 'react';

import { defineMessages } from '@/lib/i18n/messages';
import { useT, type Translator } from '@/lib/i18n/use-translation';
import { humanizeEnum } from '@/lib/utils';

/**
 * Everything the deposit queue, the review panel and the two decision dialogs say out loud.
 *
 * The register is a cashier's, not a lawyer's: «احجزه للمراجعة», not «قم بحجزه لغرض المراجعة». The
 * trade words a Damascus reviewer already uses in English — Ichancy, Telegram, NSP — stay in English,
 * because translating them would leave the screen out of step with the agent panel open beside it.
 *
 * Short ids, references, account numbers, ledger transaction ids and every amount stay exactly as the
 * backend sent them, in Western digits, in both languages. This screen is read next to a bank app.
 */
export const depositMessages = defineMessages({
  en: {
    // ── The queue screen ─────────────────────────────────────────────────────────────────────
    'deposits.description':
      'Every receipt waiting on a human. Claim one before you decide it — the claim is what stops two reviewers paying the same deposit twice.',
    'deposits.noun': 'deposits',

    'deposits.queue.refreshing': 'Refreshing…',
    'deposits.queue.notLoaded': 'Not loaded yet',
    'deposits.queue.updated': 'Live · updated {time}',
    'deposits.queue.showAll': 'Show the whole queue',

    'deposits.sweep.action': 'Run maintenance sweep',
    'deposits.sweep.confirmTitle': 'Run the maintenance sweep?',
    'deposits.sweep.confirmBody':
      'This expires deposits that ran out of time, releases claims nobody came back to, and reaps abandoned drafts. It decides nothing on its own.',
    'deposits.sweep.confirmLabel': 'Run sweep',
    'deposits.sweep.doneTitle': 'Maintenance sweep finished',
    'deposits.sweep.doneBody': '{expired} expired · {released} claims released · {reaped} reaped.',
    'deposits.sweep.failedTitle': 'The maintenance sweep failed',

    'deposits.shortcuts.move': 'move',
    'deposits.shortcuts.open': 'open',
    'deposits.shortcuts.close': 'close',
    'deposits.shortcuts.noMoney':
      'Approving and rejecting always take a click — no shortcut moves money.',

    // ── The table ────────────────────────────────────────────────────────────────────────────
    'deposits.table.caption':
      'Deposits waiting on a decision, newest first unless another sort is chosen',
    'deposits.table.emptyBody':
      'No deposit matches these filters. Widen them, or come back when the next receipt lands.',
    'deposits.copyShortId': 'Copy short ID {shortId}',
    'deposits.feePrefix': 'fee',
    'deposits.rail.unknown': 'Unknown rail',
    'deposits.player.noUsername': 'No Telegram username',
    'deposits.player.noTelegramId': 'Telegram id unknown',
    'deposits.player.open': 'Open player',

    'deposits.claim.unclaimed': 'Unclaimed',
    'deposits.claim.you': 'You',
    'deposits.claim.other': 'Someone else',

    // ── Filters ──────────────────────────────────────────────────────────────────────────────
    'deposits.filters.needsReview': 'Needs review',
    'deposits.filters.all': 'All deposits',
    'deposits.filters.unclaimedOnly': 'Unclaimed only',
    'deposits.filters.stuck': 'Stuck',
    'deposits.filters.sort': 'Sort',
    'deposits.filters.statusHint':
      'With nothing picked the queue shows everything still waiting to be reviewed. Pick “All deposits” above to include the credited, rejected and expired ones.',
    'deposits.filters.amountFrom': 'Amount from',
    'deposits.filters.amountTo': 'Amount to',
    'deposits.filters.createdFrom': 'Created from',
    'deposits.filters.createdTo': 'Created to',
    'deposits.amountFormat': 'Use a plain amount, like 1500.00',

    // ── Field names this feature owns ────────────────────────────────────────────────────────
    'deposits.field.shortId': 'Short ID',
    'deposits.field.reference': 'Reference',
    'deposits.field.destination': 'Destination',
    'deposits.field.risk': 'Risk',
    'deposits.field.claim': 'Claim',
    'deposits.field.age': 'Age',
    'deposits.field.expires': 'Expires',
    'deposits.field.claimed': 'Claimed',
    'deposits.field.verified': 'Verified',
    'deposits.field.credited': 'Credited',
    'deposits.field.fee': 'Fee',
    'deposits.field.method': 'Method',
    'deposits.field.account': 'Account',
    'deposits.field.accountHolder': 'Account holder',
    'deposits.field.referenceRequired': 'Reference required',
    'deposits.field.sender': 'Sender',
    'deposits.field.secondApprovalNeeded': 'Needs a second approver',
    'deposits.field.decidedBy': 'Decided by',
    'deposits.field.secondApprover': 'Second approver',
    'deposits.field.attempts': 'Attempts',
    'deposits.field.verifiedBy': 'Verified by',
    'deposits.field.creditKeyEpoch': 'Credit key epoch',
    'deposits.field.submitted': 'Submitted',
    'deposits.field.reviewStarted': 'Review started',
    'deposits.field.decided': 'Decided',
    // Same English word as the money row above it, a different Arabic one: there it is an amount,
    // here it is the moment the money landed.
    'deposits.field.creditedAt': 'Credited',
    'deposits.field.depositId': 'Deposit id',
    'deposits.field.paymentMethodId': 'Payment method id',
    /** Appends the shared "optional" to a shared field name instead of re-declaring either. */
    'deposits.optionalField': '{label} ({optional})',

    // ── The review panel ─────────────────────────────────────────────────────────────────────
    'deposits.sheet.title': 'Deposit {shortId}',
    'deposits.sheet.loading': 'Loading this deposit.',
    'deposits.sheet.summary': '{status} · {proofs}',
    'deposits.proofCount': { one: '1 proof', other: '{count} proofs' },
    'deposits.sheet.mismatchTitle': 'Verified is not what the player claimed',
    'deposits.sheet.mismatchBody':
      'They asked for {claimed} and {verified} was verified. Whoever decided it should have said why in the note.',

    'deposits.section.money': 'Money',
    'deposits.section.chain': 'What the chain says',
    'deposits.section.destination': 'Where it was sent',
    'deposits.section.sender': 'Who sent it',
    'deposits.section.decision': 'Decision',
    'deposits.section.credit': 'Credit',
    'deposits.section.rejection': 'Rejection',
    'deposits.section.timeline': 'Timeline',
    'deposits.section.proofs': { one: 'Proof', other: 'Proofs' },

    // ── The on-chain verdict ─────────────────────────────────────────────────────────────────
    // Two of these seven carry the weight. `suspect` has to read as a STOP, because everything a
    // reviewer normally checks is present on a suspect transfer — it is real, it is confirmed, and
    // it paid somebody else. `unavailable` must NOT read as a refusal: it is our node that failed,
    // and the deposit is exactly as good or as bad as it was before we asked.
    'deposits.chain.loading': 'Reading the chain…',
    'deposits.chain.refresh': 'Check again',
    'deposits.chain.checked': 'Checked',
    'deposits.chain.arrived': 'Arrived on chain',
    'deposits.chain.creditable': 'Worth crediting',
    'deposits.chain.network': 'Network',
    'deposits.chain.txHash': 'Transaction hash',
    'deposits.chain.from': 'Sent from',
    'deposits.chain.confirmations': 'Confirmations',
    'deposits.chain.confirmationsValue': '{confirmations} of {required}',

    'deposits.chain.verified.title': 'Confirmed on chain',
    'deposits.chain.verified.body':
      'The transfer is on the chain, confirmed, and for the amount the player asked for.',

    'deposits.chain.pending.title': 'Found, but not confirmed yet',
    'deposits.chain.pending.body':
      'The transfer is on the chain and is not deep enough to be safe. A transfer this shallow can still be dropped, and the money would be gone after you had paid it out. Check again in a few minutes.',

    'deposits.chain.mismatch.title': 'Less arrived than the player claimed',
    'deposits.chain.mismatch.body':
      'Both figures are below. The creditable amount is what actually arrived, priced at your rate — approving the claimed figure pays out money nobody sent.',

    'deposits.chain.suspect.title': 'Stop — this transfer did not pay you',
    'deposits.chain.suspect.body':
      'It is real, it is confirmed, and it paid a wallet that is not yours. That is exactly what makes it convincing. Crediting it hands this player somebody else’s transfer, and no second reviewer will catch it either. Reject it.',

    'deposits.chain.missing.title': 'Nothing on the chain matches this',
    'deposits.chain.missing.body':
      'The chain answered, and no transfer with this hash reached your wallet. Ask the player for the hash again before rejecting — a mistyped one looks exactly like this.',

    'deposits.chain.unavailable.title': 'We could not read the chain',
    'deposits.chain.unavailable.body':
      'This is our outage, not a verdict. Nothing here counts against the player and nothing here counts for them. Decide this deposit on the proof, the way you would if we never asked the chain at all.',

    'deposits.destination.gone': 'The rail this deposit used is no longer on record.',
    'deposits.reference.none': 'None given',
    'deposits.nobodyYet': 'Nobody yet',
    'deposits.expiry.none': 'No expiry',
    'deposits.rejection.noNote': 'No note was left',
    'deposits.credit.epochHint':
      'Retrying bumps the epoch, which is what stops the failed attempt from landing later and crediting the player a second time.',

    // How a credit was proved. Not in the shared enum table — it is read on this screen only.
    'deposits.creditVerifiedBy.unconfirmed': 'Not yet confirmed',
    'deposits.creditVerifiedBy.API_OK': 'Ichancy confirmed',
    'deposits.creditVerifiedBy.BALANCE_DELTA': 'Proved by balance re-read',
    'deposits.creditVerifiedBy.MANUAL': 'Confirmed by a human',

    // ── Actions ──────────────────────────────────────────────────────────────────────────────
    'deposits.actions.readOnly': 'Your role can read this deposit but not decide it.',
    'deposits.actions.secondApprovalTitle': 'Waiting for a second approver',
    'deposits.actions.secondApprovalBody':
      'The first approval is recorded and no money has moved yet. A different admin has to confirm it before the player is credited.',
    'deposits.actions.otherClaimTitle': 'Another reviewer has this one',
    'deposits.actions.otherClaimBody':
      'They claimed it {when}. Ask them to release it, or claim it anyway and the server will say who actually holds it.',
    'deposits.actions.claimFirstTitle': 'Claim it before you decide',
    'deposits.actions.claimFirstBody':
      'Two reviewers approving the same receipt pays the player twice. Claiming locks this deposit to you until you release it.',
    'deposits.actions.claim': 'Claim to review',
    'deposits.actions.claimAnyway': 'Claim anyway',
    'deposits.actions.release': 'Release',
    'deposits.actions.approve': 'Approve…',
    'deposits.actions.reject': 'Reject…',
    'deposits.actions.settled': 'This deposit has already been answered — it is {status}.',

    'deposits.retry.action': 'Retry credit',
    'deposits.retry.confirmTitle': 'Retry the credit for {shortId}?',
    'deposits.retry.confirmBody':
      'This re-queues the credit under a new key epoch. It does not create a second payment: the old attempt can no longer land.',
    'deposits.retry.notePlaceholder': 'What was wrong the first time?',
    'deposits.retry.queuedTitle': 'Credit for {shortId} is queued again',
    'deposits.retry.notQueuedTitle': 'Credit for {shortId} was not requeued',
    'deposits.retry.epochBody': 'The credit key epoch is now {epoch}.',
    'deposits.retry.failedTitle': 'Could not retry the credit',

    'deposits.error.claim': 'Could not claim this deposit',
    'deposits.error.release': 'Could not release this deposit',
    'deposits.error.approve': 'Could not approve this deposit',
    'deposits.error.reject': 'Could not reject this deposit',

    'deposits.toast.claimedTitle': 'You have {shortId}',
    'deposits.toast.claimedBody': 'Nobody else can decide it while you hold the claim.',
    'deposits.toast.releasedTitle': 'Released {shortId}',
    'deposits.toast.releasedBody': 'It is back in the queue for whoever picks it up next.',
    'deposits.toast.approvedTitle': 'Approved {shortId}',
    'deposits.toast.approvedBody':
      'The player has been credited. Ledger transaction {transaction}.',
    'deposits.toast.secondApprovalTitle': 'A second approver is needed',
    'deposits.toast.secondApprovalBody':
      'The money has NOT moved. {shortId} stays put until another admin confirms it.',
    'deposits.toast.rejectedTitle': 'Rejected {shortId}',
    'deposits.toast.rejectedBody': 'Nothing was credited and the reason is on the record.',
    'deposits.toast.alreadyTitle': 'Someone else already handled this',
    'deposits.toast.alreadyBody': '{shortId} is now {status}. The queue has been refreshed.',
    'deposits.toast.alreadyBodyUnknown':
      '{shortId} is no longer yours to decide. The queue has been refreshed.',

    // ── Approving ────────────────────────────────────────────────────────────────────────────
    'deposits.approve.title': 'Approve deposit {shortId}',
    'deposits.approve.description':
      '{player} is credited once this is approved. Read the amount before you confirm.',
    'deposits.approve.thisPlayer': 'this player',
    'deposits.approve.playerClaimed': 'Player claimed',
    'deposits.approve.youAreApproving': 'You are approving',
    'deposits.approve.changedTitle': 'This is not the amount the player claimed',
    'deposits.approve.changedBody':
      'You are approving {delta} against what they asked for. Only do that when the receipt says so.',
    'deposits.approve.secondTitle': 'A second approver is needed for this one',
    'deposits.approve.secondBody':
      'Your approval records the decision but does not move money. Someone else has to confirm it before {player} sees anything.',
    // The chain's own figure, as a BUTTON and never as a pre-filled value — see the comment beside
    // `verifiedAmount` in approve-dialog.tsx for why nothing may fill this field on its own.
    'deposits.approve.chainTitle': 'The chain says a different amount arrived',
    'deposits.approve.chainBody':
      '{arrived} arrived, which is {creditable} at your rate. Nothing has been typed into the box for you — press the button if that is the figure you mean to approve.',
    'deposits.approve.useChainAmount': 'Use {amount}',
    'deposits.approve.amountLabel': 'Verified amount ({currency})',
    'deposits.approve.amountTooSmall': 'Approve an amount greater than zero.',
    'deposits.approve.notePlaceholder':
      'Anything the next person reading this deposit should know.',
    'deposits.approve.confirm': 'Approve',
    'deposits.approve.confirmAmount': 'Approve {amount}',

    // ── Rejecting ────────────────────────────────────────────────────────────────────────────
    'deposits.reject.title': 'Reject deposit {shortId}',
    'deposits.reject.description':
      'The player is told this was refused. Nothing is credited and nothing is reversed.',
    'deposits.reject.reasonPlaceholder': 'Pick a reason',
    'deposits.reject.reasonRequired': 'Choose why this deposit is being rejected.',
    'deposits.reject.noteRequired': '"{reason}" has to be explained in writing.',
    'deposits.reject.notePlaceholder': 'What did you see on the receipt?',
    'deposits.reject.noteAlertTitle': 'This reason needs a note',
    'deposits.reject.noteAlertBody':
      'Whoever answers the player’s complaint will only have what you write here.',
    'deposits.reject.confirm': 'Reject deposit',

    // ── Proofs ───────────────────────────────────────────────────────────────────────────────
    'deposits.proofs.noneTitle': 'No proof was uploaded',
    'deposits.proofs.noneBody':
      'There is nothing to read here. Reject with “{reason}” rather than guessing from the reference alone.',
    'deposits.proofs.alt': 'Proof {index} of {total} for deposit {shortId}',
    'deposits.proofs.enlarge': 'Enlarge',
    'deposits.proofs.enlargeLabel': 'Enlarge {alt}',
    'deposits.proofs.fetchFailed': 'This proof could not be fetched',
    'deposits.proofs.decodeFailedTitle': 'This proof could not be displayed',
    'deposits.proofs.decodeFailedBody':
      'The bytes arrived but the browser could not decode them as {mimeType}. Treat it as unreadable rather than approving on the reference alone.',
    'deposits.proofs.nothingToShow': 'Nothing to show',
    'deposits.proofs.size': 'Size',
    'deposits.proofs.dimensions': 'Dimensions',
    'deposits.proofs.source': 'Source',
    'deposits.proofs.uploaded': 'Uploaded',

    // Where a receipt came from. Also absent from the shared enum table.
    'deposits.proofSource.PLAYER_UPLOAD': 'Player upload',
    'deposits.proofSource.ADMIN_UPLOAD': 'Admin upload',
    'deposits.proofSource.TELEGRAM_PHOTO': 'Telegram photo',
    'deposits.proofSource.TELEGRAM_DOCUMENT': 'Telegram document',
    'deposits.proofSource.SYSTEM_IMPORT': 'System import',
  },

  ar: {
    'deposits.description':
      'كل إشعار دفع ينتظر مراجعة بشرية. احجز الإيداع قبل أن تقرّره — الحجز هو ما يمنع مراجعَين من دفع الإيداع نفسه مرتين.',
    'deposits.noun': 'إيداع',

    'deposits.queue.refreshing': 'جارٍ التحديث…',
    'deposits.queue.notLoaded': 'لم يُحمّل بعد',
    'deposits.queue.updated': 'مباشر · آخر تحديث {time}',
    'deposits.queue.showAll': 'اعرض الطابور كاملاً',

    'deposits.sweep.action': 'تشغيل صيانة الطابور',
    'deposits.sweep.confirmTitle': 'تشغيل صيانة الطابور؟',
    'deposits.sweep.confirmBody':
      'تُنهي هذه العملية الإيداعات التي نفد وقتها، وتحرّر الحجوزات التي لم يعد إليها أحد، وتزيل المسودات المهملة. ولا تقرّر شيئاً بنفسها.',
    'deposits.sweep.confirmLabel': 'تشغيل الصيانة',
    'deposits.sweep.doneTitle': 'انتهت صيانة الطابور',
    'deposits.sweep.doneBody': '{expired} منتهٍ · {released} حجز محرَّر · {reaped} مُزال.',
    'deposits.sweep.failedTitle': 'فشلت صيانة الطابور',

    'deposits.shortcuts.move': 'للتنقل',
    'deposits.shortcuts.open': 'للفتح',
    'deposits.shortcuts.close': 'للإغلاق',
    'deposits.shortcuts.noMoney':
      'الموافقة والرفض يحتاجان نقرة دائماً — لا يوجد اختصار يحرّك المال.',

    'deposits.table.caption': 'إيداعات تنتظر القرار، الأحدث أولاً ما لم يُختر ترتيب آخر',
    'deposits.table.emptyBody':
      'لا يوجد إيداع يطابق عوامل التصفية هذه. وسّعها، أو عد عند وصول الإشعار التالي.',
    'deposits.copyShortId': 'نسخ المعرّف المختصر {shortId}',
    'deposits.feePrefix': 'رسوم',
    'deposits.rail.unknown': 'قناة غير معروفة',
    'deposits.player.noUsername': 'لا يوجد اسم مستخدم تلغرام',
    'deposits.player.noTelegramId': 'معرّف تلغرام غير معروف',
    'deposits.player.open': 'فتح صفحة اللاعب',

    'deposits.claim.unclaimed': 'غير محجوز',
    'deposits.claim.you': 'أنت',
    'deposits.claim.other': 'شخص آخر',

    'deposits.filters.needsReview': 'يحتاج مراجعة',
    'deposits.filters.all': 'كل الإيداعات',
    'deposits.filters.unclaimedOnly': 'غير المحجوزة فقط',
    'deposits.filters.stuck': 'عالقة',
    'deposits.filters.sort': 'الترتيب',
    'deposits.filters.statusHint':
      'إن لم تختر شيئاً يعرض الطابور كل ما ينتظر المراجعة. اختر «كل الإيداعات» في الأعلى لتشمل المشحونة والمرفوضة والمنتهية.',
    'deposits.filters.amountFrom': 'المبلغ من',
    'deposits.filters.amountTo': 'المبلغ إلى',
    'deposits.filters.createdFrom': 'أُنشئ من',
    'deposits.filters.createdTo': 'أُنشئ إلى',
    'deposits.amountFormat': 'اكتب المبلغ بصيغة بسيطة، مثل 1500.00',

    'deposits.field.shortId': 'المعرّف المختصر',
    'deposits.field.reference': 'المرجع',
    'deposits.field.destination': 'الوجهة',
    'deposits.field.risk': 'الخطورة',
    'deposits.field.claim': 'الحجز',
    'deposits.field.age': 'المدة',
    'deposits.field.expires': 'ينتهي خلال',
    'deposits.field.claimed': 'المبلغ المطلوب',
    'deposits.field.verified': 'المبلغ المتحقَّق',
    'deposits.field.credited': 'المبلغ المُضاف',
    'deposits.field.fee': 'الرسوم',
    'deposits.field.method': 'الوسيلة',
    'deposits.field.account': 'الحساب',
    'deposits.field.accountHolder': 'صاحب الحساب',
    'deposits.field.referenceRequired': 'المرجع مطلوب',
    'deposits.field.sender': 'المُرسِل',
    'deposits.field.secondApprovalNeeded': 'يحتاج موافقاً ثانياً',
    'deposits.field.decidedBy': 'مَن قرّره',
    'deposits.field.secondApprover': 'الموافق الثاني',
    'deposits.field.attempts': 'عدد المحاولات',
    'deposits.field.verifiedBy': 'طريقة التحقق',
    'deposits.field.creditKeyEpoch': 'دورة مفتاح الإضافة',
    'deposits.field.submitted': 'تاريخ التقديم',
    'deposits.field.reviewStarted': 'بدء المراجعة',
    'deposits.field.decided': 'تاريخ القرار',
    'deposits.field.creditedAt': 'تاريخ الإضافة',
    'deposits.field.depositId': 'معرّف الإيداع',
    'deposits.field.paymentMethodId': 'معرّف وسيلة الدفع',
    'deposits.optionalField': '{label} ({optional})',

    'deposits.sheet.title': 'إيداع {shortId}',
    'deposits.sheet.loading': 'جارٍ تحميل هذا الإيداع.',
    'deposits.sheet.summary': '{status} · {proofs}',
    'deposits.proofCount': {
      zero: 'بلا إثبات',
      one: 'إثبات واحد',
      two: 'إثباتان',
      few: '{count} إثباتات',
      many: '{count} إثباتاً',
      other: '{count} إثبات',
    },
    'deposits.sheet.mismatchTitle': 'المبلغ المتحقَّق يخالف ما طلبه اللاعب',
    'deposits.sheet.mismatchBody':
      'طلب {claimed} وتم التحقق من {verified}. من قرّر ذلك كان عليه أن يذكر السبب في الملاحظة.',

    'deposits.section.money': 'المبالغ',
    'deposits.section.chain': 'ما تقوله الشبكة',
    'deposits.section.destination': 'إلى أين أُرسل',
    'deposits.section.sender': 'من أرسله',
    'deposits.section.decision': 'القرار',
    'deposits.section.credit': 'الإضافة',
    'deposits.section.rejection': 'الرفض',
    'deposits.section.timeline': 'التسلسل الزمني',
    'deposits.section.proofs': {
      zero: 'الإثباتات',
      one: 'الإثبات',
      two: 'الإثباتان',
      few: 'الإثباتات',
      many: 'الإثباتات',
      other: 'الإثباتات',
    },

    'deposits.chain.loading': 'جارٍ قراءة الشبكة…',
    'deposits.chain.refresh': 'أعد القراءة',
    'deposits.chain.checked': 'قُرئ',
    'deposits.chain.arrived': 'الواصل على الشبكة',
    'deposits.chain.creditable': 'المبلغ القابل للإضافة',
    'deposits.chain.network': 'الشبكة',
    'deposits.chain.txHash': 'رقم العملية (hash)',
    'deposits.chain.from': 'أُرسل من محفظة',
    'deposits.chain.confirmations': 'التأكيدات',
    'deposits.chain.confirmationsValue': '{confirmations} من {required}',

    'deposits.chain.verified.title': 'مؤكَّد على الشبكة',
    'deposits.chain.verified.body': 'الحوالة موجودة على الشبكة ومؤكَّدة وبالمبلغ الذي طلبه اللاعب.',

    'deposits.chain.pending.title': 'وُجدت لكنها لم تُؤكَّد بعد',
    'deposits.chain.pending.body':
      'الحوالة على الشبكة لكن عمقها غير كافٍ. حوالة بهذا العمق قد تسقط من الشبكة، ويضيع المال بعد أن تكون قد دفعته. أعد القراءة بعد دقائق.',

    'deposits.chain.mismatch.title': 'الواصل أقل مما طلبه اللاعب',
    'deposits.chain.mismatch.body':
      'الرقمان أدناه. المبلغ القابل للإضافة هو ما وصل فعلاً مسعَّراً بسعرك — والموافقة على المبلغ المطلوب تدفع مالاً لم يرسله أحد.',

    'deposits.chain.suspect.title': 'قف — هذه الحوالة لم تصلك أنت',
    'deposits.chain.suspect.body':
      'حقيقية ومؤكَّدة، لكنها دخلت محفظة ليست محفظتك، وهذا بالضبط ما يجعلها مقنعة. إضافتها تمنح هذا اللاعب حوالة غيره، ولن ينتبه لها الموافق الثاني أيضاً. ارفضها.',

    'deposits.chain.missing.title': 'لا شيء على الشبكة يطابق هذا',
    'deposits.chain.missing.body':
      'الشبكة أجابت، ولا توجد حوالة بهذا الرقم وصلت إلى محفظتك. اطلب الرقم من اللاعب مرة أخرى قبل الرفض — الرقم المكتوب خطأً يبدو تماماً هكذا.',

    'deposits.chain.unavailable.title': 'تعذّرت قراءة الشبكة',
    'deposits.chain.unavailable.body':
      'هذا عطل عندنا وليس حكماً. لا شيء هنا ضد اللاعب ولا شيء هنا لصالحه. قرِّر هذا الإيداع من الإثبات، كما لو أننا لم نسأل الشبكة أصلاً.',

    'deposits.destination.gone': 'القناة التي استُخدمت في هذا الإيداع لم تعد مسجّلة.',
    'deposits.reference.none': 'لم يُذكر',
    'deposits.nobodyYet': 'لا أحد بعد',
    'deposits.expiry.none': 'بلا انتهاء',
    'deposits.rejection.noNote': 'لم تُترك ملاحظة',
    'deposits.credit.epochHint':
      'إعادة المحاولة ترفع رقم الدورة، وهذا ما يمنع المحاولة الفاشلة من الوصول لاحقاً وإضافة المبلغ للاعب مرة ثانية.',

    'deposits.creditVerifiedBy.unconfirmed': 'لم يتأكد بعد',
    'deposits.creditVerifiedBy.API_OK': 'تأكيد من Ichancy',
    'deposits.creditVerifiedBy.BALANCE_DELTA': 'مثبت بإعادة قراءة الرصيد',
    'deposits.creditVerifiedBy.MANUAL': 'أكّده موظف',

    'deposits.actions.readOnly': 'صلاحيتك تسمح بقراءة هذا الإيداع لا بتقريره.',
    'deposits.actions.secondApprovalTitle': 'بانتظار موافق ثانٍ',
    'deposits.actions.secondApprovalBody':
      'الموافقة الأولى مسجّلة ولم يتحرك أي مبلغ بعد. يجب أن يؤكّدها موظف آخر قبل أن يُضاف المبلغ للاعب.',
    'deposits.actions.otherClaimTitle': 'مراجع آخر يحجز هذا الإيداع',
    'deposits.actions.otherClaimBody':
      'حجزه {when}. اطلب منه تحريره، أو احجزه أنت وسيقول لك الخادم من يحمله فعلاً.',
    'deposits.actions.claimFirstTitle': 'احجزه قبل أن تقرّره',
    'deposits.actions.claimFirstBody':
      'موافقة مراجعَين على الإشعار نفسه تدفع للاعب مرتين. الحجز يقفل هذا الإيداع باسمك حتى تحرّره.',
    'deposits.actions.claim': 'احجزه للمراجعة',
    'deposits.actions.claimAnyway': 'احجزه على أي حال',
    'deposits.actions.release': 'تحرير الحجز',
    'deposits.actions.approve': 'موافقة…',
    'deposits.actions.reject': 'رفض…',
    'deposits.actions.settled': 'هذا الإيداع تم البت فيه — حالته {status}.',

    'deposits.retry.action': 'إعادة محاولة الإضافة',
    'deposits.retry.confirmTitle': 'إعادة محاولة الإضافة للإيداع {shortId}؟',
    'deposits.retry.confirmBody':
      'تعيد هذه العملية جدولة الإضافة بدورة مفتاح جديدة. ولا تنشئ دفعة ثانية: المحاولة القديمة لم يعد بإمكانها الوصول.',
    'deposits.retry.notePlaceholder': 'ما الذي حصل في المرة الأولى؟',
    'deposits.retry.queuedTitle': 'أُعيدت جدولة إضافة {shortId}',
    'deposits.retry.notQueuedTitle': 'لم تُعد جدولة إضافة {shortId}',
    'deposits.retry.epochBody': 'دورة مفتاح الإضافة الآن {epoch}.',
    'deposits.retry.failedTitle': 'تعذّرت إعادة محاولة الإضافة',

    'deposits.error.claim': 'تعذّر حجز هذا الإيداع',
    'deposits.error.release': 'تعذّر تحرير هذا الإيداع',
    'deposits.error.approve': 'تعذّرت الموافقة على هذا الإيداع',
    'deposits.error.reject': 'تعذّر رفض هذا الإيداع',

    'deposits.toast.claimedTitle': 'أصبح {shortId} لك',
    'deposits.toast.claimedBody': 'لا يستطيع غيرك تقريره ما دام الحجز بيدك.',
    'deposits.toast.releasedTitle': 'تم تحرير {shortId}',
    'deposits.toast.releasedBody': 'عاد إلى الطابور لمن يأخذه بعدك.',
    'deposits.toast.approvedTitle': 'تمت الموافقة على {shortId}',
    'deposits.toast.approvedBody': 'تمت إضافة المبلغ للاعب. قيد الدفتر {transaction}.',
    'deposits.toast.secondApprovalTitle': 'يلزم موافق ثانٍ',
    'deposits.toast.secondApprovalBody':
      'المبلغ لم يتحرك. يبقى {shortId} كما هو حتى يؤكّده موظف آخر.',
    'deposits.toast.rejectedTitle': 'تم رفض {shortId}',
    'deposits.toast.rejectedBody': 'لم يُضف أي مبلغ، والسبب مسجّل.',
    'deposits.toast.alreadyTitle': 'شخص آخر تولّى هذا قبلك',
    'deposits.toast.alreadyBody': 'حالة {shortId} الآن {status}. تم تحديث الطابور.',
    'deposits.toast.alreadyBodyUnknown': 'لم يعد {shortId} من نصيبك. تم تحديث الطابور.',

    'deposits.approve.title': 'الموافقة على الإيداع {shortId}',
    'deposits.approve.description':
      'يُضاف المبلغ إلى {player} بمجرد الموافقة. اقرأ المبلغ قبل أن تؤكّد.',
    'deposits.approve.thisPlayer': 'هذا اللاعب',
    'deposits.approve.playerClaimed': 'اللاعب طلب',
    'deposits.approve.youAreApproving': 'أنت توافق على',
    'deposits.approve.changedTitle': 'هذا ليس المبلغ الذي طلبه اللاعب',
    'deposits.approve.changedBody':
      'أنت توافق على {delta} مقارنةً بما طلبه. لا تفعل ذلك إلا إذا كان الإشعار يقول ذلك.',
    'deposits.approve.secondTitle': 'هذا الإيداع يحتاج موافقاً ثانياً',
    'deposits.approve.secondBody':
      'موافقتك تسجّل القرار لكنها لا تحرّك المال. يجب أن يؤكّدها شخص آخر قبل أن يرى {player} أي شيء.',
    'deposits.approve.chainTitle': 'الشبكة تقول إن مبلغاً مختلفاً وصل',
    'deposits.approve.chainBody':
      'وصل {arrived}، أي {creditable} بسعرك. لم نكتب لك شيئاً في الخانة — اضغط الزر إن كان هذا هو الرقم الذي تقصد الموافقة عليه.',
    'deposits.approve.useChainAmount': 'استخدم {amount}',
    'deposits.approve.amountLabel': 'المبلغ المتحقَّق ({currency})',
    'deposits.approve.amountTooSmall': 'وافق على مبلغ أكبر من صفر.',
    'deposits.approve.notePlaceholder': 'أي شيء يجب أن يعرفه من يقرأ هذا الإيداع بعدك.',
    'deposits.approve.confirm': 'موافقة',
    'deposits.approve.confirmAmount': 'الموافقة على {amount}',

    'deposits.reject.title': 'رفض الإيداع {shortId}',
    'deposits.reject.description': 'يُبلَّغ اللاعب بأن إيداعه رُفض. لا يُضاف شيء ولا يُعكس شيء.',
    'deposits.reject.reasonPlaceholder': 'اختر سبباً',
    'deposits.reject.reasonRequired': 'اختر سبب رفض هذا الإيداع.',
    'deposits.reject.noteRequired': '«{reason}» يجب شرحه كتابةً.',
    'deposits.reject.notePlaceholder': 'ماذا رأيت في الإشعار؟',
    'deposits.reject.noteAlertTitle': 'هذا السبب يحتاج ملاحظة',
    'deposits.reject.noteAlertBody': 'من سيردّ على شكوى اللاعب لن يكون بين يديه سوى ما تكتبه هنا.',
    'deposits.reject.confirm': 'رفض الإيداع',

    'deposits.proofs.noneTitle': 'لم يُرفع أي إثبات',
    'deposits.proofs.noneBody':
      'لا يوجد ما يُقرأ هنا. ارفضه بسبب «{reason}» بدل التخمين من المرجع وحده.',
    'deposits.proofs.alt': 'الإثبات {index} من {total} للإيداع {shortId}',
    'deposits.proofs.enlarge': 'تكبير',
    'deposits.proofs.enlargeLabel': 'تكبير {alt}',
    'deposits.proofs.fetchFailed': 'تعذّر جلب هذا الإثبات',
    'deposits.proofs.decodeFailedTitle': 'تعذّر عرض هذا الإثبات',
    'deposits.proofs.decodeFailedBody':
      'وصلت البيانات لكن المتصفح لم يستطع فك ترميزها كـ {mimeType}. عامله كإثبات غير مقروء بدل الموافقة اعتماداً على المرجع وحده.',
    'deposits.proofs.nothingToShow': 'لا شيء لعرضه',
    'deposits.proofs.size': 'الحجم',
    'deposits.proofs.dimensions': 'الأبعاد',
    'deposits.proofs.source': 'المصدر',
    'deposits.proofs.uploaded': 'تاريخ الرفع',

    'deposits.proofSource.PLAYER_UPLOAD': 'رفعه اللاعب',
    'deposits.proofSource.ADMIN_UPLOAD': 'رفعه موظف',
    'deposits.proofSource.TELEGRAM_PHOTO': 'صورة من Telegram',
    'deposits.proofSource.TELEGRAM_DOCUMENT': 'ملف من Telegram',
    'deposits.proofSource.SYSTEM_IMPORT': 'استيراد من النظام',
  },
});

export type DepositMessageKey = keyof (typeof depositMessages)['en'];

export type DepositTranslator = Translator<(typeof depositMessages)['en']>;

/** The two backend enums this screen renders that the shared enum table does not carry. */
export type DepositEnumGroup = 'creditVerifiedBy' | 'proofSource';

/**
 * `useEnumLabel` for the enums that live in this bundle instead of the shared one.
 *
 * Same contract as the shared hook, including the part that matters most: a value the backend adds
 * tomorrow has no key here, so it renders as itself humanised rather than vanishing off a panel a
 * reviewer is using to decide whether to pay somebody.
 */
export function useDepositEnumLabel(): (group: DepositEnumGroup, value: string) => string {
  const t = useT(depositMessages);

  return useCallback(
    (group: DepositEnumGroup, value: string) => {
      const key = `deposits.${group}.${value}`;
      const label = t(key as DepositMessageKey);
      return label === key ? humanizeEnum(value) : label;
    },
    [t],
  );
}
