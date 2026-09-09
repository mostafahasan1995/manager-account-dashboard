import { useNavigate, useSearch } from '@tanstack/react-router';
import { Coins, LogIn } from 'lucide-react';
import { useEffect, useRef, useState, type SyntheticEvent } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { homeRouteFor } from '@/components/layout/nav-items';
import { config } from '@/config';
import { errorMessage, isApiError } from '@/lib/api/errors';
import { can } from '@/lib/auth/permissions';
import { useAuth } from '@/lib/auth/use-auth';
import { useAppName } from '@/lib/i18n/use-app-name';
import { useEnumLabel, useT, type Translator } from '@/lib/i18n/use-translation';
import {
  MOCK_AGENT_PASSWORD,
  MOCK_AGENT_USERNAMES,
  MOCK_CONSOLE_PASSWORD,
  MOCK_ROLE_LOGINS,
  MOCK_SUSPENDED_AGENT_USERNAME,
} from '@/mocks/demo';
import { agentOperatorChoices, type AdminSession, type AgentOperatorChoice } from '@/types/admin';

import { authMessages } from './messages';

/**
 * Sign-in. One form: a username or email, and a password.
 *
 * ── WHY ONE FORM AND NOT TWO TABS ─────────────────────────────────────────────────────────────
 * This screen used to ask WHICH ACCOUNT DO YOU HOLD — an Ichancy agent account, or a one-time code
 * from the bot's `/console` command — and made the operator answer before it would take a
 * credential. Both premises are gone. Staff are username+password accounts (2026-09-05), the bot
 * hands out no console codes at all, and the server itself now tries the caller's own credential
 * first and the operator's agent account second behind the SAME two fields.
 *
 * So the screen no longer asks a question only the backend can answer. Somebody who was given a
 * username and a password types them; an owner who has only ever held the Ichancy account types
 * that; neither has to know which is which, because the answer is the same session either way.
 *
 * ── WHY THE AMBIGUITY PICKER IS NOT AN ERROR PATH ─────────────────────────────────────────────
 * One credential can legitimately open more than one operator. The server answers 409 with the
 * choices rather than picking, and this form turns into a radio list WITHOUT clearing the password
 * or showing a refusal — the credential was accepted, and being asked which operator is not a
 * failure to recover from. Getting that wrong would throw away a correct password and make somebody
 * retype it to answer a question they had already earned the right to be asked.
 *
 * ── WHY EACH REFUSAL GETS ITS OWN SENTENCE ────────────────────────────────────────────────────
 * The backend distinguishes a wrong password from a suspended operator from a console account
 * somebody deactivated, and only the first is fixed by retyping. Collapsing them into "sign-in
 * failed" would leave an owner with correct credentials retyping them forever, so the other two name
 * the person who can actually fix it.
 *
 * Everything Latin that is TYPED rather than read — a login, an operator slug, the API URL —
 * carries `dir="ltr"`, or the bidi algorithm reorders a half-typed value in an Arabic layout and
 * puts the caret on the wrong end of it.
 */

type AuthTranslator = Translator<(typeof authMessages)['en']>;

export function LoginPage() {
  const { signOutReason } = useAuth();
  const t = useT(authMessages);
  const appName = useAppName();

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-11 items-center justify-center rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)]">
            <Coins className="size-5" />
          </span>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{appName}</h1>
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
            <CredentialsForm t={t} />
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

/**
 * The refusals worth their own sentence, and everything else.
 *
 * Both spellings of each are handled because the server answers with whichever credential it got
 * as far as: a mistyped console password ends as ADMIN_CREDENTIALS_INVALID, while a credential that
 * reached the operator's agent account and failed there keeps the AGENT_ prefix. They mean the same
 * thing to the person typing, so they read the same on screen.
 */
