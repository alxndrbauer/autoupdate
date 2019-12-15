import { ConfigLoader } from '../src/config-loader';

describe('ConfigLoader consolidated tests', () => {
  const ORIG = { ...process.env };

  beforeEach(() => {
    process.env = { ...ORIG } as NodeJS.ProcessEnv;
  });

  afterEach(() => {
    process.env = ORIG;
  });

  test('githubToken required throws when missing', () => {
    delete process.env.GITHUB_TOKEN;
    const cfg = new ConfigLoader();
    expect(() => cfg.githubToken()).toThrow(/GITHUB_TOKEN/);
  });

  test('scheduleBranches returns empty array when not set', () => {
    delete process.env.SCHEDULE_BRANCHES;
    const cfg = new ConfigLoader();
    expect(cfg.scheduleBranches()).toEqual([]);
  });

  test('scheduleBranches splits, trims and ignores empties', () => {
    process.env.SCHEDULE_BRANCHES = ' main, , develop , ,feature  ';
    const cfg = new ConfigLoader();
    expect(cfg.scheduleBranches()).toEqual(['main', 'develop', 'feature']);
  });

  test('pullRequestLabels splits comma list and trims/filters empties', () => {
    process.env.PR_LABELS = '  a , one, , b,  '; // covers trimming and filtering
    const cfg = new ConfigLoader();
    expect(cfg.pullRequestLabels()).toEqual(['a', 'one', 'b']);
  });

  test('excludedLabels trims and filters empty entries', () => {
    process.env.EXCLUDED_LABELS = ' ,skip, , dep ';
    const cfg = new ConfigLoader();
    expect(cfg.excludedLabels()).toEqual(['skip', 'dep']);
  });

  test('mergeMsg and conflictMsg trim and empty -> null', () => {
    process.env.MERGE_MSG = '  Merge via CI  ';
    process.env.CONFLICT_MSG = '   ';
    const cfg = new ConfigLoader();
    expect(cfg.mergeMsg()).toBe('Merge via CI');
    expect(cfg.conflictMsg()).toBeNull();
  });

  test('mergeMsg and conflictMsg return null for empty/whitespace', () => {
    process.env.MERGE_MSG = '   ';
    process.env.CONFLICT_MSG = '';
    const cfg = new ConfigLoader();
    expect(cfg.mergeMsg()).toBeNull();
    expect(cfg.conflictMsg()).toBeNull();
  });

  test('retryCount and retrySleep parse ints with defaults and overrides', () => {
    delete process.env.RETRY_COUNT;
    delete process.env.RETRY_SLEEP;
    const cfg1 = new ConfigLoader();
    expect(cfg1.retryCount()).toBe(5);
    expect(cfg1.retrySleep()).toBe(300);

    process.env.RETRY_COUNT = '3';
    process.env.RETRY_SLEEP = '1000';
    const cfg2 = new ConfigLoader();
    expect(cfg2.retryCount()).toBe(3);
    expect(cfg2.retrySleep()).toBe(1000);
  });

  test('getValue throws when required env var missing', () => {
    delete process.env.SOME_RANDOM_ENV_VAR;
    const cfg = new ConfigLoader();
    expect(() => cfg.getValue('SOME_RANDOM_ENV_VAR', true)).toThrow();
  });

  test('dryRun parses boolean and defaults to false', () => {
    delete process.env.DRY_RUN;
    const cfg1 = new ConfigLoader();
    expect(cfg1.dryRun()).toBe(false);

    process.env.DRY_RUN = 'true';
    const cfg2 = new ConfigLoader();
    expect(cfg2.dryRun()).toBe(true);
  });

  test('pullRequestLabels and excludedLabels return empty arrays when not set', () => {
    delete process.env.PR_LABELS;
    delete process.env.EXCLUDED_LABELS;
    const cfg = new ConfigLoader();
    expect(cfg.pullRequestLabels()).toEqual([]);
    expect(cfg.excludedLabels()).toEqual([]);
  });

  test('mergeConflictAction and pullRequestReadyState default values', () => {
    delete process.env.MERGE_CONFLICT_ACTION;
    delete process.env.PR_READY_STATE;
    const cfg = new ConfigLoader();
    expect(cfg.mergeConflictAction()).toBe('fail');
    expect(cfg.pullRequestReadyState()).toBe('all');
  });

  test('pullRequestFilter defaults to all and respects override', () => {
    delete process.env.PR_FILTER;
    const cfg1 = new ConfigLoader();
    expect(cfg1.pullRequestFilter()).toBe('all');

    process.env.PR_FILTER = 'labelled';
    const cfg2 = new ConfigLoader();
    expect(cfg2.pullRequestFilter()).toBe('labelled');
  });

  test('githubRef and githubRepository are required and throw when missing', () => {
    delete process.env.GITHUB_REF;
    delete process.env.GITHUB_REPOSITORY;
    const cfg = new ConfigLoader();
    expect(() => cfg.githubRef()).toThrow(/GITHUB_REF/);
    expect(() => cfg.githubRepository()).toThrow(/GITHUB_REPOSITORY/);
  });

  test('getValue returns provided default when not required', () => {
    delete process.env.SOME_DEFAULT_TEST;
    const cfg = new ConfigLoader();
    expect(cfg.getValue('SOME_DEFAULT_TEST', false, 'fallback')).toBe(
      'fallback',
    );
  });
});

