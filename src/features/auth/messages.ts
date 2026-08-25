import { defineMessages } from '@/lib/i18n/messages';

/**
 * Sign-in strings, for both doors into the console.
 *
 * ── WHY THERE ARE TWO SETS ────────────────────────────────────────────────────────────────────
 * An OPERATOR signs in with its Ichancy agent account — the username and password its players are
 * registered under — and lands as that operator's super admin. The PLATFORM signs in with a
 * one-time code from a Telegram bot, because it runs no agent of its own and has nothing else to
 * prove itself with. The two panels are therefore not two spellings of one idea, and the strings
 * are written to say which account a person is being asked for rather than leaving them to guess.
 *
 * ── WHY THE BOT INSTRUCTION IS CLAUSES AND NOT A SENTENCE ─────────────────────────────────────
 * Two of its parts are not language: `/console` and `/login` are typed into Telegram exactly as
 * written, and "direct chat" is emphasised because sending the command in a group is the mistake
 * that panel exists to prevent. Composing the sentence in the component keeps those parts as
 * elements — a `<code>` that cannot be translated by accident, and a `<strong>` that survives
 * translation.
 *
 * ── WHY THE THREE AGENT REFUSALS ARE THREE STRINGS ────────────────────────────────────────────
 * The backend answers a wrong password, a suspended operator and an operator with no owner as three
 * distinct codes on purpose, and collapsing them here would throw that away: only the first is
 * fixed by retyping. The other two name the person who CAN fix them, because the operator reading
 * the screen cannot, and a screen that only says "refused" sends them round a loop instead.
 *
 * The Arabic is what a cashier says at the desk, not what a manual says. Ichancy, Telegram and the
 * slash commands stay in English because that is how they are typed and how they are spoken.
 */
