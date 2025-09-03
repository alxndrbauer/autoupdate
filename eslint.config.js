// Flat ESLint config (valid for ESLint v8+/v9). This file configures
// TypeScript parsing and basic environment globals so ESLint can lint
// the project's TypeScript test files under the flat config system.
module.exports = [
	{
		ignores: ['node_modules', 'dist', 'coverage'],
	},
	{
		files: ['**/*.ts'],
			languageOptions: {
				parser: require('@typescript-eslint/parser'),
						parserOptions: {
							ecmaVersion: 2020,
							sourceType: 'module',
						project: ['./tsconfig.json', './tsconfig.tests.json', './new-tests/tsconfig.new-tests.json'],
						},
				globals: {
				// Jest globals
				describe: 'readonly',
				test: 'readonly',
				expect: 'readonly',
				beforeEach: 'readonly',
				afterEach: 'readonly',
				jest: 'readonly',
				// Node globals commonly used
				process: 'readonly',
				Buffer: 'readonly',
			},
		},
		plugins: {
			'@typescript-eslint': require('@typescript-eslint/eslint-plugin'),
			jest: require('eslint-plugin-jest'),
		},
		rules: {
			// Mirror key rules from .eslintrc.yml so behavior is consistent
			'no-console': 'error',
			'no-plusplus': 'off',
			'no-await-in-loop': 'off',
			'no-constant-condition': 'off',
			'no-restricted-syntax': 'off',
			'@typescript-eslint/ban-ts-comment': 'off',
			'@typescript-eslint/no-explicit-any': 'off',
		},
	},
];
