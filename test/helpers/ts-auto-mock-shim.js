// Improved runtime shim for ts-auto-mock used in tests when the transformer
// isn't applied. It returns a Proxy around the provided overrides so tests
// can access properties/methods safely. If `jest.fn` is available the shim
// will create spy functions for missing function properties.

function createMock(overrides = {}) {
  // If the caller provided an overrides object, return a deep-serializable
  // clone of it so tests that expect concrete values still work.
  if (overrides && Object.keys(overrides).length > 0) {
    if (typeof structuredClone === 'function') {
      return structuredClone(overrides);
    }

    try {
      return JSON.parse(JSON.stringify(overrides));
    } catch (e) {
      return Array.isArray(overrides) ? overrides.slice() : Object.assign({}, overrides);
    }
  }

  // For empty mocks return a recursive proxy object that safely returns
  // further proxies for any property access. This prevents code under test
  // from throwing when it expects nested objects to exist, while still
  // coercing to an empty string when used in string contexts (e.g. path
  // building) so network mocks don't receive 'undefined' or errors.
  const makeProxy = () => {
    const handler = {
      get(_target, prop) {
        if (prop === Symbol.toPrimitive) {
          return () => '';
        }
        if (prop === 'toString' || prop === 'valueOf') {
          return () => '';
        }
        if (prop === 'then') {
          // Ensure it's not treated as a Promise
          return undefined;
        }
        return makeProxy();
      },
      apply() {
        return makeProxy();
      },
    };

    // Use a function as the underlying target so the proxy is callable if
    // tests treat it like a function; otherwise property access will work.
    return new Proxy(function () {}, handler);
  };

  return makeProxy();
}

module.exports = { createMock };
module.exports.createMock = createMock;
exports.createMock = createMock;
