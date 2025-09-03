import { describe, it, expect, vi } from 'vitest';
import { AutoUpdater } from '../../src/autoupdater';
import { ConfigLoader } from '../../src/config-loader';
import { Output } from '../../src/Output';

function mkCfg(): ConfigLoader {
  const c = new ConfigLoader();
  c.env = { GITHUB_TOKEN: 't', GITHUB_REF: 'refs/heads/main', GITHUB_REPOSITORY: 'o/r' } as any;
  return c;
}

function mkPull(): any {
  return {
    number: 7,
    head: { ref: 'feature', label: 'feature', repo: { owner: { login: 'o' }, name: 'r' } },
    base: { ref: 'main', label: 'main' },
  };
}

describe('AutoUpdater.merge', () => {
  it('returns true on successful merge (200)', async () => {
    const cfg = mkCfg();
    (cfg as any).retryCount = () => 0;
    const updater = new AutoUpdater(cfg, {} as any);
    const mergeFn = vi.fn().mockResolvedValue({ status: 200, data: { sha: 'abc' } });
    (updater as any).octokit = { rest: { repos: { merge: mergeFn } } };
    const outputs: Record<string, any> = {};
    const ok = await updater.merge('o', 7, { owner: 'o', repo: 'r', base: 'feature', head: 'main' }, (k, v) => { outputs[k] = v; });
    expect(ok).toBe(true);
    expect(outputs[Output.Conflicted]).toBe(false);
  });

  it('returns true on merge not required (204)', async () => {
    const cfg = mkCfg();
    (cfg as any).retryCount = () => 0;
    const updater = new AutoUpdater(cfg, {} as any);
    const mergeFn = vi.fn().mockResolvedValue({ status: 204, data: { sha: 'abc' } });
    (updater as any).octokit = { rest: { repos: { merge: mergeFn } } };
    const outputs: Record<string, any> = {};
    const ok = await updater.merge('o', 7, { owner: 'o', repo: 'r', base: 'feature', head: 'main' }, (k, v) => { outputs[k] = v; });
    expect(ok).toBe(true);
  });

  it('returns false for fork 403', async () => {
    const cfg = mkCfg();
    (cfg as any).retryCount = () => 0;
    const updater = new AutoUpdater(cfg, {} as any);
    const err: any = new Error('no access'); err.status = 403;
    const mergeFn = vi.fn().mockRejectedValue(err);
    (updater as any).octokit = { rest: { repos: { merge: mergeFn } } };
    const outputs: Record<string, any> = {};
    const ok = await updater.merge('someoneelse', 7, { owner: 'o', repo: 'r', base: 'feature', head: 'main' }, (k, v) => { outputs[k] = v; });
    expect(ok).toBe(false);
    expect(outputs[Output.Conflicted]).toBe(false);
  });

  it('handles merge conflict with ignore action', async () => {
    const cfg = mkCfg();
    (cfg as any).retryCount = () => 0;
    (cfg as any).mergeConflictAction = () => 'ignore';
    const updater = new AutoUpdater(cfg, {} as any);
    const conflict = new Error('Merge conflict');
    const mergeFn = vi.fn().mockRejectedValue(conflict);
    (updater as any).octokit = { rest: { repos: { merge: mergeFn } } };
    const outputs: Record<string, any> = {};
    const ok = await updater.merge('o', 7, { owner: 'o', repo: 'r', base: 'feature', head: 'main' }, (k, v) => { outputs[k] = v; });
    expect(ok).toBe(false); // skip
    expect(outputs[Output.Conflicted]).toBe(true);
  });

  it('retries on generic error then succeeds', async () => {
    const cfg = mkCfg();
    (cfg as any).retryCount = () => 2;
    (cfg as any).retrySleep = () => 0;
    const updater = new AutoUpdater(cfg, {} as any);
    const err = new Error('flaky');
    const mergeFn = vi.fn()
      .mockRejectedValueOnce(err)
      .mockResolvedValue({ status: 200, data: { sha: 'xyz' } });
    (updater as any).octokit = { rest: { repos: { merge: mergeFn } } };
    const outputs: Record<string, any> = {};
    const ok = await updater.merge('o', 7, { owner: 'o', repo: 'r', base: 'feature', head: 'main' }, (k, v) => { outputs[k] = v; });
    expect(ok).toBe(true);
    expect(mergeFn).toHaveBeenCalledTimes(2);
  });

  it('throws after exceeding retries', async () => {
    const cfg = mkCfg();
    (cfg as any).retryCount = () => 1;
    (cfg as any).retrySleep = () => 0;
    const updater = new AutoUpdater(cfg, {} as any);
    const err = new Error('always');
    const mergeFn = vi.fn().mockRejectedValue(err);
    (updater as any).octokit = { rest: { repos: { merge: mergeFn } } };
    const outputs: Record<string, any> = {};
    await expect(updater.merge('o', 7, { owner: 'o', repo: 'r', base: 'feature', head: 'main' }, (k, v) => { outputs[k] = v; })).rejects.toThrow('always');
  });

  it('merge conflict with fail action throws', async () => {
    const cfg = mkCfg();
    (cfg as any).retryCount = () => 0;
    (cfg as any).mergeConflictAction = () => 'fail';
    const updater = new AutoUpdater(cfg, {} as any);
    const conflict = new Error('Merge conflict');
    const mergeFn = vi.fn().mockRejectedValue(conflict);
    (updater as any).octokit = { rest: { repos: { merge: mergeFn } } };
    await expect(updater.merge('o', 7, { owner: 'o', repo: 'r', base: 'feature', head: 'main' })).rejects.toThrow('Merge conflict');
  });
});

