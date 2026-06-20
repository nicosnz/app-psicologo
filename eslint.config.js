import sonarjs from 'eslint-plugin-sonarjs';

export default [
  {
    plugins: { sonarjs },
    files: ['src/**/*.js'],
    rules: {
      // — Long method —
      'max-lines-per-function': ['warn', { max: 30, skipBlankLines: true, skipComments: true }],

      // — Magic numbers —
      'no-magic-numbers': ['warn', { ignore: [0, 1, -1, 2], ignoreArrayIndexes: true }],

      // — Complejidad ciclomática —
      'complexity': ['warn', 8],

      // — Nesting profundo —
      'max-depth': ['warn', 3],

      // — Demasiados parámetros —
      'max-params': ['warn', 4],

      // — Archivo muy largo —
      'max-lines': ['warn', { max: 100, skipBlankLines: true, skipComments: true }],

      // — SonarJS: complejidad cognitiva —
      'sonarjs/cognitive-complexity': ['warn', 10],

      // — SonarJS: strings duplicados —
      'sonarjs/no-duplicate-string': ['warn', { threshold: 3 }],

      // — SonarJS: código duplicado —
      'sonarjs/no-identical-functions': 'warn',
    },
  },
];
