import { describe, it, expect, beforeEach } from 'vitest';
import { http } from 'msw';
import { server } from '../setup';
import { AutoUpdater } from '../../src/autoupdater';
import { ConfigLoader } from '../../src/config-loader';

// High-level integration style test (greenfield style) with MSW intercepting
// GitHub API endpoints.

describe('AutoUpdater integration (pull request path)', () => {
  let cfg: ConfigLoader;

  beforeEach(() => {
    cfg = new ConfigLoader();
    cfg.env = {
      GITHUB_TOKEN: 't',
      GITHUB_REF: 'refs/heads/main',
      GITHUB_REPOSITORY: 'owner/repo',
    } as any;
  });

  it('skips when compare shows up-to-date', async () => {
    server.use(
      http.get(
        'https://api.github.com/repos/owner/repo/compare/h...b',
        () => new Response(JSON.stringify({ behind_by: 0 }), { status: 200 }),
      ),
    );
    const updater = new AutoUpdater(cfg, {} as any);
    const pull: any = {
      merged: false,
      state: 'open',
      head: {
        repo: { owner: { login: 'owner' }, name: 'repo' },
        label: 'h',
        ref: 'h',
      },
      base: { ref: 'b', label: 'b' },
      labels: [],
      draft: false,
    };
    const res = await updater.prNeedsUpdate(pull);
    expect(res).toBe(false);
  });
});
