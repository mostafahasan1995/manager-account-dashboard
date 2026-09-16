import { describe, expect, it } from 'vitest';

import { DEFAULT_BREAK_STATUSES, breakListQueryFrom } from './break-display';

describe('breakListQueryFrom', () => {
  it('asks for the default statuses explicitly when the URL names none', () => {
    expect(breakListQueryFrom({ status: undefined, category: undefined })).toEqual({
      status: [...DEFAULT_BREAK_STATUSES],
    });
  });

  it('passes the filters the URL does name', () => {
    expect(
      breakListQueryFrom({
        status: ['RESOLVED'],
        category: ['DUPLICATE_CREDIT'],
        minSeverity: 4,
      }),
    ).toEqual({ status: ['RESOLVED'], category: ['DUPLICATE_CREDIT'], minSeverity: 4 });
  });

  it('leaves an unset filter off the query rather than sending an empty one', () => {
    expect(
      breakListQueryFrom({ status: undefined, category: undefined, minSeverity: 2 }),
    ).not.toHaveProperty('category');
  });
});
