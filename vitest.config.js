import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // This app's test surface leans heavily on pure-logic math (BMI/BMR,
    // GPS distance/pace, cycle prediction, program generation, PPG signal
    // processing, ...) — 'node' is enough for that and keeps runs fast.
    // Any test that needs a DOM can opt into jsdom per-file with a
    // `// @vitest-environment jsdom` docblock once jsdom is added.
    environment: 'node',
    include: ['tests/unit/**/*.test.js'],
  },
});
