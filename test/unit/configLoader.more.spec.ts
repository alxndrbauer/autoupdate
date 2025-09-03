import { describe, it, expect } from 'vitest';
import { ConfigLoader } from '../../src/config-loader';

describe('ConfigLoader additional branches', () => {
  it('excludedLabels empty string returns []', () => {
    const c = new ConfigLoader();
    c.env = { EXCLUDED_LABELS: '' } as any;
    expect(c.excludedLabels()).toEqual([]);
  });
  it('pullRequestLabels empty returns []', () => {
    const c = new ConfigLoader();
    c.env = { PR_LABELS: '' } as any;
    expect(c.pullRequestLabels()).toEqual([]);
  });
  it('mergeMsg returns null for blank', () => {
    const c = new ConfigLoader();
    c.env = { MERGE_MSG: '   ' } as any;
    expect(c.mergeMsg()).toBeNull();
  });
  it('conflictMsg returns null for blank', () => {
    const c = new ConfigLoader();
    c.env = { CONFLICT_MSG: '' } as any;
    expect(c.conflictMsg()).toBeNull();
  });
  it('getValue required throws', () => {
    const c = new ConfigLoader();
    c.env = {} as any;
    expect(() => c.getValue('MUST', true)).toThrow(/MUST/);
  });
});
