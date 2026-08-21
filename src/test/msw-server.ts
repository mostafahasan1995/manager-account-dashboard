import { setupServer } from 'msw/node';

import { handlers } from '@/mocks/handlers';

/** The same handlers the browser uses, so tests exercise the contract the demo runs on. */
export const server = setupServer(...handlers);