// ensure default exported singleton also exercises the same branches
import ConfigDefault from '../src/config-loader';

describe('ConfigLoader default instance coverage hits', () => {
  const ORIG = { ...process.env };

  afterEach(() => {
    process.env = ORIG;
  });

  test('default instance returns env value when present', () => {
    process.env = { SOME_DEF: 'present' } as any;
    // the default singleton captures its env at construction, ensure it points to the current process.env
    (ConfigDefault as any).env = process.env;
    expect((ConfigDefault as any).getValue('SOME_DEF', false, 'fallback')).toBe(
      'present',
    );
  });

  test('default instance throws when required key missing', () => {
    process.env = {} as any;
    (ConfigDefault as any).env = process.env;
    expect(() => (ConfigDefault as any).getValue('MISSING_DEF', true)).toThrow(
      /MISSING_DEF/,
    );
  });
});

// --- additional edge-case tests moved here to improve coverage and keep config tests together ---
import { ConfigLoader as CLClass } from '../src/config-loader';

describe('ConfigLoader coverage edge cases (moved)', () => {
  test('mergeMsg returns null for empty string and null env values, and trims non-empty', () => {
    const loader = new CLClass();

    // empty string -> treated as missing -> returns null
    loader.env = { MERGE_MSG: '' } as any;
    expect(loader.mergeMsg()).toBeNull();

    // null value present in env -> should be treated as missing/default -> returns null
    loader.env = { MERGE_MSG: null } as any;
    expect(loader.mergeMsg()).toBeNull();

    // non-empty with whitespace should be trimmed
    loader.env = { MERGE_MSG: '  Commit message  ' } as any;
    expect(loader.mergeMsg()).toBe('Commit message');
  });

  test('mergeMsg handles getValue returning null or undefined (branch coverage)', () => {
    const loader = new CLClass();
    // stub getValue to return null
    (loader as any).getValue = () => null;
    expect(loader.mergeMsg()).toBeNull();

    // stub getValue to return undefined
    (loader as any).getValue = () => undefined;
    expect(loader.mergeMsg()).toBeNull();
  });

  test('conflictMsg mirrors mergeMsg behavior for empty/null/trimmed values', () => {
    const loader = new CLClass();

    loader.env = { CONFLICT_MSG: '' } as any;
    expect(loader.conflictMsg()).toBeNull();

    loader.env = { CONFLICT_MSG: null } as any;
    expect(loader.conflictMsg()).toBeNull();

    loader.env = { CONFLICT_MSG: '  Conflict happened ' } as any;
    expect(loader.conflictMsg()).toBe('Conflict happened');
  });

  test('conflictMsg handles getValue returning null or undefined (branch coverage)', () => {
    const loader = new CLClass();
    // stub getValue to return null
    (loader as any).getValue = () => null;
    expect(loader.conflictMsg()).toBeNull();

    // stub getValue to return undefined
    (loader as any).getValue = () => undefined;
    expect(loader.conflictMsg()).toBeNull();
  });

  test('scheduleBranches trims entries and ignores empty items', () => {
    const loader = new CLClass();
    loader.env = { SCHEDULE_BRANCHES: ' main, , develop ,, feature ' } as any;
    expect(loader.scheduleBranches()).toEqual(['main', 'develop', 'feature']);

    // empty env should return empty array
    loader.env = { SCHEDULE_BRANCHES: '' } as any;
    expect(loader.scheduleBranches()).toEqual([]);
  });

  test('getValue returns env value when key present and not null/undefined', () => {
    const loader = new CLClass();
    loader.env = { SOME_KEY: 'present' } as any;
    expect(loader.getValue('SOME_KEY', false, 'fallback')).toBe('present');
  });

  test('getValue throws when key present but null and required=true', () => {
    const loader = new CLClass();
    loader.env = { SOME_KEY: null } as any;
    expect(() => loader.getValue('SOME_KEY', true)).toThrow(/SOME_KEY/);
  });

  test('getValue throws when key present but undefined and required=true', () => {
    const loader = new CLClass();
    // simulate a key that exists with undefined value
    const env: any = {};
    env['SOME_KEY'] = undefined;
    loader.env = env as any;
    expect(() => loader.getValue('SOME_KEY', true)).toThrow(/SOME_KEY/);
  });
});

