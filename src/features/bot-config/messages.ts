import { defineMessages } from '@/lib/i18n/messages';

/**
 * The bot appearance screen, in both languages.
 *
 * ══ MOST OF THIS FILE IS ONE SENTENCE, WRITTEN NINE WAYS ══════════════════════════════════════
 * "This part is real, that part is not." The screen shows four surfaces of the same bot and only
 * one of them can be changed from here, so nearly every heading has a companion key saying which
 * kind it is and — where it is not live — what would have to exist for it to be. The convention is
 * the destinations screen's `telegram.category.notLive`, generalised: state it beside the thing,
 * never hide the thing.
 *
 * A vaguer wording was available for every one of these ("coming soon", "not yet configurable") and
 * is deliberately not used. An operator who reads "coming soon" waits; an operator who reads "this
 * is a literal in the bot's code and nothing reads your operator name" knows what to ask for.
 *
 * The Telegram vocabulary stays in English inside the Arabic — bot, admin, callback, Start — for the
 * reason the rest of this console does it: those are the words the operator sees in Telegram's own
 * interface while they are looking at this screen.
 *
 * ══ SLASH COMMANDS IN ARABIC CARRY LRM MARKS ══════════════════════════════════════════════════
 * `‎/start‎` and friends are wrapped in U+200E, the same as /console in `common-messages.ts`. The
 * leading slash is bidi-neutral, so in an Arabic sentence it takes the paragraph direction and
 * lands at the far end of the Latin run: `start/`, which is not a command anyone can type. The
 * marks are invisible and the string still matches a search for the command.
 *
 * ══ WHAT IS NOT IN HERE ═══════════════════════════════════════════════════════════════════════
 * The bot's own text. Quotations live in `bot-surface.ts`, untranslated, and that includes the
 * `/deposit {amount}` a player types: a command sitting in a translation bundle is a command a
 * translator eventually translates, and the bot then answers the translation with nothing.
 */
