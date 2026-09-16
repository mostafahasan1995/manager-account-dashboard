import { defineMessages } from '@/lib/i18n/messages';

/**
 * What the stats screen says, in both languages.
 *
 * ── THE FOOTNOTES ARE THE POINT, NOT FILLER ───────────────────────────────────────────────────
 * Three of these strings exist because a number on its own is misread here in a specific, expensive
 * way, and each names the misreading it prevents:
 *
 *   `basis.*`        `Opened` and `Credited` are counted on different clocks and will not add up.
 *                    Somebody WILL try to subtract them; the footnote is what stops that becoming
 *                    a bug report about the totals being wrong.
 *   `basis.current`  The queue figures ignore the window entirely. Without saying so, "2 waiting"
 *                    under a heading that says "Today" reads as two arrivals today.
 *   `profit.noRails` A zero profit when no rail charges a fee is a SETTING, not a bad month. This
 *                    is the sentence that sends somebody to the rails screen instead of to us.
 *
 * Nothing here restates the shared bundle: rail names come from the server, statuses from the enum
 * labels the queue's badges already use.
 */
export const statsMessages = defineMessages({
  en: {
    'stats.title': 'Statistics',
    'stats.description':
      'What actually happened — every deposit, not just the ones waiting for a decision.',
    'stats.refresh': 'Refresh',

    // ── The window ───────────────────────────────────────────────────────────────────────────
    'stats.period.day': 'Today',
    'stats.period.week': 'Last 7 days',
    'stats.period.month': 'This month',
    'stats.period.all': 'All time',
    'stats.period.label': 'Period',
    'stats.period.window': '{from} → {to} (UTC)',
    'stats.period.utcNote':
      'Windows are UTC, the same clock the /report message in Telegram uses, so the two agree.',

    // ── Which clock a figure is on ───────────────────────────────────────────────────────────
    'stats.basis.createdAt': 'Counted when the deposit was opened',
    'stats.basis.creditedAt': 'Counted when the money landed',
    'stats.basis.decidedAt': 'Counted when it was decided',
    'stats.basis.paidAt': 'Counted when it was paid',
    'stats.basis.current': 'Right now — not limited to this period',

    // ── Deposits ─────────────────────────────────────────────────────────────────────────────
    'stats.deposits.title': 'Deposits',
    'stats.deposits.description':
      'Opened and credited are counted on different clocks, so they are not two views of the same set and will not add up. Each tile says which.',
    'stats.deposits.opened': 'Opened',
    'stats.deposits.credited': 'Credited',
    'stats.deposits.rejected': 'Rejected',
    'stats.deposits.expired': 'Expired',
    'stats.deposits.waiting': 'Waiting for review',
    'stats.deposits.attention': 'Stuck money',
    'stats.deposits.lifetime': 'Deposits in total',
    'stats.deposits.lifetimeHint': 'Every deposit ever, in any status',
    'stats.deposits.viewAll': 'See all deposits',

    // ── Withdrawals and players ──────────────────────────────────────────────────────────────
    'stats.withdrawals.title': 'Withdrawals and players',
    'stats.withdrawals.paid': 'Paid out',
    'stats.withdrawals.pending': 'Owed',
    'stats.players.new': 'New players',
    'stats.players.total': 'Players in total',
    'stats.players.totalHint': 'Everyone ever registered',

    // ── Profit ───────────────────────────────────────────────────────────────────────────────
    'stats.profit.title': 'Profit',
    'stats.profit.description':
      'Fees kept on deposits credited and withdrawals paid in this period. This is the only revenue the system records; it is posted to house cash like any other money.',
    'stats.profit.total': 'Fees kept',
    'stats.profit.depositFees': 'From deposits',
    'stats.profit.withdrawalFees': 'From withdrawals',
    'stats.profit.rails': '{charging} of {active} active rails charge a fee',
    'stats.profit.noRails':
      'None of your {active} active rails charges a fee, so nothing can be collected. Set a fee on a rail to start keeping one.',
    'stats.profit.noRailsAction': 'Open rails',

    // ── By rail ──────────────────────────────────────────────────────────────────────────────
    'stats.byMethod.title': 'Where the money came from',
    'stats.byMethod.description': 'Credited deposits, split by the rail they arrived on.',
    'stats.byMethod.rail': 'Rail',
    'stats.byMethod.count': 'Deposits',
    'stats.byMethod.total': 'Credited',
    'stats.byMethod.fees': 'Fees',
    'stats.byMethod.emptyTitle': 'Nothing was credited in this period',
    'stats.byMethod.emptyBody': 'Widen the period, or check the queue for deposits still waiting.',

    // ── The platform table ───────────────────────────────────────────────────────────────────
    'stats.tenants.title': 'Every operator',
    'stats.tenants.description':
      'The same figures for each active operator. Suspended operators are left out.',
    'stats.tenants.operator': 'Operator',
    'stats.tenants.emptyTitle': 'No active operators',
    'stats.tenants.emptyBody': 'Activate an operator and its figures appear here.',

    'stats.emptyTitle': 'Nothing happened in this period',
    'stats.emptyBody': 'No deposit was opened or credited in this window. Try a wider period.',
  },

  ar: {
    'stats.title': 'الإحصائيات',
    'stats.description': 'ما حدث فعلاً — كل الإيداعات، لا التي تنتظر قراراً فقط.',
    'stats.refresh': 'تحديث',

    'stats.period.day': 'اليوم',
    'stats.period.week': 'آخر 7 أيام',
    'stats.period.month': 'الشهر الحالي',
    'stats.period.all': 'منذ البداية',
    'stats.period.label': 'الفترة',
    'stats.period.window': '{from} ← {to} (UTC)',
    'stats.period.utcNote':
      'الفترات محسوبة بتوقيت UTC، وهو نفس التوقيت الذي يستخدمه تقرير ‎/report‎ في تلغرام، حتى يتطابق الاثنان.',

    'stats.basis.createdAt': 'تُحتسب عند فتح الإيداع',
    'stats.basis.creditedAt': 'تُحتسب عند وصول المبلغ',
    'stats.basis.decidedAt': 'تُحتسب عند البتّ فيها',
    'stats.basis.paidAt': 'تُحتسب عند الدفع',
    'stats.basis.current': 'الوضع الحالي — غير مقيّد بالفترة',

    'stats.deposits.title': 'الإيداعات',
    'stats.deposits.description':
      '«المفتوحة» و«المشحونة» تُحتسبان بتوقيتين مختلفين، فهما ليستا وجهين لنفس المجموعة ولن يتطابقا. كل بطاقة تذكر التوقيت الذي احتُسبت به.',
    'stats.deposits.opened': 'المفتوحة',
    'stats.deposits.credited': 'المشحونة',
    'stats.deposits.rejected': 'المرفوضة',
    'stats.deposits.expired': 'المنتهية',
    'stats.deposits.waiting': 'بانتظار المراجعة',
    'stats.deposits.attention': 'أموال عالقة',
    'stats.deposits.lifetime': 'إجمالي الإيداعات',
    'stats.deposits.lifetimeHint': 'كل إيداع مهما كانت حالته',
    'stats.deposits.viewAll': 'عرض كل الإيداعات',

    'stats.withdrawals.title': 'السحوبات واللاعبون',
    'stats.withdrawals.paid': 'المدفوعة',
    'stats.withdrawals.pending': 'المستحقة',
    'stats.players.new': 'لاعبون جدد',
    'stats.players.total': 'إجمالي اللاعبين',
    'stats.players.totalHint': 'كل من سُجّل يوماً',

    'stats.profit.title': 'الأرباح',
    'stats.profit.description':
      'العمولات المحتجزة على الإيداعات المشحونة والسحوبات المدفوعة في هذه الفترة. هذا هو الدخل الوحيد الذي يسجّله النظام، ويُقيَّد في صندوق الشركة كأي مبلغ آخر.',
    'stats.profit.total': 'العمولات المحتجزة',
    'stats.profit.depositFees': 'من الإيداعات',
    'stats.profit.withdrawalFees': 'من السحوبات',
    'stats.profit.rails': '{charging} من {active} قناة فعّالة تتقاضى عمولة',
    'stats.profit.noRails':
      'لا تتقاضى أي من قنواتك الفعّالة الـ{active} عمولة، فلا يمكن تحصيل شيء. اضبط عمولة على قناة لتبدأ بتحصيلها.',
    'stats.profit.noRailsAction': 'فتح قنوات الدفع',

    'stats.byMethod.title': 'من أين جاءت الأموال',
    'stats.byMethod.description': 'الإيداعات المشحونة موزّعة حسب القناة التي وصلت عبرها.',
    'stats.byMethod.rail': 'القناة',
    'stats.byMethod.count': 'الإيداعات',
    'stats.byMethod.total': 'المشحون',
    'stats.byMethod.fees': 'العمولات',
    'stats.byMethod.emptyTitle': 'لم يُشحن شيء في هذه الفترة',
    'stats.byMethod.emptyBody': 'وسّع الفترة، أو راجع الطابور بحثاً عن إيداعات ما زالت تنتظر.',

    'stats.tenants.title': 'كل المشغّلين',
    'stats.tenants.description': 'نفس الأرقام لكل مشغّل فعّال. المشغّلون الموقوفون غير مشمولين.',
    'stats.tenants.operator': 'المشغّل',
    'stats.tenants.emptyTitle': 'لا يوجد مشغّلون فعّالون',
    'stats.tenants.emptyBody': 'فعّل مشغّلاً وستظهر أرقامه هنا.',

    'stats.emptyTitle': 'لم يحدث شيء في هذه الفترة',
    'stats.emptyBody': 'لم يُفتح أو يُشحن أي إيداع في هذه النافذة. جرّب فترة أوسع.',
  },
});
