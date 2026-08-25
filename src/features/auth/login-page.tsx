import { useNavigate, useSearch } from '@tanstack/react-router';
import { Building2, Coins, KeyRound, MessageSquare } from 'lucide-react';
import { useEffect, useRef, useState, type SyntheticEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { homeRouteFor } from '@/components/layout/nav-items';
import { config } from '@/config';
import { errorMessage, isApiError } from '@/lib/api/errors';
import { can } from '@/lib/auth/permissions';
import { useAuth } from '@/lib/auth/use-auth';
import { useEnumLabel, useT, type Translator } from '@/lib/i18n/use-translation';
import {
  MOCK_AGENT_PASSWORD,
  MOCK_AGENT_USERNAMES,
  MOCK_LOGIN_CODE,
  MOCK_ROLE_CODES,
  MOCK_SUSPENDED_AGENT_USERNAME,
} from '@/mocks/demo';
import { agentOperatorChoices, type AdminSession, type AgentOperatorChoice } from '@/types/admin';

import { authMessages } from './messages';

/**
 * Sign-in.
 *
 * ── TWO DOORS, NOT TWO SPELLINGS OF ONE ───────────────────────────────────────────────────────
 * An OPERATOR signs in with its Ichancy agent account — the username and password its own players
 * are registered under — and lands as that operator's super admin. The PLATFORM signs in with a
 * one-time code from the Telegram bot, because it runs no Ichancy agent of its own and has nothing
 * else to prove itself with. Staff of an operator use the code too.
 *
 * They are tabs rather than one form with a "sign in with…" link because the question the screen is
 * really asking is WHICH ACCOUNT DO YOU HOLD, and that has exactly two answers. A single form with
 * a fallback would make one of them look like the recovery path for the other.
 *
 * ── WHY THE TABS ACTIVATE MANUALLY ────────────────────────────────────────────────────────────
 * `activationMode="manual"`, so arrow keys move between the tabs without switching panels. Each
 * panel is a FORM whose first field takes focus when it mounts; with the default automatic mode,
 * arrowing across the tab list would yank focus into a text field on every keystroke and unmount
 * whatever the operator had already typed on the other side.
 *
 * ── WHY EACH REFUSAL GETS ITS OWN SENTENCE ────────────────────────────────────────────────────
 * The backend distinguishes a wrong password from a suspended operator from a console account
 * somebody deactivated, and only the first is fixed by retyping. Collapsing them into "sign-in
 * failed" would leave an owner with correct credentials retyping them forever, so the other two name
 * the person who can actually fix it.
 *
 * There is deliberately no "this operator has no admin yet" case to handle: an operator's first
 * agent sign-in creates its own super admin row, because an operator is born with no staff and the
 * agent account IS its owner.
 *
 * Everything Latin that is TYPED rather than read — the two slash commands, the code, an Ichancy
 * login, the API URL — carries `dir="ltr"`. In an Arabic sentence the bidi algorithm would otherwise
 * pull the leading slash to the far end of the run and show `console/`, which is not a command
 * anyone can copy.
 */

type AuthTranslator = Translator<(typeof authMessages)['en']>;
type Door = 'agent' | 'code';

export function LoginPage() {
  const { signOutReason } = useAuth();
  const t = useT(authMessages);
  const [door, setDoor] = useState<Door>('agent');

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-11 items-center justify-center rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)]">
            <Coins className="size-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{config.appName}</h1>
            <p className="text-sm text-[var(--muted-foreground)]">{t('app.tagline')}</p>
          </div>
        </div>

        {signOutReason === 'expired' ? (
          <Alert tone="warning" title={t('auth.session.expiredTitle')}>
            {t('auth.session.expiredBody')}
          </Alert>
        ) : null}

        {signOutReason === 'unauthorized' ? (
          <Alert tone="warning" title={t('auth.session.signedOutTitle')}>
            {t('auth.session.signedOutBody')}
          </Alert>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>{t('auth.signIn.title')}</CardTitle>
            <CardDescription>{t('auth.signIn.description')}</CardDescription>
          </CardHeader>

          <CardContent>
            <Tabs
              value={door}
              onValueChange={(next) => {
                setDoor(next as Door);
              }}
              activationMode="manual"
            >
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="agent">
                  <Building2 className="size-4" />
                  {t('auth.tab.agent')}
                </TabsTrigger>
                <TabsTrigger value="code">
                  <KeyRound className="size-4" />
                  {t('auth.tab.code')}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="agent">
                <AgentForm t={t} />
              </TabsContent>

              <TabsContent value="code">
                <BotCodeForm t={t} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {config.enableMocks ? <DemoHint t={t} /> : <ApiHint t={t} />}
      </div>
    </main>
  );
}

