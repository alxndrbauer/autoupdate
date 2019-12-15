import { createMock } from './ts-auto-mock-shim';

describe('ts-auto-mock-shim', () => {
  test('empty mock returns safe nested objects', () => {
    const mock = createMock();
    expect(mock.someProperty.deepProperty.veryDeep).toBeDefined();
    expect(String(mock.someProperty)).toBe('');
    expect(mock.someProperty + '').toBe('');
  });

  test('mock preserves provided values', () => {
    const mock = createMock({
      existing: 'value',
      nested: { prop: 42 },
    });
    expect(mock.existing).toBe('value');
    expect(mock.nested.prop).toBe(42);
  });

  test('mock handles array inputs', () => {
    const mock = createMock([1, 2, 3]);
    expect(Array.isArray(mock)).toBe(true);
    expect(mock).toEqual([1, 2, 3]);
  });

  test('mock handles function calls safely', () => {
    const mock = createMock();
    const result = mock.someFunction();
    expect(result.anotherProperty).toBeDefined();
    expect(String(result)).toBe('');
  });

  test('mock is not treated as a promise', () => {
    const mock = createMock();
    expect(mock.then).toBeUndefined();
  });

  test('mock handles JSON serialization', () => {
    const mock = createMock({ keepThis: 'value' });
    expect(JSON.stringify(mock)).toBe('{"keepThis":"value"}');

    const emptyMock = createMock();
    expect(() => JSON.stringify(emptyMock)).not.toThrow();
  });

  test('mock handles clone fallback when structuredClone is not available', () => {
    const originalClone = global.structuredClone;
    // @ts-ignore
    global.structuredClone = undefined;

    // Test regular object cloning
    const mock = createMock({ test: 'value', nested: { prop: 42 } });
    expect(mock).toEqual({ test: 'value', nested: { prop: 42 } });

    // Test array cloning
    const arrayMock = createMock([1, 2, { test: 'value' }]);
    expect(arrayMock).toEqual([1, 2, { test: 'value' }]);

    // @ts-ignore
    global.structuredClone = originalClone;
  });

  test('mock handles JSON parse errors', () => {
    const circular: any = { prop: 'value' };
    circular.self = circular;

    const mock = createMock(circular);
    expect(mock).toEqual(circular);
  });

  test('mock toString and valueOf behavior', () => {
    const mock = createMock();
    expect(mock.toString()).toBe('');
    expect(mock.valueOf()).toBe('');
    expect(mock[Symbol.toPrimitive]('string')).toBe('');
    expect(mock[Symbol.toPrimitive]('number')).toBe('');
  });

  test('uses structuredClone when available for object cloning', () => {
    const original = { a: 1, nested: { b: 2 } };
    const originalStructured = global.structuredClone;

    // Provide a fake structuredClone to observe that path is used
    // @ts-ignore
    global.structuredClone = (obj) => ({ __cloned: true, ...obj });

    const mock = createMock(original);
    expect(mock.__cloned).toBe(true);
    expect(mock.a).toBe(1);
    expect(mock.nested.b).toBe(2);

    // restore
    // @ts-ignore
    global.structuredClone = originalStructured;
  });
});
