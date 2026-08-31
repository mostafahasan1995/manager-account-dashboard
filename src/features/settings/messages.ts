import { defineMessages } from '@/lib/i18n/messages';

/**
 * Everything the Settings screen says.
 *
 * Two tables that live outside this folder are copied in here rather than read from source:
 * `CAPABILITY_LABELS` in lib/auth/permissions.ts and `ADMIN_ROLE_DESCRIPTIONS` in types/enums.ts.
 * Both are prose shown to a person, so both have to be translated, and Settings is the only screen
 * that renders either — if a second screen ever does, they belong in the shared bundle beside the
 * `enum.adminRole.*` labels instead. The English halves are word for word the same as the maps, so
 * a change there that is not mirrored here shows up as English text on an Arabic screen.
 *
 * `X-Tenant-Id`, `docs/API-CONTRACT.md`, `/console`, CORS, Telegram and Ichancy stay in English in
 * both halves: they are things you type or grep for, not words you translate.
 */
export const settingsMessages = defineMessages({
  en: {
    'settings.page.description':
      'Your session, what your role can reach, and how this console is wired to the backend.',

    // ── You ──────────────────────────────────────────────────────────────────────────────────
    'settings.profile.title': 'You',
    'settings.profile.description': 'The admin account this console is acting as.',
    'settings.profile.noSession': 'No session is signed in on this tab.',
    'settings.profile.sessionEndsIn': 'Session ends in',
    'settings.profile.noRefreshTitle': 'Admin sessions have no refresh token',
    'settings.profile.noRefreshBefore':
      'When the countdown reaches zero this console signs you out and anything unsaved goes with it. Send',
    'settings.profile.noRefreshAfter':
      'to the cashier bot on Telegram for a new one-time code, then sign in again.',

    'settings.role.PLATFORM_ADMIN':
      'Runs the platform: creates, configures and suspends tenants. Sees no tenant data.',
    'settings.role.SUPER_ADMIN':
      'Top of one tenant. Everything inside it, including staff and approval limits.',
    'settings.role.FINANCE_ADMIN':
      'Decides deposits, manages payment rails, and works reconciliation breaks.',
    'settings.role.REVIEWER': 'Reviews and decides deposits. Cannot change rails or staff.',
    'settings.role.SUPPORT':
      'Reads players, deposits and rails to answer questions. Decides nothing.',
    'settings.role.VIEWER': 'Read-only on the deposit queue and reconciliation.',

    // ── Your access ──────────────────────────────────────────────────────────────────────────
    'settings.access.title': 'Your access',
    'settings.access.description': 'What {role} is allowed to do in this console.',
    'settings.access.signedOut': 'Sign in to see what your role can do.',
    'settings.access.noCapabilities': 'This role holds no console capabilities.',
    'settings.access.footnote':
      'Anything not on this list is hidden from you here and refused by the API. Ask a super admin if you need more.',

    'settings.capability.deposits.read': 'See the deposit queue',
    'settings.capability.deposits.decide': 'Claim, approve and reject deposits',
    'settings.capability.deposits.retryCredit': 'Retry a failed credit',
    'settings.capability.deposits.sweep': 'Run the deposit maintenance sweep',
    'settings.capability.players.read': 'See players',
    'settings.capability.players.link': 'Create a player Ichancy account',
    'settings.capability.paymentMethods.read': 'See payment methods and destinations',
    'settings.capability.paymentMethods.write': 'Change payment methods and destinations',
    'settings.capability.admins.read': 'See staff and their approval limits',
    'settings.capability.admins.write': 'Add staff and set approval limits',
    'settings.capability.reconciliation.read': 'See reconciliation breaks and rail ageing',
    'settings.capability.reconciliation.act': 'Resolve breaks, sync the float, run invariants',
    'settings.capability.tenants.manage': 'Create, configure and suspend tenants',
    'settings.capability.platformFinance.read': "See every operator's finance balances",
    'settings.capability.telegramDestinations.read': 'See where the bot publishes',
    'settings.capability.telegramDestinations.write': 'Add, change and test Telegram destinations',
    'settings.capability.reports.publish': 'Publish a report to Telegram',

    // ── Appearance ───────────────────────────────────────────────────────────────────────────
    'settings.appearance.title': 'Appearance',
    'settings.appearance.description':
      'Saved on this machine, not on your account — a shared console keeps each browser’s own choice.',
    'settings.appearance.theme': 'Theme',
    'settings.appearance.hintLight': 'Always the light palette.',
    'settings.appearance.hintDark': 'Always the dark palette.',
    'settings.appearance.hintSystem': 'Follow this machine.',
    'settings.appearance.showingLight': 'Currently showing the light palette.',
    'settings.appearance.showingDark': 'Currently showing the dark palette.',

    // ── Connection ───────────────────────────────────────────────────────────────────────────
    'settings.connection.title': 'Connection',
    'settings.connection.description':
      'The backend this console talks to, and how it is answering.',
    'settings.connection.baseUrl': 'API base URL',
    'settings.connection.mockApi': 'Mock API',
    'settings.connection.on': 'On',
    'settings.connection.off': 'Off',
    'settings.connection.mockOnHint':
      'Requests are answered in the browser by the built-in mock API. No backend is contacted and nothing you do here is saved.',
    'settings.connection.mockOffHint': 'Every request goes to the URL above.',
    'settings.connection.tenantHeader': 'Tenant header',
    'settings.connection.sent': 'Sent',
    'settings.connection.notSent': 'Not sent',
    'settings.connection.tenantHeaderOnHint':
      'X-Tenant-Id rides on every admin request. The backend must read and validate it — see the tenant gap in docs/API-CONTRACT.md.',
    'settings.connection.tenantHeaderOffHint':
      'Admin requests carry no tenant claim, so everything except Tenants answers for the default tenant — the tenant gap in docs/API-CONTRACT.md.',
    'settings.connection.health': 'Backend health',
    'settings.connection.servedFrom': 'This console is served from',
    'settings.connection.corsHint': ', which must appear in the backend’s CORS allow-list.',
    'settings.connection.liveness': 'Liveness',
    'settings.connection.noAnswer': 'No answer',
    'settings.connection.processRole': 'Process role',
    'settings.connection.runningSince': 'Running since',
    'settings.connection.readiness': 'Readiness',
    'settings.connection.ready': 'Ready',
    'settings.connection.notReady': 'Not ready',
    'settings.connection.noIndicators': 'The backend reported no readiness indicators.',
    'settings.connection.indicatorsCaption': 'Backend readiness indicators',
    'settings.connection.check': 'Check',
    'settings.connection.liveOk': 'Ok',
    'settings.connection.liveDegraded': 'Degraded',
    'settings.connection.indicatorUp': 'Up',
    'settings.connection.indicatorDown': 'Down',

    // ── Maintenance ──────────────────────────────────────────────────────────────────────────
    'settings.maintenance.title': 'Maintenance',
    'settings.maintenance.description':
      'Housekeeping the backend also runs on a schedule. Run it by hand when the queue looks stuck and you would rather not wait for the next cron.',
    'settings.maintenance.summary':
      'One pass closes deposits that ran past their payment window, hands back claims a reviewer never returned to, and pulls stuck credits back so they can be retried.',
    'settings.maintenance.run': 'Run sweep',
    'settings.maintenance.confirmTitle': 'Run the deposit sweep?',
    'settings.maintenance.confirmBody':
      'It expires deposits past their window, releases claims nobody came back to, and pulls back stuck credits. It writes to the live queue and cannot be undone.',
    'settings.maintenance.changed': {
      one: 'This pass changed {count} deposit.',
      other: 'This pass changed {count} deposits.',
    },
    'settings.maintenance.expired': 'Expired',
    'settings.maintenance.expiredMeaning':
      'Deposits that ran past their payment window and were closed.',
    'settings.maintenance.released': 'Released',
    'settings.maintenance.releasedMeaning':
      'Claims a reviewer never came back to, handed back to the queue.',
    'settings.maintenance.reaped': 'Reaped',
    'settings.maintenance.reapedMeaning':
      'Credits stuck mid-flight, pulled back so they can be retried.',
    'settings.maintenance.done': 'Sweep finished',
    'settings.maintenance.counts': '{expired} expired, {released} released, {reaped} reaped.',
    'settings.maintenance.failed': 'The sweep did not run',
  },

  ar: {
    'settings.page.description': 'جلستك، وما يصل إليه دورك، وكيف ترتبط هذه اللوحة بالخادم.',

    'settings.profile.title': 'حسابك',
    'settings.profile.description': 'حساب الإدارة الذي تعمل به هذه اللوحة.',
    'settings.profile.noSession': 'لا توجد جلسة مسجّلة في هذا التبويب.',
    'settings.profile.sessionEndsIn': 'تنتهي الجلسة بعد',
    'settings.profile.noRefreshTitle': 'جلسات الإدارة بلا تجديد تلقائي',
    'settings.profile.noRefreshBefore':
      'عند وصول العدّاد إلى الصفر تخرجك اللوحة ويضيع كل ما لم تحفظه. أرسل',
    'settings.profile.noRefreshAfter':
      'إلى بوت الصرّاف على تلغرام للحصول على رمز جديد لمرة واحدة، ثم سجّل الدخول من جديد.',

    'settings.role.PLATFORM_ADMIN':
      'يدير المنصّة: ينشئ المشغّلين ويضبطهم ويوقفهم. لا يرى بيانات أي مشغّل.',
    'settings.role.SUPER_ADMIN':
      'أعلى صلاحية داخل مشغّل واحد. كل ما فيه، بما في ذلك الموظفون وحدود الموافقة.',
    'settings.role.FINANCE_ADMIN': 'يبتّ في الإيداعات، ويدير قنوات الدفع، ويعالج فروقات التسوية.',
    'settings.role.REVIEWER': 'يراجع الإيداعات ويبتّ فيها. لا يعدّل قنوات الدفع ولا الموظفين.',
    'settings.role.SUPPORT':
      'يطّلع على اللاعبين والإيداعات وقنوات الدفع ليجيب على الاستفسارات. لا يبتّ في شيء.',
    'settings.role.VIEWER': 'اطّلاع فقط على قائمة الإيداعات والتسوية.',

    'settings.access.title': 'صلاحياتك',
    'settings.access.description': 'ما يُسمح لـ {role} بفعله في هذه اللوحة.',
    'settings.access.signedOut': 'سجّل الدخول لترى ما يستطيع دورك فعله.',
    'settings.access.noCapabilities': 'هذا الدور لا يملك أي صلاحية في اللوحة.',
    'settings.access.footnote':
      'كل ما ليس في هذه القائمة مخفي عنك هنا ويرفضه الخادم. راجع المدير العام إن احتجت المزيد.',

    'settings.capability.deposits.read': 'الاطّلاع على قائمة الإيداعات',
    'settings.capability.deposits.decide': 'حجز الإيداعات والموافقة عليها ورفضها',
    'settings.capability.deposits.retryCredit': 'إعادة محاولة إضافة فاشلة',
    'settings.capability.deposits.sweep': 'تشغيل جولة صيانة الإيداعات',
    'settings.capability.players.read': 'الاطّلاع على اللاعبين',
    'settings.capability.players.link': 'إنشاء حساب Ichancy للاعب',
    'settings.capability.paymentMethods.read': 'الاطّلاع على طرق الدفع ووجهاتها',
    'settings.capability.paymentMethods.write': 'تعديل طرق الدفع ووجهاتها',
    'settings.capability.admins.read': 'الاطّلاع على الموظفين وحدود موافقتهم',
    'settings.capability.admins.write': 'إضافة الموظفين وتحديد حدود الموافقة',
    'settings.capability.reconciliation.read': 'الاطّلاع على فروقات التسوية وتقادم القنوات',
    'settings.capability.reconciliation.act': 'إغلاق الفروقات ومزامنة الرصيد وتشغيل الفحوصات',
    'settings.capability.tenants.manage': 'إنشاء المشغّلين وضبطهم وإيقافهم',
    'settings.capability.platformFinance.read': 'الاطّلاع على أرصدة كل مشغّل المالية',
    'settings.capability.telegramDestinations.read': 'الاطّلاع على وجهات النشر في تيليغرام',
    'settings.capability.telegramDestinations.write': 'إضافة وجهات تيليغرام وتعديلها واختبارها',
    'settings.capability.reports.publish': 'نشر تقرير إلى تيليغرام',

    'settings.appearance.title': 'المظهر',
    'settings.appearance.description':
      'محفوظ على هذا الجهاز لا في حسابك — اللوحة المشتركة تحتفظ باختيار كل متصفّح على حدة.',
    'settings.appearance.theme': 'السمة',
    'settings.appearance.hintLight': 'المظهر الفاتح دائماً.',
    'settings.appearance.hintDark': 'المظهر الداكن دائماً.',
    'settings.appearance.hintSystem': 'حسب إعدادات هذا الجهاز.',
    'settings.appearance.showingLight': 'المعروض الآن هو المظهر الفاتح.',
    'settings.appearance.showingDark': 'المعروض الآن هو المظهر الداكن.',

    'settings.connection.title': 'الاتصال',
    'settings.connection.description': 'الخادم الذي تتحدث إليه هذه اللوحة، وكيف يجيب.',
    'settings.connection.baseUrl': 'عنوان الـ API',
    'settings.connection.mockApi': 'واجهة تجريبية',
    'settings.connection.on': 'مفعّلة',
    'settings.connection.off': 'معطّلة',
    'settings.connection.mockOnHint':
      'يجيب المتصفّح على الطلبات بواجهة تجريبية مدمجة. لا يُتصل بأي خادم ولا يُحفظ شيء مما تفعله هنا.',
    'settings.connection.mockOffHint': 'كل طلب يذهب إلى العنوان أعلاه.',
    'settings.connection.tenantHeader': 'ترويسة المشغّل',
    'settings.connection.sent': 'تُرسل',
    'settings.connection.notSent': 'لا تُرسل',
    'settings.connection.tenantHeaderOnHint':
      'ترافق X-Tenant-Id كل طلب إداري. على الخادم قراءتها والتحقق منها — راجع فجوة المشغّلين في docs/API-CONTRACT.md.',
    'settings.connection.tenantHeaderOffHint':
      'طلبات الإدارة لا تحمل تحديداً للمشغّل، لذا يجيب كل شيء عدا المشغّلين ببيانات المشغّل الافتراضي — فجوة المشغّلين في docs/API-CONTRACT.md.',
    'settings.connection.health': 'حالة الخادم',
    'settings.connection.servedFrom': 'تُقدَّم هذه اللوحة من',
    'settings.connection.corsHint':
      '، ويجب أن يظهر هذا العنوان في قائمة CORS المسموح بها على الخادم.',
    'settings.connection.liveness': 'نبض الخادم',
    'settings.connection.noAnswer': 'لا استجابة',
    'settings.connection.processRole': 'دور العملية',
    'settings.connection.runningSince': 'يعمل منذ',
    'settings.connection.readiness': 'الجاهزية',
    'settings.connection.ready': 'جاهز',
    'settings.connection.notReady': 'غير جاهز',
    'settings.connection.noIndicators': 'لم يذكر الخادم أي مؤشر جاهزية.',
    'settings.connection.indicatorsCaption': 'مؤشرات جاهزية الخادم',
    'settings.connection.check': 'الفحص',
    'settings.connection.liveOk': 'سليم',
    'settings.connection.liveDegraded': 'يعمل جزئياً',
    'settings.connection.indicatorUp': 'يعمل',
    'settings.connection.indicatorDown': 'متوقف',

    'settings.maintenance.title': 'الصيانة',
    'settings.maintenance.description':
      'أعمال ترتيب يشغّلها الخادم دورياً أيضاً. شغّلها بيدك حين تبدو القائمة عالقة ولا تريد انتظار الدورة التالية.',
    'settings.maintenance.summary':
      'جولة واحدة تغلق الإيداعات التي تجاوزت مهلة الدفع، وتعيد إلى القائمة الحجوزات التي لم يعد إليها المراجع، وتسحب الإضافات العالقة ليعاد تنفيذها.',
    'settings.maintenance.run': 'تشغيل الجولة',
    'settings.maintenance.confirmTitle': 'تشغيل جولة صيانة الإيداعات؟',
    'settings.maintenance.confirmBody':
      'تنهي الإيداعات التي تجاوزت مهلتها، وتحرّر الحجوزات التي لم يعد إليها أحد، وتسحب الإضافات العالقة. تكتب في القائمة الحيّة ولا يمكن التراجع عنها.',
    'settings.maintenance.changed': {
      zero: 'لم تغيّر هذه الجولة أي إيداع.',
      one: 'غيّرت هذه الجولة إيداعاً واحداً.',
      two: 'غيّرت هذه الجولة إيداعين.',
      few: 'غيّرت هذه الجولة {count} إيداعات.',
      many: 'غيّرت هذه الجولة {count} إيداعاً.',
      other: 'غيّرت هذه الجولة {count} إيداع.',
    },
    'settings.maintenance.expired': 'منتهية',
    'settings.maintenance.expiredMeaning': 'إيداعات تجاوزت مهلة الدفع فأُغلقت.',
    'settings.maintenance.released': 'مُعادة',
    'settings.maintenance.releasedMeaning': 'حجوزات لم يعد إليها المراجع، أُعيدت إلى القائمة.',
    'settings.maintenance.reaped': 'مسحوبة',
    'settings.maintenance.reapedMeaning': 'إضافات عالقة في منتصف الطريق، سُحبت ليعاد تنفيذها.',
    'settings.maintenance.done': 'انتهت الجولة',
    'settings.maintenance.counts': '{expired} منتهية، {released} مُعادة، {reaped} مسحوبة.',
    'settings.maintenance.failed': 'لم تُنفَّذ الجولة',
  },
});