export const authMessages = defineMessages({
  en: {
    // ── Why the operator is back here ────────────────────────────────────────────────────────
    'auth.session.expiredTitle': 'Your session expired',
    'auth.session.expiredBody':
      'Admin sessions have no refresh token. Sign in again to carry on where you left off.',
    'auth.session.signedOutTitle': 'You were signed out',
    'auth.session.signedOutBody':
      'The API rejected the session. This happens when the token expires or the account is deactivated.',

    // ── The card, and the choice of door ─────────────────────────────────────────────────────
    'auth.signIn.title': 'Sign in',
    'auth.signIn.description':
      'Two different accounts open this console. Pick the one you actually hold.',
    'auth.tab.agent': 'Ichancy account',
    'auth.tab.code': 'Bot code',

    // ── The operator's own agent account ─────────────────────────────────────────────────────
    'auth.agent.intro':
      'The Ichancy agent account your players are registered under — the same username and password. It opens the console as that operator’s super admin.',
    'auth.agent.usernameLabel': 'Ichancy username',
    'auth.agent.passwordLabel': 'Ichancy password',
    'auth.agent.submit': 'Sign in',
    'auth.agent.invalid': 'That Ichancy username and password do not open any operator here.',
    'auth.agent.suspended':
      'Those credentials are right, but that operator is suspended. A platform admin has to activate it before anyone can sign in.',
    'auth.agent.noOwner':
      'Those credentials are right, but this operator’s console account has been deactivated. A platform admin can re-enable it from the Operators screen.',

    // ── One agent, several operators ─────────────────────────────────────────────────────────
    'auth.agent.chooseTitle': 'Which operator?',
    'auth.agent.chooseBody': {
      one: 'This Ichancy agent runs one operator.',
      other: 'This Ichancy agent runs {count} operators. Choose the one to sign into.',
    },
    'auth.agent.operatorLegend': 'Operator',
    'auth.agent.chooseSubmit': 'Sign in to {name}',
    'auth.agent.chooseBack': 'Use a different account',

    // ── The bot-code door ────────────────────────────────────────────────────────────────────
    'auth.code.who':
      'Platform admins sign in here — and so does any staff member an operator has added.',
    'auth.signIn.sendCommand': 'Send',
    'auth.signIn.toBotIn': 'to the cashier bot in a',
    'auth.signIn.directChat': 'direct chat',
    'auth.signIn.notInGroup':
      '— it refuses in a group, where a code would be a credential handed to everyone in it. The reply is good for five minutes, once.',
    'auth.signIn.playerCommand': 'is the player command and will not work here.',
    'auth.signIn.codeLabel': 'One-time code',
    'auth.signIn.submit': 'Sign in',
    'auth.signIn.invalidCode':
      'That code is not valid or has expired. Send /console for a new one.',

    // ── Which backend this build talks to ────────────────────────────────────────────────────
    'auth.demo.title': 'Demo mode',
    'auth.demo.body':
      'This build is running against the built-in mock API — no backend, no database.',
    'auth.demo.signInWith': 'Sign in with',
    'auth.demo.roleHint': 'Each code signs in as a different role, so every screen can be seen:',
    'auth.demo.agentHint':
      'Or sign in as an operator: username {usernames}, password {password}.',
    'auth.demo.agentSuspended':
      '{username} is the suspended operator, so it shows what that refusal looks like.',
    'auth.api.label': 'API:',
  },

  ar: {
    'auth.session.expiredTitle': 'انتهت جلستك',
    'auth.session.expiredBody':
      'جلسات الإدارة بلا تجديد تلقائي. سجّل الدخول من جديد للمتابعة من حيث توقّفت.',
    'auth.session.signedOutTitle': 'تم تسجيل خروجك',
    'auth.session.signedOutBody':
      'رفض الخادم الجلسة. يحدث هذا عند انتهاء صلاحية الرمز أو عند إيقاف الحساب.',

    'auth.signIn.title': 'تسجيل الدخول',
    'auth.signIn.description': 'حسابان مختلفان يفتحان هذه اللوحة. اختر الحساب الذي تملكه فعلاً.',
    'auth.tab.agent': 'حساب Ichancy',
    'auth.tab.code': 'رمز البوت',

    'auth.agent.intro':
      'حساب وكيل Ichancy الذي يُسجَّل تحته لاعبوك — نفس اسم المستخدم وكلمة المرور. يفتح اللوحة بصلاحية المدير الأعلى لهذا المشغّل.',
    'auth.agent.usernameLabel': 'اسم مستخدم Ichancy',
    'auth.agent.passwordLabel': 'كلمة مرور Ichancy',
    'auth.agent.submit': 'تسجيل الدخول',
    'auth.agent.invalid': 'اسم المستخدم وكلمة المرور هذان لا يفتحان أي مشغّل هنا.',
    'auth.agent.suspended':
      'البيانات صحيحة، لكن هذا المشغّل موقوف. على مدير المنصّة تفعيله قبل أن يتمكن أحد من الدخول.',
    'auth.agent.noOwner':
      'البيانات صحيحة، لكن حساب اللوحة لهذا المشغّل موقوف. يمكن لمدير المنصّة إعادة تفعيله من شاشة المشغّلين.',

    'auth.agent.chooseTitle': 'أي مشغّل؟',
    // Arabic counts in six categories, and this number is never one — but `one` is required and a
    // sentence that told an operator to choose between one thing would read as a bug either way.
    'auth.agent.chooseBody': {
      one: 'يدير حساب وكيل Ichancy هذا مشغّلاً واحداً.',
      two: 'يدير حساب وكيل Ichancy هذا مشغّلَين. اختر الذي تريد الدخول إليه.',
      few: 'يدير حساب وكيل Ichancy هذا {count} مشغّلين. اختر الذي تريد الدخول إليه.',
      many: 'يدير حساب وكيل Ichancy هذا {count} مشغّلاً. اختر الذي تريد الدخول إليه.',
      other: 'يدير حساب وكيل Ichancy هذا {count} مشغّل. اختر الذي تريد الدخول إليه.',
    },
    'auth.agent.operatorLegend': 'المشغّل',
    'auth.agent.chooseSubmit': 'الدخول إلى {name}',
    'auth.agent.chooseBack': 'استخدام حساب آخر',

    'auth.code.who': 'من هنا يدخل مدراء المنصّة، وكذلك أي موظف أضافه المشغّل.',
    'auth.signIn.sendCommand': 'أرسل',
    'auth.signIn.toBotIn': 'إلى بوت الصرّاف في',
    'auth.signIn.directChat': 'محادثة خاصة',
    'auth.signIn.notInGroup':
      '— البوت يرفض إرساله في مجموعة، لأن الرمز هناك يصبح بيد كل من فيها. الرد صالح خمس دقائق ولمرة واحدة.',
    'auth.signIn.playerCommand': 'هو أمر اللاعبين ولن يعمل هنا.',
    'auth.signIn.codeLabel': 'رمز دخول لمرة واحدة',
    'auth.signIn.submit': 'تسجيل الدخول',
    // The invisible marks around the command are load-bearing: in an Arabic run the leading slash
    // is a neutral character and would render on the wrong side, as `console/`, which nobody can
    // type into Telegram.
    'auth.signIn.invalidCode':
      'الرمز غير صالح أو انتهت صلاحيته. أرسل ‎/console‎ للحصول على رمز جديد.',

    'auth.demo.title': 'الوضع التجريبي',
    'auth.demo.body': 'هذه النسخة تعمل على واجهة وهمية داخل المتصفح — بلا خادم وبلا قاعدة بيانات.',
    'auth.demo.signInWith': 'سجّل الدخول بالرمز',
    'auth.demo.roleHint': 'كل رمز يسجّل الدخول بدور مختلف، حتى يمكن الاطّلاع على كل الشاشات:',
    'auth.demo.agentHint':
      'أو سجّل الدخول كمشغّل: اسم المستخدم {usernames}، وكلمة المرور {password}.',
    'auth.demo.agentSuspended': '{username} هو المشغّل الموقوف، فيُظهر شكل ذلك الرفض.',
    'auth.api.label': 'عنوان API:',
  },
});
