import { useNavigate, useSearch } from '@tanstack/react-router';
import { Coins, MessageSquare } from 'lucide-react';
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
import { useEnumLabel, useT } from '@/lib/i18n/use-translation';
import { MOCK_LOGIN_CODE, MOCK_ROLE_CODES } from '@/mocks/demo';

import { authMessages } from './messages';

/**
 * Sign-in.
 *
 * There is no password here and there never will be: the backend authenticates an admin by a
 * one-time code the Telegram bot hands out, which means the console never holds a credential that
 * could be phished or reused. The screen's whole job is to explain that clearly enough that a new
 * reviewer knows what to do without being told.
 *
 * Everything Latin that is TYPED rather than read — the two slash commands, the code itself, the API
 * URL — carries `dir="ltr"`. In an Arabic sentence the bidi algorithm would otherwise pull the
 * leading slash to the far end of the run and show `console/`, which is not a command anyone can
 * copy.
 */
export function LoginPage() {
  const { signIn, signOutReason } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ from: '/login' });
  const t = useT(authMessages);
  const enumLabel = useEnumLabel();

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
      const session = await signIn(code);
      // The FRESH session's role decides where sign-in lands. A PLATFORM_ADMIN has no overview to
      // go to, so sending everyone to "/" would bounce them straight back out of it.
      const destination =
        search.redirect ?? homeRouteFor((capability) => can(session.admin.role, capability));
      await navigate({ to: destination });
    } catch (caught) {
      setError(caught);
      setCode('');
      inputRef.current?.focus();
    } finally {
      setSubmitting(false);
    }
  };

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
            <CardDescription>
              {t('auth.signIn.sendCommand')}{' '}
              <code className="font-mono" dir="ltr">
                /console
              </code>{' '}
              {t('auth.signIn.toBotIn')} <strong>{t('auth.signIn.directChat')}</strong>{' '}
              {t('auth.signIn.notInGroup')}{' '}
              <code className="font-mono" dir="ltr">
                /login
              </code>{' '}
              {t('auth.signIn.playerCommand')}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={(event) => void handleSubmit(event)} className="space-y-4">
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
          </CardContent>
        </Card>

        {config.enableMocks ? (
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
          </Alert>
        ) : (
          <p className="text-center text-xs text-[var(--muted-foreground)]">
            {t('auth.api.label')}{' '}
            <span className="font-mono" dir="ltr">
              {config.apiBaseUrl}
            </span>
          </p>
        )}
      </div>
    </main>
  );
}
