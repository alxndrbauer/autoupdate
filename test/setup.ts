import { afterAll, afterEach, beforeAll } from 'vitest';
import { setupServer } from 'msw/node';
import { http } from 'msw';

// Minimal MSW server (Handlers can be extended per test via server.use)
export const server = setupServer(
  http.get('https://api.github.com/rate_limit', () => {
    return new Response(JSON.stringify({ resources: { core: { remaining: 5000 } } }), { status: 200 });
  }),
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

export { http };
