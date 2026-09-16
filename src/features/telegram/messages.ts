import { defineMessages } from '@/lib/i18n/messages';

/**
 * The Telegram destinations screen, in both languages.
 *
 * ══ THE FAILURE SENTENCES ARE THE POINT OF THIS FILE ═══════════════════════════════════════════
 * Four of the ways binding a chat can fail look identical from the outside — nothing arrives — and
 * are fixed by four different people doing four different things. So each one gets its own sentence
 * naming WHO fixes it and HOW, rather than a shared "could not verify". The server sends a machine
 * `reason`; these are what the operator actually reads, in their own language.
 *
 * The Telegram vocabulary stays in English inside the Arabic — bot, admin, channel, supergroup — for
 * the reason the rest of this console does it: those are the words the operator sees in Telegram's
 * own interface, and translating them breaks the match with what they are looking at while they fix
 * the problem.
 */
export const telegramMessages = defineMessages({
  en: {
    'telegram.title': 'Telegram destinations',
    'telegram.description':
      'The groups and channels your bot publishes into. Add the bot to a group as an administrator first, then paste the group here — nothing is saved until the bot has proved it can post there.',
    'telegram.note':
      'Your bot is already registered against your operator account, so there is no token to enter. Everything here is sent through that bot and nothing else.',

    'telegram.caption': {
      one: '{count} destination',
      other: '{count} destinations',
    },

    'telegram.empty.title': 'No destinations yet',
    'telegram.empty.body':
      'Add the bot to a Telegram group or channel as an administrator, then add the group here to start receiving deposits, withdrawals and reports.',

    'telegram.add': 'Add a destination',
    'telegram.add.title': 'Add a Telegram destination',
    'telegram.add.submit': 'Add destination',
    'telegram.edit.title': 'Edit destination',
    'telegram.edit.submit': 'Save changes',

    'telegram.field.url': 'Group or channel',
    'telegram.field.url.hint':
      'A t.me link, an @username, or the numeric chat id. A private invite link (t.me/+…) cannot be resolved by a bot — pick the group above instead.',
    'telegram.field.url.placeholder': 'https://t.me/your_group',

    // ── The pick-list ────────────────────────────────────────────────────────────────────────
    // This is the ONLY way a private group can be added. It has no @username to paste and its
    // invite link cannot be resolved by any bot, so before this list existed there was no value an
    // operator could type that the server was able to accept.
    'telegram.picker.title': 'Groups the bot is in',
    'telegram.picker.hint':
      'Add the bot to a group or channel in Telegram and it appears here — including private groups, which have no link a bot can open. Pick one instead of pasting anything.',
    'telegram.picker.use': 'Use this group',
    'telegram.picker.bound': 'Already added',
    'telegram.picker.selected': 'Using {name}. It is checked again before anything is saved.',
    'telegram.picker.private': 'Private group',
    'telegram.picker.loading': 'Looking for groups the bot is in…',
    'telegram.picker.error': 'Could not load the groups the bot is in. Paste a link instead.',
    'telegram.picker.empty.title': 'The bot is not in any group yet',
    'telegram.picker.empty.body':
      'Add the bot to your group or channel and make it an administrator. It shows up here as soon as Telegram tells us — usually within a second or two. Nothing needs to be pasted.',
    'telegram.picker.or': 'or paste a link',

    // One sentence per membership state, because each is fixed by a different action. A snapshot of
    // the last time Telegram told us anything, which is why none of them blocks the button: an
    // operator who promoted the bot a minute ago would otherwise be locked out of a group that
    // now works.
    'telegram.picker.status.CREATOR': 'The bot owns this chat',
    'telegram.picker.status.ADMINISTRATOR': 'The bot is an administrator',
    'telegram.picker.status.MEMBER': 'The bot is a member but not an administrator — promote it',
    'telegram.picker.status.RESTRICTED': 'The bot is restricted here and may not be able to post',
    'telegram.picker.status.LEFT': 'The bot has left this chat',
    'telegram.picker.status.KICKED': 'The bot was removed from this chat',
    'telegram.field.displayName': 'Label (optional)',
    'telegram.field.displayName.hint': 'What to call it here. Defaults to the group’s own title.',
    'telegram.field.categories': 'Send here',
    'telegram.field.categories.hint':
      'At least one. A destination that receives nothing would sit there looking configured.',
    'telegram.field.active': 'Enabled',

    'telegram.col.destination': 'Destination',
    'telegram.col.type': 'Type',
    'telegram.col.categories': 'Receives',
    'telegram.col.status': 'Status',
    'telegram.col.lastPublished': 'Last published',
    'telegram.col.actions': 'Actions',

    'telegram.status.active': 'Enabled',
    'telegram.status.inactive': 'Disabled',
    'telegram.status.neverVerified': 'Never verified',
    'telegram.status.verified': 'Verified {when}',
    'telegram.status.neverPublished': 'Nothing sent yet',

    'telegram.action.test': 'Send a test',
    'telegram.action.check': 'Re-check',
    'telegram.action.edit': 'Edit',
    'telegram.action.remove': 'Remove',
    'telegram.action.enable': 'Enable',
    'telegram.action.disable': 'Disable',

    'telegram.remove.title': 'Remove this destination?',
    'telegram.remove.body':
      'The bot will stop publishing to {name}. Nothing is deleted — adding the same group again restores it, with its history.',
    'telegram.remove.confirm': 'Remove',

    'telegram.test.ok': 'Test message delivered to {name}.',
    'telegram.test.failed': 'The test message did not go through.',
    'telegram.checked.ok': '{name} is reachable.',

    // The failure sentences. One per reason, each naming who fixes it.
    'telegram.reason.INVALID_URL':
      'That is not a Telegram group or channel. Paste the group’s @username, its t.me link, or its numeric chat id.',
    'telegram.reason.NOT_FOUND':
      'Telegram does not know that chat, or the bot cannot see it. Add the bot to the group first, then try again.',
    'telegram.reason.PRIVATE_CHAT':
      'That is a private one-to-one chat. Reports are published to groups and channels only.',
    'telegram.reason.BOT_NOT_MEMBER':
      'The bot is not in that group. Someone in the group must add it, then make it an administrator.',
    'telegram.reason.BOT_NOT_ADMIN':
      'The bot is in that group but is not an administrator. A group administrator must promote it.',
    'telegram.reason.BOT_CANNOT_POST':
      'The bot is an administrator of that channel, but its “Post messages” permission is off. Turn that permission on.',
    'telegram.reason.DUPLICATE':
      'That group is already a destination. Edit the existing one rather than adding it twice.',
    'telegram.reason.SEND_FAILED': 'Telegram refused the message.',
    'telegram.reason.UNDELIVERABLE': 'Telegram reports that chat is unreachable.',

    'telegram.fact.member': 'In the group',
    'telegram.fact.admin': 'Administrator',
    'telegram.fact.canPost': 'Can post',

    'telegram.category.NEW_PLAYER': 'New players',
    'telegram.category.DEPOSIT': 'Deposits',
    'telegram.category.WITHDRAWAL': 'Withdrawals',
    'telegram.category.PROFIT': 'Profit',
    'telegram.category.SHAM_CASH_DEPOSIT': 'Sham Cash in',
    'telegram.category.SHAM_CASH_WITHDRAWAL': 'Sham Cash out',
    'telegram.category.USDT_DEPOSIT': 'USDT in',
    'telegram.category.USDT_WITHDRAWAL': 'USDT out',
    'telegram.category.PLAYER_STATUS_CHANGE': 'Player status changes',
    'telegram.category.REPORT': 'Reports',
    'telegram.category.SYSTEM_ALERT': 'System alerts',

    'telegram.category.notLive': 'Nothing publishes this yet',
    'telegram.category.notLive.hint':
      'You can subscribe to it now; it will start arriving when the platform begins producing it.',

    'telegram.report.title': 'Publish a report',
    'telegram.report.body': 'Send the activity report to every destination that receives Reports.',
    'telegram.report.period.day': 'Today',
    'telegram.report.period.week': 'This week',
    'telegram.report.period.month': 'This month',
    'telegram.report.publish': 'Publish',
    'telegram.report.sent': {
      one: '{title} published to {count} destination.',
      other: '{title} published to {count} destinations.',
    },
    'telegram.report.none': 'Nothing was sent: no destination is subscribed to Reports yet.',
    'telegram.report.partial':
      '{title}: delivered to {delivered} of {considered}. Check the failing destinations below.',
  },

  ar: {
    'telegram.title': 'وجهات تيليغرام',
    'telegram.description':
      'المجموعات والقنوات التي ينشر فيها البوت. أضف البوت إلى المجموعة كمشرف (admin) أولاً، ثم الصق المجموعة هنا — لا يُحفظ شيء قبل أن يثبت البوت قدرته على النشر فيها.',
    'telegram.note':
      'البوت مسجَّل مسبقاً على حساب المشغّل الخاص بك، فلا حاجة لإدخال أي توكن. كل ما هنا يُرسَل عبر ذلك البوت وحده.',

    'telegram.caption': {
      zero: 'لا وجهات',
      one: 'وجهة واحدة',
      two: 'وجهتان',
      few: '{count} وجهات',
      many: '{count} وجهة',
      other: '{count} وجهة',
    },

    'telegram.empty.title': 'لا توجد وجهات بعد',
    'telegram.empty.body':
      'أضف البوت إلى مجموعة أو قناة على تيليغرام كمشرف، ثم أضف المجموعة هنا لتصلك الإيداعات والسحوبات والتقارير.',

    'telegram.add': 'إضافة وجهة',
    'telegram.add.title': 'إضافة وجهة تيليغرام',
    'telegram.add.submit': 'إضافة الوجهة',
    'telegram.edit.title': 'تعديل الوجهة',
    'telegram.edit.submit': 'حفظ التغييرات',

    'telegram.field.url': 'المجموعة أو القناة',
    'telegram.field.url.hint':
      'رابط t.me أو @username أو رقم الـ chat id. رابط الدعوة الخاص (t.me/+…) لا يستطيع البوت فتحه — اختر المجموعة من الأعلى بدلاً من ذلك.',
    'telegram.field.url.placeholder': 'https://t.me/your_group',

    'telegram.picker.title': 'المجموعات التي البوت موجود فيها',
    'telegram.picker.hint':
      'أضف البوت إلى مجموعة أو قناة في Telegram وستظهر هنا — بما فيها المجموعات الخاصة التي لا يملك البوت رابطاً يفتحه. اختر واحدة بدل لصق أي شيء.',
    'telegram.picker.use': 'استخدم هذه المجموعة',
    'telegram.picker.bound': 'مضافة مسبقاً',
    'telegram.picker.selected': 'سيتم استخدام {name}. يُعاد التحقق منها قبل الحفظ.',
    'telegram.picker.private': 'مجموعة خاصة',
    'telegram.picker.loading': 'جاري البحث عن المجموعات…',
    'telegram.picker.error': 'تعذّر تحميل المجموعات. الصق رابطاً بدلاً من ذلك.',
    'telegram.picker.empty.title': 'البوت ليس في أي مجموعة بعد',
    'telegram.picker.empty.body':
      'أضف البوت إلى مجموعتك أو قناتك واجعله admin. ستظهر هنا فور إبلاغ Telegram لنا — خلال ثانية أو ثانيتين عادةً. لا حاجة للصق أي شيء.',
    'telegram.picker.or': 'أو الصق رابطاً',

    'telegram.picker.status.CREATOR': 'البوت هو مالك هذه المحادثة',
    'telegram.picker.status.ADMINISTRATOR': 'البوت admin هنا',
    'telegram.picker.status.MEMBER': 'البوت عضو وليس admin — قم بترقيته',
    'telegram.picker.status.RESTRICTED': 'البوت مقيّد هنا وقد لا يستطيع النشر',
    'telegram.picker.status.LEFT': 'البوت غادر هذه المحادثة',
    'telegram.picker.status.KICKED': 'تمت إزالة البوت من هذه المحادثة',
    'telegram.field.displayName': 'التسمية (اختياري)',
    'telegram.field.displayName.hint': 'الاسم الذي يظهر هنا. الافتراضي هو اسم المجموعة نفسه.',
    'telegram.field.categories': 'أرسل هنا',
    'telegram.field.categories.hint':
      'واحدة على الأقل. وجهة لا تستقبل شيئاً ستبدو مضبوطة بلا فائدة.',
    'telegram.field.active': 'مفعّلة',

    'telegram.col.destination': 'الوجهة',
    'telegram.col.type': 'النوع',
    'telegram.col.categories': 'تستقبل',
    'telegram.col.status': 'الحالة',
    'telegram.col.lastPublished': 'آخر نشر',
    'telegram.col.actions': 'إجراءات',

    'telegram.status.active': 'مفعّلة',
    'telegram.status.inactive': 'معطّلة',
    'telegram.status.neverVerified': 'لم يتم التحقق بعد',
    'telegram.status.verified': 'تم التحقق {when}',
    'telegram.status.neverPublished': 'لم يُرسل شيء بعد',

    'telegram.action.test': 'إرسال رسالة اختبار',
    'telegram.action.check': 'إعادة الفحص',
    'telegram.action.edit': 'تعديل',
    'telegram.action.remove': 'إزالة',
    'telegram.action.enable': 'تفعيل',
    'telegram.action.disable': 'تعطيل',

    'telegram.remove.title': 'إزالة هذه الوجهة؟',
    'telegram.remove.body':
      'سيتوقف البوت عن النشر في {name}. لا يُحذف شيء — إضافة المجموعة نفسها مرة أخرى تُعيدها بسجلّها.',
    'telegram.remove.confirm': 'إزالة',

    'telegram.test.ok': 'وصلت رسالة الاختبار إلى {name}.',
    'telegram.test.failed': 'لم تصل رسالة الاختبار.',
    'telegram.checked.ok': '{name} قابلة للوصول.',

    'telegram.reason.INVALID_URL':
      'هذه ليست مجموعة أو قناة على تيليغرام. الصق @username الخاص بالمجموعة أو رابط t.me أو رقم الـ chat id.',
    'telegram.reason.NOT_FOUND':
      'تيليغرام لا يعرف هذه المحادثة، أو أن البوت لا يراها. أضف البوت إلى المجموعة أولاً ثم أعد المحاولة.',
    'telegram.reason.PRIVATE_CHAT':
      'هذه محادثة خاصة بين شخصين. النشر يكون في المجموعات والقنوات فقط.',
    'telegram.reason.BOT_NOT_MEMBER':
      'البوت ليس في تلك المجموعة. على أحد أعضائها إضافته ثم جعله admin.',
    'telegram.reason.BOT_NOT_ADMIN':
      'البوت داخل المجموعة لكنه ليس admin. على أحد مشرفي المجموعة ترقيته.',
    'telegram.reason.BOT_CANNOT_POST':
      'البوت admin في القناة لكن صلاحية «Post messages» مغلقة. فعّل هذه الصلاحية.',
    'telegram.reason.DUPLICATE':
      'هذه المجموعة وجهة مضافة سلفاً. عدّل الوجهة الموجودة بدل إضافتها مرتين.',
    'telegram.reason.SEND_FAILED': 'رفض تيليغرام الرسالة.',
    'telegram.reason.UNDELIVERABLE': 'يفيد تيليغرام بأن هذه المحادثة غير قابلة للوصول.',

    'telegram.fact.member': 'داخل المجموعة',
    'telegram.fact.admin': 'admin',
    'telegram.fact.canPost': 'يستطيع النشر',

    'telegram.category.NEW_PLAYER': 'اللاعبون الجدد',
    'telegram.category.DEPOSIT': 'الإيداعات',
    'telegram.category.WITHDRAWAL': 'السحوبات',
    'telegram.category.PROFIT': 'الأرباح',
    'telegram.category.SHAM_CASH_DEPOSIT': 'Sham Cash وارد',
    'telegram.category.SHAM_CASH_WITHDRAWAL': 'Sham Cash صادر',
    'telegram.category.USDT_DEPOSIT': 'USDT وارد',
    'telegram.category.USDT_WITHDRAWAL': 'USDT صادر',
    'telegram.category.PLAYER_STATUS_CHANGE': 'تغيّر حالة اللاعب',
    'telegram.category.REPORT': 'التقارير',
    'telegram.category.SYSTEM_ALERT': 'تنبيهات النظام',

    'telegram.category.notLive': 'لا شيء ينشر هذا بعد',
    'telegram.category.notLive.hint': 'يمكنك الاشتراك بها الآن، وستصلك عندما تبدأ المنصة بإنتاجها.',

    'telegram.report.title': 'نشر تقرير',
    'telegram.report.body': 'أرسل تقرير النشاط إلى كل وجهة تستقبل التقارير.',
    'telegram.report.period.day': 'اليوم',
    'telegram.report.period.week': 'هذا الأسبوع',
    'telegram.report.period.month': 'هذا الشهر',
    'telegram.report.publish': 'نشر',
    'telegram.report.sent': {
      zero: 'لم تُرسل {title} إلى أي وجهة.',
      one: 'نُشرت {title} في وجهة واحدة.',
      two: 'نُشرت {title} في وجهتين.',
      few: 'نُشرت {title} في {count} وجهات.',
      many: 'نُشرت {title} في {count} وجهة.',
      other: 'نُشرت {title} في {count} وجهة.',
    },
    'telegram.report.none': 'لم يُرسل شيء: لا توجد وجهة مشتركة بالتقارير بعد.',
    'telegram.report.partial':
      '{title}: وصلت إلى {delivered} من {considered}. راجع الوجهات المتعثّرة أدناه.',
  },
});
