'use strict';

const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['node_modules/'] },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.node,
      sourceType: 'commonjs',
    },
  },
];
