import { Output } from '../src/Output';

describe('Output enum', () => {
  test('contains Conflicted', () => {
    expect(Output.Conflicted).toBe('conflicted');
  });
});
