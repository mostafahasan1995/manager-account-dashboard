import { describe, expect, it } from 'vitest';

import { cn, humanizeEnum, initialsOf, isAbortError, truncateId } from './utils';

describe('cn', () => {
  it('joins classes', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('drops falsy values', () => {
    expect(cn('a', false, undefined, null, 'b')).toBe('a b');
  });

  it('lets a later utility win over an earlier one in the same group', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });
});

describe('humanizeEnum', () => {
  it.each([
    ['PENDING_SECOND_APPROVAL', 'Pending second approval'],
    ['ACTIVE', 'Active'],
    ['AGENT_FLOAT_MISMATCH', 'Agent float mismatch'],
  ])('renders %s as %s', (input, expected) => {
    expect(humanizeEnum(input)).toBe(expected);
  });

  it('survives an empty string', () => {
    expect(humanizeEnum('')).toBe('');
  });
});

describe('initialsOf', () => {
  it.each([
    ['Nour Haddad', 'NH'],
    ['Platform', 'P'],
    ['Sami Al Aziz', 'SA'],
  ])('reduces %s to %s', (input, expected) => {
    expect(initialsOf(input)).toBe(expected);
  });

  it('falls back to a question mark rather than rendering nothing', () => {
    expect(initialsOf('   ')).toBe('?');
  });
});

describe('truncateId', () => {
  it('shortens a long id and shows that it was shortened', () => {
    expect(truncateId('aaaaaaaa-0000-4000-8000-000000000001')).toBe('aaaaaaaa…');
  });

  it('leaves a short id alone', () => {
    expect(truncateId('K7QP42')).toBe('K7QP42');
  });
});

describe('isAbortError', () => {
  it('recognises an abort', () => {
    expect(isAbortError(new DOMException('aborted', 'AbortError'))).toBe(true);
  });

  it('does not mistake other errors for one', () => {
    expect(isAbortError(new Error('boom'))).toBe(false);
    expect(isAbortError(null)).toBe(false);
  });
});
