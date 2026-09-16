import { defineMessages } from '@/lib/i18n/messages';

/**
 * Sign-in strings. One door: a username or email, and a password.
 *
 * ── WHY THERE IS ONE SET NOW ──────────────────────────────────────────────────────────────────
 * There used to be two panels — an Ichancy agent account, and a one-time code from the bot's
 * `/console` command — and the screen made the operator say which they held before it would take
 * anything. The code door was removed on 2026-09-05 when staff became username+password accounts,
 * and the server now tries a person's own console credential first and the operator's agent
 * account second behind the same two fields. So the copy no longer asks which kind of account
 * somebody has; it asks for a login and a password, which is all a person actually knows.
 *
 * ── WHY THE REFUSALS ARE STILL THREE STRINGS ──────────────────────────────────────────────────
 * The backend answers a wrong password, a suspended operator and a deactivated console account as
 * three distinct codes on purpose, and collapsing them here would throw that away: only the first
 * is fixed by retyping. The other two name the person who CAN fix them, because the operator
 * reading the screen cannot, and a screen that only says "refused" sends them round a loop instead.
 *
 * The Arabic is what a cashier says at the desk, not what a manual says. Ichancy stays in English
 * because that is how it is written and how it is spoken.
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

    // ── The card ─────────────────────────────────────────────────────────────────────────────
    'auth.signIn.title': 'Sign in',
    'auth.signIn.description': 'Use the username and password you were given.',

    // ── The one form ─────────────────────────────────────────────────────────────────────────
    'auth.credentials.intro':
      'Your console login — a username or an email — and your password. An operator signing in for the first time can use its Ichancy agent account here too.',
    'auth.credentials.usernameLabel': 'Username or email',
    'auth.credentials.passwordLabel': 'Password',
    'auth.credentials.submit': 'Sign in',
    'auth.credentials.invalid': 'That username and password do not open anything here.',
    'auth.credentials.suspended':
      'Those credentials are right, but that operator is suspended. A platform admin has to activate it before anyone can sign in.',
    'auth.credentials.noOwner':
      'Those credentials are right, but this operator’s console account has been deactivated. A platform admin can re-enable it from the Operators screen.',

    // ── One credential, several operators ────────────────────────────────────────────────────
    'auth.credentials.chooseTitle': 'Which operator?',
    'auth.credentials.chooseBody': {
      one: 'This login opens one operator.',
      other: 'This login opens {count} operators. Choose the one to sign into.',
    },
    'auth.credentials.operatorLegend': 'Operator',
    'auth.credentials.chooseSubmit': 'Sign in to {name}',
    'auth.credentials.chooseBack': 'Use a different account',

    // ── Which backend this build talks to ────────────────────────────────────────────────────
    'auth.demo.title': 'Demo mode',
    'auth.demo.body':
      'This build is running against the built-in mock API — no backend, no database.',
    'auth.demo.signInWith': 'Every demo login uses the password {password}.',
    'auth.demo.roleHint':
      'Each username signs in as a different role, so every screen can be seen:',
    'auth.demo.agentHint': 'Or sign in as an operator: username {usernames}, password {password}.',
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
    'auth.signIn.description': 'استخدم اسم المستخدم وكلمة المرور اللذين أُعطيا لك.',

    'auth.credentials.intro':
      'اسم الدخول الخاص بك — اسم مستخدم أو بريد إلكتروني — وكلمة المرور. ويستطيع المشغّل الذي يدخل لأول مرة استخدام حساب وكيل Ichancy هنا أيضاً.',
    'auth.credentials.usernameLabel': 'اسم المستخدم أو البريد الإلكتروني',
    'auth.credentials.passwordLabel': 'كلمة المرور',
    'auth.credentials.submit': 'تسجيل الدخول',
    'auth.credentials.invalid': 'اسم المستخدم وكلمة المرور هذان لا يفتحان شيئاً هنا.',
    'auth.credentials.suspended':
      'البيانات صحيحة، لكن هذا المشغّل موقوف. على مدير المنصّة تفعيله قبل أن يتمكن أحد من الدخول.',
    'auth.credentials.noOwner':
      'البيانات صحيحة، لكن حساب اللوحة لهذا المشغّل موقوف. يمكن لمدير المنصّة إعادة تفعيله من شاشة المشغّلين.',

    'auth.credentials.chooseTitle': 'أي مشغّل؟',
    // Arabic counts in six categories, and this number is never one — but `one` is required and a
    // sentence that told an operator to choose between one thing would read as a bug either way.
    'auth.credentials.chooseBody': {
      one: 'اسم الدخول هذا يفتح مشغّلاً واحداً.',
      two: 'اسم الدخول هذا يفتح مشغّلَين. اختر الذي تريد الدخول إليه.',
      few: 'اسم الدخول هذا يفتح {count} مشغّلين. اختر الذي تريد الدخول إليه.',
      many: 'اسم الدخول هذا يفتح {count} مشغّلاً. اختر الذي تريد الدخول إليه.',
      other: 'اسم الدخول هذا يفتح {count} مشغّل. اختر الذي تريد الدخول إليه.',
    },
    'auth.credentials.operatorLegend': 'المشغّل',
    'auth.credentials.chooseSubmit': 'الدخول إلى {name}',
    'auth.credentials.chooseBack': 'استخدام حساب آخر',

    'auth.demo.title': 'الوضع التجريبي',
    'auth.demo.body': 'هذه النسخة تعمل على واجهة وهمية داخل المتصفح — بلا خادم وبلا قاعدة بيانات.',
    'auth.demo.signInWith': 'كل حسابات التجربة تستخدم كلمة المرور {password}.',
    'auth.demo.roleHint':
      'كل اسم مستخدم يسجّل الدخول بدور مختلف، حتى يمكن الاطّلاع على كل الشاشات:',
    'auth.demo.agentHint':
      'أو سجّل الدخول كمشغّل: اسم المستخدم {usernames}، وكلمة المرور {password}.',
    'auth.demo.agentSuspended': '{username} هو المشغّل الموقوف، فيُظهر شكل ذلك الرفض.',
    'auth.api.label': 'عنوان API:',
  },
});
