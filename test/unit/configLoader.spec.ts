import { describe, it, expect } from 'vitest';
import { ConfigLoader } from '../../src/config-loader';
import fc from 'fast-check';

// Property-based test example for getValue (non-null/undefined branch).

describe('ConfigLoader.getValue (property-based)', () => {
  it('returns any non-null/undefined value present in env without default usage', () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (key, val) => {
        fc.pre(key.length > 0);
        const loader = new ConfigLoader();
        loader.env = { [key]: val } as any;
        expect(loader.getValue(key, false, 'fallback')).toBe(val);
      }),
    );
  });
});
