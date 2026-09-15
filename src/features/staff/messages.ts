import { defineMessages } from '@/lib/i18n/messages';
import type { Translator } from '@/lib/i18n/use-translation';

/**
 * The staff directory, in both languages.
 *
 * `DENIED` stays in English inside the Arabic half on purpose: it is the answer the backend
 * literally returns when an approval is evaluated against a missing limit, and an operator reading
 * this screen is about to go looking for that word in a log line — translating it would break the
 * search.
 *
 * The role DESCRIPTIONS live here rather than in the shared bundle because only this feature shows
 * them. The role NAMES do not: those are a backend enum and come from `useEnumLabel()`.
 */
export const staffMessages = defineMessages({
  en: {
    // ── Directory ────────────────────────────────────────────────────────────────────────────
    'staff.description':
      'Who can decide deposits, and how much each of them may release on their own. Platform admin is not a larger super admin: it runs the platform’s tenants and sees none of this tenant’s players, deposits or money.',
    'staff.add': 'Add administrator',

    'staff.empty.filteredTitle': 'No administrator matches these filters',
    'staff.empty.filteredBody':
      'Widen the role or account-state filter to see the rest of the directory.',
    'staff.empty.title': 'No administrators yet',
    'staff.empty.body': 'Nobody can sign in to this console until an administrator is added.',
    'staff.empty.showAll': 'Show the whole directory',

    'staff.table.caption': {
      one: '{count} administrator, the role they hold, and their approval authority.',
      other: '{count} administrators, the role each one holds, and their approval authority.',
    },
    'staff.column.name': 'Name',
    'staff.column.account': 'Account',
    'staff.column.lastLogin': 'Last login',
    'staff.column.added': 'Added',
    'staff.neverSignedIn': 'Never signed in',
    'staff.telegram.none': 'No Telegram account',
    'staff.noLimitBadge': 'No approval limit',
    'staff.noLimitTooltip':
      'No approval limit is in force, so the backend denies every deposit this person tries to approve.',

    // ── Filters ──────────────────────────────────────────────────────────────────────────────
    'staff.filters.allRoles': 'All roles',
    'staff.filters.accountState': 'Account state',
    'staff.filters.anyState': 'Active and deactivated',
    'staff.filters.activeOnly': 'Active only',
    'staff.filters.deactivatedOnly': 'Deactivated only',

    // ── One administrator ────────────────────────────────────────────────────────────────────
    'staff.detail.noAdminTitle': 'This link does not name an administrator',
    'staff.detail.noAdminBody': 'Open somebody from the staff directory.',
    'staff.detail.backToStaff': 'Back to staff',
    'staff.detail.allStaff': 'All staff',
    'staff.detail.identity': 'Identity',
    'staff.detail.recordId': 'Record id',
    'staff.detail.consolePassword': 'Console password',
    'staff.detail.consolePasswordSet': 'Set',
    'staff.detail.noLimitTitle': 'No approval limit is in force',
    'staff.detail.noLimitBody':
      '{name} holds a role that decides deposits, but has no open limit version. The backend evaluates every approval against an open limit, so each one they attempt comes back DENIED until a limit is set.',
    'staff.detail.limitsTitle': 'Approval limits',
    'staff.detail.limitsBody':
      'Every version, newest first. Setting a limit closes the one in force rather than editing it, so the authority behind a past decision can always be looked up.',
    'staff.detail.setLimit': 'Set a new limit',
    'staff.detail.noLimitNeeded':
      'No limit is in force. This role does not decide deposits, so nothing would evaluate one.',
    'staff.detail.deactivateTitle': 'Deactivate {name}?',
    'staff.detail.deactivateBody':
      'They can no longer sign in. Nothing is deleted: every deposit they decided stays attributed to them, and a super admin can reactivate the record later.',
    'staff.detail.deactivatedToast': '{name} can no longer sign in.',

    'staff.apiRefused': 'The API refused this',
    'staff.refusal.selfModification':
      'Nobody edits or deactivates their own administrator record. Ask another super admin to do it.',
    'staff.refusal.lastSuperAdmin':
      'A tenant has to keep one active super admin, or nothing could grant a role again. Promote someone else first.',

    // ── What each role is allowed to do ──────────────────────────────────────────────────────
    'staff.role.PLATFORM_ADMIN':
      'Runs the platform: creates, configures and suspends tenants. Sees no tenant data.',
    'staff.role.SUPER_ADMIN':
      'Top of one tenant. Everything inside it, including staff and approval limits.',
    'staff.role.FINANCE_ADMIN':
      'Decides deposits, manages payment rails, and works reconciliation breaks.',
    'staff.role.REVIEWER': 'Reviews and decides deposits. Cannot change rails or staff.',
    'staff.role.SUPPORT': 'Reads players, deposits and rails to answer questions. Decides nothing.',
    'staff.role.VIEWER': 'Read-only on the deposit queue and reconciliation.',

    // ── Add / edit an administrator ──────────────────────────────────────────────────────────
    'staff.form.editTitle': 'Edit {name}',
    'staff.form.addBody':
      'A username and a password is the whole account. Hand them both over, and this person can sign in.',
    'staff.form.editBody':
      'Everything here can be changed. Leave the password blank to keep the current one.',
    'staff.form.displayNamePlaceholder': 'Lina Farah',
    'staff.form.username': 'Username',
    'staff.form.usernameHintNew':
      'What they type to sign in. A name or an email, unique to this operator.',
    'staff.form.usernameHintEdit':
      'What they type to sign in. Leaving this blank keeps the current one — the API has no way to remove it.',
    'staff.form.password': 'Password',
    'staff.form.passwordHintNew': 'At least 8 characters. Give it to them yourself.',
    'staff.form.passwordHintEdit': 'Leave blank to keep the current password.',
    'staff.form.accountActive': 'Account active',
    'staff.form.accountActiveHint':
      'A deactivated administrator cannot sign in. Their past decisions stay attributed to them.',
    'staff.form.saveChanges': 'Save changes',
    'staff.form.duplicate':
      'That username is already taken here. Pick another, or find the existing account in the directory and reactivate it.',
    'staff.form.createdToast': '{name} can now sign in.',
    'staff.form.updatedToast': '{name} updated.',
    'staff.form.error.displayNameRequired':
      'Give this person a name their colleagues will recognise.',
    'staff.form.error.displayNameLong': 'Keep the display name under 120 characters.',
    'staff.form.error.username':
      'A username is 3 to 64 characters: letters, digits, and . _ @ + - only.',
    'staff.form.error.passwordShort': 'Passwords are at least 8 characters.',
    'staff.form.error.passwordLong': 'Passwords are at most 72 characters.',

    // ── Approval limits ──────────────────────────────────────────────────────────────────────
    'staff.limit.maxSingle': 'Max single approval',
    'staff.limit.maxDaily': 'Max daily approval',
    'staff.limit.secondAbove': 'Second approval above',
    'staff.limit.inForce': 'In force now',
    'staff.limit.ended': 'Ended',
    'staff.limit.inForceSince': 'In force since',
    'staff.limit.neverSecond': 'Never — approves alone at any amount',
    'staff.limit.end': 'End this limit',
    'staff.limit.emptyTitle': 'No approval limit has ever been set',
    'staff.limit.emptyBody':
      '{name} has no authority to approve deposits: the backend evaluates every approval against an open limit, and with none it answers DENIED.',
    'staff.limit.endedToast': '{name} now has no approval limit and can approve nothing.',
    'staff.limit.endConfirmTitle': 'End this approval limit?',
    'staff.limit.endConfirmLead':
      'This does not replace the limit — it revokes it. {name} is left with',
    'staff.limit.endConfirmNone': 'no approval limit at all',
    'staff.limit.endConfirmMiddle':
      ', and the backend evaluates every approval against an open limit, so from that moment each deposit they try to approve comes back',
    'staff.limit.endConfirmTail':
      '. The version stays in the timeline, closed as of now: history here is never rewritten.',
    'staff.limit.endConfirmAction': 'End the limit',

    'staff.limit.setTitle': 'Set a new approval limit',
    'staff.limit.setBody':
      'What {name} may release on their own, and above what amount a second approver is required.',
    'staff.limit.warnTitle': 'This closes the current version, it does not edit it',
    'staff.limit.warnBody':
      'Saving opens a new version effective now and closes the one in force. The old version stays in the timeline with the dates it applied — history here is never rewritten, so a decision taken last week can always be checked against the limit that was live last week.',
    'staff.limit.currencyHint': 'The limit applies to this currency only.',
    'staff.limit.maxSingleHint': 'The largest deposit this administrator may approve at once.',
    'staff.limit.maxDailyHint': 'The total they may approve across one day.',
    'staff.limit.secondAboveHint':
      'Leave blank if this administrator never needs a second approver.',
    'staff.limit.submit': 'Close current version and set this one',
    'staff.limit.setToast': 'New approval limit in force for {name}.',
    'staff.limit.error.required': '{field} is required.',
    'staff.limit.error.format':
      '{field} must be a plain decimal amount like 500000.00 — no thousands separators, no currency symbol.',
    'staff.limit.error.negative': '{field} cannot be negative.',
    'staff.limit.error.currency': 'A three-letter currency code, for example NSP.',
    'staff.limit.error.secondAbove':
      'The second-approval threshold must be a plain decimal amount, or blank for never.',

    // ── Linking a staff account to Telegram ──────────────────────────────────────────────────
    'staff.telegram.row': 'Telegram link',
    'staff.telegram.linked': 'Linked',
    'staff.telegram.notLinked': 'Not linked',
    'staff.telegram.linkedHint': 'Their Approve and Reject taps in the staff group count as theirs.',
    'staff.telegram.notLinkedHint':
      'Their taps in the staff group are refused until this account is linked.',
    'staff.telegram.link': 'Link Telegram',
    'staff.telegram.unlink': 'Unlink',
    'staff.telegram.dialogTitle': 'Link {name} to Telegram',
    'staff.telegram.dialogBody':
      'The code links whichever Telegram account sends it. Only {name} should send it, from the Telegram account they approve deposits with.',
    'staff.telegram.issuing': 'Getting a code…',
    'staff.telegram.codeLabel': 'One-time code',
    'staff.telegram.stepOpenBot': '1. Open @{bot} in a private chat.',
    'staff.telegram.stepOpenAnyBot': '1. Open this operator’s bot in a private chat.',
    'staff.telegram.stepSend': '2. Send exactly this, as a new message:',
    'staff.telegram.openBot': 'Open @{bot}',
    'staff.telegram.timeLeft': 'Works once. Time left:',
    'staff.telegram.neverInGroup':
      'Never post the code in a group: a code sent in a group is cancelled. An edited message is not read, so fix a typo by sending the command again.',
    'staff.telegram.waiting': 'Waiting for the code to reach the bot. This page checks every few seconds.',
    'staff.telegram.newCode': 'Get a new code',
    'staff.telegram.done': 'Done',
    'staff.telegram.linkedTitle': '{name} is linked to Telegram',
    'staff.telegram.linkedBody': 'Their taps in the staff group count from now on.',
    'staff.telegram.errorTitle': 'Could not get a code',
    'staff.telegram.unlinkTitle': 'Unlink {name} from Telegram?',
    'staff.telegram.unlinkBody':
      'Their taps in the staff group are refused from this moment, and a code not yet used stops working. They can link again with a new code.',
    'staff.telegram.unlinkedToast': '{name} is no longer linked to Telegram.',
    'staff.telegram.unlinkErrorTitle': 'Could not unlink',
  },

  ar: {
    'staff.description':
      'من يقرّر في الإيداعات، وكم يستطيع كل واحد منهم أن يُفرج عنه بمفرده. مدير المنصّة ليس مديراً عاماً أكبر: هو يدير مشغّلي المنصّة ولا يرى لاعبي هذا المشغّل ولا إيداعاته ولا أمواله.',
    'staff.add': 'إضافة مدير',

    'staff.empty.filteredTitle': 'لا يوجد مدير يطابق عوامل التصفية هذه',
    'staff.empty.filteredBody': 'وسّع تصفية الدور أو حالة الحساب لرؤية بقية الدليل.',
    'staff.empty.title': 'لا يوجد مديرون بعد',
    'staff.empty.body': 'لا أحد يستطيع الدخول إلى هذه اللوحة حتى تتم إضافة مدير.',
    'staff.empty.showAll': 'عرض الدليل كاملاً',

    'staff.table.caption': {
      zero: 'لا مديرين هنا.',
      one: 'مدير واحد، ودوره وصلاحيته في الموافقة.',
      two: 'مديران، ودور كل منهما وصلاحيته في الموافقة.',
      few: '{count} مديرين، ودور كل واحد وصلاحيته في الموافقة.',
      many: '{count} مديراً، ودور كل واحد وصلاحيته في الموافقة.',
      other: '{count} مدير، ودور كل واحد وصلاحيته في الموافقة.',
    },
    'staff.column.name': 'الاسم',
    'staff.column.account': 'الحساب',
    'staff.column.lastLogin': 'آخر دخول',
    'staff.column.added': 'تاريخ الإضافة',
    'staff.neverSignedIn': 'لم يسجّل الدخول قط',
    'staff.telegram.none': 'لا يوجد حساب تلغرام',
    'staff.noLimitBadge': 'بلا حد موافقة',
    'staff.noLimitTooltip':
      'لا يوجد حد موافقة ساري، لذا يرفض الخادم كل إيداع يحاول هذا الشخص الموافقة عليه.',

    'staff.filters.allRoles': 'كل الأدوار',
    'staff.filters.accountState': 'حالة الحساب',
    'staff.filters.anyState': 'النشط والموقوف',
    'staff.filters.activeOnly': 'النشط فقط',
    'staff.filters.deactivatedOnly': 'الموقوف فقط',

    'staff.detail.noAdminTitle': 'هذا الرابط لا يحدّد أي مدير',
    'staff.detail.noAdminBody': 'افتح أحد الأشخاص من دليل الموظفين.',
    'staff.detail.backToStaff': 'العودة إلى الموظفين',
    'staff.detail.allStaff': 'كل الموظفين',
    'staff.detail.identity': 'الهوية',
    'staff.detail.recordId': 'معرّف السجل',
    'staff.detail.consolePassword': 'كلمة مرور اللوحة',
    'staff.detail.consolePasswordSet': 'مضبوطة',
    'staff.detail.noLimitTitle': 'لا يوجد حد موافقة ساري',
    'staff.detail.noLimitBody':
      '{name} يحمل دوراً يقرّر في الإيداعات، لكن لا توجد لديه نسخة حد مفتوحة. الخادم يقيّم كل موافقة مقابل حد مفتوح، لذا تعود كل محاولة موافقة بنتيجة DENIED حتى يُضبط له حد.',
    'staff.detail.limitsTitle': 'حدود الموافقة',
    'staff.detail.limitsBody':
      'كل النسخ، الأحدث أولاً. ضبط حد جديد يغلق الحد الساري بدل تعديله، حتى تبقى الصلاحية التي بُني عليها قرار سابق قابلة للمراجعة دائماً.',
    'staff.detail.setLimit': 'ضبط حد جديد',
    'staff.detail.noLimitNeeded':
      'لا يوجد حد ساري. هذا الدور لا يقرّر في الإيداعات، فلا شيء سيقيّم حداً أصلاً.',
    'staff.detail.deactivateTitle': 'إيقاف {name}؟',
    'staff.detail.deactivateBody':
      'لن يعود بإمكانه تسجيل الدخول. لا شيء يُحذف: كل إيداع قرّر فيه يبقى منسوباً إليه، ويستطيع المدير العام إعادة تفعيل السجل لاحقاً.',
    'staff.detail.deactivatedToast': 'لم يعد بإمكان {name} تسجيل الدخول.',

    'staff.apiRefused': 'الخادم رفض هذا الطلب',
    'staff.refusal.selfModification':
      'لا أحد يعدّل سجله كمدير أو يوقفه بنفسه. اطلب من مدير عام آخر أن يفعل ذلك.',
    'staff.refusal.lastSuperAdmin':
      'يجب أن يبقى لكل مشغّل مدير عام نشط واحد على الأقل، وإلا لن يستطيع أحد منح الأدوار مجدداً. رقِّ شخصاً آخر أولاً.',

    'staff.role.PLATFORM_ADMIN':
      'يدير المنصّة: ينشئ المشغّلين ويضبطهم ويوقفهم. لا يرى بيانات أي مشغّل.',
    'staff.role.SUPER_ADMIN':
      'أعلى صلاحية داخل مشغّل واحد. كل ما فيه، بما في ذلك الموظفون وحدود الموافقة.',
    'staff.role.FINANCE_ADMIN': 'يقرّر في الإيداعات، ويدير قنوات الدفع، ويعالج فروقات التسوية.',
    'staff.role.REVIEWER': 'يراجع الإيداعات ويقرّر فيها. لا يستطيع تغيير قنوات الدفع ولا الموظفين.',
    'staff.role.SUPPORT':
      'يطّلع على اللاعبين والإيداعات وقنوات الدفع للإجابة على الأسئلة. لا يقرّر شيئاً.',
    'staff.role.VIEWER': 'اطّلاع فقط على قائمة الإيداعات والتسوية.',

    'staff.form.editTitle': 'تعديل {name}',
    'staff.form.addBody':
      'اسم مستخدم وكلمة مرور هما الحساب كله. سلّمهما له ليتمكن من تسجيل الدخول.',
    'staff.form.editBody': 'كل ما هنا قابل للتعديل. اترك كلمة المرور فارغة للإبقاء على الحالية.',
    'staff.form.displayNamePlaceholder': 'لينا فرح',
    'staff.form.username': 'اسم المستخدم',
    'staff.form.usernameHintNew':
      'ما سيكتبه لتسجيل الدخول. اسم أو بريد إلكتروني، لا يتكرر عند هذا المشغّل.',
    'staff.form.usernameHintEdit':
      'ما سيكتبه لتسجيل الدخول. تركه فارغاً يبقي الاسم الحالي — لا توجد في الخادم طريقة لإزالته.',
    'staff.form.password': 'كلمة المرور',
    'staff.form.passwordHintNew': '8 أحرف على الأقل. سلّمها له بنفسك.',
    'staff.form.passwordHintEdit': 'اتركها فارغة لإبقاء كلمة المرور الحالية.',
    'staff.form.accountActive': 'الحساب نشط',
    'staff.form.accountActiveHint':
      'المدير الموقوف لا يستطيع تسجيل الدخول. وقراراته السابقة تبقى منسوبة إليه.',
    'staff.form.saveChanges': 'حفظ التعديلات',
    'staff.form.duplicate':
      'اسم المستخدم هذا مستخدم بالفعل هنا. اختر غيره، أو ابحث عن الحساب الموجود في الدليل وأعد تفعيله.',
    'staff.form.createdToast': 'يستطيع {name} الآن تسجيل الدخول.',
    'staff.form.updatedToast': 'تم تحديث {name}.',
    'staff.form.error.displayNameRequired': 'اكتب اسماً يعرفه زملاؤه.',
    'staff.form.error.displayNameLong': 'أبقِ الاسم الظاهر أقل من 120 حرفاً.',
    'staff.form.error.username':
      'اسم المستخدم من 3 إلى 64 حرفاً: حروف وأرقام والرموز . _ @ + - فقط.',
    'staff.form.error.passwordShort': 'كلمة المرور 8 أحرف على الأقل.',
    'staff.form.error.passwordLong': 'كلمة المرور 72 حرفاً كحد أقصى.',

    'staff.limit.maxSingle': 'الحد الأقصى للموافقة الواحدة',
    'staff.limit.maxDaily': 'الحد الأقصى اليومي للموافقات',
    'staff.limit.secondAbove': 'موافقة ثانية فوق',
    'staff.limit.inForce': 'ساري الآن',
    'staff.limit.ended': 'منتهٍ',
    'staff.limit.inForceSince': 'ساري',
    'staff.limit.neverSecond': 'أبداً — يوافق بمفرده على أي مبلغ',
    'staff.limit.end': 'إنهاء هذا الحد',
    'staff.limit.emptyTitle': 'لم يُضبط أي حد موافقة إطلاقاً',
    'staff.limit.emptyBody':
      'لا يملك {name} أي صلاحية للموافقة على الإيداعات: الخادم يقيّم كل موافقة مقابل حد مفتوح، وبلا حد يردّ بـ DENIED.',
    'staff.limit.endedToast': 'لم يعد لدى {name} أي حد موافقة، ولا يستطيع الموافقة على شيء.',
    'staff.limit.endConfirmTitle': 'إنهاء حد الموافقة هذا؟',
    'staff.limit.endConfirmLead': 'هذا لا يستبدل الحد — بل يلغيه. سيبقى {name}',
    'staff.limit.endConfirmNone': 'بلا أي حد موافقة إطلاقاً',
    'staff.limit.endConfirmMiddle':
      '، والخادم يقيّم كل موافقة مقابل حد مفتوح، لذا من تلك اللحظة يعود كل إيداع يحاول الموافقة عليه بنتيجة',
    'staff.limit.endConfirmTail':
      '. تبقى النسخة في السجل مغلقة اعتباراً من الآن: التاريخ هنا لا يُعاد كتابته أبداً.',
    'staff.limit.endConfirmAction': 'إنهاء الحد',

    'staff.limit.setTitle': 'ضبط حد موافقة جديد',
    'staff.limit.setBody':
      'ما الذي يستطيع {name} الإفراج عنه بمفرده، وفوق أي مبلغ يلزم موافق ثانٍ.',
    'staff.limit.warnTitle': 'هذا يغلق النسخة الحالية ولا يعدّلها',
    'staff.limit.warnBody':
      'الحفظ يفتح نسخة جديدة سارية من الآن ويغلق النسخة الحالية. تبقى النسخة القديمة في السجل بالتواريخ التي طُبّقت فيها — التاريخ هنا لا يُعاد كتابته، فأي قرار اتُّخذ الأسبوع الماضي يمكن دائماً مراجعته مقابل الحد الذي كان سارياً وقتها.',
    'staff.limit.currencyHint': 'ينطبق الحد على هذه العملة وحدها.',
    'staff.limit.maxSingleHint': 'أكبر إيداع يستطيع هذا المدير الموافقة عليه دفعة واحدة.',
    'staff.limit.maxDailyHint': 'مجموع ما يستطيع الموافقة عليه خلال يوم واحد.',
    'staff.limit.secondAboveHint': 'اتركه فارغاً إذا كان هذا المدير لا يحتاج موافقاً ثانياً أبداً.',
    'staff.limit.submit': 'إغلاق النسخة الحالية وضبط هذه',
    'staff.limit.setToast': 'حد موافقة جديد ساري الآن لـ {name}.',
    'staff.limit.error.required': '{field}: هذا الحقل مطلوب.',
    'staff.limit.error.format':
      '{field}: يجب أن يكون مبلغاً عشرياً بسيطاً مثل 500000.00 — بلا فواصل آلاف وبلا رمز عملة.',
    'staff.limit.error.negative': '{field}: لا يمكن أن يكون سالباً.',
    'staff.limit.error.currency': 'رمز عملة من ثلاثة أحرف، مثل NSP.',
    'staff.limit.error.secondAbove':
      'حد الموافقة الثانية يجب أن يكون مبلغاً عشرياً بسيطاً، أو فارغاً إذا لم يكن مطلوباً أبداً.',

    'staff.telegram.row': 'ربط تلغرام',
    'staff.telegram.linked': 'مربوط',
    'staff.telegram.notLinked': 'غير مربوط',
    'staff.telegram.linkedHint': 'ضغطاته على «موافقة» و«رفض» في مجموعة الموظفين تُحسب له.',
    'staff.telegram.notLinkedHint': 'تُرفض ضغطاته في مجموعة الموظفين حتى يُربط هذا الحساب.',
    'staff.telegram.link': 'ربط تلغرام',
    'staff.telegram.unlink': 'فك الربط',
    'staff.telegram.dialogTitle': 'ربط {name} بتلغرام',
    'staff.telegram.dialogBody':
      'يربط الرمز حساب تلغرام الذي يرسله أياً كان. يجب أن يرسله {name} وحده، من حساب تلغرام الذي يوافق به على الإيداعات.',
    'staff.telegram.issuing': 'جارٍ الحصول على رمز…',
    'staff.telegram.codeLabel': 'رمز لمرة واحدة',
    'staff.telegram.stepOpenBot': '1. افتح ‎@{bot} في محادثة خاصة.',
    'staff.telegram.stepOpenAnyBot': '1. افتح بوت هذا المشغّل في محادثة خاصة.',
    'staff.telegram.stepSend': '2. أرسل هذا حرفياً، في رسالة جديدة:',
    'staff.telegram.openBot': 'افتح ‎@{bot}',
    'staff.telegram.timeLeft': 'يعمل مرة واحدة. الوقت المتبقي:',
    'staff.telegram.neverInGroup':
      'لا تنشر الرمز في مجموعة أبداً: الرمز المرسل في مجموعة يُلغى. والرسالة المعدّلة لا تُقرأ، فصحّح أي خطأ بإرسال الأمر من جديد.',
    'staff.telegram.waiting': 'بانتظار وصول الرمز إلى البوت. تتحقق هذه الصفحة كل بضع ثوانٍ.',
    'staff.telegram.newCode': 'الحصول على رمز جديد',
    'staff.telegram.done': 'تم',
    'staff.telegram.linkedTitle': 'رُبط {name} بتلغرام',
    'staff.telegram.linkedBody': 'ضغطاته في مجموعة الموظفين تُحسب من الآن.',
    'staff.telegram.errorTitle': 'تعذّر الحصول على رمز',
    'staff.telegram.unlinkTitle': 'فك ربط {name} بتلغرام؟',
    'staff.telegram.unlinkBody':
      'تُرفض ضغطاته في مجموعة الموظفين من هذه اللحظة، ويتوقف أي رمز لم يُستخدم بعد. ويمكنه الربط من جديد برمز جديد.',
    'staff.telegram.unlinkedToast': 'لم يعد {name} مربوطاً بتلغرام.',
    'staff.telegram.unlinkErrorTitle': 'تعذّر فك الربط',
  },
});

/** What `useT(staffMessages)` gives back, for the zod factories that are handed a translator. */
export type StaffTranslator = Translator<typeof staffMessages.en>;
