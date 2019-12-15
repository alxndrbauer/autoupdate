const { createMock } = require('./ts-auto-mock-shim');

describe('ts-auto-mock-shim fallback branches', () => {
  test('JSON.stringify throws -> fallback to array/object clone', () => {
    // Create a circular structure that causes JSON.stringify to throw
    const a = {};
    a.self = a;

    // When overrides is an array with circular ref, fallback should return a shallow copy via slice
    const arr = [];
    arr.push(arr);
    const clonedArr = createMock(arr);
    // cloned arr should be an array (slice) with same length 1
    expect(Array.isArray(clonedArr)).toBe(true);
    expect(clonedArr.length).toBe(1);

    // For object with circular ref, fallback should return Object.assign({}, overrides)
    const obj = {};
    obj.self = obj;
    const clonedObj = createMock(obj);
    expect(typeof clonedObj).toBe('object');
    expect(clonedObj).not.toBe(obj);
  });

  test('proxy handler special properties', () => {
    const m = createMock();
    // toString/valueOf should coerce to empty string function
    const toStr = m.toString();
    expect(String(m)).toBe('');
    expect(toStr).toBe('');

    // 'then' should be undefined on property access (to avoid Promise behavior)
    expect(m.then).toBeUndefined();
  });
});
