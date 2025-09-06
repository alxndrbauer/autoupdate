import { describe, it, expect, vi } from 'vitest';
import { Router } from '../../src/router';
import { ConfigLoader } from '../../src/config-loader';

function mkConfig(env: any = {}): ConfigLoader {
  const cfg = new ConfigLoader();
  cfg.env = {
    GITHUB_TOKEN: 't',
    GITHUB_REF: 'refs/heads/main',
    GITHUB_REPOSITORY: 'o/r',
    ...env,
  } as any;
  return cfg;
}

const baseEvent: any = {
  repository: { name: 'r', owner: { login: 'o', name: 'o' } },
};

describe('Router.route', () => {
  it('routes pull_request', async () => {
    const cfg = mkConfig();
    const ev = {
      pull_request: {
        head: { repo: { owner: { login: 'o' } } },
        action: 'synchronize',
      },
    } as any;
    const r = new Router(cfg, ev as any);
    const spy = ((r as any).updater.handlePullRequest = vi
      .fn()
      .mockResolvedValue(false));
    await r.route('pull_request');
    expect(spy).toHaveBeenCalled();
  });
  it('routes push', async () => {
    const cfg = mkConfig();
    const ev = {
      ref: 'refs/heads/main',
      repository: baseEvent.repository,
    } as any;
    const r = new Router(cfg, ev);
    const spy = ((r as any).updater.handlePush = vi.fn().mockResolvedValue(0));
    await r.route('push');
    expect(spy).toHaveBeenCalled();
  });
  it('routes workflow_run', async () => {
    const cfg = mkConfig();
    const ev = {
      workflow_run: { head_branch: 'main', event: 'push' },
      repository: baseEvent.repository,
    } as any;
    const r = new Router(cfg, ev);
    const spy = ((r as any).updater.handleWorkflowRun = vi
      .fn()
      .mockResolvedValue(0));
    await r.route('workflow_run');
    expect(spy).toHaveBeenCalled();
  });
  it('routes workflow_dispatch', async () => {
    const cfg = mkConfig();
    const ev = {
      ref: 'refs/heads/main',
      repository: baseEvent.repository,
    } as any;
    const r = new Router(cfg, ev);
    const spy = ((r as any).updater.handleWorkflowDispatch = vi
      .fn()
      .mockResolvedValue(0));
    await r.route('workflow_dispatch');
    expect(spy).toHaveBeenCalled();
  });
  it('routes schedule', async () => {
    const cfg = mkConfig();
    cfg.env.SCHEDULE_BRANCHES = ''; // triggers fallback to github ref
    const ev = { repository: baseEvent.repository } as any;
    const r = new Router(cfg, ev);
    const spy = ((r as any).updater.handleSchedule = vi
      .fn()
      .mockResolvedValue(0));
    await r.route('schedule');
    expect(spy).toHaveBeenCalled();
  });
  it('throws on unknown event', async () => {
    const cfg = mkConfig();
    const r = new Router(cfg, {} as any);
    await expect(r.route('weird')).rejects.toThrow(/Unknown event/);
  });
});
