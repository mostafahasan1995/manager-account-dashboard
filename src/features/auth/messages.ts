import { defineMessages } from '@/lib/i18n/messages';

/**
 * Sign-in strings.
 *
 * The bot instruction is declared as CLAUSES rather than one sentence because two of its parts are
 * not language: `/console` and `/login` are commands typed into Telegram exactly as written, and
 * "direct chat" is emphasised because sending the command in a group is the mistake this screen
 * exists to prevent. Composing the sentence in the component keeps those parts as elements — a
 * `<code>` that cannot be translated by accident, and a `<strong>` that survives translation.
 *
 * The Arabic is what a cashier says at the desk, not what a manual says: "أرسل" and "الرمز غير
 * صالح", with Ichancy, Telegram and the slash commands left in English because that is how they are
 * typed and how they are spoken.
 */
export const authMessages = defineMessages({
  en: {
    // ── Why the operator is back here ────────────────────────────────────────────────────────
    'auth.session.expiredTitle': 'Your session expired',
    'auth.session.expiredBody':
      'Admin sessions have no refresh token. Ask the bot for a new code to carry on.',
    'auth.session.signedOutTitle': 'You were signed out',
    'auth.session.signedOutBody':
      'The API rejected the session. This happens when the token expires or the account is deactivated.',

    // ── The bot-code instruction, one clause per element it wraps ────────────────────────────
    'auth.signIn.title': 'Sign in with a bot code',
    'auth.signIn.sendCommand': 'Send',
    'auth.signIn.toBotIn': 'to the cashier bot in a',
    'auth.signIn.directChat': 'direct chat',
    'auth.signIn.notInGroup':
      '— it refuses in a group, where a code would be a credential handed to everyone in it. The reply is good for five minutes, once.',
    'auth.signIn.playerCommand': 'is the player command and will not work here.',

    // ── The form ─────────────────────────────────────────────────────────────────────────────
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
    'auth.api.label': 'API:',
  },

  ar: {
    'auth.session.expiredTitle': 'انتهت جلستك',
    'auth.session.expiredBody':
      'جلسات الإدارة بلا تجديد تلقائي. اطلب من البوت رمزاً جديداً للمتابعة.',
    'auth.session.signedOutTitle': 'تم تسجيل خروجك',
    'auth.session.signedOutBody':
      'رفض الخادم الجلسة. يحدث هذا عند انتهاء صلاحية الرمز أو عند إيقاف الحساب.',

    'auth.signIn.title': 'تسجيل الدخول برمز البوت',
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
    'auth.api.label': 'عنوان API:',
  },
});