/**
 * Where a fresh session lands.
 *
 * The FRESH session's role decides, not the one in context: a PLATFORM_ADMIN has no overview to go
 * to, so sending everyone to "/" would bounce them straight back out of it. `redirect` wins when
 * there is one, which is what makes a shared queue link survive a sign-in.
 */
function useLanding(): (session: AdminSession) => Promise<void> {
  const navigate = useNavigate();
  const search = useSearch({ from: '/login' });

  return async (session: AdminSession) => {
    const destination =
      search.redirect ?? homeRouteFor((capability) => can(session.admin.role, capability));
    await navigate({ to: destination });
  };
}

/** The three refusals this door has that are worth their own sentence, and everything else. */
function agentErrorMessage(error: unknown, t: AuthTranslator): string {
  if (isApiError(error)) {
    if (error.code === 'AGENT_CREDENTIALS_INVALID') return t('auth.agent.invalid');
    if (error.code === 'AGENT_OPERATOR_NOT_ACTIVE') return t('auth.agent.suspended');
    if (error.code === 'AGENT_OPERATOR_HAS_NO_OWNER') return t('auth.agent.noOwner');
  }
  return errorMessage(error);
}

function AgentForm({ t }: { t: AuthTranslator }) {
  const { signInWithAgent } = useAuth();
  const land = useLanding();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  /** Non-empty only after the server answered "which operator?". */
  const [operators, setOperators] = useState<AgentOperatorChoice[]>([]);
  const [chosenSlug, setChosenSlug] = useState<string | null>(null);

  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  /*
   * Keyed on whether the picker is up, not on mount, and that is what makes the way back work: the
   * username input is UNMOUNTED while the operator choice is on screen, so focusing it from the
   * click handler that dismisses the picker would reach a null ref. Here the focus lands after the
   * fields exist again. On first mount the picker is empty, so this is also the initial focus.
   */
  useEffect(() => {
    if (operators.length === 0) usernameRef.current?.focus();
  }, [operators.length]);

  const attempt = async (operatorSlug: string | null) => {
    setSubmitting(true);
    setError(null);
    try {
      const session = await signInWithAgent({
        username,
        password,
        // Absent, not undefined: the field is optional in the strict sense on the wire.
        ...(operatorSlug === null ? {} : { operatorSlug }),
      });
      await land(session);
    } catch (caught) {
      /*
       * Not a failure — a question. The credential was accepted and the agent runs more than one
       * operator, so the form turns into a picker rather than throwing the password away and
       * making somebody type it again to answer a question they have already earned the right to
       * be asked.
       */
      if (isApiError(caught) && caught.code === 'AGENT_OPERATOR_AMBIGUOUS') {
        const choices = agentOperatorChoices(caught.details);
        if (choices.length > 0) {
          setOperators(choices);
          setChosenSlug(choices[0]?.slug ?? null);
          return;
        }
      }

      setError(caught);
      // The username survives and the password does not: retyping a username you got right is
      // friction, and leaving a rejected password in the field invites resubmitting it unchanged.
      setPassword('');
      setOperators([]);
      setChosenSlug(null);
      passwordRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    if (operators.length === 0 && (username.trim().length === 0 || password.length === 0)) return;
    void attempt(chosenSlug);
  };

  const chosen = operators.find((operator) => operator.slug === chosenSlug);

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      {operators.length > 0 ? (
        <OperatorChoice
          t={t}
          operators={operators}
          chosenSlug={chosenSlug}
          onChoose={setChosenSlug}
        />
      ) : (
        <>
          <p className="text-sm text-[var(--muted-foreground)]">{t('auth.agent.intro')}</p>

          <div className="space-y-1.5">
            <Label htmlFor="agent-username">{t('auth.agent.usernameLabel')}</Label>
            <Input
              id="agent-username"
              ref={usernameRef}
              value={username}
              onChange={(event) => {
                setUsername(event.target.value);
              }}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              maxLength={256}
              // An Ichancy login is Latin and typed left to right in either language.
              dir="ltr"
              className="font-mono"
              aria-invalid={error !== null}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="agent-password">{t('auth.agent.passwordLabel')}</Label>
            <Input
              id="agent-password"
              ref={passwordRef}
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
              }}
              autoComplete="current-password"
              maxLength={256}
              dir="ltr"
              aria-invalid={error !== null}
              aria-describedby={error === null ? undefined : 'agent-error'}
            />
          </div>
        </>
      )}

      {error === null ? null : (
        <p id="agent-error" role="alert" className="text-sm text-[var(--danger)]">
          {agentErrorMessage(error, t)}
        </p>
      )}

      <Button
        type="submit"
        variant="primary"
        className="w-full"
        loading={submitting}
        disabled={
          operators.length > 0
            ? chosenSlug === null
            : username.trim().length === 0 || password.length === 0
        }
      >
        <Building2 className="size-4" />
        {chosen === undefined
          ? t('auth.agent.submit')
          : t('auth.agent.chooseSubmit', { name: chosen.displayName })}
      </Button>

      {operators.length > 0 ? (
        <Button
          type="button"
          variant="ghost"
          className="w-full"
          onClick={() => {
            setOperators([]);
            setChosenSlug(null);
            setPassword('');
          }}
        >
          {t('auth.agent.chooseBack')}
        </Button>
      ) : null}
    </form>
  );
}