// final focused tests to hit remaining getValue branches reported by coverage
import { ConfigLoader as CLFinal } from '../src/config-loader';

describe('ConfigLoader final coverage hits', () => {
  test('getValue throws when key missing and required=true (missing from env)', () => {
    const loader = new CLFinal();
    loader.env = {} as any;
    expect(() => loader.getValue('MISSING_KEY', true)).toThrow(/MISSING_KEY/);
  });

  test('getValue returns provided default when key missing and not required', () => {
    const loader = new CLFinal();
    loader.env = {} as any;
    expect(loader.getValue('MISSING_KEY', false, 'fallback')).toBe('fallback');
  });

  test('getValue returns env value when key present and not null/undefined (covers return path)', () => {
    const loader = new CLFinal();
    loader.env = { SOME_KEY: 'present' } as any;
    expect(loader.getValue('SOME_KEY', false, 'fallback')).toBe('present');
  });

  test('getValue returns env value when key present and required=true', () => {
    const loader = new CLFinal();
    loader.env = { REQUIRED_KEY: 'yes' } as any;
    expect(loader.getValue('REQUIRED_KEY', true)).toBe('yes');
  });

  test('getValue returns default when key exists with undefined and required=false', () => {
    const loader = new CLFinal();
    const env: any = {};
    env['UNDEF_KEY'] = undefined;
    loader.env = env as any;
    expect(loader.getValue('UNDEF_KEY', false, 'defaulted')).toBe('defaulted');
  });

  test('getValue throws when key exists with null and required=true', () => {
    const loader = new CLFinal();
    loader.env = { NULL_KEY: null } as any;
    expect(() => loader.getValue('NULL_KEY', true)).toThrow(/NULL_KEY/);
  });

  test('getValue throws when key exists with undefined and required=true', () => {
    const loader = new CLFinal();
    const env: any = {};
    env['UNDEF_REQ'] = undefined;
    loader.env = env as any;
    expect(() => loader.getValue('UNDEF_REQ', true)).toThrow(/UNDEF_REQ/);
  });

  test('getValue via Object.defineProperty with enumerable present value returns value', () => {
    const loader = new CLFinal();
    const env: any = {};
    Object.defineProperty(env, 'DP_KEY', {
      value: 'dp',
      enumerable: true,
      configurable: true,
      writable: true,
    });
    loader.env = env as any;
    expect(loader.getValue('DP_KEY', false, 'fallback')).toBe('dp');
  });

  test('getValue via Object.defineProperty with null value and required=true throws', () => {
    const loader = new CLFinal();
    const env: any = {};
    Object.defineProperty(env, 'DP_NULL', {
      value: null,
      enumerable: true,
      configurable: true,
      writable: true,
    });
    loader.env = env as any;
    expect(() => loader.getValue('DP_NULL', true)).toThrow(/DP_NULL/);
  });

  test('explicit present and non-null/undefined returns value (various property shapes)', () => {
    const loader = new ConfigLoader();

    // simple assigned property
    loader.env = { X1: 'v1' } as any;
    expect(loader.getValue('X1', false, 'd')).toBe('v1');

    // property created via defineProperty (enumerable)
    const env2: any = {};
    Object.defineProperty(env2, 'X2', {
      value: 'v2',
      enumerable: true,
      configurable: true,
    });
    loader.env = env2 as any;
    expect(loader.getValue('X2', false)).toBe('v2');

    // property exists with falsy but non-null/undefined (empty string)
    loader.env = { X3: '' } as any;
    expect(loader.getValue('X3', false, 'd')).toBe('');
  });

  test('explicit undefined and null handling with required throws and non-required defaults', () => {
    const loader = new ConfigLoader();

    const env: any = {};
    env['U1'] = undefined;
    loader.env = env as any;
    // undefined present but required=false should return default
    expect(loader.getValue('U1', false, 'def')).toBe('def');
    // undefined present and required=true should throw
    expect(() => loader.getValue('U1', true)).toThrow(/U1/);

    loader.env = { N1: null } as any;
    expect(() => loader.getValue('N1', true)).toThrow(/N1/);
  });

  test('missing key with required=true throws with message containing key', () => {
    const loader = new ConfigLoader();
    loader.env = {} as any;
    expect(() => loader.getValue('MISSING_X', true)).toThrow(/MISSING_X/);
  });

  test('returns value when key present and not null/undefined (required=true)', () => {
    const cfg = new ConfigLoader();
    cfg.env = { A_KEY: 'value' } as any;
    expect(cfg.getValue('A_KEY', true)).toBe('value');
  });

  test('returns value when key present and not null/undefined (required=false)', () => {
    const cfg = new ConfigLoader();
    cfg.env = { B_KEY: 'other' } as any;
    expect(cfg.getValue('B_KEY', false, 'fallback')).toBe('other');
  });

  test('throws when key missing and required=true', () => {
    const cfg = new ConfigLoader();
    cfg.env = {} as any;
    expect(() => cfg.getValue('MISSING', true)).toThrow(/MISSING/);
  });

  test('returns default when key missing and required=false', () => {
    const cfg = new ConfigLoader();
    cfg.env = {} as any;
    expect(cfg.getValue('MISSING', false, 'def')).toBe('def');
  });

  test('key present with null and required=true throws', () => {
    const cfg = new ConfigLoader();
    cfg.env = { K_NULL: null } as any;
    expect(() => cfg.getValue('K_NULL', true)).toThrow(/K_NULL/);
  });

  test('key present with null and required=false returns default', () => {
    const cfg = new ConfigLoader();
    cfg.env = { K_NULL: null } as any;
    expect(cfg.getValue('K_NULL', false, 'def')).toBe('def');
  });

  test('key present with undefined and required=true throws', () => {
    const cfg = new ConfigLoader();
    const env: any = {};
    env['K_UNDEF'] = undefined;
    cfg.env = env as any;
    expect(() => cfg.getValue('K_UNDEF', true)).toThrow(/K_UNDEF/);
  });

  test('key present with undefined and required=false returns default', () => {
    const cfg = new ConfigLoader();
    const env: any = {};
    env['K_UNDEF'] = undefined;
    cfg.env = env as any;
    expect(cfg.getValue('K_UNDEF', false, 'def')).toBe('def');
  });

  test('property defined via Object.defineProperty (enumerable) returns value', () => {
    const cfg = new ConfigLoader();
    const env: any = {};
    Object.defineProperty(env, 'DP', {
      value: 'dp-val',
      enumerable: true,
      configurable: true,
    });
    cfg.env = env as any;
    expect(cfg.getValue('DP', false, 'fallback')).toBe('dp-val');
  });

  test('property defined via Object.defineProperty with null triggers required throw', () => {
    const cfg = new ConfigLoader();
    const env: any = {};
    Object.defineProperty(env, 'DP_NULL', {
      value: null,
      enumerable: true,
      configurable: true,
    });
    cfg.env = env as any;
    expect(() => cfg.getValue('DP_NULL', true)).toThrow(/DP_NULL/);
  });
});
