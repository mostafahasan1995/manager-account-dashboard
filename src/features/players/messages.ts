import { defineMessages } from '@/lib/i18n/messages';

/**
 * The player directory's strings.
 *
 * Ichancy stays in English everywhere: it is the name of the betting platform the cashiers talk
 * about by name all day, and an Arabic rendering of it would be a word nobody says out loud.
 *
 * The Arabic register is the one used at the desk — "لا يمكن إضافة الرصيد" rather than a literary
 * paraphrase — because these lines are read aloud to a player waiting on the phone.
 */
export const playerMessages = defineMessages({
  en: {
    'players.description':
      'Find an account by name, @username, Telegram id or phone. A player with no Ichancy account cannot be credited, however far their deposit gets.',
    'players.empty.title': 'No players match these filters',
    'players.empty.description':
      'Search spans name, username, Telegram id and phone — try a shorter fragment, or clear the status and Ichancy filters.',

    'players.table.caption': 'Players matching the current filters',
    'players.table.action': 'Action',

    'players.field.playerId': 'Player id',
    'players.field.firstName': 'First name',
    'players.field.lastName': 'Last name',
    'players.field.phone': 'Phone',
    'players.field.language': 'Language',
    'players.field.lastSeen': 'Last seen',
    'players.field.linked': 'Linked',
    'players.field.ichancyPlayerId': 'Ichancy player id',
    'players.field.ichancyLogin': 'Ichancy login',
    'players.field.registered': 'Registered',
    'players.field.deposit': 'Deposit',

    'players.ichancy.linked': 'Linked',
    'players.ichancy.notLinked': 'Not linked',
    'players.ichancy.playerId': 'id {id}',
    'players.ichancy.login': 'Login',
    'players.ichancy.agent': 'Agent',
    'players.cannotBeCredited': 'Cannot be credited',

    'players.filters.search': 'Search players',
    'players.filters.searchPlaceholder': 'Name, @username, Telegram id or phone',
    'players.filters.clearSearch': 'Clear search',
    'players.filters.anyStatus': 'Any status',
    'players.filters.linked': 'Ichancy linked',
    'players.filters.waitingForIchancy': 'Waiting for Ichancy',

    'players.backToList': 'Back to players',
    'players.identity.title': 'Identity',
    'players.identity.ichancyAccount': 'Ichancy account',

    'players.link.action': 'Create Ichancy account',
    'players.link.forPlayer': 'Create Ichancy account for {name}',
    'players.link.confirmTitle': 'Create an Ichancy account?',
    'players.link.confirmDescription':
      "{name} gets a betting account on the tenant's Ichancy agent, which is what lets their approved deposits be credited.",
    'players.link.confirmLabel': 'Create account',
    'players.link.notWaitingTitle': 'This player is not waiting for an account',
    'players.link.notWaitingBody':
      'Their status is not “{status}”, so somebody either closed the account or the link already failed for a reason worth checking first.',
    'players.link.idempotentNote':
      'Safe to repeat: if the account already exists this changes nothing and says so.',
    'players.link.created': 'Ichancy account created',
    'players.link.createdDescription':
      '{name} can be credited now. Login {login}, agent {agent}.',
    'players.link.alreadyLinked': 'Already linked',
    'players.link.alreadyLinkedDescription':
      'Nothing was created — {name} already has login {login} on agent {agent}.',
    'players.link.nothingCreated':
      ' — this player already had an account, so nothing was created.',
    'players.link.failed': 'Could not create the Ichancy account',

    'players.deposits.title': 'Recent deposits',
    'players.deposits.hint': 'Newest first. Open one to review it in the queue.',
    'players.deposits.showing': {
      one: 'Showing the most recent deposit.',
      other: 'Showing the {count} most recent deposits.',
    },
    'players.deposits.emptyTitle': 'No deposits yet',
    'players.deposits.emptyDescription': 'This player has never submitted one.',
    'players.deposits.caption': "The player's most recent deposits",
  },

  ar: {
    'players.description':
      'ابحث عن حساب بالاسم أو @username أو معرّف تلغرام أو رقم الهاتف. اللاعب الذي لا يملك حساب Ichancy لا يمكن إضافة الرصيد له، مهما تقدّم إيداعه.',
    'players.empty.title': 'لا يوجد لاعبون يطابقون هذه التصفية',
    'players.empty.description':
      'البحث يشمل الاسم واسم المستخدم ومعرّف تلغرام ورقم الهاتف — جرّب جزءاً أقصر، أو امسح تصفية الحالة والربط مع Ichancy.',

    'players.table.caption': 'اللاعبون المطابقون للتصفية الحالية',
    'players.table.action': 'الإجراء',

    'players.field.playerId': 'معرّف اللاعب',
    'players.field.firstName': 'الاسم الأول',
    'players.field.lastName': 'اسم العائلة',
    'players.field.phone': 'رقم الهاتف',
    'players.field.language': 'اللغة',
    'players.field.lastSeen': 'آخر ظهور',
    'players.field.linked': 'الربط',
    'players.field.ichancyPlayerId': 'معرّف اللاعب في Ichancy',
    'players.field.ichancyLogin': 'اسم الدخول في Ichancy',
    'players.field.registered': 'تاريخ التسجيل',
    'players.field.deposit': 'الإيداع',

    'players.ichancy.linked': 'مرتبط',
    'players.ichancy.notLinked': 'غير مرتبط',
    'players.ichancy.playerId': 'المعرّف {id}',
    'players.ichancy.login': 'اسم الدخول',
    'players.ichancy.agent': 'الوكيل',
    'players.cannotBeCredited': 'لا يمكن إضافة الرصيد',

    'players.filters.search': 'بحث عن لاعب',
    'players.filters.searchPlaceholder': 'الاسم أو @username أو معرّف تلغرام أو الهاتف',
    'players.filters.clearSearch': 'مسح البحث',
    'players.filters.anyStatus': 'كل الحالات',
    'players.filters.linked': 'الربط مع Ichancy',
    'players.filters.waitingForIchancy': 'بانتظار Ichancy',

    'players.backToList': 'رجوع إلى اللاعبين',
    'players.identity.title': 'بيانات اللاعب',
    'players.identity.ichancyAccount': 'حساب Ichancy',

    'players.link.action': 'إنشاء حساب Ichancy',
    'players.link.forPlayer': 'إنشاء حساب Ichancy لـ {name}',
    'players.link.confirmTitle': 'إنشاء حساب Ichancy؟',
    'players.link.confirmDescription':
      'سيحصل {name} على حساب لعب على وكيل Ichancy الخاص بالمشغّل، وهو ما يسمح بإضافة رصيد إيداعاته الموافق عليها.',
    'players.link.confirmLabel': 'إنشاء الحساب',
    'players.link.notWaitingTitle': 'هذا اللاعب ليس بانتظار حساب',
    'players.link.notWaitingBody':
      'حالته ليست «{status}»، أي أن أحدهم أغلق الحساب أو أن الربط فشل سابقاً لسبب يستحق التحقق منه أولاً.',
    'players.link.idempotentNote': 'التكرار آمن: إذا كان الحساب موجوداً فلن يتغيّر شيء وسيُقال لك ذلك.',
    'players.link.created': 'تم إنشاء حساب Ichancy',
    'players.link.createdDescription':
      'يمكن الآن إضافة الرصيد لـ {name}. اسم الدخول {login}، الوكيل {agent}.',
    'players.link.alreadyLinked': 'مرتبط مسبقاً',
    'players.link.alreadyLinkedDescription':
      'لم يُنشأ شيء — {name} يملك أصلاً اسم الدخول {login} على الوكيل {agent}.',
    'players.link.nothingCreated': ' — هذا اللاعب كان يملك حساباً أصلاً، فلم يُنشأ شيء.',
    'players.link.failed': 'تعذّر إنشاء حساب Ichancy',

    'players.deposits.title': 'آخر الإيداعات',
    'players.deposits.hint': 'الأحدث أولاً. افتح أحدها لمراجعته في القائمة.',
    // Arabic counts in six categories, and a player panel showing exactly two deposits is ordinary.
    'players.deposits.showing': {
      zero: 'لا توجد إيداعات.',
      one: 'يظهر آخر إيداع.',
      two: 'يظهر آخر إيداعين.',
      few: 'تظهر آخر {count} إيداعات.',
      many: 'يظهر آخر {count} إيداعاً.',
      other: 'يظهر آخر {count} إيداع.',
    },
    'players.deposits.emptyTitle': 'لا توجد إيداعات بعد',
    'players.deposits.emptyDescription': 'هذا اللاعب لم يقدّم أي إيداع.',
    'players.deposits.caption': 'آخر إيداعات هذا اللاعب',
  },
});