/**
 * The picker shown when one Ichancy agent runs several operators.
 *
 * Radio inputs rather than a select: there are two or three of these, each with a name and a slug
 * worth reading, and which operator's money a session opens is not a choice to bury behind a
 * closed dropdown.
 */
function OperatorChoice({
  t,
  operators,
  chosenSlug,
  onChoose,
}: {
  t: AuthTranslator;
  operators: AgentOperatorChoice[];
  chosenSlug: string | null;
  onChoose: (slug: string) => void;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="sr-only">{t('auth.agent.operatorLegend')}</legend>

      <Alert tone="info" title={t('auth.agent.chooseTitle')}>
        {t('auth.agent.chooseBody', { count: operators.length })}
      </Alert>

      <div className="space-y-2">
        {operators.map((operator) => (
          <label
            key={operator.slug}
            className="flex cursor-pointer items-start gap-3 rounded-md border border-[var(--border)] p-3 text-sm hover:bg-[var(--surface-muted)] has-[:checked]:border-[var(--primary)] has-[:checked]:bg-[var(--primary-muted)]"
          >
            <input
              type="radio"
              name="operator"
              value={operator.slug}
              checked={chosenSlug === operator.slug}
              onChange={() => {
                onChoose(operator.slug);
              }}
              className="mt-0.5 accent-[var(--primary)]"
            />
            <span className="min-w-0">
              <span className="block font-medium">{operator.displayName}</span>
              <span className="block font-mono text-xs text-[var(--muted-foreground)]" dir="ltr">
                {operator.slug}
              </span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function BotCodeForm({ t }: { t: AuthTranslator }) {
  const { signIn } = useAuth();
  const land = useLanding();

  const [code, setCode] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (code.trim().length === 0 || submitting) return;

    setSubmitting(true);
    setError(null);
    try {
      await land(await signIn(code));
    } catch (caught) {
      setError(caught);
      setCode('');
      inputRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="space-y-4"
      noValidate
    >
      <p className="text-sm text-[var(--muted-foreground)]">
        {t('auth.code.who')} {t('auth.signIn.sendCommand')}{' '}
        <code className="font-mono" dir="ltr">
          /console
        </code>{' '}
        {t('auth.signIn.toBotIn')} <strong>{t('auth.signIn.directChat')}</strong>{' '}
        {t('auth.signIn.notInGroup')}{' '}
        <code className="font-mono" dir="ltr">
          /login
        </code>{' '}
        {t('auth.signIn.playerCommand')}
      </p>

      <div className="space-y-1.5">
        <Label htmlFor="bot-code">{t('auth.signIn.codeLabel')}</Label>
        <Input
          id="bot-code"
          ref={inputRef}
          value={code}
          onChange={(event) => {
            setCode(event.target.value.toUpperCase());
          }}
          placeholder="K7QP42XM"
          autoComplete="one-time-code"
          // The real code is 8 uppercase letters and digits, not a PIN. `inputMode="numeric"`
          // would open a number pad that cannot type it, and lower case is upper-cased here
          // rather than rejected at the server — nobody should lose a 5-minute code to caps.
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={64}
          // A Latin code is typed left to right in either language; an RTL field would put
          // the caret on the wrong end of a half-typed one.
          dir="ltr"
          className="text-center font-mono text-lg tracking-[0.3em] uppercase"
          aria-invalid={error !== null}
          aria-describedby={error === null ? undefined : 'bot-code-error'}
        />
      </div>

      {error === null ? null : (
        <p id="bot-code-error" role="alert" className="text-sm text-[var(--danger)]">
          {isApiError(error) && error.code === 'BOT_CODE_INVALID'
            ? t('auth.signIn.invalidCode')
            : errorMessage(error)}
        </p>
      )}

      <Button
        type="submit"
        variant="primary"
        className="w-full"
        loading={submitting}
        disabled={code.trim().length === 0}
      >
        <MessageSquare className="size-4" />
        {t('auth.signIn.submit')}
      </Button>
    </form>
  );
}

function DemoHint({ t }: { t: AuthTranslator }) {
  const enumLabel = useEnumLabel();

  return (
    <Alert tone="info" title={t('auth.demo.title')}>
      <p>
        {t('auth.demo.body')} {t('auth.demo.signInWith')}{' '}
        <code className="font-mono font-semibold" dir="ltr">
          {MOCK_LOGIN_CODE}
        </code>
        .
      </p>
      <p className="mt-2">{t('auth.demo.roleHint')}</p>
      {/* Roles are most of what this console is; a demo stuck on one role shows none of it. */}
      <ul className="mt-1 space-y-0.5">
        {Object.entries(MOCK_ROLE_CODES).map(([code, role]) => (
          <li key={code} className="flex items-center gap-2">
            <code className="font-mono font-semibold" dir="ltr">
              {code}
            </code>
            <span>{enumLabel('adminRole', role)}</span>
          </li>
        ))}
      </ul>
      {/* The other door needs demonstrating too, refusals included — see MOCK_AGENT_PASSWORD. */}
      <p className="mt-2">
        {t('auth.demo.agentHint', {
          usernames: MOCK_AGENT_USERNAMES.join(', '),
          password: MOCK_AGENT_PASSWORD,
        })}
      </p>
      <p className="mt-1">
        {t('auth.demo.agentSuspended', { username: MOCK_SUSPENDED_AGENT_USERNAME })}
      </p>
    </Alert>
  );
}

function ApiHint({ t }: { t: AuthTranslator }) {
  return (
    <p className="text-center text-xs text-[var(--muted-foreground)]">
      {t('auth.api.label')}{' '}
      <span className="font-mono" dir="ltr">
        {config.apiBaseUrl}
      </span>
    </p>
  );
}