describe('AutoUpdater.update', () => {
  it('returns false when prNeedsUpdate=false', async () => {
    const cfg = mkCfg();
    const updater = new AutoUpdater(cfg, {} as any);
    (updater as any).prNeedsUpdate = vi.fn().mockResolvedValue(false);
    const pull = mkPull();
    const res = await updater.update('o', pull);
    expect(res).toBe(false);
  });

  it('returns true for dryRun path', async () => {
    const cfg = mkCfg();
    (cfg as any).dryRun = () => true;
    const updater = new AutoUpdater(cfg, {} as any);
    (updater as any).prNeedsUpdate = vi.fn().mockResolvedValue(true);
    const pull = mkPull();
    pull.head.repo = { owner: { login: 'o' }, name: 'r' };
    const res = await updater.update('o', pull);
    expect(res).toBe(true);
  });

  it('skips when head.repo null', async () => {
    const cfg = mkCfg();
    (cfg as any).dryRun = () => false;
    const updater = new AutoUpdater(cfg, {} as any);
    (updater as any).prNeedsUpdate = vi.fn().mockResolvedValue(true);
    const pull = mkPull();
    pull.head.repo = null;
    const res = await updater.update('o', pull);
    expect(res).toBe(false);
  });

  it('passes mergeMsg into merge options', async () => {
    const cfg = mkCfg();
    (cfg as any).dryRun = () => false;
    (cfg as any).mergeMsg = () => 'custom message';
    const updater = new AutoUpdater(cfg, {} as any);
    (updater as any).prNeedsUpdate = vi.fn().mockResolvedValue(true);
    const mergeSpy = vi.fn().mockResolvedValue(true);
    (updater as any).merge = mergeSpy;
    const pull = mkPull();
    pull.head.repo = { owner: { login: 'o' }, name: 'r' };
    await updater.update('o', pull);
    expect(mergeSpy).toHaveBeenCalled();
    const callArgs = mergeSpy.mock.calls[0][2];
    expect(callArgs.commit_message).toBe('custom message');
  });

  it('handles merge throwing error and returns false', async () => {
    const cfg = mkCfg();
    (cfg as any).dryRun = () => false;
    const updater = new AutoUpdater(cfg, {} as any);
    (updater as any).prNeedsUpdate = vi.fn().mockResolvedValue(true);
    const mergeSpy = vi.fn().mockRejectedValue(new Error('boom'));
    (updater as any).merge = mergeSpy;
    const pull = mkPull();
    pull.head.repo = { owner: { login: 'o' }, name: 'r' };
    const res = await updater.update('o', pull);
    expect(res).toBe(false);
  });
});
