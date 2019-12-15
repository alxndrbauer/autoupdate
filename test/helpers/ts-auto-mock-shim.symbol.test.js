const { createMock } = require('./ts-auto-mock-shim');

describe('ts-auto-mock-shim symbol primitive', () => {
  test('Symbol.toPrimitive handler exists and returns empty string for hints', () => {
    const mock = createMock();

    // Access the Symbol.toPrimitive property and assert it's a function
    const toPrim = mock[Symbol.toPrimitive];
    expect(typeof toPrim).toBe('function');

    // Call it with different hint values and assert empty string is returned
    expect(toPrim('string')).toBe('');
    expect(toPrim('number')).toBe('');
    expect(toPrim('default')).toBe('');
  });
});
