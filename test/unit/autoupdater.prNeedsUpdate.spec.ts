import { describe, it, expect, vi } from 'vitest';
import { AutoUpdater } from '../../src/autoupdater';
import { ConfigLoader } from '../../src/config-loader';

function mkCfg(extra: any = {}): ConfigLoader {
  const cfg = new ConfigLoader();
  cfg.env = {
    GITHUB_TOKEN: 't',
    GITHUB_REF: 'refs/heads/main',
    GITHUB_REPOSITORY: 'o/r',
    ...extra,
  } as any;
  return cfg;
}

// Helper to build a base pull request shape we can mutate per test
function basePull(): any {
  return {
    merged: false,
    state: 'open',
    head: {
      repo: { owner: { login: 'o' }, name: 'r' },
      label: 'feature',
      ref: 'feature',
    },
    base: { ref: 'main', label: 'main' },
    labels: [],
    draft: false,
    auto_merge: { enabled_by: { login: 'user' } },
  };
}

describe('AutoUpdater.prNeedsUpdate', () => {
  it('returns false when already merged', async () => {
    const cfg = mkCfg();
    const updater = new AutoUpdater(cfg, {} as any);
    const pull = { ...basePull(), merged: true };
    const res = await updater.prNeedsUpdate(pull);
    expect(res).toBe(false);
  });

  it('returns false when not open', async () => {
    const cfg = mkCfg();
    const updater = new AutoUpdater(cfg, {} as any);
    const pull = { ...basePull(), state: 'closed' };
    const res = await updater.prNeedsUpdate(pull);
    expect(res).toBe(false);
  });

  it('returns false when fork deleted', async () => {
    const cfg = mkCfg();
    const updater = new AutoUpdater(cfg, {} as any);
    const pull = { ...basePull(), head: { repo: null } };
    const res = await updater.prNeedsUpdate(pull);
    expect(res).toBe(false);
  });

  it('returns false when comparison behind_by=0', async () => {
    const cfg = mkCfg();
    const updater = new AutoUpdater(cfg, {} as any);
    const pull = basePull();
    // mock compareCommitsWithBasehead
    (updater as any).octokit = {
      rest: {
        repos: {
          compareCommitsWithBasehead: vi
            .fn()
            .mockResolvedValue({ data: { behind_by: 0 } }),
        },
      },
    };
    const res = await updater.prNeedsUpdate(pull);
    expect(res).toBe(false);
  });

  it('returns false when compare throws', async () => {
    const cfg = mkCfg();
    const updater = new AutoUpdater(cfg, {} as any);
    const pull = basePull();
    (updater as any).octokit = {
      rest: {
        repos: {
          compareCommitsWithBasehead: vi
            .fn()
            .mockRejectedValue(new Error('boom')),
        },
      },
    };
    const res = await updater.prNeedsUpdate(pull);
    expect(res).toBe(false);
  });

  it('skips due to excluded label', async () => {
    const cfg = mkCfg({ EXCLUDED_LABELS: 'skip,hold' });
    const updater = new AutoUpdater(cfg, {} as any);
    const pull = { ...basePull(), labels: [{ name: 'hold' }] };
    (updater as any).octokit = {
      rest: {
        repos: {
          compareCommitsWithBasehead: vi
            .fn()
            .mockResolvedValue({ data: { behind_by: 2 } }),
        },
      },
    };
    const res = await updater.prNeedsUpdate(pull);
    expect(res).toBe(false);
  });

  it('excluded labels configured but none match', async () => {
    const cfg = mkCfg({ EXCLUDED_LABELS: 'skip,hold' });
    const updater = new AutoUpdater(cfg, {} as any);
    const pull = { ...basePull(), labels: [{ name: 'else' }] };
    (updater as any).octokit = {
      rest: {
        repos: {
          compareCommitsWithBasehead: vi
            .fn()
            .mockResolvedValue({ data: { behind_by: 2 } }),
        },
      },
    };
    const res = await updater.prNeedsUpdate(pull);
    expect(res).toBe(true); // passes through to success end
  });

  it('excluded labels includes label without name property (debug continue path)', async () => {
    const cfg = mkCfg({ EXCLUDED_LABELS: 'skip' });
    const updater = new AutoUpdater(cfg, {} as any);
    const pull = { ...basePull(), labels: [{ notName: true } as any] };
    (updater as any).octokit = {
      rest: {
        repos: {
          compareCommitsWithBasehead: vi
            .fn()
            .mockResolvedValue({ data: { behind_by: 1 } }),
        },
      },
    };
    const res = await updater.prNeedsUpdate(pull);
    expect(res).toBe(true);
  });

  it('filters by ready state draft', async () => {
    const cfg = mkCfg({ PR_READY_STATE: 'draft' });
    const updater = new AutoUpdater(cfg, {} as any);
    const pull = { ...basePull(), draft: false }; // not draft so should skip
    (updater as any).octokit = {
      rest: {
        repos: {
          compareCommitsWithBasehead: vi
            .fn()
            .mockResolvedValue({ data: { behind_by: 3 } }),
        },
      },
    };
    const res = await updater.prNeedsUpdate(pull);
    expect(res).toBe(false);
  });

  it('filters by ready state ready_for_review', async () => {
    const cfg = mkCfg({ PR_READY_STATE: 'ready_for_review' });
    const updater = new AutoUpdater(cfg, {} as any);
    const pull = { ...basePull(), draft: true }; // draft so should skip
    (updater as any).octokit = {
      rest: {
        repos: {
          compareCommitsWithBasehead: vi
            .fn()
            .mockResolvedValue({ data: { behind_by: 3 } }),
        },
      },
    };
    const res = await updater.prNeedsUpdate(pull);
    expect(res).toBe(false);
  });

  it('labelled filter: no labels configured', async () => {
    const cfg = mkCfg({ PR_FILTER: 'labelled', PR_LABELS: '' });
    const updater = new AutoUpdater(cfg, {} as any);
    (updater as any).octokit = {
      rest: {
        repos: {
          compareCommitsWithBasehead: vi
            .fn()
            .mockResolvedValue({ data: { behind_by: 5 } }),
        },
      },
    };
    const res = await updater.prNeedsUpdate(basePull());
    expect(res).toBe(false);
  });

  it('labelled filter: PR has none of the labels', async () => {
    const cfg = mkCfg({ PR_FILTER: 'labelled', PR_LABELS: 'update,merge' });
    const updater = new AutoUpdater(cfg, {} as any);
    (updater as any).octokit = {
      rest: {
        repos: {
          compareCommitsWithBasehead: vi
            .fn()
            .mockResolvedValue({ data: { behind_by: 5 } }),
        },
      },
    };
    const res = await updater.prNeedsUpdate({
      ...basePull(),
      labels: [{ name: 'random' }],
    });
    expect(res).toBe(false);
  });

  it('labelled filter: labels defined but PR has no labels', async () => {
    const cfg = mkCfg({ PR_FILTER: 'labelled', PR_LABELS: 'x,y' });
    const updater = new AutoUpdater(cfg, {} as any);
    (updater as any).octokit = {
      rest: {
        repos: {
          compareCommitsWithBasehead: vi
            .fn()
            .mockResolvedValue({ data: { behind_by: 2 } }),
        },
      },
    };
    const pull = { ...basePull(), labels: [] };
    const res = await updater.prNeedsUpdate(pull);
    expect(res).toBe(false);
  });

  it('labelled filter: handles undefined label name and continues', async () => {
    const cfg = mkCfg({ PR_FILTER: 'labelled', PR_LABELS: 'real' });
    const updater = new AutoUpdater(cfg, {} as any);
    (updater as any).octokit = {
      rest: {
        repos: {
          compareCommitsWithBasehead: vi
            .fn()
            .mockResolvedValue({ data: { behind_by: 2 } }),
        },
      },
    };
    const pull = {
      ...basePull(),
      labels: [{ notName: true } as any, { name: 'other' }],
    };
    const res = await updater.prNeedsUpdate(pull);
    expect(res).toBe(false);
  });

  it('labelled filter: PR has required label', async () => {
    const cfg = mkCfg({ PR_FILTER: 'labelled', PR_LABELS: 'update,merge' });
    const updater = new AutoUpdater(cfg, {} as any);
    (updater as any).octokit = {
      rest: {
        repos: {
          compareCommitsWithBasehead: vi
            .fn()
            .mockResolvedValue({ data: { behind_by: 1 } }),
        },
      },
    };
    const res = await updater.prNeedsUpdate({
      ...basePull(),
      labels: [{ name: 'merge' }],
    });
    expect(res).toBe(true);
  });

  it('protected filter: branch not protected', async () => {
    const cfg = mkCfg({ PR_FILTER: 'protected' });
    const updater = new AutoUpdater(cfg, {} as any);
    (updater as any).octokit = {
      rest: {
        repos: {
          compareCommitsWithBasehead: vi
            .fn()
            .mockResolvedValue({ data: { behind_by: 2 } }),
          getBranch: vi.fn().mockResolvedValue({ data: { protected: false } }),
        },
      },
    };
    const res = await updater.prNeedsUpdate(basePull());
    expect(res).toBe(false);
  });

  it('protected filter: branch protected', async () => {
    const cfg = mkCfg({ PR_FILTER: 'protected' });
    const updater = new AutoUpdater(cfg, {} as any);
    (updater as any).octokit = {
      rest: {
        repos: {
          compareCommitsWithBasehead: vi
            .fn()
            .mockResolvedValue({ data: { behind_by: 2 } }),
          getBranch: vi.fn().mockResolvedValue({ data: { protected: true } }),
        },
      },
    };
    const res = await updater.prNeedsUpdate(basePull());
    expect(res).toBe(true);
  });

  it('auto_merge filter: auto_merge disabled', async () => {
    const cfg = mkCfg({ PR_FILTER: 'auto_merge' });
    const updater = new AutoUpdater(cfg, {} as any);
    (updater as any).octokit = {
      rest: {
        repos: {
          compareCommitsWithBasehead: vi
            .fn()
            .mockResolvedValue({ data: { behind_by: 2 } }),
        },
      },
    };
    const res = await updater.prNeedsUpdate({
      ...basePull(),
      auto_merge: null,
    });
    expect(res).toBe(false);
  });

  it('auto_merge filter: auto_merge enabled', async () => {
    const cfg = mkCfg({ PR_FILTER: 'auto_merge' });
    const updater = new AutoUpdater(cfg, {} as any);
    (updater as any).octokit = {
      rest: {
        repos: {
          compareCommitsWithBasehead: vi
            .fn()
            .mockResolvedValue({ data: { behind_by: 2 } }),
        },
      },
    };
    const res = await updater.prNeedsUpdate(basePull());
    expect(res).toBe(true);
  });

  it('draft filter passes when draft and behind', async () => {
    const cfg = mkCfg({ PR_READY_STATE: 'draft' });
    const updater = new AutoUpdater(cfg, {} as any);
    (updater as any).octokit = {
      rest: {
        repos: {
          compareCommitsWithBasehead: vi
            .fn()
            .mockResolvedValue({ data: { behind_by: 1 } }),
        },
      },
    };
    const res = await updater.prNeedsUpdate({ ...basePull(), draft: true });
    expect(res).toBe(true);
  });

  it('ready_for_review filter passes when not draft and behind', async () => {
    const cfg = mkCfg({ PR_READY_STATE: 'ready_for_review' });
    const updater = new AutoUpdater(cfg, {} as any);
    (updater as any).octokit = {
      rest: {
        repos: {
          compareCommitsWithBasehead: vi
            .fn()
            .mockResolvedValue({ data: { behind_by: 2 } }),
        },
      },
    };
    const res = await updater.prNeedsUpdate({ ...basePull(), draft: false });
    expect(res).toBe(true);
  });

  it('default path returns true when behind and passes all filters', async () => {
    const cfg = mkCfg();
    const updater = new AutoUpdater(cfg, {} as any);
    (updater as any).octokit = {
      rest: {
        repos: {
          compareCommitsWithBasehead: vi
            .fn()
            .mockResolvedValue({ data: { behind_by: 3 } }),
        },
      },
    };
    const res = await updater.prNeedsUpdate(basePull());
    expect(res).toBe(true);
  });
});
