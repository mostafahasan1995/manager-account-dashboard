import { defineMessages } from '@/lib/i18n/messages';

/**
 * The platform finance screen, in both languages.
 *
 * Only strings this feature owns live here — Refresh, Low, Checked and the loading/error states come
 * from the shared bundle through `t()`. The wiring vocabulary stays in English inside the Arabic, as
 * everywhere else in this console: USDT, TRC20, BEP20, Sham Cash and NSP are the words a platform
 * admin reads in the operators' own config, and translating them would break that match.
 *
 * The words the failed-read cells show — "unavailable", "not linked", "expired", "not loaded" — are
 * the whole point of the screen: a read that did not land renders as WHAT IT IS, never as a zero.
 */
export const financeMessages = defineMessages({
  en: {
    'finance.title': 'Operator finances',
    'finance.description':
      "Every operator's money, in one place: its Ichancy agent float, the USDT wallets its rails pay into, and its Sham Cash account. The float is read up front; the USDT and Sham Cash columns cost a chain call and a session replay, so they are loaded per operator with Refresh.",
    'finance.note':
      'A balance that could not be read is shown as what it is — unavailable, not linked, expired, or not loaded — and never as a zero. Zero is a real, empty wallet; an outage shown as zero would say an operator’s money is gone.',
    'finance.caption': {
      one: '{count} operator',
      other: '{count} operators',
    },

    'finance.refreshAll': 'Refresh all',
    'finance.refreshRow': 'Refresh',
    'finance.refreshAria': 'Refresh the USDT and Sham Cash columns for {slug}',

    'finance.col.operator': 'Operator',
    'finance.col.agentFloat': 'Agent float',
    'finance.col.usdt': 'USDT wallets',
    'finance.col.shamCash': 'Sham Cash',

    // The failed-read words. `finance.unavailable` is shared by every "the read did not land" cell.
    'finance.unavailable': 'Unavailable',
    'finance.notLoaded': 'Not loaded',
    'finance.notLoadedHint': 'Not read yet — press Refresh to load it.',
    'finance.usdt.noWallets': 'No wallets on this rail',
    'finance.shamCash.notLinked': 'Not linked',
    'finance.shamCash.unauthorized': 'Key rejected',
    'finance.shamCash.locked': 'locked {amount}',
    'finance.checked': 'Checked',

    'finance.empty.title': 'No operators yet',
    'finance.empty.body':
      'When the platform has operators, their finance balances appear here, one row each.',
  },

  ar: {
    'finance.title': 'أموال المشغّلين',
    'finance.description':
      'أموال كل مشغّل في مكان واحد: رصيد وكيله لدى Ichancy، ومحافظ USDT التي تدفع إليها قنواته، وحساب Sham Cash. رصيد الوكيل يُقرأ مباشرةً؛ أما عمودا USDT وSham Cash فيكلّف كلٌّ منهما اتصالاً بالشبكة وإعادة تشغيل جلسة، لذا يُحمَّلان لكل مشغّل عبر «تحديث».',
    'finance.note':
      'الرصيد الذي تعذّرت قراءته يظهر كما هو — غير متاح، أو غير مربوط، أو منتهٍ، أو غير محمّل — ولا يظهر أبداً كصفر. الصفر رصيد حقيقي لمحفظة فارغة؛ وعرض العطل كصفر يقول إن أموال المشغّل ذهبت.',
    'finance.caption': {
      zero: 'لا مشغّلين',
      one: 'مشغّل واحد',
      two: 'مشغّلان',
      few: '{count} مشغّلين',
      many: '{count} مشغّلاً',
      other: '{count} مشغّل',
    },

    'finance.refreshAll': 'تحديث الكل',
    'finance.refreshRow': 'تحديث',
    'finance.refreshAria': 'تحديث عمودَي USDT وSham Cash للمشغّل {slug}',

    'finance.col.operator': 'المشغّل',
    'finance.col.agentFloat': 'رصيد الوكيل',
    'finance.col.usdt': 'محافظ USDT',
    'finance.col.shamCash': 'Sham Cash',

    'finance.unavailable': 'غير متاح',
    'finance.notLoaded': 'غير محمّل',
    'finance.notLoadedHint': 'لم يُقرأ بعد — اضغط «تحديث» لتحميله.',
    'finance.usdt.noWallets': 'لا محافظ على هذه القناة',
    'finance.shamCash.notLinked': 'غير مربوط',
    'finance.shamCash.unauthorized': 'المفتاح مرفوض',
    'finance.shamCash.locked': 'محجوز {amount}',
    'finance.checked': 'قُرئ',

    'finance.empty.title': 'لا مشغّلين بعد',
    'finance.empty.body': 'عندما يكون للمنصّة مشغّلون، تظهر أرصدتهم المالية هنا، صفٌّ لكل مشغّل.',
  },
});