export const botConfigMessages = defineMessages({
  en: {
    'botConfig.title': 'Bot appearance',
    'botConfig.description':
      'What your bot shows a player: the buttons they tap, the commands it advertises and the text it sends. Every section says whether changing it here changes the bot.',

    // ── The legend. Three states, and every section carries exactly one of them ───────────────
    'botConfig.state.live': 'Live',
    'botConfig.state.live.hint': 'Saved here, used by the bot on its next message.',
    'botConfig.state.reading': 'Reading only',
    'botConfig.state.reading.hint':
      'An accurate reading of what the bot does today. Nothing on this console can change it.',
    'botConfig.state.draft': 'Draft only',
    'botConfig.state.draft.hint':
      'Nothing reads this. What you type is not saved, not sent, and gone when the page reloads.',

    'botConfig.honest.title': 'One part of this screen edits your bot. The rest reads it.',
    'botConfig.honest.body':
      'The payment buttons are genuinely yours to change — they are your payment methods, and a change here reaches the bot immediately. The commands, the menu, the messages and the bot’s own name are compiled into the bot and no console can write them yet. Each section below says which it is, and the ones that are not live say what is missing rather than looking disabled.',

    'botConfig.routing.title': 'Where the bot posts your notifications',
    'botConfig.routing.body':
      'Deposits, withdrawals, new players and reports go to the Telegram groups you bind yourself. That part is fully wired in both directions and has its own screen.',
    'botConfig.routing.link': 'Telegram destinations',

    'botConfig.tab.buttons': 'Payment buttons',
    'botConfig.tab.commands': 'Commands',
    'botConfig.tab.messages': 'Messages',
    'botConfig.tab.identity': 'Name and profile',

    // ── The live section ─────────────────────────────────────────────────────────────────────
    'botConfig.buttons.title': 'The buttons a player taps to pay',
    'botConfig.buttons.body':
      'One button per payment method the bot offers, labelled with the method’s name, in the bot’s own order: lowest number first, ties alphabetical. Hidden and internal methods are listed here too and marked, because “why is my rail not in the bot” is answered by seeing it. These are the same records the payment rails screen edits — there is one copy, and this is a second way into it.',
    'botConfig.buttons.emojiTitle': 'Emoji in a label are safe',
    'botConfig.buttons.emojiBody':
      'Telegram caps a button’s hidden payload at 64 bytes and the bot silently leaves out any method that goes over. The label is not part of that payload — it carries the method’s id and the amount and nothing else — so a label can be as long or as decorated as you like. Each row shows what its payload actually measures.',
    'botConfig.buttons.payload': 'Hidden payload {bytes} of {max} bytes',
    'botConfig.buttons.payloadOver':
      'Over Telegram’s limit. The bot leaves this method out of the keyboard entirely.',
    'botConfig.buttons.unsaved': 'Not saved',
    'botConfig.buttons.saved': '{name} saved. The bot uses it from its next message.',
    'botConfig.buttons.saveFailed': 'Could not save {name}.',
    'botConfig.buttons.hidden': 'Hidden from the bot',
    'botConfig.buttons.internal': 'Never offered to a player',
    'botConfig.buttons.internalBody':
      'The internal rail is for corrections and float top-ups. The bot filters it out of every list, so it has no button whatever this says.',
    'botConfig.buttons.readOnly':
      'Changing a payment method needs the payment rails permission, which your role does not hold. Everything here is readable.',
    'botConfig.buttons.empty.title': 'No payment methods yet',
    'botConfig.buttons.empty.body':
      'The bot shows a player one button per active payment method. Add one on the payment rails screen and it appears here and in the bot.',

    'botConfig.field.label': 'Button label',
    'botConfig.field.label.hint':
      'Exactly what a player reads on the button. The bot never translates it.',
    'botConfig.field.order': 'Order',
    'botConfig.field.order.hint':
      'Lowest first. Two methods sharing a number fall back to alphabetical, which is what the bot does.',
    'botConfig.field.shown': 'Shown in the bot',
    'botConfig.field.shown.hint':
      'Off removes the button — and stops the method being offered anywhere else too.',
    'botConfig.field.instructions': 'What the player reads after tapping it',
    'botConfig.field.instructions.hint':
      'Sent with the account details once the deposit is open. Empty sends nothing extra.',

    // ── The preview ──────────────────────────────────────────────────────────────────────────
    'botConfig.preview.title': 'What the player sees',
    'botConfig.preview.caption':
      'Built from your live payment methods, with the bot’s own rules applied: active only, {currency} only, and only the methods whose limits take this amount. The rules are mirrored from the bot’s code as this console understands them — the bot serves none of this, and nothing on this card is saved anywhere.',
    'botConfig.preview.amount': 'Deposit amount',
    'botConfig.preview.arabic':
      'The bot answers every player in Arabic, whatever language their Telegram is set to, and the text below is its own, quoted. With one exception, and it starts on the next screen: the payment details sent the moment a player taps one of these buttons are generated in English, and so are the deposit notifications.',
    'botConfig.preview.single':
      'Only one method takes this amount, so the bot sends no buttons at all — it opens the deposit straight away. Asking “which one?” with a single button is a tap that carries no information.',
    'botConfig.preview.none':
      'No active method takes this amount, so the bot answers with its limits instead of a keyboard.',
    'botConfig.preview.outOfRange': 'Outside its limits at this amount: {names}',
    'botConfig.preview.noCurrency':
      'There is no active payment method to build a preview from yet.',

    // ── The command menu ─────────────────────────────────────────────────────────────────────
    'botConfig.commands.title': 'What your bot advertises',
    'botConfig.commands.body':
      'The menu behind Telegram’s / button: ten commands every player sees, and six more that only staff chats are given.',
    'botConfig.commands.col.command': 'Command',
    'botConfig.commands.col.description': 'What Telegram shows beside it',
    'botConfig.commands.col.audience': 'Who sees it',
    'botConfig.commands.audience.PLAYER': 'Everyone',
    'botConfig.commands.audience.ADMIN': 'Staff chats only',
    'botConfig.commands.arabic':
      'Every description is Arabic for every player: the bot never reads the language a player’s Telegram is set to. Its deposit notifications are the one part that comes out in English, and they are on the messages tab.',
    'botConfig.commands.frozenTitle': 'Why there is no “add a command” here',
    'botConfig.commands.frozenBody':
      'The list is a frozen constant in the bot, and a test refuses to build the bot if a listed command has no handler answering it. So a new command is not a missing box on this screen — it is code that has to exist first. Renaming one has no column to store the new name in, no endpoint to send it to, and nothing that would read it.',
    'botConfig.commands.staffTitle': 'Why the staff commands are not in the public menu',
    'botConfig.commands.staffBody':
      'They are pushed only to the admin group and to each admin’s private chat. The bot answers a non-admin with silence precisely so the staff surface cannot be listed, and a public menu with /queue in it would undo that.',
    'botConfig.commands.pushTitle': 'Pushing this menu to Telegram',
    'botConfig.commands.pushBody':
      'A platform admin pushes the menu from the operators screen. There is deliberately no button for it here: there is nothing on this screen to push, because there is nothing on this screen to change.',
    'botConfig.commands.pushLink': 'Open the operators screen',
    'botConfig.commands.copyTitle': 'This list is a copy',
    'botConfig.commands.copyBody':
      'Nothing serves the bot’s menu over the API, so this is transcribed from the bot’s own constants. If the bot’s list changes, this screen keeps showing the old one until somebody updates it too.',

    'botConfig.menu.title': 'The buttons under /start',
    'botConfig.menu.body':
      'Eight buttons below the welcome message. They are built once when the bot starts and nothing about them reads your operator, so every operator’s bot shows exactly these.',

    // ── The messages ─────────────────────────────────────────────────────────────────────────
    'botConfig.messages.title': '“The bot’s messages” is not one list',
    'botConfig.messages.body':
      'A screen that offered you one editable list of your bot’s messages would be showing a fraction of them and calling it all of them. Below are the surfaces this console can point at and where each one lives. Nothing serves an inventory of the bot’s text over the API, so this is not a complete one either — it is what we can name.',
    'botConfig.messages.interactive.title': 'Replies to a tap or a command',
    'botConfig.messages.interactive.body': {
      one: '{count} Arabic string in the player bot’s own message bundle: the replies behind /start, /help, /deposit, /methods and the menu buttons. Not everything those answer with — the cards here hold the text written outside the bundle, and the account details come from your payment methods.',
      other:
        '{count} Arabic strings in the player bot’s own message bundle: the replies behind /start, /help, /deposit, /methods and the menu buttons. Not everything those answer with — the cards here hold the text written outside the bundle, and the account details come from your payment methods.',
    },
    'botConfig.messages.queued.title': 'Deposit notifications',
    'botConfig.messages.queued.body': {
      one: '{count} template, sent when a deposit is credited, rejected, expired, fails to credit, or its proof arrives. A different file and a different switch from the ones above.',
      other:
        '{count} templates, sent when a deposit is credited, rejected, expired, fails to credit, or its proof arrives. A different file and a different switch from the ones above.',
    },
    'botConfig.messages.queued.warning':
      'They are written in English. A player who has read Arabic through the whole deposit is told “Your deposit has been credited” in English at the end of it. That is real, and nothing on this console can fix it.',
    'botConfig.messages.admin.title': 'The admin bot',
    'botConfig.messages.admin.body':
      'The staff side has no message bundle at all. Every sentence it sends is written at the place it is sent from, so there is not even a list to show you.',
    'botConfig.messages.inline.title': 'Literals in the handlers',
    'botConfig.messages.inline.body':
      'Some of the most-read text is not in any bundle either — the welcome below is written inline, in the handler that sends it.',
    'botConfig.messages.quoted':
      'Quoted from the bot, with the bot’s own placeholders left in. A filled-in example would read as a real deposit.',
    'botConfig.messages.conditional':
      'And this line only for a player who arrived through a referral link:',

    'botConfig.messages.draft.title': 'Draft a rewrite',
    'botConfig.messages.draft.body':
      'Type here to see how a message would read. There is no save button, and that is the honest part: there is no template table, no operator column on one, and no endpoint. What would have to exist first is a stored template the bot reads when it sends, instead of a string compiled into it.',
    'botConfig.messages.draft.welcome': 'The welcome',
    'botConfig.messages.draft.credited': 'Deposit credited',
    'botConfig.messages.draft.reset': 'Put the bot’s own words back',

    // ── The bot's own name ───────────────────────────────────────────────────────────────────
    'botConfig.identity.title': 'The name, the profile texts and the language',
    'botConfig.identity.body':
      'What Telegram shows on your bot’s profile, and the name the bot calls itself in /start, /help and /about.',
    'botConfig.identity.brandTitle': 'The one change that would unlock the most',
    'botConfig.identity.brandBody':
      'Every operator’s bot calls itself “Ichancy Cashier”, because that name is a literal in the bot’s code. Your operator already has a name of its own in the database, and no bot handler reads it. One handler reading that column would give every operator its own bot everywhere the name appears — the welcome, the help card and the service status card.',
    'botConfig.identity.brandYours': 'Your operator here is {slug}.',
    'botConfig.identity.brandUnknown':
      'This session does not carry your operator’s name, so there is nothing to show beside it.',

    'botConfig.identity.name': 'The name the bot calls itself',
    'botConfig.identity.nameHint': 'Written into the welcome, the help card and /about.',
    'botConfig.identity.description': 'Description',
    'botConfig.identity.descriptionHint':
      'Shown on the empty chat screen before a player taps Start.',
    'botConfig.identity.short': 'Short bio',
    'botConfig.identity.shortHint': 'The line on the bot’s profile page.',
    'botConfig.identity.chars': '{count} of {max} characters',
    'botConfig.identity.overLimit': 'Telegram would refuse this: it is over {max} characters.',
    'botConfig.identity.menuButton': 'The menu button',
    'botConfig.identity.menuButton.commands': 'The commands list',
    'botConfig.identity.menuButton.webApp': 'Open the cashier app',
    'botConfig.identity.menuButtonHint':
      'Fixed to the commands list for every operator: the bot sets it once, to that, and reads nothing.',
    'botConfig.identity.language': 'The language players are answered in',
    'botConfig.identity.language.ar': 'Arabic',
    'botConfig.identity.language.en': 'English',
    'botConfig.identity.languageHint':
      'The bot answers in Arabic and ignores what a player’s Telegram is set to — deliberately, because a Syrian player whose phone is in English was getting the whole bot in English. The payment details and the deposit notifications are generated in English regardless, which is a separate bug from this picker. This picker changes nothing.',
    'botConfig.identity.noSave':
      'There is no save button on this card. Nothing here is stored anywhere, and a button that appeared to save it would be the lie this screen is written to avoid.',
  },

  ar: {
    'botConfig.title': 'شكل البوت',
    'botConfig.description':
      'ما يراه اللاعب في البوت: الأزرار التي يضغطها، والأوامر التي يعلن عنها، والنصوص التي يرسلها. كل قسم هنا يوضّح إن كان تعديله من هنا يغيّر البوت فعلاً.',

    'botConfig.state.live': 'فعّال',
    'botConfig.state.live.hint': 'يُحفظ من هنا، ويستخدمه البوت في أول رسالة بعده.',
    'botConfig.state.reading': 'للقراءة فقط',
    'botConfig.state.reading.hint':
      'قراءة دقيقة لما يفعله البوت اليوم. لا شيء في لوحة التحكم يستطيع تغييره.',
    'botConfig.state.draft': 'مسوّدة فقط',
    'botConfig.state.draft.hint':
      'لا شيء يقرأ هذا. ما تكتبه لا يُحفظ ولا يُرسل، ويختفي عند إعادة تحميل الصفحة.',

    'botConfig.honest.title': 'قسم واحد من هذه الشاشة يعدّل البوت، والباقي يقرأه.',
    'botConfig.honest.body':
      'أزرار الدفع ملكك فعلاً — هي طرق الدفع نفسها، وأي تعديل هنا يصل إلى البوت فوراً. أما الأوامر والقائمة والرسائل واسم البوت فهي مكتوبة داخل شيفرة البوت ولا تستطيع أي لوحة تحكم الكتابة إليها بعد. كل قسم أدناه يقول أي نوع هو، والأقسام غير الفعّالة تقول ما الناقص بدل أن تظهر معطّلة.',

    'botConfig.routing.title': 'أين ينشر البوت إشعاراتك',
    'botConfig.routing.body':
      'الإيداعات والسحوبات واللاعبون الجدد والتقارير تذهب إلى مجموعات Telegram التي تربطها بنفسك. هذا الجزء موصول بالكامل في الاتجاهين وله شاشته الخاصة.',
    'botConfig.routing.link': 'وجهات تيليغرام',

    'botConfig.tab.buttons': 'أزرار الدفع',
    'botConfig.tab.commands': 'الأوامر',
    'botConfig.tab.messages': 'الرسائل',
    'botConfig.tab.identity': 'الاسم والملف',

    'botConfig.buttons.title': 'الأزرار التي يضغطها اللاعب ليدفع',
    'botConfig.buttons.body':
      'زر واحد لكل طريقة دفع يعرضها البوت، باسم الطريقة، وبترتيب البوت نفسه: الأصغر رقماً أولاً، والمتساوية أبجدياً. والطرق المخفية والداخلية مذكورة هنا أيضاً ومعلَّمة، لأن سؤال «لماذا لا تظهر قناتي في البوت؟» يُجاب برؤيتها. وهذه هي نفس السجلات التي تعدّلها شاشة قنوات الدفع — نسخة واحدة، وهذه طريقة ثانية للوصول إليها.',
    'botConfig.buttons.emojiTitle': 'الإيموجي في التسمية آمن',
    'botConfig.buttons.emojiBody':
      'يحدّد Telegram حجم البيانات المخفية خلف الزر بـ 64 بايت، ويحذف البوت بصمت أي طريقة تتجاوزها. التسمية ليست جزءاً من تلك البيانات — فهي تحمل معرّف الطريقة والمبلغ فقط — لذا يمكن أن تكون التسمية طويلة أو مزيّنة كما تريد. كل سطر يعرض حجم بياناته الفعلي.',
    'botConfig.buttons.payload': 'البيانات المخفية {bytes} من {max} بايت',
    'botConfig.buttons.payloadOver':
      'تجاوزت حدّ Telegram. يحذف البوت هذه الطريقة من لوحة الأزرار بالكامل.',
    'botConfig.buttons.unsaved': 'غير محفوظ',
    'botConfig.buttons.saved': 'تم حفظ {name}. يستخدمه البوت في أول رسالة بعده.',
    'botConfig.buttons.saveFailed': 'تعذّر حفظ {name}.',
    'botConfig.buttons.hidden': 'مخفية عن البوت',
    'botConfig.buttons.internal': 'لا تُعرض على اللاعب أبداً',
    'botConfig.buttons.internalBody':
      'القناة الداخلية للتصحيحات وتعبئة رصيد الكاشيرة. يستبعدها البوت من كل قائمة، فلا زر لها مهما كان الإعداد هنا.',
    'botConfig.buttons.readOnly':
      'تعديل طريقة دفع يحتاج صلاحية قنوات الدفع، ودورك لا يملكها. كل ما هنا قابل للقراءة.',
    'botConfig.buttons.empty.title': 'لا توجد طرق دفع بعد',
    'botConfig.buttons.empty.body':
      'يعرض البوت للاعب زراً لكل طريقة دفع مفعّلة. أضف واحدة من شاشة قنوات الدفع لتظهر هنا وفي البوت.',

    'botConfig.field.label': 'تسمية الزر',
    'botConfig.field.label.hint': 'ما يقرأه اللاعب على الزر تماماً. البوت لا يترجمها أبداً.',
    'botConfig.field.order': 'الترتيب',
    'botConfig.field.order.hint':
      'الأصغر أولاً. الطريقتان اللتان تحملان الرقم نفسه تُرتَّبان أبجدياً، وهذا ما يفعله البوت.',
    'botConfig.field.shown': 'تظهر في البوت',
    'botConfig.field.shown.hint': 'الإطفاء يزيل الزر — ويوقف عرض الطريقة في كل مكان آخر أيضاً.',
    'botConfig.field.instructions': 'ما يقرأه اللاعب بعد الضغط عليها',
    'botConfig.field.instructions.hint':
      'يُرسَل مع بيانات الحساب بعد فتح طلب الشحن. الفراغ لا يرسل شيئاً إضافياً.',

    'botConfig.preview.title': 'ما يراه اللاعب',
    'botConfig.preview.caption':
      'مبني من طرق الدفع الفعلية عندك، بقواعد البوت نفسها: المفعّلة فقط، وبعملة {currency} فقط، والطرق التي تقبل هذا المبلغ ضمن حدودها فقط. والقواعد منقولة من شيفرة البوت كما تفهمها هذه اللوحة — لا يقدّمها البوت، ولا يُحفظ أي شيء في هذه البطاقة.',
    'botConfig.preview.amount': 'مبلغ الشحن',
    'botConfig.preview.arabic':
      'يجيب البوت كل لاعب بالعربية مهما كانت لغة Telegram عنده، والنص أدناه نصّه هو منقولاً كما هو. باستثناء واحد يبدأ بعد هذه الشاشة مباشرة: بيانات الدفع التي تُرسَل لحظة ضغط اللاعب على أحد هذه الأزرار مولَّدة بالإنكليزية، وكذلك إشعارات الإيداع.',
    'botConfig.preview.single':
      'طريقة واحدة فقط تقبل هذا المبلغ، لذلك لا يرسل البوت أي أزرار — يفتح الطلب مباشرة. السؤال «أي طريقة؟» بزر واحد ضغطة بلا معنى.',
    'botConfig.preview.none':
      'لا توجد طريقة مفعّلة تقبل هذا المبلغ، فيجيب البوت بالحدود بدل لوحة الأزرار.',
    'botConfig.preview.outOfRange': 'خارج حدودها عند هذا المبلغ: {names}',
    'botConfig.preview.noCurrency': 'لا توجد طريقة دفع مفعّلة لبناء المعاينة منها بعد.',

    'botConfig.commands.title': 'ما يعلن عنه البوت',
    'botConfig.commands.body':
      'القائمة خلف زر ‎/‎ في Telegram: عشرة أوامر يراها كل لاعب، وستة أخرى لا تُعطى إلا لمحادثات الموظفين.',
    'botConfig.commands.col.command': 'الأمر',
    'botConfig.commands.col.description': 'ما يظهره Telegram بجانبه',
    'botConfig.commands.col.audience': 'من يراه',
    'botConfig.commands.audience.PLAYER': 'الجميع',
    'botConfig.commands.audience.ADMIN': 'محادثات الموظفين فقط',
    'botConfig.commands.arabic':
      'كل الأوصاف بالعربية لكل لاعب: البوت لا يقرأ لغة Telegram عند اللاعب أبداً. وإشعارات الإيداع هي الجزء الوحيد الذي يخرج بالإنكليزية، وهي في تبويب الرسائل.',
    'botConfig.commands.frozenTitle': 'لماذا لا يوجد «إضافة أمر» هنا',
    'botConfig.commands.frozenBody':
      'القائمة ثابتة (frozen) داخل البوت، ويرفض اختبار بناء البوت إذا كان أمر مُعلَن بلا معالج يجيب عليه. فالأمر الجديد ليس حقلاً ناقصاً في هذه الشاشة، بل شيفرة يجب أن توجد أولاً. وإعادة تسمية أمر موجود لا يوجد لها عمود يحفظ الاسم الجديد، ولا endpoint تُرسل إليه، ولا شيء يقرأه.',
    'botConfig.commands.staffTitle': 'لماذا أوامر الموظفين ليست في القائمة العامة',
    'botConfig.commands.staffBody':
      'تُرسَل فقط إلى مجموعة الـ admin وإلى المحادثة الخاصة بكل admin. يجيب البوت غير الـ admin بالصمت تحديداً حتى لا يمكن حصر أوامر الموظفين، وقائمة عامة فيها ‎/queue‎ تنسف ذلك.',
    'botConfig.commands.pushTitle': 'إرسال هذه القائمة إلى Telegram',
    'botConfig.commands.pushBody':
      'يرسل مدير المنصة القائمة من شاشة المشغّلين. لا يوجد زر لذلك هنا عن قصد: لا شيء في هذه الشاشة يُرسَل، لأن لا شيء فيها يُعدَّل.',
    'botConfig.commands.pushLink': 'فتح شاشة المشغّلين',
    'botConfig.commands.copyTitle': 'هذه القائمة نسخة',
    'botConfig.commands.copyBody':
      'لا شيء يقدّم قائمة البوت عبر الـ API، لذلك نُقلت هنا من ثوابت البوت نفسها. إذا تغيّرت قائمة البوت تبقى هذه الشاشة تعرض القديمة حتى يحدّثها أحد.',

    'botConfig.menu.title': 'الأزرار تحت ‎/start‎',
    'botConfig.menu.body':
      'ثمانية أزرار تحت رسالة الترحيب. تُبنى مرة واحدة عند تشغيل البوت ولا شيء فيها يقرأ المشغّل، فبوت كل مشغّل يعرض هذه الأزرار نفسها.',

    'botConfig.messages.title': '«رسائل البوت» ليست قائمة واحدة',
    'botConfig.messages.body':
      'أي شاشة تعرض عليك قائمة واحدة قابلة للتعديل لرسائل بوتك ستكون تعرض جزءاً منها وتسمّيه كلها. أدناه الأسطح التي تستطيع هذه اللوحة الإشارة إليها، ومكان كل واحد منها. ولا شيء يقدّم جرداً لنصوص البوت عبر الـ API، فهذه ليست قائمة كاملة أيضاً — هي ما نستطيع تسميته.',
    'botConfig.messages.interactive.title': 'الردود على ضغطة أو أمر',
    'botConfig.messages.interactive.body': {
      zero: 'لا نصوص في حزمة رسائل بوت اللاعبين.',
      one: 'نص عربي واحد في حزمة رسائل بوت اللاعبين: الردود خلف ‎/start‎ و‎/help‎ و‎/deposit‎ و‎/methods‎ وأزرار القائمة. وليس كل ما تجيب به — البطاقات هنا فيها النصوص المكتوبة خارج الحزمة، وبيانات الحساب تأتي من طرق الدفع عندك.',
      two: 'نصان عربيان في حزمة رسائل بوت اللاعبين: الردود خلف ‎/start‎ و‎/help‎ و‎/deposit‎ و‎/methods‎ وأزرار القائمة. وليست كل ما تجيب به — البطاقات هنا فيها النصوص المكتوبة خارج الحزمة، وبيانات الحساب تأتي من طرق الدفع عندك.',
      few: '{count} نصوص عربية في حزمة رسائل بوت اللاعبين: الردود خلف ‎/start‎ و‎/help‎ و‎/deposit‎ و‎/methods‎ وأزرار القائمة. وليست كل ما تجيب به — البطاقات هنا فيها النصوص المكتوبة خارج الحزمة، وبيانات الحساب تأتي من طرق الدفع عندك.',
      many: '{count} نصاً عربياً في حزمة رسائل بوت اللاعبين: الردود خلف ‎/start‎ و‎/help‎ و‎/deposit‎ و‎/methods‎ وأزرار القائمة. وليست كل ما تجيب به — البطاقات هنا فيها النصوص المكتوبة خارج الحزمة، وبيانات الحساب تأتي من طرق الدفع عندك.',
      other:
        '{count} نص عربي في حزمة رسائل بوت اللاعبين: الردود خلف ‎/start‎ و‎/help‎ و‎/deposit‎ و‎/methods‎ وأزرار القائمة. وليست كل ما تجيب به — البطاقات هنا فيها النصوص المكتوبة خارج الحزمة، وبيانات الحساب تأتي من طرق الدفع عندك.',
    },
    'botConfig.messages.queued.title': 'إشعارات الإيداع',
    'botConfig.messages.queued.body': {
      zero: 'لا قوالب هنا.',
      one: 'قالب واحد يُرسَل عند إضافة الإيداع أو رفضه أو انتهاء مهلته أو فشل إضافته أو وصول إثباته. ملف مختلف ومنطق مختلف عن الذي فوقه.',
      two: 'قالبان يُرسَلان عند إضافة الإيداع أو رفضه أو انتهاء مهلته أو فشل إضافته أو وصول إثباته. ملف مختلف ومنطق مختلف عن الذي فوقه.',
      few: '{count} قوالب تُرسَل عند إضافة الإيداع أو رفضه أو انتهاء مهلته أو فشل إضافته أو وصول إثباته. ملف مختلف ومنطق مختلف عن الذي فوقه.',
      many: '{count} قالباً تُرسَل عند إضافة الإيداع أو رفضه أو انتهاء مهلته أو فشل إضافته أو وصول إثباته. ملف مختلف ومنطق مختلف عن الذي فوقه.',
      other:
        '{count} قالب يُرسَل عند إضافة الإيداع أو رفضه أو انتهاء مهلته أو فشل إضافته أو وصول إثباته. ملف مختلف ومنطق مختلف عن الذي فوقه.',
    },
    'botConfig.messages.queued.warning':
      'وهي مكتوبة بالإنكليزية. اللاعب الذي قرأ العربية طوال عملية الشحن يُقال له في نهايتها «Your deposit has been credited» بالإنكليزية. هذا واقع، ولا شيء في لوحة التحكم يصلحه.',
    'botConfig.messages.admin.title': 'بوت الموظفين',
    'botConfig.messages.admin.body':
      'جانب الموظفين ليس له حزمة نصوص أصلاً. كل جملة يرسلها مكتوبة في مكان إرسالها، فلا توجد حتى قائمة لعرضها.',
    'botConfig.messages.inline.title': 'نصوص مكتوبة داخل المعالجات',
    'botConfig.messages.inline.body':
      'بعض أكثر النصوص قراءةً ليس في أي حزمة أيضاً — رسالة الترحيب أدناه مكتوبة مباشرة داخل المعالج الذي يرسلها.',
    'botConfig.messages.quoted':
      'منقول من البوت، مع إبقاء متغيّراته كما هي. المثال المعبّأ يُقرأ كإيداع حقيقي.',
    'botConfig.messages.conditional': 'وهذا السطر فقط للاعب وصل عبر رابط إحالة:',

    'botConfig.messages.draft.title': 'اكتب مسوّدة',
    'botConfig.messages.draft.body':
      'اكتب هنا لترى كيف ستُقرأ الرسالة. لا يوجد زر حفظ، وهذا هو الجزء الصادق: لا يوجد جدول قوالب، ولا عمود للمشغّل فيه، ولا endpoint. ما يجب أن يوجد أولاً هو قالب مخزّن يقرأه البوت لحظة الإرسال بدل نص مضمّن داخله.',
    'botConfig.messages.draft.welcome': 'رسالة الترحيب',
    'botConfig.messages.draft.credited': 'تمت إضافة الإيداع',
    'botConfig.messages.draft.reset': 'أعد نص البوت كما هو',

    'botConfig.identity.title': 'الاسم ونصوص الملف واللغة',
    'botConfig.identity.body':
      'ما يعرضه Telegram في ملف بوتك، والاسم الذي يسمّي به البوت نفسه في ‎/start‎ و‎/help‎ و‎/about‎.',
    'botConfig.identity.brandTitle': 'التغيير الوحيد الذي سيفتح أكثر شيء',
    'botConfig.identity.brandBody':
      'بوت كل مشغّل يسمّي نفسه «Ichancy Cashier» لأن هذا الاسم مكتوب داخل شيفرة البوت. لمشغّلك اسم خاص به في قاعدة البيانات، ولا يقرأه أي معالج في البوت. معالج واحد يقرأ ذلك العمود يعطي كل مشغّل بوته الخاص في كل مكان يظهر فيه الاسم — الترحيب وبطاقة المساعدة وبطاقة حالة الخدمة.',
    'botConfig.identity.brandYours': 'مشغّلك هنا هو {slug}.',
    'botConfig.identity.brandUnknown': 'هذه الجلسة لا تحمل اسم مشغّلك، فلا شيء يمكن عرضه بجانبه.',

    'botConfig.identity.name': 'الاسم الذي يسمّي به البوت نفسه',
    'botConfig.identity.nameHint': 'يُكتب داخل الترحيب وبطاقة المساعدة و‎/about‎.',
    'botConfig.identity.description': 'الوصف',
    'botConfig.identity.descriptionHint': 'يظهر في شاشة المحادثة الفارغة قبل أن يضغط اللاعب Start.',
    'botConfig.identity.short': 'النبذة القصيرة',
    'botConfig.identity.shortHint': 'السطر الذي يظهر في صفحة ملف البوت.',
    'botConfig.identity.chars': '{count} من {max} حرفاً',
    'botConfig.identity.overLimit': 'سيرفضه Telegram: تجاوز {max} حرفاً.',
    'botConfig.identity.menuButton': 'زر القائمة',
    'botConfig.identity.menuButton.commands': 'قائمة الأوامر',
    'botConfig.identity.menuButton.webApp': 'فتح تطبيق الكاشير',
    'botConfig.identity.menuButtonHint':
      'ثابت على قائمة الأوامر لكل مشغّل: يضبطه البوت مرة واحدة على ذلك ولا يقرأ شيئاً.',
    'botConfig.identity.language': 'اللغة التي يُجاب بها اللاعبون',
    'botConfig.identity.language.ar': 'العربية',
    'botConfig.identity.language.en': 'الإنكليزية',
    'botConfig.identity.languageHint':
      'يجيب البوت بالعربية ويتجاهل لغة Telegram عند اللاعب — عن قصد، لأن لاعباً سورياً هاتفه بالإنكليزية كان يصله البوت كله بالإنكليزية. أما بيانات الدفع وإشعارات الإيداع فتُولَّد بالإنكليزية على أي حال، وتلك مشكلة منفصلة عن هذا الاختيار. وهذا الاختيار لا يغيّر شيئاً.',
    'botConfig.identity.noSave':
      'لا يوجد زر حفظ في هذه البطاقة. لا شيء هنا يُخزَّن في أي مكان، وزر يبدو أنه يحفظ سيكون هو الكذبة التي كُتبت هذه الشاشة لتجنّبها.',
  },
});
