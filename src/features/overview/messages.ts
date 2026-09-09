import { defineMessages } from '@/lib/i18n/messages';

/**
 * What the first screen of a shift says, in both languages.
 *
 * The two counting keys belong to the system strip, where the number is the sentence: "1 of 2 rail
 * accounts still holds money" has to agree in Arabic too, and two — a pair of rails, a pair of
 * accounts — is the count this strip shows most often, which is exactly the form English has no
 * word for.
 *
 * Nothing here restates the shared bundle. The tile that counts one deposit status takes its name
 * from the status itself, so the tile and the badge in the queue below it cannot drift apart.
 */
export const overviewMessages = defineMessages({
  en: {
    'overview.description':
      'What needs a decision right now. Every tile and row opens the screen that acts on it.',

    // ── The row of counts ────────────────────────────────────────────────────────────────────
    'overview.tiles.waiting': 'Waiting for review',
    'overview.tiles.waitingHint': 'Submitted and not yet decided',
    'overview.tiles.unclaimed': 'Unclaimed',
    'overview.tiles.unclaimedHint': 'Nobody has started on these',
    'overview.tiles.secondApprovalHint': 'Above the dual-approval threshold',
    'overview.tiles.stuck': 'Stuck money',
    'overview.tiles.stuckHint': 'Credit failed or needs reconciliation',
    'overview.tiles.breaks': 'Open breaks',
    'overview.tiles.breaksHint': 'Open and under investigation',
    'overview.tiles.withdrawals': 'Withdrawals waiting',
    'overview.tiles.withdrawalsHint': 'Waiting for a decision, or debited and not yet paid',
    'overview.tiles.sampleHint': 'First {limit} counted — the queue sends no total',

    // ── Oldest waiting ───────────────────────────────────────────────────────────────────────
    'overview.waiting.title': 'Oldest waiting',
    'overview.waiting.description':
      'The reviewable deposits that have waited longest. Open one to decide it.',
    'overview.waiting.openQueue': 'Open the queue',
    'overview.waiting.columnDeposit': 'Deposit',
    'overview.waiting.columnWaiting': 'Waiting',
    'overview.waiting.openDeposit': 'Open deposit {shortId}',
    'overview.waiting.late': 'Late',
    'overview.waiting.emptyTitle': 'Nothing is waiting',
    'overview.waiting.emptyBody': 'Every submitted deposit has already been picked up.',

    // ── Open breaks ──────────────────────────────────────────────────────────────────────────
    'overview.breaks.title': 'Needs a decision that is not a deposit',
    'overview.breaks.description':
      'Open reconciliation breaks, worst first. These are differences between the ledger and what actually happened.',
    'overview.breaks.all': 'All breaks',
    'overview.breaks.columnBreak': 'Break',
    'overview.breaks.columnSeverity': 'Severity',
    'overview.breaks.columnDifference': 'Difference',
    'overview.breaks.columnDetected': 'Detected',
    'overview.breaks.emptyTitle': 'The books agree',
    'overview.breaks.emptyBody': 'No open reconciliation breaks. Nothing here needs a decision.',

    // ── System strip ─────────────────────────────────────────────────────────────────────────
    'overview.system.title': 'System',
    'overview.system.staleBadge': 'Stale rails',
    'overview.system.settlingBadge': 'Rails settling',
    'overview.system.staleAccounts': {
      one: '{count} of {total} rail accounts still holds money past the last ageing bucket:',
      other: '{count} of {total} rail accounts still hold money past the last ageing bucket:',
    },
    'overview.system.noStaleAccounts': {
      one: 'The one rail account holds no money past the last ageing bucket.',
      other: 'None of the {count} rail accounts hold money past the last ageing bucket.',
    },
    'overview.system.emptyTitle': 'No rail accounts yet',
    'overview.system.emptyBody':
      'Nothing has cleared through a payment rail, so there is no ageing to report.',
    'overview.system.checked': 'checked',
    'overview.system.railAgeing': 'Rail ageing',
  },

  ar: {
    'overview.description': 'ما الذي يحتاج قراراً الآن. كل بطاقة وكل سطر يفتح الشاشة التي تعالجه.',

    'overview.tiles.waiting': 'بانتظار المراجعة',
    'overview.tiles.waitingHint': 'مُقدَّمة ولم يُبتّ فيها بعد',
    'overview.tiles.unclaimed': 'غير مُستلمة',
    'overview.tiles.unclaimedHint': 'لم يبدأ بها أحد',
    'overview.tiles.secondApprovalHint': 'فوق حدّ الموافقة المزدوجة',
    'overview.tiles.stuck': 'أموال عالقة',
    'overview.tiles.stuckHint': 'فشلت إضافتها أو تحتاج تسوية',
    'overview.tiles.breaks': 'فروقات مفتوحة',
    'overview.tiles.breaksHint': 'مفتوحة أو قيد التحقيق',
    'overview.tiles.withdrawals': 'سحوبات بانتظار إجراء',
    'overview.tiles.withdrawalsHint': 'بانتظار قرار، أو خُصمت ولم تُدفع بعد',
    'overview.tiles.sampleHint': 'عُدّت أول {limit} فقط — القائمة لا ترسل مجموعاً',

    'overview.waiting.title': 'الأطول انتظاراً',
    'overview.waiting.description':
      'الإيداعات القابلة للمراجعة التي انتظرت أطول مدة. افتح واحداً لتبتّ فيه.',
    'overview.waiting.openQueue': 'فتح قائمة الإيداعات',
    'overview.waiting.columnDeposit': 'الإيداع',
    'overview.waiting.columnWaiting': 'مدة الانتظار',
    'overview.waiting.openDeposit': 'فتح الإيداع {shortId}',
    'overview.waiting.late': 'متأخر',
    'overview.waiting.emptyTitle': 'لا شيء بانتظار المراجعة',
    'overview.waiting.emptyBody': 'كل إيداع مُقدَّم استلمه أحد بالفعل.',

    'overview.breaks.title': 'قرارات مطلوبة خارج الإيداعات',
    'overview.breaks.description':
      'فروقات التسوية المفتوحة، الأخطر أولاً. هذه فروق بين الدفاتر وما حدث فعلاً.',
    'overview.breaks.all': 'كل الفروقات',
    'overview.breaks.columnBreak': 'نوع الفرق',
    'overview.breaks.columnSeverity': 'الخطورة',
    'overview.breaks.columnDifference': 'الفارق',
    'overview.breaks.columnDetected': 'وقت الاكتشاف',
    'overview.breaks.emptyTitle': 'الدفاتر متطابقة',
    'overview.breaks.emptyBody': 'لا توجد فروقات تسوية مفتوحة. لا شيء هنا يحتاج قراراً.',

    'overview.system.title': 'النظام',
    'overview.system.staleBadge': 'قنوات متوقفة',
    'overview.system.settlingBadge': 'القنوات تُسوّى',
    'overview.system.staleAccounts': {
      zero: 'لا يوجد حساب قناة يحتفظ بمال بعد آخر فترة تقادم:',
      one: 'حساب واحد من {total} ما زال يحتفظ بمال بعد آخر فترة تقادم:',
      two: 'حسابان من {total} ما زالا يحتفظان بمال بعد آخر فترة تقادم:',
      few: '{count} حسابات من {total} ما زالت تحتفظ بمال بعد آخر فترة تقادم:',
      many: '{count} حساباً من {total} ما زال يحتفظ بمال بعد آخر فترة تقادم:',
      other: '{count} حساب من {total} ما زال يحتفظ بمال بعد آخر فترة تقادم:',
    },
    'overview.system.noStaleAccounts': {
      zero: 'لا توجد حسابات قنوات.',
      one: 'حساب القناة الوحيد لا يحتفظ بمال بعد آخر فترة تقادم.',
      two: 'حسابا القنوات لا يحتفظان بمال بعد آخر فترة تقادم.',
      few: 'لا يحتفظ أيّ من حسابات القنوات {count} بمال بعد آخر فترة تقادم.',
      many: 'لا يحتفظ أيّ من حسابات القنوات {count} بمال بعد آخر فترة تقادم.',
      other: 'لا يحتفظ أيّ من حسابات القنوات {count} بمال بعد آخر فترة تقادم.',
    },
    'overview.system.emptyTitle': 'لا توجد حسابات قنوات بعد',
    'overview.system.emptyBody': 'لم يمرّ شيء عبر قناة دفع، فلا يوجد تقادم لعرضه.',
    'overview.system.checked': 'آخر فحص',
    'overview.system.railAgeing': 'تقادم القنوات',
  },
});