function credentialsErrorMessage(error: unknown, t: AuthTranslator): string {
  if (isApiError(error)) {
    if (error.code === 'ADMIN_CREDENTIALS_INVALID' || error.code === 'AGENT_CREDENTIALS_INVALID') {
      return t('auth.credentials.invalid');
    }
    if (error.code === 'ADMIN_OPERATOR_NOT_ACTIVE' || error.code === 'AGENT_OPERATOR_NOT_ACTIVE') {
      return t('auth.credentials.suspended');
    }
    if (error.code === 'AGENT_OPERATOR_HAS_NO_OWNER') return t('auth.credentials.noOwner');
  }
  return errorMessage(error);
}

/** The codes that mean "which operator?", in either spelling. See the file header. */
const isAmbiguous = (code: string): boolean =>
  code === 'ADMIN_OPERATOR_AMBIGUOUS' || code === 'AGENT_OPERATOR_AMBIGUOUS';

function CredentialsForm({ t }: { t: AuthTranslator }) {
  const { signIn } = useAuth();
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
      const session = await signIn({
        username,
        password,
        // Absent, not undefined: the field is optional in the strict sense on the wire.
        ...(operatorSlug === null ? {} : { operatorSlug }),
      });
      await land(session);
    } catch (caught) {
      /*
       * Not a failure — a question. The credential was accepted and it opens more than one
       * operator, so the form turns into a picker rather than throwing the password away and
       * making somebody type it again to answer a question they have already earned the right to
       * be asked.
       */
      if (isApiError(caught) && isAmbiguous(caught.code)) {
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
          <p className="text-sm text-[var(--muted-foreground)]">{t('auth.credentials.intro')}</p>

          <div className="space-y-1.5">
            <Label htmlFor="credentials-username">{t('auth.credentials.usernameLabel')}</Label>
            <Input
              id="credentials-username"
              ref={usernameRef}
              value={username}
              onChange={(event) => {
                setUsername(event.target.value);
              }}
              autoComplete="username"
              // A login is not a sentence: never capitalise it, never correct it, and let a
              // password manager fill it.
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              maxLength={256}
              // A login is Latin and typed left to right in either language.
              dir="ltr"
              className="font-mono"
              aria-invalid={error !== null}
              aria-describedby={error === null ? undefined : 'credentials-error'}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="credentials-password">{t('auth.credentials.passwordLabel')}</Label>
            <Input
              id="credentials-password"
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
              aria-describedby={error === null ? undefined : 'credentials-error'}
            />
          </div>
        </>
      )}

      {error === null ? null : (
        <p id="credentials-error" role="alert" className="text-sm text-[var(--danger)]">
          {credentialsErrorMessage(error, t)}
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
        <LogIn className="size-4" />
        {chosen === undefined
          ? t('auth.credentials.submit')
          : t('auth.credentials.chooseSubmit', { name: chosen.displayName })}
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
          {t('auth.credentials.chooseBack')}
        </Button>
      ) : null}
    </form>
  );
}

/**
 * The picker shown when one credential opens several operators.
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
      <legend className="sr-only">{t('auth.credentials.operatorLegend')}</legend>

      <Alert tone="info" title={t('auth.credentials.chooseTitle')}>
        {t('auth.credentials.chooseBody', { count: operators.length })}
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

function DemoHint({ t }: { t: AuthTranslator }) {
  const enumLabel = useEnumLabel();

  return (
    <Alert tone="info" title={t('auth.demo.title')}>
      <p>
        {t('auth.demo.body')} {t('auth.demo.signInWith', { password: MOCK_CONSOLE_PASSWORD })}
      </p>
      <p className="mt-2">{t('auth.demo.roleHint')}</p>
      {/* Roles are most of what this console is; a demo stuck on one role shows none of it. */}
      <ul className="mt-1 space-y-0.5">
        {Object.entries(MOCK_ROLE_LOGINS).map(([username, role]) => (
          <li key={username} className="flex items-center gap-2">
            <code className="font-mono font-semibold" dir="ltr">
              {username}
            </code>
            <span>{enumLabel('adminRole', role)}</span>
          </li>
        ))}
      </ul>
      {/* The other credential needs demonstrating too, refusals included. */}
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
