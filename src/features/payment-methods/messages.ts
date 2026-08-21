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
    'rails.form.codeLocked':
      'Deposits already point at this code; changing it would orphan them.',
    'rails.form.namePlaceholder': 'Bank transfer',
    'rails.form.railLocked':
      'The rail decides how the money physically arrives, so a different one is a different method.',
    'rails.form.currencyHint': 'Three-letter code, uppercase.',
    'rails.form.currencyLocked': "The ledger already holds this method's balances in this currency.",
    'rails.form.minHint': 'The smallest deposit this method accepts.',
    'rails.form.maxHint': 'The largest deposit this method accepts.',
    'rails.form.feeFixedHint': 'Taken from every deposit, on top of the percentage.',
    'rails.form.feeBpsHint': '100 basis points is 1%. 10000 is the whole deposit.',
    'rails.form.sortOrderHint': "Lower shows first in the player's list.",
    'rails.form.referencePatternHint':
      "Optional regular expression the player's reference must match. Only read when a reference is required.",
    'rails.form.instructionsHint': 'Shown to the player in the bot, word for word.',
    'rails.form.instructionsPlaceholder':
      'Transfer to the account shown, then upload the receipt.',
    'rails.form.requiresReferenceHint':
      "The player must type the rail's transaction reference before they can submit.",
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
    'rails.validation.capFormat':
      'A plain decimal, like 20000000.00 — or leave it empty for no cap.',
    'rails.validation.capNegative': 'A cap cannot be negative.',
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
    'rails.destination.addedBody':
      'صار بالإمكان تسليم هذا الحساب للاعبين الذين يختارون {method}.',
    'rails.destination.saved': 'تم حفظ {name}',
    'rails.destination.savedBody': 'رقم الحساب نفسه لم يتغيّر.',
    'rails.destination.addFailed': 'تعذّرت إضافة الوجهة',
    'rails.destination.saveFailed': 'تعذّر حفظ الوجهة',

    'rails.form.saveFailedTitle': 'لم يُحفظ',
    'rails.form.saveChanges': 'حفظ التعديلات',
    'rails.form.codeHint': 'هكذا سيشير كل إيداع وكل قيد محاسبي إلى هذه الطريقة.',
    'rails.form.codeLocked': 'هناك إيداعات تشير إلى هذا الرمز، وتغييره يقطع صلتها بها.',
    'rails.form.namePlaceholder': 'حوالة بنكية',
    'rails.form.railLocked': 'القناة تحدد كيف يصل المال فعلياً، فالقناة المختلفة تعني طريقة مختلفة.',
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
    'rails.validation.maxBelowMin': 'يجب ألا يقل الحد الأعلى عن الحد الأدنى، وإلا لن يستطيع أحد الإيداع.',
    'rails.validation.destinationLabel': 'الصرّافون يختارون هذا الحساب من تسميته.',
    'rails.validation.accountRequired': 'هذا هو الرقم الذي سيدفع إليه اللاعبون. لا يمكن تركه فارغاً.',
    'rails.validation.capFormat': 'رقم عشري بسيط، مثل 20000000.00 — أو اتركه فارغاً لبلا حدّ.',
    'rails.validation.capNegative': 'لا يمكن أن يكون الحد سالباً.',
  },
});

/**
 * The translator these screens hand to their zod factories. The schemas are built at render, not at
 * module load, so a message is in the language the operator is reading right now.
 */
export type RailTranslator = Translator<typeof railMessages.en>;
