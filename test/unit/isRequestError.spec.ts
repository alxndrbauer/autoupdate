import { describe, it, expect } from 'vitest';
import { isRequestError } from '../../src/helpers/isRequestError';

class CustomErr extends Error { status?: number }

describe('isRequestError', () => {
  it('returns true for error with numeric status', () => {
    const err = new CustomErr('boom');
    err.status = 403;
    expect(isRequestError(err)).toBe(true);
  });
  it('returns false for error without status', () => {
    const err = new Error('x');
    expect(isRequestError(err)).toBe(false);
  });
});
