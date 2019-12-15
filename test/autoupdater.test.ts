import config from '../src/config-loader';
import { AutoUpdater } from '../src/autoupdater';
import nock from 'nock';
import { createMock } from 'ts-auto-mock';
import {
  PullRequestEvent,
  PullRequest,
  PushEvent,
} from '@octokit/webhooks-types/schema';
import { Output } from '../src/Output';
import * as ghCore from '@actions/core';

describe('AutoUpdater (consolidated)', () => {
  describe('basic push/schedule/workflow handling', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      jest.spyOn(config, 'githubToken').mockReturnValue('token');
    });

    test('handlePush returns 0 for non-branch events', async () => {
      const event = createMock<PushEvent>({
        ref: 'not-a-branch',
        repository: { owner: { login: 'o' }, name: 'r' },
      });
      const u = new AutoUpdater(config, event);
      const out = await u.handlePush();
      expect(out).toBe(0);
    });

    test('handleWorkflowRun skips unsupported event types', async () => {
      const evt = createMock<any>({
        workflow_run: { event: 'pull_request_review', head_branch: 'main' },
        repository: { name: 'r', owner: { login: 'o' } },
      });
      const u = new AutoUpdater(config, evt);
      const out = await u.handleWorkflowRun();
      expect(out).toBe(0);
    });

    test('handleSchedule falls back to githubRef when scheduleBranches empty', async () => {
      jest.spyOn(config, 'githubRepository').mockReturnValue('owner/repo');
      jest.spyOn(config, 'scheduleBranches').mockReturnValue([]);
      jest.spyOn(config, 'githubRef').mockReturnValue('refs/heads/main');

      const event = { schedule: '*' } as any;
      const u = new AutoUpdater(config, event);

      // avoid network calls by spying on pulls which is ultimately invoked
      const pullsSpy = jest.spyOn(u, 'pulls').mockResolvedValueOnce(0);

      const updated = await u.handleSchedule();
      expect(updated).toBe(0);
      expect(pullsSpy).toHaveBeenCalledWith('refs/heads/main', 'repo', 'owner');
    });
  });

  // --- include the larger autoupdater test suite below ---

  describe('AutoUpdater additional branches', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      jest.spyOn(config, 'githubToken').mockReturnValue('token');
      // sensible defaults
      jest.spyOn(config, 'retryCount').mockReturnValue(2);
      jest.spyOn(config, 'retrySleep').mockReturnValue(1);
      jest.spyOn(config, 'mergeConflictAction').mockReturnValue('fail');
      jest.spyOn(config, 'excludedLabels').mockReturnValue([]);
    });

    afterEach(() => {
      nock.cleanAll();
    });

    test('prNeedsUpdate skips merged PRs', async () => {
      const pull = createMock<PullRequest>({
        merged: true,
        number: 1,
        state: 'open',
        head: {
          repo: { owner: { login: 'o' }, name: 'r' },
          ref: 'refs/heads/f',
          label: 'o:f',
        },
        base: { ref: 'main', label: 'o:main' },
        labels: [],
      });

      const u = new AutoUpdater(config, {} as PullRequestEvent);
      const res = await u.prNeedsUpdate(pull as any);
      expect(res).toBe(false);
    });

    test('prNeedsUpdate labelled filter handles undefined label.name in labels array', async () => {
      // ensure we hit the branch where a label object has no `name`
      jest.spyOn(config, 'pullRequestFilter').mockReturnValue('labelled');
      jest.spyOn(config, 'pullRequestLabels').mockReturnValue(['keep']);

      const pull = {
        merged: false,
        number: 600,
        state: 'open',
        head: {
          repo: { owner: { login: 'o' }, name: 'r' },
          label: 'o:f',
          ref: 'refs/heads/f',
        },
        base: { ref: 'main', label: 'o:main' },
        // first label missing name property, second matches
        labels: [{} as any, { name: 'keep' } as any],
        draft: false,
      } as any;

      const u = new AutoUpdater(config, {} as PullRequestEvent);
      jest
        .spyOn(u.octokit.rest.repos, 'compareCommitsWithBasehead')
        .mockResolvedValue({ data: { behind_by: 2 } } as any);

      const res = await u.prNeedsUpdate(pull as any);
      expect(res).toBe(true);
    });

    test('prNeedsUpdate skips non-open PRs', async () => {
      const pull = createMock<PullRequest>({
        merged: false,
        number: 2,
        state: 'closed',
        head: {
          repo: { owner: { login: 'o' }, name: 'r' },
          ref: 'refs/heads/f',
          label: 'o:f',
        },
        base: { ref: 'main', label: 'o:main' },
        labels: [],
      });

      const u = new AutoUpdater(config, {} as PullRequestEvent);
      const res = await u.prNeedsUpdate(pull as any);
      expect(res).toBe(false);
    });

    test('prNeedsUpdate skips when head.repo is null', async () => {
      const pull = createMock<PullRequest>({
        merged: false,
        number: 3,
        state: 'open',
        head: { repo: null as any, ref: 'refs/heads/f', label: 'o:f' },
        base: { ref: 'main', label: 'o:main' },
        labels: [],
      });

      const u = new AutoUpdater(config, {} as PullRequestEvent);
      const res = await u.prNeedsUpdate(pull as any);
      expect(res).toBe(false);
    });

    test('prNeedsUpdate handles compare behind_by === 0', async () => {
      const pull = createMock<PullRequest>({
        number: 4,
        state: 'open',
        head: {
          repo: { owner: { login: 'o' }, name: 'r' },
          ref: 'refs/heads/f',
          label: 'o:f',
        },
        base: { ref: 'main', label: 'o:main' },
        labels: [],
      });

      // compare returns behind_by 0
      const u = new AutoUpdater(config, {} as PullRequestEvent);
      jest
        .spyOn(u.octokit.rest.repos, 'compareCommitsWithBasehead')
        .mockResolvedValue({ data: { behind_by: 0 } } as any);

      const res = await u.prNeedsUpdate(pull as any);
      expect(res).toBe(false);
    });

    test('prNeedsUpdate returns false when compare errors', async () => {
      const pull = createMock<PullRequest>({
        merged: false,
        number: 5,
        state: 'open',
        head: {
          repo: { owner: { login: 'o' }, name: 'r' },
          ref: 'refs/heads/f',
          label: 'o:f',
        },
        base: { ref: 'main', label: 'o:main' },
        labels: [],
      });

      const u = new AutoUpdater(config, {} as PullRequestEvent);
      jest
        .spyOn(u.octokit.rest.repos, 'compareCommitsWithBasehead')
        .mockRejectedValue(new Error('boom'));

      const res = await u.prNeedsUpdate(pull as any);
      expect(res).toBe(false);
    });

    test('prNeedsUpdate skips due to excluded label', async () => {
      const pull = createMock<PullRequest>({
        merged: false,
        number: 6,
        state: 'open',
        head: {
          repo: { owner: { login: 'o' }, name: 'r' },
          ref: 'refs/heads/f',
          label: 'o:f',
        },
        base: { ref: 'main', label: 'o:main' },
        labels: [{ name: 'skip' } as any],
      });

      jest.spyOn(config, 'excludedLabels').mockReturnValue(['skip']);
      const u = new AutoUpdater(config, {} as PullRequestEvent);
      jest
        .spyOn(u.octokit.rest.repos, 'compareCommitsWithBasehead')
        .mockResolvedValue({ data: { behind_by: 1 } } as any);

      const res = await u.prNeedsUpdate(pull as any);
      expect(res).toBe(false);
    });

    test('prNeedsUpdate labelled filter with no labels configured', async () => {
      const pull = createMock<PullRequest>({
        merged: false,
        number: 7,
        state: 'open',
        head: {
          repo: { owner: { login: 'o' }, name: 'r' },
          ref: 'refs/heads/f',
          label: 'o:f',
        },
        base: { ref: 'main', label: 'o:main' },
      });

      jest.spyOn(config, 'pullRequestFilter').mockReturnValue('labelled');
      jest.spyOn(config, 'pullRequestLabels').mockReturnValue([]);

      // prNeedsUpdate compares base vs head before checking PR_FILTER, so
      // ensure the compare API is mocked to avoid network calls.
      const u = new AutoUpdater(config, {} as PullRequestEvent);
      jest
        .spyOn(u.octokit.rest.repos, 'compareCommitsWithBasehead')
        .mockResolvedValue({ data: { behind_by: 1 } } as any);

      const res = await u.prNeedsUpdate(pull as any);
      expect(res).toBe(false);
    });

    test('prNeedsUpdate labelled filter with matching label returns true', async () => {
      const pull = createMock<PullRequest>({
        merged: false,
        number: 8,
        state: 'open',
        head: {
          repo: { owner: { login: 'o' }, name: 'r' },
          ref: 'refs/heads/f',
          label: 'o:f',
        },
        base: { ref: 'main', label: 'o:main' },
        labels: [{ name: 'keep' } as any],
      });

      jest.spyOn(config, 'pullRequestFilter').mockReturnValue('labelled');
      jest.spyOn(config, 'pullRequestLabels').mockReturnValue(['keep']);

      const u = new AutoUpdater(config, {} as PullRequestEvent);
      jest
        .spyOn(u.octokit.rest.repos, 'compareCommitsWithBasehead')
        .mockResolvedValue({ data: { behind_by: 2 } } as any);

      const res = await u.prNeedsUpdate(pull as any);
      expect(res).toBe(true);
    });

    test('prNeedsUpdate protected branch check', async () => {
      const pull = createMock<PullRequest>({
        merged: false,
        number: 9,
        state: 'open',
        head: {
          repo: { owner: { login: 'o' }, name: 'r' },
          ref: 'refs/heads/f',
          label: 'o:f',
        },
        base: { ref: 'main', label: 'o:main' },
        labels: [],
      });

      jest.spyOn(config, 'pullRequestFilter').mockReturnValue('protected');

      const u = new AutoUpdater(config, {} as PullRequestEvent);
      jest
        .spyOn(u.octokit.rest.repos, 'compareCommitsWithBasehead')
        .mockResolvedValue({ data: { behind_by: 1 } } as any);
      jest
        .spyOn(u.octokit.rest.repos, 'getBranch')
        .mockResolvedValue({ data: { protected: true } } as any);

      const res = await u.prNeedsUpdate(pull as any);
      expect(res).toBe(true);
    });

    test('prNeedsUpdate auto_merge behavior', async () => {
      const pull = createMock<PullRequest>({
        merged: false,
        number: 10,
        state: 'open',
        head: {
          repo: { owner: { login: 'o' }, name: 'r' },
          ref: 'refs/heads/f',
          label: 'o:f',
        },
        base: { ref: 'main', label: 'o:main' },
        labels: [],
        auto_merge: null,
      });

      jest.spyOn(config, 'pullRequestFilter').mockReturnValue('auto_merge');

      const u = new AutoUpdater(config, {} as PullRequestEvent);
      jest
        .spyOn(u.octokit.rest.repos, 'compareCommitsWithBasehead')
        .mockResolvedValue({ data: { behind_by: 1 } } as any);

      const res = await u.prNeedsUpdate(pull as any);
      expect(res).toBe(false);

      // now with auto_merge set
      (pull as any).auto_merge = { enabled_by: { login: 'u' } } as any;
      // second compare call for the next invocation
      jest
        .spyOn(u.octokit.rest.repos, 'compareCommitsWithBasehead')
        .mockResolvedValue({ data: { behind_by: 1 } } as any);
      const res2 = await u.prNeedsUpdate(pull as any);
      expect(res2).toBe(true);
    });

    test('update respects dry run and head.repo null', async () => {
      const pull = createMock<PullRequest>({
        merged: false,
        number: 11,
        state: 'open',
        head: {
          repo: { owner: { login: 'o' }, name: 'r' },
          ref: 'refs/heads/f',
          label: 'o:f',
        },
        base: { ref: 'main', label: 'o:main' },
        labels: [],
      });

      jest.spyOn(config, 'dryRun').mockReturnValue(true);

      const u = new AutoUpdater(config, {} as PullRequestEvent);
      jest
        .spyOn(u.octokit.rest.repos, 'compareCommitsWithBasehead')
        .mockResolvedValue({ data: { behind_by: 1 } } as any);

      const res = await u.update('owner', pull as any);
      expect(res).toBe(true);

      // head.repo null
      (pull as any).head.repo = null;
      const res2 = await u.update('owner', pull as any);
      expect(res2).toBe(false);
    });

    test('merge handles 200, 204 and retry/403/conflict paths', async () => {
      const u = new AutoUpdater(config, {} as PullRequestEvent);

      const setOut = jest.fn();

      // 200
      jest
        .spyOn(u.octokit.rest.repos, 'merge')
        .mockResolvedValueOnce({ status: 200, data: { sha: 's1' } } as any);
      const ok = await u.merge(
        'owner',
        1,
        { owner: 'o', repo: 'r', base: 'b', head: 'h' } as any,
        setOut,
      );
      expect(ok).toBe(true);
      expect(setOut).toHaveBeenCalledWith(Output.Conflicted, false);

      // 204
      jest
        .spyOn(u.octokit.rest.repos, 'merge')
        .mockResolvedValueOnce({ status: 204, data: '' } as any);
      const ok2 = await u.merge(
        'owner',
        2,
        { owner: 'o', repo: 'r', base: 'b', head: 'h' } as any,
        setOut,
      );
      expect(ok2).toBe(true);

      // 403 on fork mismatch -> returns false
      jest
        .spyOn(u.octokit.rest.repos, 'merge')
        .mockRejectedValueOnce(
          Object.assign(new Error('Forbidden'), { status: 403 }),
        );
      const ok3 = await u.merge(
        'different-owner',
        3,
        { owner: 'o', repo: 'r', base: 'b', head: 'h' } as any,
        setOut,
      );
      expect(ok3).toBe(false);

      // Merge conflict with ignore action
      jest.spyOn(config, 'mergeConflictAction').mockReturnValue('ignore');
      jest
        .spyOn(u.octokit.rest.repos, 'merge')
        .mockRejectedValueOnce(
          Object.assign(new Error('Merge conflict'), { status: 409 }),
        );
      const ok4 = await u.merge(
        'owner',
        4,
        { owner: 'o', repo: 'r', base: 'b', head: 'h' } as any,
        setOut,
      );
      expect(ok4).toBe(false);
      expect(setOut).toHaveBeenCalledWith(Output.Conflicted, true);

      // retry then success
      jest.spyOn(config, 'mergeConflictAction').mockReturnValue('fail');
      jest.spyOn(config, 'retryCount').mockReturnValue(2);
      jest.spyOn(config, 'retrySleep').mockReturnValue(1);

      jest
        .spyOn(u.octokit.rest.repos, 'merge')
        .mockRejectedValueOnce(
          Object.assign(new Error('err'), { status: 500 }),
        );
      jest
        .spyOn(u.octokit.rest.repos, 'merge')
        .mockRejectedValueOnce(
          Object.assign(new Error('err'), { status: 500 }),
        );
      jest.spyOn(u.octokit.rest.repos, 'merge').mockResolvedValueOnce({
        status: 200,
        data: { sha: 's-final' },
      } as any);

      const ok5 = await u.merge(
        'owner',
        5,
        { owner: 'o', repo: 'r', base: 'b', head: 'h' } as any,
        setOut,
      );
      expect(ok5).toBe(true);
    });
  });

  describe('AutoUpdater additional coverage', () => {
    const owner = 'owner';
    const repo = 'repo';

    beforeEach(() => {
      jest.resetAllMocks();
      jest.spyOn(config, 'githubToken').mockImplementation(() => 'test-token');
      // sensible defaults
      jest.spyOn(config, 'retryCount').mockReturnValue(0);
      jest.spyOn(config, 'retrySleep').mockReturnValue(0);
      jest.spyOn(config, 'mergeConflictAction').mockReturnValue('fail');
      jest.spyOn(config, 'excludedLabels').mockReturnValue([]);
      jest.spyOn(config, 'pullRequestFilter').mockReturnValue('all');
      jest.spyOn(config, 'pullRequestLabels').mockReturnValue([]);
      jest.spyOn(config, 'pullRequestReadyState').mockReturnValue('all');
    });

    test('merge handles 200 OK and sets output', async () => {
      const updater = new AutoUpdater(config, {} as any);
      const setOutput = jest.fn();

      const mergeOpts = { owner, repo, base: 'b', head: 'h' } as any;

      jest
        .spyOn(updater.octokit.rest.repos, 'merge')
        .mockResolvedValueOnce({ status: 200, data: { sha: 'abc' } } as any);

      const res = await updater.merge(owner, 1, mergeOpts, setOutput);
      expect(res).toBe(true);
      expect(setOutput).toHaveBeenCalledWith(expect.any(String), false);
      expect(updater.octokit.rest.repos.merge).toHaveBeenCalled();
    });

    test('merge handles 204 No Content', async () => {
      const updater = new AutoUpdater(config, {} as any);
      const setOutput = jest.fn();

      const mergeOpts = { owner, repo, base: 'b', head: 'h' } as any;

      jest
        .spyOn(updater.octokit.rest.repos, 'merge')
        .mockResolvedValueOnce({ status: 204, data: '' } as any);

      const res = await updater.merge(owner, 1, mergeOpts, setOutput);
      expect(res).toBe(true);
      expect(setOutput).toHaveBeenCalledWith(expect.any(String), false);
      expect(updater.octokit.rest.repos.merge).toHaveBeenCalled();
    });

    test('merge retries on 503 and succeeds', async () => {
      jest.spyOn(config, 'retryCount').mockReturnValue(2);
      jest.spyOn(config, 'retrySleep').mockReturnValue(0);

      const updater = new AutoUpdater(config, {} as any);
      const setOutput = jest.fn();
      const mergeOpts = { owner, repo, base: 'b', head: 'h' } as any;

      const mergeSpy = jest.spyOn(updater.octokit.rest.repos, 'merge');
      mergeSpy.mockRejectedValueOnce(
        Object.assign(new Error('err'), { status: 503 }),
      );
      mergeSpy.mockRejectedValueOnce(
        Object.assign(new Error('err'), { status: 503 }),
      );
      mergeSpy.mockResolvedValueOnce({
        status: 200,
        data: { sha: 'ok' },
      } as any);

      const res = await updater.merge(owner, 1, mergeOpts, setOutput);
      expect(res).toBe(true);
      expect(updater.octokit.rest.repos.merge).toHaveBeenCalled();
    });

    test('merge conflict with ignore returns false and sets conflicted true', async () => {
      jest.spyOn(config, 'mergeConflictAction').mockReturnValue('ignore');
      const updater = new AutoUpdater(config, {} as any);
      const setOutput = jest.fn();
      const mergeOpts = { owner, repo, base: 'b', head: 'h' } as any;

      jest
        .spyOn(updater.octokit.rest.repos, 'merge')
        .mockRejectedValueOnce(
          Object.assign(new Error('Merge conflict'), { status: 409 }),
        );

      const res = await updater.merge(owner, 1, mergeOpts, setOutput);
      expect(res).toBe(false);
      expect(setOutput).toHaveBeenCalledWith(expect.any(String), true);
      expect(updater.octokit.rest.repos.merge).toHaveBeenCalled();
    });

    test('merge conflict without ignore throws', async () => {
      jest.spyOn(config, 'mergeConflictAction').mockReturnValue('fail');
      const updater = new AutoUpdater(config, {} as any);
      const setOutput = jest.fn();
      const mergeOpts = { owner, repo, base: 'b', head: 'h' } as any;

      jest
        .spyOn(updater.octokit.rest.repos, 'merge')
        .mockRejectedValueOnce(
          Object.assign(new Error('Merge conflict'), { status: 409 }),
        );

      await expect(
        updater.merge(owner, 1, mergeOpts, setOutput),
      ).rejects.toThrow('Merge conflict');
      expect(setOutput).toHaveBeenCalledWith(expect.any(String), true);
      expect(updater.octokit.rest.repos.merge).toHaveBeenCalled();
    });

    test('fork authorization 403 returns false and logs', async () => {
      const updater = new AutoUpdater(config, {} as any);
      const setOutput = jest.fn();
      const mergeOpts = { owner: 'other', repo, base: 'b', head: 'h' } as any;

      jest.spyOn(updater.octokit.rest.repos, 'merge').mockRejectedValueOnce(
        Object.assign(new Error('Must have admin rights to Repository.'), {
          status: 403,
        }),
      );

      const res = await updater.merge(owner, 1, mergeOpts, setOutput);
      expect(res).toBe(false);
      expect(setOutput).toHaveBeenCalledWith(expect.any(String), false);
      expect(updater.octokit.rest.repos.merge).toHaveBeenCalled();
    });

    test('prNeedsUpdate: compare behind_by 0 returns false', async () => {
      const updater = new AutoUpdater(config, {} as any);
      const pull = {
        merged: false,
        state: 'open',
        head: {
          repo: { owner: { login: owner }, name: repo },
          label: 'h',
          ref: 'h',
        },
        base: { ref: 'b', label: 'b' },
        labels: [],
        draft: false,
      } as any;

      jest
        .spyOn(updater.octokit.rest.repos, 'compareCommitsWithBasehead')
        .mockResolvedValueOnce({ data: { behind_by: 0 } } as any);

      const res = await updater.prNeedsUpdate(pull);
      expect(res).toBe(false);
      expect(
        updater.octokit.rest.repos.compareCommitsWithBasehead,
      ).toHaveBeenCalled();
    });

    test('prNeedsUpdate: compare error returns false', async () => {
      const updater = new AutoUpdater(config, {} as any);
      const pull = {
        merged: false,
        state: 'open',
        head: {
          repo: { owner: { login: owner }, name: repo },
          label: 'h',
          ref: 'h',
        },
        base: { ref: 'b', label: 'b' },
        labels: [],
        draft: false,
      } as any;

      jest
        .spyOn(updater.octokit.rest.repos, 'compareCommitsWithBasehead')
        .mockRejectedValueOnce(
          Object.assign(new Error('Not Found'), { status: 404 }),
        );

      const res = await updater.prNeedsUpdate(pull);
      expect(res).toBe(false);
      expect(
        updater.octokit.rest.repos.compareCommitsWithBasehead,
      ).toHaveBeenCalled();
    });

    test('prNeedsUpdate: excluded label causes skip', async () => {
      jest.spyOn(config, 'excludedLabels').mockReturnValue(['dep']);
      const updater = new AutoUpdater(config, {} as any);
      const pull = {
        merged: false,
        state: 'open',
        head: {
          repo: { owner: { login: owner }, name: repo },
          label: 'h',
          ref: 'h',
        },
        base: { ref: 'b', label: 'b' },
        labels: [{ name: 'dep' }],
        draft: false,
      } as any;

      jest
        .spyOn(updater.octokit.rest.repos, 'compareCommitsWithBasehead')
        .mockResolvedValueOnce({ data: { behind_by: 1 } } as any);

      const res = await updater.prNeedsUpdate(pull);
      expect(res).toBe(false);
      expect(
        updater.octokit.rest.repos.compareCommitsWithBasehead,
      ).toHaveBeenCalled();
    });

    test('prNeedsUpdate: labelled filter matches', async () => {
      jest.spyOn(config, 'pullRequestFilter').mockReturnValue('labelled');
      jest.spyOn(config, 'pullRequestLabels').mockReturnValue(['ok']);
      const updater = new AutoUpdater(config, {} as any);
      const pull = {
        merged: false,
        state: 'open',
        head: {
          repo: { owner: { login: owner }, name: repo },
          label: 'h',
          ref: 'h',
        },
        base: { ref: 'b', label: 'b' },
        labels: [{ name: 'ok' }],
        draft: false,
      } as any;

      jest
        .spyOn(updater.octokit.rest.repos, 'compareCommitsWithBasehead')
        .mockResolvedValueOnce({ data: { behind_by: 1 } } as any);

      const res = await updater.prNeedsUpdate(pull);
      expect(res).toBe(true);
      expect(
        updater.octokit.rest.repos.compareCommitsWithBasehead,
      ).toHaveBeenCalled();
    });

    test('prNeedsUpdate: protected filter checks branch', async () => {
      jest.spyOn(config, 'pullRequestFilter').mockReturnValue('protected');
      const updater = new AutoUpdater(config, {} as any);
      const pull = {
        merged: false,
        state: 'open',
        head: {
          repo: { owner: { login: owner }, name: repo },
          label: 'h',
          ref: 'h',
        },
        base: { ref: 'b', label: 'b' },
        labels: [],
        draft: false,
      } as any;

      jest
        .spyOn(updater.octokit.rest.repos, 'compareCommitsWithBasehead')
        .mockResolvedValueOnce({ data: { behind_by: 1 } } as any);
      jest
        .spyOn(updater.octokit.rest.repos, 'getBranch')
        .mockResolvedValueOnce({ data: { protected: true } } as any);

      const res = await updater.prNeedsUpdate(pull);
      expect(res).toBe(true);
      expect(
        updater.octokit.rest.repos.compareCommitsWithBasehead,
      ).toHaveBeenCalled();
      expect(updater.octokit.rest.repos.getBranch).toHaveBeenCalled();
    });
  });

  describe('AutoUpdater final coverage targets', () => {
    beforeEach(() => {
      jest.resetAllMocks();
      jest.spyOn(config, 'githubToken').mockReturnValue('t');
      jest.spyOn(config, 'retryCount').mockReturnValue(1);
      jest.spyOn(config, 'retrySleep').mockReturnValue(0);
      jest.spyOn(config, 'mergeConflictAction').mockReturnValue('fail');
      jest.spyOn(config, 'excludedLabels').mockReturnValue([]);
      jest.spyOn(config, 'pullRequestFilter').mockReturnValue('all');
      jest.spyOn(config, 'pullRequestLabels').mockReturnValue([]);
      jest.spyOn(config, 'pullRequestReadyState').mockReturnValue('all');
    });

    afterEach(() => {
      nock.cleanAll();
    });

    test('prNeedsUpdate handles undefined label.name gracefully', async () => {
      const updater = new AutoUpdater(config, {} as any);

      jest.spyOn(config, 'excludedLabels').mockReturnValue(['skip']);

      const pull: any = {
        merged: false,
        state: 'open',
        head: {
          repo: { owner: { login: 'o' }, name: 'r' },
          label: 'o:f',
          ref: 'refs/heads/f',
        },
        base: { ref: 'main', label: 'o:main' },
        labels: [{} as any, { name: 'keep' }],
        draft: false,
      };

      jest
        .spyOn(updater.octokit.rest.repos, 'compareCommitsWithBasehead')
        .mockResolvedValueOnce({ data: { behind_by: 1 } } as any);

      const res = await updater.prNeedsUpdate(pull as any);
      expect(res).toBe(true);
    });

    test('prNeedsUpdate respects PR_READY_STATE=draft', async () => {
      const updater = new AutoUpdater(config, {} as any);
      jest.spyOn(config, 'pullRequestReadyState').mockReturnValue('draft');

      const pull: any = {
        merged: false,
        state: 'open',
        head: {
          repo: { owner: { login: 'o' }, name: 'r' },
          label: 'o:f',
          ref: 'refs/heads/f',
        },
        base: { ref: 'main', label: 'o:main' },
        labels: [],
        draft: false,
      };

      jest
        .spyOn(updater.octokit.rest.repos, 'compareCommitsWithBasehead')
        .mockResolvedValueOnce({ data: { behind_by: 1 } } as any);

      const res = await updater.prNeedsUpdate(pull as any);
      expect(res).toBe(false);
    });

    test('prNeedsUpdate respects PR_READY_STATE=ready_for_review', async () => {
      const updater = new AutoUpdater(config, {} as any);
      jest
        .spyOn(config, 'pullRequestReadyState')
        .mockReturnValue('ready_for_review');

      const pull: any = {
        merged: false,
        state: 'open',
        head: {
          repo: { owner: { login: 'o' }, name: 'r' },
          label: 'o:f',
          ref: 'refs/heads/f',
        },
        base: { ref: 'main', label: 'o:main' },
        labels: [],
        draft: true,
      };

      jest
        .spyOn(updater.octokit.rest.repos, 'compareCommitsWithBasehead')
        .mockResolvedValueOnce({ data: { behind_by: 1 } } as any);

      const res = await updater.prNeedsUpdate(pull as any);
      expect(res).toBe(false);
    });

    test('merge throws after retry exhaustion and sets output conflicted=false', async () => {
      jest.spyOn(config, 'retryCount').mockReturnValue(0);
      const updater = new AutoUpdater(config, {} as any);
      const setOut = jest.fn();

      jest
        .spyOn(updater.octokit.rest.repos, 'merge')
        .mockRejectedValue(Object.assign(new Error('boom'), { status: 500 }));

      await expect(
        updater.merge(
          'owner',
          99,
          { owner: 'o', repo: 'r', base: 'b', head: 'h' } as any,
          setOut,
        ),
      ).rejects.toBeDefined();

      expect(setOut).toHaveBeenCalledWith(Output.Conflicted, false);
    });

    test('pulls iterates multiple pages and counts updated PRs', async () => {
      const updater = new AutoUpdater(config, {} as any);

      // Replace paginate.iterator with an async generator that yields two pages
      (updater as any).octokit = (updater as any).octokit || {};
      (updater as any).octokit.paginate = {
        iterator: (_opts: any) =>
          (async function* () {
            yield { data: [{ number: 1 }, { number: 2 }] };
            yield { data: [{ number: 3 }] };
          })(),
      } as any;

      const updatedCalls: any[] = [];
      jest
        .spyOn(updater, 'update')
        .mockImplementation(async (_owner: string, pull: any) => {
          // simulate update true for PR 1 and 3, false for PR 2
          updatedCalls.push(pull.number);
          return pull.number === 1 || pull.number === 3;
        });

      const res = await updater.pulls('refs/heads/main', 'repo', 'login');
      expect(res).toBe(2);
      expect(updatedCalls).toEqual([1, 2, 3]);
    });

    test('pulls returns 0 when owner is invalid', async () => {
      const updater = new AutoUpdater(config, {} as any);
      const res = await updater.pulls('refs/heads/main', 'repo', '');
      expect(res).toBe(0);
    });

    test('pulls returns 0 when repoName is invalid', async () => {
      const updater = new AutoUpdater(config, {} as any);
      const res = await updater.pulls('refs/heads/main', '', 'login');
      expect(res).toBe(0);
    });

    test('handlePullRequest returns false when head.repo is null', async () => {
      const event: any = {
        pull_request: { head: { repo: null }, action: 'synchronize' },
      };
      const updater = new AutoUpdater(config, event);

      const res = await updater.handlePullRequest();
      expect(res).toBe(false);
    });

    test('handlePullRequest logs success and no-changes paths', async () => {
      const event: any = {
        pull_request: {
          head: { repo: { owner: { login: 'o' } } },
          action: 'synchronize',
        },
      };
      const updater = new AutoUpdater(config, event);

      // case: update returns true
      jest.spyOn(updater, 'update').mockResolvedValueOnce(true);
      const r1 = await updater.handlePullRequest();
      expect(r1).toBe(true);

      // case: update returns false
      jest.spyOn(updater, 'update').mockResolvedValueOnce(false);
      const r2 = await updater.handlePullRequest();
      expect(r2).toBe(false);
    });

    test('handleSchedule returns 0 when GITHUB_REPOSITORY malformed', async () => {
      jest.spyOn(config, 'githubRepository').mockReturnValue('not-a-repo');
      const updater = new AutoUpdater(config, {} as any);
      const res = await updater.handleSchedule();
      expect(res).toBe(0);
    });

    test('handleWorkflowRun rejects unsupported event and missing branch', async () => {
      const eventUnsupported: any = {
        workflow_run: { head_branch: 'b', event: 'deployment' },
        repository: { name: 'r', owner: { login: 'o', name: 'n' } },
      };
      const updater1 = new AutoUpdater(config, eventUnsupported);
      const res1 = await updater1.handleWorkflowRun();
      expect(res1).toBe(0);

      const eventNoBranch: any = {
        workflow_run: { head_branch: null, event: 'push' },
        repository: { name: 'r', owner: { login: 'o', name: 'n' } },
      };
      const updater2 = new AutoUpdater(config, eventNoBranch);
      const res2 = await updater2.handleWorkflowRun();
      expect(res2).toBe(0);
    });

    test('handleWorkflowDispatch delegates to pulls', async () => {
      const event: any = {
        ref: 'refs/heads/ci',
        repository: { name: 'r', owner: { login: 'o', name: 'n' } },
      };
      const updater = new AutoUpdater(config, event);
      jest.spyOn(updater, 'pulls').mockResolvedValueOnce(3);
      const res = await updater.handleWorkflowDispatch();
      expect(res).toBe(3);
    });

    test('update catches merge errors and calls setFailed', async () => {
      const updater = new AutoUpdater(config, {} as any);
      const pull: any = {
        number: 77,
        head: {
          ref: 'refs/heads/f',
          repo: { owner: { login: 'o' }, name: 'r' },
        },
        base: { ref: 'main' },
      };

      jest.spyOn(updater, 'prNeedsUpdate').mockResolvedValue(true);
      jest.spyOn(updater, 'merge').mockRejectedValue(new Error('boom'));
      const setFailed = jest
        .spyOn(ghCore, 'setFailed')
        .mockImplementation(() => {});

      const res = await updater.update('owner', pull as any);
      expect(res).toBe(false);
      expect(setFailed).toHaveBeenCalled();
    });

    test('update passes commit_message to merge when mergeMsg configured', async () => {
      const updater = new AutoUpdater(config, {} as any);
      const pull: any = {
        number: 88,
        head: {
          ref: 'refs/heads/f',
          repo: { owner: { login: 'o' }, name: 'r' },
          label: 'o:f',
        },
        base: { ref: 'main', label: 'o:main' },
      };

      jest.spyOn(updater, 'prNeedsUpdate').mockResolvedValue(true);
      jest.spyOn(config, 'mergeMsg').mockReturnValue('CI update');

      const mergeSpy = jest
        .spyOn(updater, 'merge')
        .mockResolvedValue(true as any);

      const res = await updater.update('owner', pull as any);
      expect(res).toBe(true);
      expect(mergeSpy).toHaveBeenCalled();
      const calledWith = mergeSpy.mock.calls[0][2] as any;
      expect(calledWith.commit_message).toBe('CI update');
    });

    test('prNeedsUpdate labelled filter skips when PR has no labels', async () => {
      const updater = new AutoUpdater(config, {} as any);
      jest.spyOn(config, 'pullRequestFilter').mockReturnValue('labelled');
      jest.spyOn(config, 'pullRequestLabels').mockReturnValue(['ok']);

      const pull: any = {
        merged: false,
        state: 'open',
        head: {
          repo: { owner: { login: 'o' }, name: 'r' },
          label: 'o:f',
          ref: 'refs/heads/f',
        },
        base: { ref: 'main', label: 'o:main' },
        labels: [],
        draft: false,
      };

      jest
        .spyOn(updater.octokit.rest.repos, 'compareCommitsWithBasehead')
        .mockResolvedValueOnce({ data: { behind_by: 1 } } as any);

      const res = await updater.prNeedsUpdate(pull as any);
      expect(res).toBe(false);
    });

    test('prNeedsUpdate protected filter skips when branch not protected', async () => {
      const updater = new AutoUpdater(config, {} as any);
      jest.spyOn(config, 'pullRequestFilter').mockReturnValue('protected');

      const pull: any = {
        merged: false,
        state: 'open',
        head: {
          repo: { owner: { login: 'o' }, name: 'r' },
          label: 'o:f',
          ref: 'refs/heads/f',
        },
        base: { ref: 'main', label: 'o:main' },
        labels: [],
        draft: false,
      };

      jest
        .spyOn(updater.octokit.rest.repos, 'compareCommitsWithBasehead')
        .mockResolvedValueOnce({ data: { behind_by: 1 } } as any);
      jest
        .spyOn(updater.octokit.rest.repos, 'getBranch')
        .mockResolvedValueOnce({ data: { protected: false } } as any);

      const res = await updater.prNeedsUpdate(pull as any);
      expect(res).toBe(false);
    });

    test('handleWorkflowRun delegates to pulls when event supported', async () => {
      const event: any = {
        workflow_run: { head_branch: 'main', event: 'push' },
        repository: { name: 'r', owner: { login: 'o', name: 'n' } },
      };
      const updater = new AutoUpdater(config, event);
      jest.spyOn(updater, 'pulls').mockResolvedValueOnce(5);
      const res = await updater.handleWorkflowRun();
      expect(res).toBe(5);
    });

    test('handleSchedule uses GITHUB_REF when SCHEDULE_BRANCHES is empty', async () => {
      jest.spyOn(config, 'githubRepository').mockReturnValue('o/r');
      jest.spyOn(config, 'scheduleBranches').mockReturnValue([]);
      jest.spyOn(config, 'githubRef').mockReturnValue('refs/heads/main');

      const updater = new AutoUpdater(config, {} as any);
      const pullsSpy = jest.spyOn(updater, 'pulls').mockResolvedValueOnce(1);

      const res = await updater.handleSchedule();
      expect(res).toBe(1);
      expect(pullsSpy).toHaveBeenCalledWith('refs/heads/main', 'r', 'o');
    });

    test('handleSchedule iterates SCHEDULE_BRANCHES and aggregates updates', async () => {
      jest.spyOn(config, 'githubRepository').mockReturnValue('o/r');
      jest
        .spyOn(config, 'scheduleBranches')
        .mockReturnValue(['main', 'develop']);

      const updater = new AutoUpdater(config, {} as any);
      const pullsSpy = jest
        .spyOn(updater, 'pulls')
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(3);

      const res = await updater.handleSchedule();
      expect(res).toBe(5);
      expect(pullsSpy).toHaveBeenNthCalledWith(1, 'refs/heads/main', 'r', 'o');
      expect(pullsSpy).toHaveBeenNthCalledWith(
        2,
        'refs/heads/develop',
        'r',
        'o',
      );
    });

    test('update passes commit_message to merge when mergeMsg configured (integration)', async () => {
      const updater = new AutoUpdater(config, {} as any);
      const pull: any = {
        number: 10,
        head: {
          ref: 'refs/heads/feature',
          repo: { owner: { login: 'o' }, name: 'r' },
          label: 'o:feature',
        },
        base: { ref: 'main' },
        merged: false,
        state: 'open',
        labels: [],
        draft: false,
      };

      jest.spyOn(updater, 'prNeedsUpdate').mockResolvedValue(true);
      const mergeSpy = jest
        .spyOn(updater, 'merge')
        .mockResolvedValue(true as any);
      jest.spyOn(config, 'mergeMsg').mockReturnValue('My commit message');
      jest.spyOn(config, 'dryRun').mockReturnValue(false);

      const res = await updater.update('o', pull as any);
      expect(res).toBe(true);
      expect(mergeSpy).toHaveBeenCalled();
      const calledWith = mergeSpy.mock.calls[0][2] as any;
      expect(calledWith.commit_message).toBe('My commit message');
    });

    test('prNeedsUpdate labelled filter returns true when PR has matching label', async () => {
      const updater = new AutoUpdater(config, {} as any);
      jest.spyOn(config, 'pullRequestFilter').mockReturnValue('labelled');
      jest.spyOn(config, 'pullRequestLabels').mockReturnValue(['ok']);

      const pull: any = {
        merged: false,
        state: 'open',
        head: {
          repo: { owner: { login: 'o' }, name: 'r' },
          label: 'o:f',
          ref: 'refs/heads/f',
        },
        base: { ref: 'main', label: 'o:main' },
        labels: [{ name: 'ok' }],
        draft: false,
      };

      jest
        .spyOn(updater.octokit.rest.repos, 'compareCommitsWithBasehead')
        .mockResolvedValue({ data: { behind_by: 1 } } as any);

      const res = await updater.prNeedsUpdate(pull as any);
      expect(res).toBe(true);
    });

    test('prNeedsUpdate labelled filter returns false when PR has labels but none match', async () => {
      const updater = new AutoUpdater(config, {} as any);
      jest.spyOn(config, 'pullRequestFilter').mockReturnValue('labelled');
      jest.spyOn(config, 'pullRequestLabels').mockReturnValue(['ok']);

      const pull: any = {
        merged: false,
        state: 'open',
        head: {
          repo: { owner: { login: 'o' }, name: 'r' },
          label: 'o:f',
          ref: 'refs/heads/f',
        },
        base: { ref: 'main', label: 'o:main' },
        labels: [{ name: 'nope' }],
        draft: false,
      };

      jest
        .spyOn(updater.octokit.rest.repos, 'compareCommitsWithBasehead')
        .mockResolvedValue({ data: { behind_by: 1 } } as any);

      const res = await updater.prNeedsUpdate(pull as any);
      expect(res).toBe(false);
    });

    test('update returns false when head.repo is null even if prNeedsUpdate true', async () => {
      const updater = new AutoUpdater(config, {} as any);
      const pull: any = {
        number: 123,
        head: { ref: 'refs/heads/f', repo: null, label: 'o:f' },
        base: { ref: 'main' },
      };

      jest.spyOn(updater, 'prNeedsUpdate').mockResolvedValue(true);
      jest.spyOn(config, 'dryRun').mockReturnValue(false);

      const res = await updater.update('o', pull as any);
      expect(res).toBe(false);
    });

    test('prNeedsUpdate protected filter returns true when base branch is protected', async () => {
      const updater = new AutoUpdater(config, {} as any);
      jest.spyOn(config, 'pullRequestFilter').mockReturnValue('protected');

      const pull: any = {
        merged: false,
        state: 'open',
        head: {
          repo: { owner: { login: 'o' }, name: 'r' },
          label: 'o:f',
          ref: 'refs/heads/f',
        },
        base: { ref: 'main', label: 'o:main' },
        labels: [],
        draft: false,
      };

      jest
        .spyOn(updater.octokit.rest.repos, 'compareCommitsWithBasehead')
        .mockResolvedValue({ data: { behind_by: 1 } } as any);
      jest
        .spyOn(updater.octokit.rest.repos, 'getBranch')
        .mockResolvedValue({ data: { protected: true } } as any);

      const res = await updater.prNeedsUpdate(pull as any);
      expect(res).toBe(true);
    });
  });
});
