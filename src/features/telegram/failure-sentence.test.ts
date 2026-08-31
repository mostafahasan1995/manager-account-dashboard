import { describe, expect, it } from 'vitest';

import { ApiError } from '@/lib/api/errors';

import { checkReasonSentence, failureSentence, reasonOf } from './failure-sentence';
import { telegramMessages } from './messages';

/**
 * This module turns a machine `reason` into the sentence an operator reads, and its whole value is
 * that the sentence NAMES WHO FIXES IT. So the tests assert the distinction rather than the
 * mapping: "not a member" and "not an administrator" must not collapse into one another, because
 * from outside they look identical (nothing arrives) and are fixed by different people.
 *
 * The fallback matters as much: a reason the console has not learned yet must degrade to the
 * server's own English message, never to a missing-key crash or a blank alert.
 */

/** The real English bundle, so a renamed key fails here rather than shipping an empty alert. */
const t = ((key: keyof (typeof telegramMessages)['en']) => {
  const message = telegramMessages.en[key];
  if (typeof message !== 'string') throw new Error(`${key} is not a plain string`);
  return message;
}) as Parameters<typeof failureSentence>[1];

const apiError = (details: unknown) =>
  new ApiError({ status: 400, code: 'TELEGRAM_CHAT_REJECTED', message: 'nope', details });

describe('reading the reason off a failure', () => {
  it('finds a known reason in the error details', () => {
    expect(reasonOf(apiError({ reason: 'BOT_NOT_ADMIN' }))).toBe('BOT_NOT_ADMIN');
  });

  it.each([
    ['a reason this console has not learned', apiError({ reason: 'SOMETHING_NEW' })],
    ['details with no reason at all', apiError({ fields: ['url'] })],
    ['details that are not an object', apiError('plain text')],
    ['an error that is not an ApiError', new Error('network down')],
    ['a non-error value', 'boom'],
  ])('returns null for %s', (_label, error) => {
    expect(reasonOf(error)).toBeNull();
  });
});

describe('the sentence an operator reads', () => {
  it.each([
    ['BOT_NOT_MEMBER', /not in that group/i],
    ['BOT_NOT_ADMIN', /not an administrator/i],
    ['BOT_CANNOT_POST', /post messages/i],
    ['PRIVATE_CHAT', /one-to-one/i],
    ['NOT_FOUND', /does not know that chat/i],
    ['INVALID_URL', /not a telegram group or channel/i],
    ['DUPLICATE', /already a destination/i],
  ])('%s names the fix', (reason, pattern) => {
    expect(failureSentence(apiError({ reason }), t)).toMatch(pattern);
  });

  it('keeps the three membership failures distinct from one another', () => {
    // The single most important property here. If any two of these ever return the same string,
    // the feature has silently regressed to the generic error it was built to replace.
    const sentences = ['BOT_NOT_MEMBER', 'BOT_NOT_ADMIN', 'BOT_CANNOT_POST'].map((reason) =>
      failureSentence(apiError({ reason }), t),
    );

    expect(new Set(sentences).size).toBe(3);
  });

  it('falls back to null when there is no reason, so the caller can show the server message', () => {
    expect(failureSentence(new Error('network down'), t)).toBeNull();
    expect(failureSentence(apiError({ reason: 'SOMETHING_NEW' }), t)).toBeNull();
  });
});

describe('a check or test result’s reason', () => {
  it('maps a known reason to its sentence', () => {
    expect(checkReasonSentence('BOT_NOT_MEMBER', t)).toMatch(/not in that group/i);
    expect(checkReasonSentence('SEND_FAILED', t)).toMatch(/refused the message/i);
    expect(checkReasonSentence('UNDELIVERABLE', t)).toMatch(/unreachable/i);
  });

  it('returns null for no reason, or one it does not know', () => {
    expect(checkReasonSentence(null, t)).toBeNull();
    expect(checkReasonSentence('SOMETHING_NEW', t)).toBeNull();
  });
});
