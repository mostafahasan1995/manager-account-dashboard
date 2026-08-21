import { defineMessages } from '@/lib/i18n/messages';

/**
 * Everything the reconciliation screen says, in both languages.
 *
 * Two decisions worth knowing before editing this file.
 *
 * A BREAK is «فرق» and the amount it is made of is «فارق». English uses "difference" for both and
 * gets away with it; Arabic does not, because "close the difference" and "correct the difference"
 * would then be the same sentence about two different things — one is a record, the other is money.
 *
 * The INVARIANT names are keyed by the backend's own identifiers rather than translated at the call
 * site, and an identifier this build has never seen renders as itself. A check the backend adds
 * tomorrow must appear in the violations table under its raw name, not vanish behind a missing key.
 */
export const reconMessages = defineMessages({
  en: {
    // ── The screen ───────────────────────────────────────────────────────────────────────────
    'recon.description':
      'Every number here is a claim about real money. Nothing is rounded, nothing is inferred, and a difference stays on screen until somebody explains it in writing.',
    'recon.tab.breaks': 'Breaks',
    'recon.tab.ageing': 'Rail ageing',
    'recon.tab.ledger': 'Ledger checks',

    // ── Columns and detail rows, shared across the three tabs ────────────────────────────────
    'recon.field.severity': 'Severity',
    'recon.field.category': 'Category',
    'recon.field.expected': 'Expected',
    'recon.field.actual': 'Actual',
    'recon.field.delta': 'Delta',
    'recon.field.pointsAt': 'Points at',
    'recon.field.detected': 'Detected',
    'recon.field.assignee': 'Assignee',
    'recon.field.deposit': 'Deposit',
    'recon.field.ledgerAccount': 'Ledger account',
    'recon.field.ichancyCall': 'Ichancy call',
    'recon.field.resolvedAt': 'Resolved',
    'recon.field.resolutionNote': 'Resolution note',
    'recon.field.resolutionTx': 'Resolution transaction',
    'recon.field.breakId': 'Break id',
    'recon.field.dedupeKey': 'Dedupe key',

    // ── Filters ──────────────────────────────────────────────────────────────────────────────
    'recon.filters.statusHint': 'With nothing ticked the queue falls back to open and investigating.',
    'recon.filters.minSeverity': 'Minimum severity',
    'recon.filters.anySeverity': 'Any severity',
    'recon.filters.severityAndAbove': '{level} and above',

    // ── The break list ───────────────────────────────────────────────────────────────────────
    'recon.list.caption': 'Reconciliation breaks matching the filters',
    'recon.list.emptyTitle': 'Nothing is out of balance here',
    'recon.list.emptyBody':
      'No break matches these filters. Widen the status or category filter before concluding the books agree.',
    'recon.list.noun': 'breaks',
    'recon.ref.deposit': 'Deposit {id}',
    'recon.ref.player': 'Player {id}',
    'recon.ref.ledger': 'Ledger {id}',
    'recon.ref.call': 'Call {id}',
    'recon.ref.none': 'Nothing linked',
    'recon.assignee.unassigned': 'Unassigned',
    'recon.assignee.you': 'You',

    // ── One break, in full ───────────────────────────────────────────────────────────────────
    'recon.detail.title': 'Break',
    'recon.detail.loading': 'Loading the break.',
    'recon.detail.description':
      'Everything the reconciliation checks recorded about this difference.',
    'recon.detail.comparison': 'The difference',
    'recon.detail.history': 'History',
    'recon.detail.recorded': 'What the check recorded',
    'recon.detail.noDetail': 'The check recorded no detail.',
    'recon.detail.rawJson': 'Raw JSON',
    'recon.detail.assign': 'Assign to me',
    'recon.detail.correctFloat': 'Correct float',
    'recon.detail.resolve': 'Resolve',
    'recon.assign.success': 'Break assigned to you',
    'recon.assign.error': 'Could not assign the break',

    // ── Correcting the float ─────────────────────────────────────────────────────────────────
    'recon.correct.title': 'Post a ledger correction',
    'recon.correct.description':
      'This moves the agent float account by the difference below and closes the break.',
    'recon.correct.willRestate': 'The ledger will be restated',
    'recon.correct.amount': 'Correction amount:',
    'recon.correct.notePlaceholder':
      'What was checked, and why the Ichancy figure is the right one.',
    'recon.correct.noteRequired': 'Say why the ledger is being restated.',
    'recon.correct.submit': 'Post the correction',
    'recon.correct.posted': 'Ledger correction posted',
    'recon.correct.restatedBy': 'The ledger was restated by',
    'recon.correct.transaction': 'Transaction',
    'recon.correct.transactionId': 'Transaction {id}',
    'recon.correct.error': 'Could not post the correction',

    // ── Closing a break ──────────────────────────────────────────────────────────────────────
    'recon.resolve.title': 'Close this break',
    'recon.resolve.how': 'How is it being closed?',
    'recon.resolve.RESOLVED': 'The difference was explained and corrected.',
    'recon.resolve.WRITTEN_OFF': 'Real money is missing and we are accepting the loss.',
    'recon.resolve.FALSE_POSITIVE': 'There was never a difference; the check was wrong.',
    'recon.resolve.notePlaceholder': 'What was found, and what was done about it.',
    'recon.resolve.noteHint': 'Required. This note is the audit trail for the money.',
    'recon.resolve.noteRequired': 'A resolution note is required.',
    'recon.resolve.submit': 'Close break',
    'recon.resolve.closedAs': 'Break closed as {status}',
    'recon.resolve.error': 'Could not close the break',
    'recon.writeOff.title': 'Write off this break?',
    'recon.writeOff.alertTitle': 'This accepts a real loss',
    'recon.writeOff.alertBody':
      'Writing off records that the money is gone and will not be recovered. The ledger keeps the difference; it is not corrected. Only do this once somebody has decided to absorb it.',
    'recon.writeOff.confirm': 'Write it off',

    // ── The agent float ──────────────────────────────────────────────────────────────────────
    'recon.float.title': 'Agent float',
    'recon.float.description':
      'Reads the agent wallet from Ichancy and compares it with the ledger. Raises a break when the two disagree.',
    'recon.float.sync': 'Sync agent float',
    'recon.float.synced': 'Agent float compared with Ichancy',
    'recon.float.syncedNoIchancy': 'Float sync ran, but Ichancy did not answer',
    'recon.float.syncError': 'Could not sync the agent float',
    'recon.float.failedTitle': 'The float sync failed',
    'recon.float.unreadableTitle': 'Ichancy could not be read',
    'recon.float.unreadableBody':
      'There is no casino-side figure to compare the ledger against, so nothing here confirms the float is correct. Treat this as an outage and run the sync again before acting on any of the numbers below.',
    'recon.float.belowTitle': 'The agent float is below the low watermark',
    'recon.float.belowBody':
      'The agent will start failing player credits once it runs out. Top it up before the next deposit is approved.',
    'recon.float.ledger': 'Ledger',
    'recon.float.ichancy': 'Ichancy',
    'recon.float.unavailable': 'Unavailable',
    'recon.float.notComparable': 'Not comparable',
    'recon.float.watermark': 'Low watermark',
    'recon.float.below': 'Below',
    'recon.float.above': 'Above',
    'recon.float.noBreak': 'No break was raised by this sync.',
    'recon.float.openBreak': 'Open the break this raised',

    // ── The ledger's own invariants ──────────────────────────────────────────────────────────
    'recon.ledger.title': 'Ledger invariant checks',
    'recon.ledger.description':
      'Re-derives the ledger from its own entries: every transaction must balance to zero, each currency must balance globally, and every account balance must equal the sum of its entries. A violation means the books are internally inconsistent, before any comparison with Ichancy.',
    'recon.ledger.run': 'Run ledger invariant checks',
    'recon.ledger.passed': 'The ledger passed every invariant',
    'recon.ledger.failedCount': {
      one: 'The ledger failed {count} check',
      other: 'The ledger failed {count} checks',
    },
    'recon.ledger.runError': 'Could not run the invariant checks',
    'recon.ledger.didNotRun': 'The checks did not run',
    'recon.ledger.consistent': 'Ledger consistent',
    'recon.ledger.consistentBody': 'Every invariant held when the check ran.',
    'recon.ledger.inconsistent': 'Ledger not consistent',
    'recon.ledger.violationCount': {
      one:
        '{count} invariant did not hold. Each row below is a difference the ledger cannot explain from its own entries.',
      other:
        '{count} invariants did not hold. Each row below is a difference the ledger cannot explain from its own entries.',
    },
    'recon.ledger.checked': 'Checked',
    'recon.ledger.truncatedTitle': 'The list is incomplete',
    'recon.ledger.truncatedBody':
      'A check hit its row cap — there may be more violations than are listed here.',
    'recon.ledger.noViolations': 'No violations to list.',
    'recon.ledger.caption': 'Invariant violations',
    'recon.ledger.invariant': 'Invariant',
    'recon.ledger.subject': 'Subject',
    'recon.ledger.detail': 'Detail',
    'recon.invariant.I1_TRANSACTION_BALANCES': 'Every transaction balances to zero',
    'recon.invariant.I2_GLOBAL_BALANCE': 'The whole ledger balances per currency',
    'recon.invariant.I3_ACCOUNT_BALANCE_MATCHES_ENTRIES': 'Account balances match their entries',

    // ── Rail ageing ──────────────────────────────────────────────────────────────────────────
    'recon.ageing.emptyTitle': 'No rail clearing accounts',
    'recon.ageing.emptyBody':
      'Nothing has moved through a rail clearing account yet, so there is no ageing to report.',
    'recon.ageing.generated': 'Generated',
    'recon.ageing.staleTitle': 'Money is sitting past 30 days',
    'recon.ageing.staleBody':
      'Money held in a clearing account for more than thirty days has never been matched to a bank statement, so nobody can prove it is still there — {accounts}.',
    'recon.ageing.staleBadge': 'Stale — unsettled past 30 days',
    'recon.ageing.balance': 'Balance',
    'recon.ageing.oldest': 'Oldest unsettled',
    'recon.ageing.caption': 'Ageing buckets for {account}',
    'recon.ageing.age': 'Age',
    'recon.ageing.net': 'Net',
    'recon.ageing.entries': 'Entries',
  },

  ar: {
    'recon.description':
      'كل رقم هنا ادّعاء عن مال حقيقي. لا تقريب ولا استنتاج، ويبقى الفارق على الشاشة حتى يشرحه أحدهم كتابةً.',
    'recon.tab.breaks': 'الفروقات',
    'recon.tab.ageing': 'تقادم القنوات',
    'recon.tab.ledger': 'فحوصات الدفتر',

    'recon.field.severity': 'الخطورة',
    'recon.field.category': 'الفئة',
    'recon.field.expected': 'المتوقع',
    'recon.field.actual': 'الفعلي',
    'recon.field.delta': 'الفارق',
    'recon.field.pointsAt': 'يشير إلى',
    'recon.field.detected': 'وقت الاكتشاف',
    'recon.field.assignee': 'المسؤول',
    'recon.field.deposit': 'الإيداع',
    'recon.field.ledgerAccount': 'حساب الدفتر',
    'recon.field.ichancyCall': 'طلب Ichancy',
    'recon.field.resolvedAt': 'وقت التسوية',
    'recon.field.resolutionNote': 'ملاحظة التسوية',
    'recon.field.resolutionTx': 'قيد التسوية',
    'recon.field.breakId': 'معرّف الفرق',
    'recon.field.dedupeKey': 'مفتاح منع التكرار',

    'recon.filters.statusHint': 'إذا لم تُحدَّد أي حالة تعود القائمة إلى المفتوح وقيد التحقيق.',
    'recon.filters.minSeverity': 'أدنى خطورة',
    'recon.filters.anySeverity': 'أي خطورة',
    'recon.filters.severityAndAbove': '{level} فأعلى',

    'recon.list.caption': 'فروقات التسوية المطابقة لعوامل التصفية',
    'recon.list.emptyTitle': 'لا شيء غير متوازن هنا',
    'recon.list.emptyBody':
      'لا يوجد فرق مطابق لهذه التصفية. وسّع تصفية الحالة أو الفئة قبل أن تستنتج أن الحسابات متطابقة.',
    'recon.list.noun': 'فرق',
    'recon.ref.deposit': 'إيداع {id}',
    'recon.ref.player': 'لاعب {id}',
    'recon.ref.ledger': 'دفتر {id}',
    'recon.ref.call': 'طلب {id}',
    'recon.ref.none': 'لا شيء مرتبط',
    'recon.assignee.unassigned': 'بلا مسؤول',
    'recon.assignee.you': 'أنت',

    'recon.detail.title': 'فرق',
    'recon.detail.loading': 'جارٍ تحميل الفرق.',
    'recon.detail.description': 'كل ما سجّلته فحوصات التسوية عن هذا الفرق.',
    'recon.detail.comparison': 'المقارنة',
    'recon.detail.history': 'السجل',
    'recon.detail.recorded': 'ما سجّله الفحص',
    'recon.detail.noDetail': 'لم يسجّل الفحص أي تفاصيل.',
    'recon.detail.rawJson': 'JSON الخام',
    'recon.detail.assign': 'أسنده إليّ',
    'recon.detail.correctFloat': 'تصحيح رصيد الوكيل',
    'recon.detail.resolve': 'تسوية',
    'recon.assign.success': 'تم إسناد الفرق إليك',
    'recon.assign.error': 'تعذّر إسناد الفرق',

    'recon.correct.title': 'تسجيل قيد تصحيح',
    'recon.correct.description': 'يحرّك هذا حساب رصيد الوكيل بمقدار الفارق أدناه ويُغلق الفرق.',
    'recon.correct.willRestate': 'سيُعاد ضبط الدفتر',
    'recon.correct.amount': 'قيمة التصحيح:',
    'recon.correct.notePlaceholder': 'ما الذي جرى التحقق منه، ولماذا رقم Ichancy هو الصحيح.',
    'recon.correct.noteRequired': 'اذكر سبب إعادة ضبط الدفتر.',
    'recon.correct.submit': 'تسجيل التصحيح',
    'recon.correct.posted': 'تم تسجيل قيد التصحيح',
    'recon.correct.restatedBy': 'أُعيد ضبط الدفتر بمقدار',
    'recon.correct.transaction': 'القيد',
    'recon.correct.transactionId': 'القيد {id}',
    'recon.correct.error': 'تعذّر تسجيل التصحيح',

    'recon.resolve.title': 'إغلاق هذا الفرق',
    'recon.resolve.how': 'كيف يُغلق؟',
    'recon.resolve.RESOLVED': 'جرى تفسير الفارق وتصحيحه.',
    'recon.resolve.WRITTEN_OFF': 'هناك مال ناقص فعلاً ونحن نقبل الخسارة.',
    'recon.resolve.FALSE_POSITIVE': 'لم يكن هناك فارق أصلاً؛ الفحص كان خاطئاً.',
    'recon.resolve.notePlaceholder': 'ما الذي وُجد، وما الذي فُعل بشأنه.',
    'recon.resolve.noteHint': 'مطلوبة. هذه الملاحظة هي سجل التدقيق لهذا المال.',
    'recon.resolve.noteRequired': 'ملاحظة التسوية مطلوبة.',
    'recon.resolve.submit': 'إغلاق الفرق',
    'recon.resolve.closedAs': 'أُغلق الفرق كـ {status}',
    'recon.resolve.error': 'تعذّر إغلاق الفرق',
    'recon.writeOff.title': 'شطب هذا الفرق؟',
    'recon.writeOff.alertTitle': 'هذا قبول بخسارة حقيقية',
    'recon.writeOff.alertBody':
      'الشطب يسجّل أن المال ضاع ولن يُسترد. يبقى الفارق في الدفتر ولا يُصحَّح. لا تفعل هذا إلا بعد أن يقرر أحدهم تحمّل الخسارة.',
    'recon.writeOff.confirm': 'اشطبه',

    'recon.float.title': 'رصيد الوكيل',
    'recon.float.description':
      'يقرأ محفظة الوكيل من Ichancy ويقارنها بالدفتر. يفتح فرقاً عند اختلاف الاثنين.',
    'recon.float.sync': 'مزامنة رصيد الوكيل',
    'recon.float.synced': 'تمت مقارنة رصيد الوكيل مع Ichancy',
    'recon.float.syncedNoIchancy': 'تمت المزامنة، لكن Ichancy لم يستجب',
    'recon.float.syncError': 'تعذّرت مزامنة رصيد الوكيل',
    'recon.float.failedTitle': 'فشلت مزامنة الرصيد',
    'recon.float.unreadableTitle': 'تعذّرت قراءة Ichancy',
    'recon.float.unreadableBody':
      'لا يوجد رقم من جهة الكازينو لمقارنة الدفتر به، فلا شيء هنا يؤكد أن الرصيد صحيح. اعتبر هذا عطلاً وأعد المزامنة قبل التصرف بأي من الأرقام أدناه.',
    'recon.float.belowTitle': 'رصيد الوكيل تحت الحد الأدنى',
    'recon.float.belowBody':
      'سيبدأ الوكيل بفشل إضافة الأرصدة للاعبين عند نفاده. اشحنه قبل الموافقة على الإيداع التالي.',
    'recon.float.ledger': 'الدفتر',
    'recon.float.ichancy': 'Ichancy',
    'recon.float.unavailable': 'غير متاح',
    'recon.float.notComparable': 'لا يمكن المقارنة',
    'recon.float.watermark': 'الحد الأدنى',
    'recon.float.below': 'تحت الحد',
    'recon.float.above': 'فوق الحد',
    'recon.float.noBreak': 'لم تفتح هذه المزامنة أي فرق.',
    'recon.float.openBreak': 'افتح الفرق الناتج عنها',

    'recon.ledger.title': 'فحوصات قواعد الدفتر',
    'recon.ledger.description':
      'يُعيد اشتقاق الدفتر من قيوده: كل قيد يجب أن يوازن إلى صفر، وكل عملة يجب أن تتوازن إجمالاً، ورصيد كل حساب يجب أن يساوي مجموع قيوده. المخالفة تعني أن الحسابات غير متسقة مع نفسها، قبل أي مقارنة مع Ichancy.',
    'recon.ledger.run': 'شغّل فحوصات قواعد الدفتر',
    'recon.ledger.passed': 'اجتاز الدفتر كل القواعد',
    'recon.ledger.failedCount': {
      zero: 'لم يسقط الدفتر في أي فحص',
      one: 'سقط الدفتر في فحص واحد',
      two: 'سقط الدفتر في فحصين',
      few: 'سقط الدفتر في {count} فحوصات',
      many: 'سقط الدفتر في {count} فحصاً',
      other: 'سقط الدفتر في {count} فحص',
    },
    'recon.ledger.runError': 'تعذّر تشغيل الفحوصات',
    'recon.ledger.didNotRun': 'لم تعمل الفحوصات',
    'recon.ledger.consistent': 'الدفتر متسق',
    'recon.ledger.consistentBody': 'صمدت كل القواعد وقت الفحص.',
    'recon.ledger.inconsistent': 'الدفتر غير متسق',
    'recon.ledger.violationCount': {
      zero: 'لم تسقط أي قاعدة. كل سطر أدناه فارق لا يستطيع الدفتر تفسيره من قيوده.',
      one: 'قاعدة واحدة لم تصمد. كل سطر أدناه فارق لا يستطيع الدفتر تفسيره من قيوده.',
      two: 'قاعدتان لم تصمدا. كل سطر أدناه فارق لا يستطيع الدفتر تفسيره من قيوده.',
      few: '{count} قواعد لم تصمد. كل سطر أدناه فارق لا يستطيع الدفتر تفسيره من قيوده.',
      many: '{count} قاعدة لم تصمد. كل سطر أدناه فارق لا يستطيع الدفتر تفسيره من قيوده.',
      other: '{count} قاعدة لم تصمد. كل سطر أدناه فارق لا يستطيع الدفتر تفسيره من قيوده.',
    },
    'recon.ledger.checked': 'جرى الفحص',
    'recon.ledger.truncatedTitle': 'القائمة غير مكتملة',
    'recon.ledger.truncatedBody':
      'بلغ أحد الفحوصات حدّ الصفوف — قد تكون هناك مخالفات أكثر مما هو معروض هنا.',
    'recon.ledger.noViolations': 'لا مخالفات لعرضها.',
    'recon.ledger.caption': 'مخالفات قواعد الدفتر',
    'recon.ledger.invariant': 'القاعدة',
    'recon.ledger.subject': 'الموضوع',
    'recon.ledger.detail': 'التفصيل',
    'recon.invariant.I1_TRANSACTION_BALANCES': 'كل قيد يوازن إلى صفر',
    'recon.invariant.I2_GLOBAL_BALANCE': 'الدفتر كله متوازن لكل عملة',
    'recon.invariant.I3_ACCOUNT_BALANCE_MATCHES_ENTRIES': 'أرصدة الحسابات تطابق قيودها',

    'recon.ageing.emptyTitle': 'لا توجد حسابات تسوية للقنوات',
    'recon.ageing.emptyBody': 'لم يمر شيء بعد عبر حساب تسوية قناة، فلا يوجد تقادم لعرضه.',
    'recon.ageing.generated': 'أُنشئ التقرير',
    'recon.ageing.staleTitle': 'مال راكد منذ أكثر من 30 يوماً',
    'recon.ageing.staleBody':
      'المال المحتجز في حساب تسوية أكثر من ثلاثين يوماً لم يُطابَق مع كشف بنكي، فلا أحد يستطيع إثبات أنه ما زال موجوداً — {accounts}.',
    'recon.ageing.staleBadge': 'متقادم — غير مسوّى منذ أكثر من 30 يوماً',
    'recon.ageing.balance': 'الرصيد',
    'recon.ageing.oldest': 'أقدم مبلغ غير مسوّى',
    'recon.ageing.caption': 'شرائح التقادم لحساب {account}',
    'recon.ageing.age': 'العمر',
    'recon.ageing.net': 'الصافي',
    'recon.ageing.entries': 'عدد القيود',
  },
});
