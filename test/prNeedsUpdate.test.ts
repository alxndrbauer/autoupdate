import config from '../src/config-loader';
import { AutoUpdater } from '../src/autoupdater';
import nock from 'nock';

describe('AutoUpdater prNeedsUpdate extra branches', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(config, 'githubToken').mockReturnValue('t');
    jest.spyOn(config, 'excludedLabels').mockReturnValue([]);
  });

  test('label name undefined is skipped', async () => {
    const updater = new AutoUpdater(config, {} as any);
    const pull = {
      merged: false,
      state: 'open',
      head: {
        repo: { owner: { login: 'o' }, name: 'r' },
        label: 'h',
        ref: 'h',
      },
      base: { ref: 'b', label: 'b' },
      labels: [{}, { name: 'ok' }],
      draft: false,
    } as any;

    const compareSpy = jest
      .spyOn((updater as any).octokit.rest.repos, 'compareCommitsWithBasehead')
      .mockResolvedValue({ data: { behind_by: 1 } } as any);

    jest.spyOn(config, 'pullRequestFilter').mockReturnValue('labelled');
    jest.spyOn(config, 'pullRequestLabels').mockReturnValue(['ok']);

    const res = await updater.prNeedsUpdate(pull);
    expect(res).toBe(true);
    expect(compareSpy).toHaveBeenCalled();
  });

  test('labelled filter with no configured labels returns false', async () => {
    const updater = new AutoUpdater(config, {} as any);
    const pull = {
      merged: false,
      state: 'open',
      head: {
        repo: { owner: { login: 'o' }, name: 'r' },
        label: 'h',
        ref: 'h',
      },
      base: { ref: 'b', label: 'b' },
      labels: [{ name: 'x' }],
      draft: false,
    } as any;

    jest.spyOn(config, 'pullRequestFilter').mockReturnValue('labelled');
    jest.spyOn(config, 'pullRequestLabels').mockReturnValue([]);

    const compareSpy = jest
      .spyOn((updater as any).octokit.rest.repos, 'compareCommitsWithBasehead')
      .mockResolvedValue({ data: { behind_by: 1 } } as any);

    const res = await updater.prNeedsUpdate(pull);
    expect(res).toBe(false);
    expect(compareSpy).toHaveBeenCalled();
  });

  test('ready state draft and ready_for_review paths', async () => {
    const updater = new AutoUpdater(config, {} as any);
    const pull = {
      merged: false,
      state: 'open',
      head: {
        repo: { owner: { login: 'o' }, name: 'r' },
        label: 'h',
        ref: 'h',
      },
      base: { ref: 'b', label: 'b' },
      labels: [],
      draft: true,
    } as any;

    const compareSpy = jest
      .spyOn((updater as any).octokit.rest.repos, 'compareCommitsWithBasehead')
      .mockResolvedValue({ data: { behind_by: 1 } } as any);

    jest.spyOn(config, 'pullRequestReadyState').mockReturnValue('draft');
    const resDraft = await updater.prNeedsUpdate(pull);
    expect(resDraft).toBe(true);
    expect(compareSpy).toHaveBeenCalled();

    const compareSpy2 = jest
      .spyOn((updater as any).octokit.rest.repos, 'compareCommitsWithBasehead')
      .mockResolvedValue({ data: { behind_by: 1 } } as any);
    jest
      .spyOn(config, 'pullRequestReadyState')
      .mockReturnValue('ready_for_review');
    const resReady = await updater.prNeedsUpdate({ ...pull, draft: true });
    expect(resReady).toBe(false);
    expect(compareSpy2).toHaveBeenCalled();
  });
});
