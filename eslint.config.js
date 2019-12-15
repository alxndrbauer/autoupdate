// Minimal flat config to supply ignore patterns while keeping legacy
// .eslintrc.yml for rules. ESLint v9 warns if .eslintignore is present; this
// moves ignore settings into the flat config.
module.exports = [
  {
    ignores: ['node_modules', 'dist', 'coverage', "*.js"],
  },
];
