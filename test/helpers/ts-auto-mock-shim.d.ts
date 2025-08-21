export interface MockOptions {
  [key: string]: any;
}

export function createMock<T = any>(overrides?: MockOptions): T;
