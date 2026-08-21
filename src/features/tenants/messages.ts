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
    'tenants.noBotUsernameYet': 'no bot username yet',
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
    'tenants.field.webhook': 'Webhook',

    // ── The detail panel ─────────────────────────────────────────────────────────────────────
    'tenants.detail.fallbackTitle': 'Tenant',
    'tenants.detail.loading': 'Loading this tenant.',
    'tenants.detail.slug': 'Slug {slug}',
    'tenants.editSettings': 'Edit settings',
    'tenants.section.identity': 'Identity',
    'tenants.section.money': 'Money and review rules',
    'tenants.section.wiring': 'Ichancy and Telegram wiring',
    'tenants.webhook.configured': 'webhook configured',
    'tenants.webhook.missing': 'no webhook yet',
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
      'Staff belong to one operator, so the same Telegram account can hold a separate admin row inside every operator you run. This creates yours inside {name}.',
    'tenants.addMe.target': 'This admin row will be written into',
    'tenants.addMe.you': 'Your Telegram account',
    'tenants.addMe.youHint':
      'Taken from the session you are signed in with. This is the account that will send /console.',
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
      'This Telegram account already holds an admin row inside {name}. Nothing changed, and nothing needed to.',
    'tenants.addMe.nextStepTitle': 'Next: sign in to {name}',
    'tenants.addMe.nextStepWithBot':
      'Send /console to @{bot} — that operator’s own bot. A code from any other bot signs you into the operator that bot belongs to, not into {name}.',
    'tenants.addMe.nextStepNoBot':
      'Send /console to the bot whose token {name} was created with. This operator has no bot username recorded yet, so confirm which bot that is in BotFather — a code from any other bot signs you into the operator that bot belongs to.',

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
      'One operator: one Telegram bot, one Ichancy agent, one currency.',
    'tenants.create.submit': 'Create tenant',
    'tenants.create.suspendedTitle': 'This tenant will be created suspended',
    'tenants.create.suspendedBody':
      'Nothing on this form can prove the agent id belongs to the username above it, and a correct username paired with the wrong agent id registers real players under another operator. So a new tenant lands suspended and serves nobody until you activate it — which is the moment the backend actually signs in to Ichancy and finds out.',
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
    'tenants.hint.slug': 'Lowercase, hyphenated, permanent. It appears in every log line.',
    'tenants.hint.botToken':
      'Stored write-only. It is never returned again, here or anywhere else.',
    'tenants.hint.agentId': 'Checked for the first time when you activate the tenant.',
    'tenants.hint.currencyCode':
      'Permanent: it is the unit of every amount this tenant will ever record.',
    'tenants.hint.feedChatId':
      'Leaving this empty keeps the current one: the API has no way to unset a feed chat.',
    'tenants.hint.expiryRange': '{min} to {max}.',
    'tenants.hint.minorUnits': 'Minor units — 150000 means 1,500.00',
    'tenants.hint.minorPreview': '= {preview}',
    'tenants.placeholder.displayName': 'Northern branch',

    // ── Validation ───────────────────────────────────────────────────────────────────────────
    'tenants.validation.slug':
      'Lowercase letters, digits and hyphens; 3 to 32 characters, starting with a letter and ending with a letter or digit.',
    'tenants.validation.displayName': 'Give the operator a name people will recognise.',
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
  },

  ar: {
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
    'tenants.noBotUsernameYet': 'لا يوجد اسم مستخدم للبوت بعد',
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
    'tenants.field.webhook': 'الـ webhook',

    'tenants.detail.fallbackTitle': 'المشغّل',
    'tenants.detail.loading': 'جارٍ تحميل بيانات هذا المشغّل.',
    'tenants.detail.slug': 'المعرّف النصي {slug}',
    'tenants.editSettings': 'تعديل الإعدادات',
    'tenants.section.identity': 'التعريف',
    'tenants.section.money': 'المبالغ وقواعد المراجعة',
    'tenants.section.wiring': 'الربط مع Ichancy وTelegram',
    'tenants.webhook.configured': 'تم ضبط الـ webhook',
    'tenants.webhook.missing': 'لا يوجد webhook بعد',
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
      'الموظفون يخصّون مشغّلاً واحداً، فيمكن لحساب Telegram نفسه أن يملك سجل مدير مستقلاً داخل كل مشغّل تديره. هذا ينشئ سجلك داخل {name}.',
    'tenants.addMe.target': 'سيُكتب سجل المدير هذا داخل',
    'tenants.addMe.you': 'حساب Telegram الخاص بك',
    'tenants.addMe.youHint':
      'مأخوذ من الجلسة التي سجّلت دخولك بها. هذا هو الحساب الذي سيرسل ‎/console‎.',
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
      'حساب Telegram هذا يملك سجل مدير داخل {name} من قبل. لم يتغيّر شيء، ولا حاجة لأن يتغيّر.',
    'tenants.addMe.nextStepTitle': 'الخطوة التالية: سجّل الدخول إلى {name}',
    'tenants.addMe.nextStepWithBot':
      'أرسل ‎/console‎ إلى ‎@{bot}‎ — بوت هذا المشغّل نفسه. الرمز الآتي من أي بوت آخر يُدخلك إلى المشغّل التابع له ذلك البوت، لا إلى {name}.',
    'tenants.addMe.nextStepNoBot':
      'أرسل ‎/console‎ إلى البوت الذي أُنشئ {name} برمزه. لا يوجد اسم مستخدم مسجّل لبوت هذا المشغّل بعد، فتأكد من هويته في BotFather — الرمز الآتي من أي بوت آخر يُدخلك إلى المشغّل التابع له ذلك البوت.',

    'tenants.role.SUPER_ADMIN':
      'أعلى صلاحية داخل مشغّل واحد. كل ما فيه، بما في ذلك الموظفون وحدود الموافقة.',
    'tenants.role.FINANCE_ADMIN': 'يقرّر في الإيداعات، ويدير قنوات الدفع، ويعالج فروقات التسوية.',
    'tenants.role.REVIEWER': 'يراجع الإيداعات ويقرّر فيها. لا يستطيع تغيير قنوات الدفع ولا الموظفين.',
    'tenants.role.SUPPORT':
      'يطّلع على اللاعبين والإيداعات وقنوات الدفع للإجابة على الأسئلة. لا يقرّر شيئاً.',
    'tenants.role.VIEWER': 'اطّلاع فقط على قائمة الإيداعات والتسوية.',

    'tenants.create.description': 'مشغّل واحد: بوت Telegram واحد، ووكيل Ichancy واحد، وعملة واحدة.',
    'tenants.create.submit': 'إنشاء المشغّل',
    'tenants.create.suspendedTitle': 'سيُنشأ هذا المشغّل موقوفاً',
    'tenants.create.suspendedBody':
      'لا شيء في هذه الاستمارة يثبت أن معرّف الوكيل يخص اسم المستخدم الذي فوقه، واسم مستخدم صحيح مع معرّف وكيل خاطئ يسجّل لاعبين حقيقيين تحت مشغّل آخر. لذلك يُنشأ المشغّل الجديد موقوفاً ولا يخدم أحداً حتى تفعّله — وعندها فقط يسجّل الخادم الدخول فعلياً إلى Ichancy ويتبيّن الأمر.',
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

    'tenants.hint.slug': 'حروف إنجليزية صغيرة وشرطات، ودائم. يظهر في كل سطر سجل.',
    'tenants.hint.botToken': 'يُحفظ للكتابة فقط. لا يُعاد إظهاره مرة أخرى، لا هنا ولا في أي مكان.',
    'tenants.hint.agentId': 'يُتحقق منه لأول مرة عند تفعيل المشغّل.',
    'tenants.hint.currencyCode': 'دائم: هو وحدة كل مبلغ سيسجّله هذا المشغّل.',
    'tenants.hint.feedChatId':
      'ترك الحقل فارغاً يبقي القناة الحالية: الخادم لا يوفّر طريقة لإزالتها.',
    'tenants.hint.expiryRange': 'من {min} إلى {max}.',
    'tenants.hint.minorUnits': 'وحدات صغرى — 150000 تعني 1,500.00',
    'tenants.hint.minorPreview': '= {preview}',
    'tenants.placeholder.displayName': 'الفرع الشمالي',

    'tenants.validation.slug':
      'حروف إنجليزية صغيرة وأرقام وشرطات؛ من 3 إلى 32 خانة، تبدأ بحرف وتنتهي بحرف أو رقم.',
    'tenants.validation.displayName': 'أعطِ المشغّل اسماً يعرفه الناس.',
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
  },
});
