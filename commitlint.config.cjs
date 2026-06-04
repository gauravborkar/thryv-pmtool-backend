/** @type {import('@commitlint/types').UserConfig} */
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // Allowed commit types
    'type-enum': [
      2,
      'always',
      ['feat', 'fix', 'refactor', 'docs', 'chore', 'test', 'ci', 'perf'],
    ],
    // Subject must be lowercase
    'subject-case': [2, 'always', 'lower-case'],
    // Max header length
    'header-max-length': [2, 'always', 100],
  },
};
