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

function mkPull(num = 1): any {
  return {
    number: num,
    head: {
      ref: 'f' + num,
      label: 'f' + num,
      repo: { owner: { login: 'o' }, name: 'r' },
    },
    base: { ref: 'main', label: 'main' },
  };
}

describe('AutoUpdater.pulls', () => {
  it('skips when ref not a branch', async () => {
    const cfg = mkCfg();
    const updater = new AutoUpdater(cfg, {} as any);
    const res = await updater.pulls('refs/tags/v1', 'r', 'o');
    expect(res).toBe(0);
  });
  it('skips when owner invalid', async () => {
    const cfg = mkCfg();
    const updater = new AutoUpdater(cfg, {} as any);
    const res = await updater.pulls('refs/heads/main', 'r', '');
    expect(res).toBe(0);
  });
  it('skips when repo invalid', async () => {
    const cfg = mkCfg();
    const updater = new AutoUpdater(cfg, {} as any);
    const res = await updater.pulls('refs/heads/main', '', 'o');
    expect(res).toBe(0);
  });
  it('iterates pages and counts updated PRs', async () => {
    const cfg = mkCfg();
    const updater = new AutoUpdater(cfg, {} as any);
    const page1 = { data: [mkPull(1), mkPull(2)] };
    const page2 = { data: [mkPull(3)] };
    const iterator = async function* () {
      yield page1 as any;
      yield page2 as any;
    };
    (updater as any).octokit.paginate = {
      iterator: vi.fn().mockReturnValue(iterator()),
    };
    (updater as any).octokit.rest = {
      pulls: { list: { endpoint: { merge: vi.fn().mockReturnValue({}) } } },
    };
    (updater as any).update = vi
      .fn()
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const res = await updater.pulls('refs/heads/main', 'r', 'o');
    expect(res).toBe(2);
  });
});

describe('AutoUpdater handlers', () => {
  it('handleSchedule single branch path (fallback to github ref)', async () => {
    const cfg = mkCfg();
    const updater = new AutoUpdater(cfg, {} as any);
    (updater as any).pulls = vi.fn().mockResolvedValue(3);
    const count = await updater.handleSchedule();
    expect(count).toBe(3);
  });
  it('handleSchedule parse error returns 0', async () => {
    const bad = mkCfg({ GITHUB_REPOSITORY: 'broken' });
    const updater = new AutoUpdater(bad, {} as any);
    const res = await updater.handleSchedule();
    expect(res).toBe(0);
  });
  it('handleSchedule multiple branches', async () => {
    const cfg = mkCfg({ SCHEDULE_BRANCHES: 'main,dev' });
    const updater = new AutoUpdater(cfg, {} as any);
    (updater as any).pulls = vi
      .fn()
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);
    const count = await updater.handleSchedule();
    expect(count).toBe(3);
  });
  it('handleWorkflowRun unsupported event', async () => {
    const ev: any = {
      workflow_run: { head_branch: 'main', event: 'release' },
      repository: { name: 'r', owner: { login: 'o', name: 'o' } },
    };
    const updater = new AutoUpdater(mkCfg(), ev);
    const res = await updater.handleWorkflowRun();
    expect(res).toBe(0);
  });
  it('handleWorkflowRun missing branch', async () => {
    const ev: any = {
      workflow_run: { head_branch: '', event: 'push' },
      repository: { name: 'r', owner: { login: 'o', name: 'o' } },
    };
    const updater = new AutoUpdater(mkCfg(), ev);
    const res = await updater.handleWorkflowRun();
    expect(res).toBe(0);
  });
  it('handleWorkflowRun push path', async () => {
    const ev: any = {
      workflow_run: { head_branch: 'main', event: 'push' },
      repository: { name: 'r', owner: { login: 'o', name: 'o' } },
    };
    const updater = new AutoUpdater(mkCfg(), ev);
    (updater as any).pulls = vi.fn().mockResolvedValue(5);
    const res = await updater.handleWorkflowRun();
    expect(res).toBe(5);
  });
  it('handleWorkflowDispatch', async () => {
    const ev: any = {
      ref: 'refs/heads/feat',
      repository: { name: 'r', owner: { login: 'o', name: 'o' } },
    };
    const updater = new AutoUpdater(mkCfg(), ev);
    (updater as any).pulls = vi.fn().mockResolvedValue(4);
    const res = await updater.handleWorkflowDispatch();
    expect(res).toBe(4);
  });
  it('handlePush', async () => {
    const ev: any = {
      ref: 'refs/heads/main',
      repository: { name: 'r', owner: { login: 'o', name: 'o' } },
    };
    const updater = new AutoUpdater(mkCfg(), ev);
    (updater as any).pulls = vi.fn().mockResolvedValue(6);
    const res = await updater.handlePush();
    expect(res).toBe(6);
  });
  it('handlePullRequest repo null', async () => {
    const ev: any = {
      action: 'synchronize',
      pull_request: { head: { repo: null } },
    };
    const updater = new AutoUpdater(mkCfg(), ev);
    const res = await updater.handlePullRequest();
    expect(res).toBe(false);
  });
  it('handlePullRequest updated path', async () => {
    const ev: any = {
      action: 'synchronize',
      pull_request: {
        number: 9,
        head: { repo: { owner: { login: 'o' } } },
        base: { ref: 'main' },
      },
    };
    const updater = new AutoUpdater(mkCfg(), ev);
    (updater as any).update = vi.fn().mockResolvedValue(true);
    const res = await updater.handlePullRequest();
    expect(res).toBe(true);
  });
  it('handlePullRequest not updated path', async () => {
    const ev: any = {
      action: 'synchronize',
      pull_request: {
        number: 9,
        head: { repo: { owner: { login: 'o' } } },
        base: { ref: 'main' },
      },
    };
    const updater = new AutoUpdater(mkCfg(), ev);
    (updater as any).update = vi.fn().mockResolvedValue(false);
    const res = await updater.handlePullRequest();
    expect(res).toBe(false);
  });
});
