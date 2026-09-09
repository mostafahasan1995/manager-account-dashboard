import { defineMessages } from '@/lib/i18n/messages';

/**
 * The developer bench, in both languages.
 *
 * ── WHY IT IS TRANSLATED AT ALL, GIVEN IT IS A DEV TOOL ───────────────────────────────────────
 * Because the person using it reads Arabic. A "dev-only" screen that is English-only is a screen
 * whose warnings — the ones about pasting a live cashier session — are the least likely part to be
 * read. The field NAMES stay in English in both halves: `accessToken`, `authToken` and `forge` are
 * strings you copy out of a browser's cookie list, not words to translate.
 */
export const shamCashDevMessages = defineMessages({
  en: {
    'shamDev.title': 'Sham Cash bench',
    'shamDev.description':
      'The old browser mechanism, on demand. Sham Cash is read over its API now; this is here for the two questions only a browser can answer.',

    'shamDev.warningTitle': 'This is a live cashier session',
    'shamDev.warningBody':
      'Whoever holds these values is signed in as that Sham Cash account until the session lapses. Nothing here is saved — they are used for one check and dropped — so there is no “save” button and there is not meant to be one.',

    // ── The linked account ───────────────────────────────────────────────────────────────────
    'shamDev.account.pageTitle': 'Your Sham Cash account',
    'shamDev.account.pageBody':
      'Link it once by scanning a code from the app on your phone, then read the balance whenever you need it.',
    'shamDev.account.title': 'Account',
    'shamDev.account.readAt': 'Read',
    'shamDev.account.refresh': 'Refresh',
    'shamDev.account.unlink': 'Unlink',
    'shamDev.account.link': 'Link your account',
    'shamDev.account.emptyTitle': 'No account is linked yet',
    'shamDev.account.emptyBody':
      'Scan the code with the Sham Cash app and the account appears here.',
    'shamDev.account.neverRead': 'Not read yet',
    'shamDev.account.neverReadBody': 'Press Refresh to read the balance for the first time.',
    'shamDev.account.sessionClosed': 'The session has closed',
    'shamDev.account.sessionClosedBody':
      'These figures are the last ones read. They will not update until you link the account again.',
    'shamDev.account.refreshFailed': 'Could not read the account',
    // ── Linking by QR ────────────────────────────────────────────────────────────────────────
    'shamDev.qr.title': 'Link by QR',
    'shamDev.qr.description':
      'What the Sham Cash web login does: it draws a code, you scan it from the phone app, and the page signs itself in. The session that comes back is correct by construction — no copying.',
    'shamDev.qr.pin': 'PIN to set on this browser',
    'shamDev.qr.pinHint':
      'Sham Cash asks a newly linked browser to choose a 4-digit code, seconds after you scan. Give it here and it is saved for you; leave it blank and you will have to set it yourself.',
    'shamDev.qr.start': 'Show me a code',
    'shamDev.qr.restart': 'New code',
    'shamDev.qr.opening': 'Opening the Sham Cash login page — this takes a moment',
    'shamDev.qr.alt': 'The Sham Cash login QR code',
    'shamDev.qr.step1': 'Open the Sham Cash app on your phone',
    'shamDev.qr.step2': 'Go to your account, then Linked devices',
    'shamDev.qr.step3': 'Point the camera at the code above',
    'shamDev.qr.waiting': 'Waiting for you to scan it…',
    'shamDev.qr.linked': 'Linked',
    'shamDev.qr.linkedBody':
      'The session is filled into the form below. Press “Run the check” to read the balance with it.',
    'shamDev.qr.linkedPin':
      'The session is filled into the form below. Sham Cash asked for the PIN, so type your 4 digits in the PIN field before running the check.',
    'shamDev.qr.expired': 'The code expired',
    'shamDev.qr.expiredBody': 'Nobody scanned it in time. Ask for a new one.',
    'shamDev.qr.failed': 'The pairing failed',
    'shamDev.qr.matched': 'Found the code as: {strategy}',
    'shamDev.qr.fallbackTitle': 'This is the whole page, not just the code',
    'shamDev.qr.fallbackBody':
      'The QR element was not recognised, so what you see is a screenshot of the entire login page — the code is in it and should still scan. Worth reporting, because it means one selector in the API needs correcting.',

    // ── The credential check ─────────────────────────────────────────────────────────────────
    'shamDev.check.title': 'Check a session',
    'shamDev.check.description':
      'Launches a real browser and replays these values at shamcash.sy. Expect 55 to 90 seconds — the site is slow to render, and that is what is being waited for.',
    'shamDev.check.where':
      'Open shamcash.sy signed in, then take the cookies from your browser tools and the PIN hash from localStorage.',
    'shamDev.check.accessToken': 'accessToken cookie',
    'shamDev.check.authToken': 'authToken cookie',
    'shamDev.check.forge': 'forge cookie (optional)',
    'shamDev.check.pinCodeHash': 'shamcash-pin-code-hash (optional)',
    'shamDev.check.pinCodeHashHint': 'From localStorage, not from the cookies.',
    'shamDev.check.pin': 'PIN (optional)',
    'shamDev.check.pinHint': 'The 4 digits you type after signing in.',
    'shamDev.check.submit': 'Run the check',
    'shamDev.check.running': 'Reading the page — this takes about a minute',
    'shamDev.check.required': 'accessToken and authToken are both required.',

    // ── Its verdicts ─────────────────────────────────────────────────────────────────────────
    'shamDev.result.ok': 'The session works',
    'shamDev.result.okBody': 'Read at {checkedAt}.',
    'shamDev.result.expired': 'The session has lapsed',
    'shamDev.result.expiredBody':
      'Sham Cash sent the reader to its login page. The values were read correctly — they are simply no longer signed in. Copy a fresh set.',
    'shamDev.result.notLinked': 'No session was sent',
    'shamDev.result.notLinkedBody':
      'Fill in at least the two token fields and run the check again.',
    'shamDev.result.unavailable': 'The read did not complete',
    'shamDev.result.debugTitle': 'What the browser actually saw',
    'shamDev.result.debugBody':
      'The page loaded and was not sent to login, but did not look like the account home. These are what tell a block, a slow render and a redesign apart.',
    'shamDev.result.debugUrl': 'Ended on',
    'shamDev.result.debugStorage': 'localStorage keys',
    'shamDev.result.debugApi': 'What the site’s own API answered',
    'shamDev.result.debugErrors': 'JavaScript errors',
    'shamDev.result.debugText': 'Page text',
    'shamDev.result.copyText': 'Copy the text into the parser below',

    // ── The parser bench ─────────────────────────────────────────────────────────────────────
    'shamDev.parse.title': 'Check the parser',
    'shamDev.parse.description':
      'Page text in, balances and transfers out. No browser, no network, no session — this is what tells a parsing regression apart from a credential problem.',
    'shamDev.parse.label': 'Page text',
    'shamDev.parse.hint':
      'The rendered text, not the HTML: run document.body.innerText in the page’s console, or use the text a failed check hands back above.',
    'shamDev.parse.submit': 'Parse it',
    'shamDev.parse.required': 'Paste some page text first.',
    'shamDev.parse.nothing': 'The parser found nothing',
    'shamDev.parse.nothingBody':
      'No balance card and no transfer was recognised in that text. If the text plainly shows them, the page has changed and the parser needs updating.',

    // ── Shared result tables ─────────────────────────────────────────────────────────────────
    'shamDev.balances': 'Balances',
    'shamDev.currency': 'Currency',
    'shamDev.available': 'Available',
    'shamDev.locked': 'Reserved',
    'shamDev.transactions': 'Transfers',
    'shamDev.txId': 'Operation',
    'shamDev.txDate': 'Date',
    'shamDev.txAmount': 'Amount',
    'shamDev.txWho': 'Counterparty',
    'shamDev.txCard': 'Card',
    'shamDev.noTransactions': 'No transfers were on the page.',
  },

  ar: {
    'shamDev.title': 'منصة اختبار شام كاش',
    'shamDev.description':
      'الآلية القديمة عبر المتصفح، عند الطلب. تُقرأ شام كاش عبر واجهتها البرمجية الآن؛ هذه هنا للسؤالين اللذين لا يجيب عنهما إلا متصفح.',

    'shamDev.warningTitle': 'هذه جلسة صرّاف حيّة',
    'shamDev.warningBody':
      'من يملك هذه القيم يكون داخلاً إلى حساب شام كاش ذاك حتى تنتهي الجلسة. لا يُحفظ شيء هنا — تُستخدم لفحص واحد ثم تُهمل — لذا لا يوجد زر «حفظ»، ولا ينبغي أن يوجد.',

    'shamDev.account.pageTitle': 'حسابك في شام كاش',
    'shamDev.account.pageBody':
      'اربطه مرة واحدة بمسح رمز من التطبيق على هاتفك، ثم اقرأ الرصيد وقتما تشاء.',
    'shamDev.account.title': 'الحساب',
    'shamDev.account.readAt': 'قُرئ',
    'shamDev.account.refresh': 'تحديث',
    'shamDev.account.unlink': 'إلغاء الربط',
    'shamDev.account.link': 'اربط حسابك',
    'shamDev.account.emptyTitle': 'لا يوجد حساب مربوط بعد',
    'shamDev.account.emptyBody': 'امسح الرمز بتطبيق شام كاش وسيظهر الحساب هنا.',
    'shamDev.account.neverRead': 'لم يُقرأ بعد',
    'shamDev.account.neverReadBody': 'اضغط «تحديث» لقراءة الرصيد لأول مرة.',
    'shamDev.account.sessionClosed': 'أُغلقت الجلسة',
    'shamDev.account.sessionClosedBody':
      'هذه آخر الأرقام التي قُرئت. لن تتحدّث حتى تربط الحساب من جديد.',
    'shamDev.account.refreshFailed': 'تعذّرت قراءة الحساب',
    'shamDev.qr.title': 'الربط عبر رمز QR',
    'shamDev.qr.description':
      'ما يفعله تسجيل الدخول في موقع شام كاش: يرسم رمزاً، تمسحه من تطبيق الهاتف، فتسجّل الصفحة دخولها بنفسها. الجلسة العائدة صحيحة بحكم آلية إنشائها — بلا نسخ ولا لصق.',
    'shamDev.qr.pin': 'الرمز السري لهذا المتصفح',
    'shamDev.qr.pinHint':
      'تطلب شام كاش من المتصفح المرتبط حديثاً اختيار رمز من أربعة أرقام، بعد المسح بثوانٍ. اكتبه هنا ليُحفظ تلقائياً، أو اتركه فارغاً وستضطر لضبطه بنفسك.',
    'shamDev.qr.start': 'أظهر لي رمزاً',
    'shamDev.qr.restart': 'رمز جديد',
    'shamDev.qr.opening': 'جارٍ فتح صفحة دخول شام كاش — يستغرق لحظة',
    'shamDev.qr.alt': 'رمز QR لتسجيل الدخول إلى شام كاش',
    'shamDev.qr.step1': 'افتح تطبيق شام كاش على هاتفك',
    'shamDev.qr.step2': 'اضغط على حسابي ثم الأجهزة المرتبطة',
    'shamDev.qr.step3': 'وجّه الكاميرا على الرمز بالأعلى',
    'shamDev.qr.waiting': 'بانتظار أن تمسح الرمز…',
    'shamDev.qr.linked': 'تم الربط',
    'shamDev.qr.linkedBody':
      'عُبّئت الجلسة في النموذج بالأسفل. اضغط «ابدأ الفحص» لقراءة الرصيد بها.',
    'shamDev.qr.linkedPin':
      'عُبّئت الجلسة في النموذج بالأسفل. طلبت شام كاش الرمز السري، فاكتب أرقامك الأربعة في حقل الرمز قبل بدء الفحص.',
    'shamDev.qr.expired': 'انتهت صلاحية الرمز',
    'shamDev.qr.expiredBody': 'لم يمسحه أحد في الوقت المتاح. اطلب رمزاً جديداً.',
    'shamDev.qr.failed': 'فشل الربط',
    'shamDev.qr.matched': 'وُجد الرمز عبر: {strategy}',
    'shamDev.qr.fallbackTitle': 'هذه لقطة للصفحة كاملة، لا للرمز وحده',
    'shamDev.qr.fallbackBody':
      'لم يُتعرَّف على عنصر رمز QR، فما تراه لقطة لصفحة الدخول بأكملها — الرمز موجود فيها ويُفترض أن يعمل المسح. يستحق الإبلاغ، لأنه يعني أن محدِّداً واحداً في الخادم يحتاج تصحيحاً.',

    'shamDev.check.title': 'فحص جلسة',
    'shamDev.check.description':
      'يشغّل متصفحاً حقيقياً ويعيد تشغيل هذه القيم على shamcash.sy. توقّع من 55 إلى 90 ثانية — الموقع بطيء في العرض، وهذا ما يُنتظر.',
    'shamDev.check.where':
      'افتح shamcash.sy وأنت مسجّل الدخول، ثم انسخ الكوكيز من أدوات المتصفح، وقيمة PIN من localStorage.',
    'shamDev.check.accessToken': 'كوكي accessToken',
    'shamDev.check.authToken': 'كوكي authToken',
    'shamDev.check.forge': 'كوكي forge (اختياري)',
    'shamDev.check.pinCodeHash': 'shamcash-pin-code-hash (اختياري)',
    'shamDev.check.pinCodeHashHint': 'من localStorage، لا من الكوكيز.',
    'shamDev.check.pin': 'الرمز السري (اختياري)',
    'shamDev.check.pinHint': 'الأرقام الأربعة التي تُدخلها بعد تسجيل الدخول.',
    'shamDev.check.submit': 'ابدأ الفحص',
    'shamDev.check.running': 'جارٍ قراءة الصفحة — يستغرق دقيقة تقريباً',
    'shamDev.check.required': 'الحقلان accessToken و authToken مطلوبان.',

    'shamDev.result.ok': 'الجلسة تعمل',
    'shamDev.result.okBody': 'قُرئت في {checkedAt}.',
    'shamDev.result.expired': 'انتهت صلاحية الجلسة',
    'shamDev.result.expiredBody':
      'أعادت شام كاش القارئ إلى صفحة تسجيل الدخول. القيم قُرئت بشكل صحيح — لكنها ببساطة لم تعد مسجّلة الدخول. انسخ مجموعة جديدة.',
    'shamDev.result.notLinked': 'لم تُرسل أي جلسة',
    'shamDev.result.notLinkedBody': 'املأ حقلي الرمزين على الأقل ثم أعد الفحص.',
    'shamDev.result.unavailable': 'لم تكتمل القراءة',
    'shamDev.result.debugTitle': 'ما رآه المتصفح فعلاً',
    'shamDev.result.debugBody':
      'حُمّلت الصفحة ولم يُعَد توجيهها إلى تسجيل الدخول، لكنها لم تبدُ كصفحة الحساب. هذه هي التي تفرّق بين الحجب والعرض البطيء وإعادة التصميم.',
    'shamDev.result.debugUrl': 'انتهت عند',
    'shamDev.result.debugStorage': 'مفاتيح localStorage',
    'shamDev.result.debugApi': 'ما أجابت به واجهة الموقع',
    'shamDev.result.debugErrors': 'أخطاء جافاسكربت',
    'shamDev.result.debugText': 'نص الصفحة',
    'shamDev.result.copyText': 'انسخ النص إلى المحلّل بالأسفل',

    'shamDev.parse.title': 'فحص المحلّل',
    'shamDev.parse.description':
      'نص الصفحة يدخل، والأرصدة والحوالات تخرج. بلا متصفح ولا شبكة ولا جلسة — وهذا ما يفرّق بين خلل في التحليل ومشكلة في بيانات الدخول.',
    'shamDev.parse.label': 'نص الصفحة',
    'shamDev.parse.hint':
      'النص المعروض لا شيفرة HTML: نفّذ document.body.innerText في وحدة تحكّم الصفحة، أو استخدم النص الذي يعيده فحص فاشل بالأعلى.',
    'shamDev.parse.submit': 'حلّل',
    'shamDev.parse.required': 'الصق نص الصفحة أولاً.',
    'shamDev.parse.nothing': 'لم يجد المحلّل شيئاً',
    'shamDev.parse.nothingBody':
      'لم يُتعرَّف على أي بطاقة رصيد أو حوالة في هذا النص. إن كان النص يُظهرها بوضوح، فقد تغيّرت الصفحة ويحتاج المحلّل إلى تحديث.',

    'shamDev.balances': 'الأرصدة',
    'shamDev.currency': 'العملة',
    'shamDev.available': 'المتاح',
    'shamDev.locked': 'المحجوز',
    'shamDev.transactions': 'الحوالات',
    'shamDev.txId': 'رقم العملية',
    'shamDev.txDate': 'التاريخ',
    'shamDev.txAmount': 'المبلغ',
    'shamDev.txWho': 'الطرف الآخر',
    'shamDev.txCard': 'البطاقة',
    'shamDev.noTransactions': 'لا توجد حوالات في الصفحة.',
  },
});
