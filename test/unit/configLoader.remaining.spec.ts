import { describe, it, expect } from 'vitest';
import { ConfigLoader } from '../../src/config-loader';

describe('ConfigLoader remaining methods', () => {
  it('covers githubToken and related getters', () => {
    const c = new ConfigLoader();
    c.env = {
      GITHUB_TOKEN: 'tok',
      GITHUB_REF: 'refs/heads/main',
      GITHUB_REPOSITORY: 'o/r',
      DRY_RUN: 'true',
      RETRY_COUNT: '7',
      RETRY_SLEEP: '42',
      MERGE_CONFLICT_ACTION: 'ignore',
      PR_READY_STATE: 'all',
      SCHEDULE_BRANCHES: 'main,dev',
    } as any;
    expect(c.githubToken()).toBe('tok');
    expect(c.dryRun()).toBe(true);
    expect(c.retryCount()).toBe(7);
    expect(c.retrySleep()).toBe(42);
    expect(c.mergeConflictAction()).toBe('ignore');
    expect(c.githubRef()).toBe('refs/heads/main');
    expect(c.githubRepository()).toBe('o/r');
    expect(c.pullRequestReadyState()).toBe('all');
    expect(c.scheduleBranches()).toEqual(['main', 'dev']);
  });

  it('mergeMsg and conflictMsg return trimmed strings', () => {
    const c = new ConfigLoader();
    c.env = {
      MERGE_MSG: '  hello  ',
      CONFLICT_MSG: ' world ',
      GITHUB_TOKEN: 't',
    } as any;
    expect(c.mergeMsg()).toBe('hello');
    expect(c.conflictMsg()).toBe('world');
  });
});
