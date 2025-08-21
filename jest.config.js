module.exports = {
  "clearMocks": true,
  "collectCoverage": true,
  "coverageDirectory": "coverage",
  "coverageProvider": "v8",
  "preset": "ts-jest",
  "setupFiles": [
    "<rootDir>/test/config.ts"
  ],
  "testEnvironment": "node",
  "transform": {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.tests.json"
      }
    ]
  },
  "moduleNameMapper": {
    "^ts-auto-mock$": "<rootDir>/test/helpers/ts-auto-mock-shim.js"
  },
}
