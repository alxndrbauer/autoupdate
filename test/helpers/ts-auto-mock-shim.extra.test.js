const { createMock } = require('./ts-auto-mock-shim');

describe('ts-auto-mock-shim extra coverage', () => {
  test('returns a deep clone when overrides object provided (JSON path)', () => {
    const overrides = { a: 1, b: { c: 2 } };
    // Ensure structuredClone is not available to force JSON path
    const origStructured = global.structuredClone;
    try {
      // delete structuredClone if present
      global.structuredClone = undefined;
    } catch (e) {
      // ignore
    }

    const cloned = createMock(overrides);
    expect(cloned).toEqual(overrides);
    // Mutating clone should not affect original
    cloned.b.c = 3;
    expect(overrides.b.c).toBe(2);

    // restore
    if (typeof origStructured !== 'undefined') {
      global.structuredClone = origStructured;
    } else {
      try {
        delete global.structuredClone;
      } catch (e) {}
    }
  });

  test('returns a proxy when no overrides provided', () => {
    const m = createMock();
    // should be callable and have toString that coerces to empty string
  expect(typeof m).toBe('function');
  expect(String(m)).toBe('');
  // calling deep properties returns a proxy; coercing to string should be empty
  expect(String(m.any.nested.other())).toBe('');
  });
});
