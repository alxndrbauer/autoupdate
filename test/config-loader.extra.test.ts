import { ConfigLoader } from '../src/config-loader';

describe('config-loader additional coverage', () => {
  test('mergeMsg/conflictMsg when raw value is a non-empty string (covers toString().trim())', () => {
    const loader = new ConfigLoader();
    const env: { MERGE_MSG?: any; CONFLICT_MSG?: any } = {};

    // Provide non-null, non-undefined values that are not empty after trim
    env.MERGE_MSG = '  Merge now  ';
    env.CONFLICT_MSG = '  Conflicted  ';
    Object.defineProperty(loader, 'env', { value: env });

    expect(loader.mergeMsg()).toBe('Merge now');
    expect(loader.conflictMsg()).toBe('Conflicted');

    // Also cover case where value is an object with toString()
    env.MERGE_MSG = { toString: () => '  ObjMerge  ' };
    env.CONFLICT_MSG = { toString: () => '  ObjConflict  ' };
    expect(loader.mergeMsg()).toBe('ObjMerge');
    expect(loader.conflictMsg()).toBe('ObjConflict');
  });
});
