
/// <reference types="vitest" />
import { fileURLToPath } from 'node:url'
import { defineConfig, mergeConfig, configDefaults, coverageConfigDefaults } from 'vitest/config'
import viteConfig from './vite.config'

/**
 * Environment toggles:
 * - Set VITEST_COVERAGE=false to disable coverage in local runs if desired.
 * - Set VITEST_JUNIT_PATH to change JUnit output path.
 */
const COVERAGE_ENABLED = process.env.VITEST_COVERAGE !== 'false'
const JUNIT_PATH = process.env.VITEST_JUNIT_PATH ?? './tests/junit-report.xml'

export default defineConfig(
  mergeConfig(viteConfig, {
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    test: {
      // --- Runtime environment ---
      environment: 'jsdom',
      environmentOptions: {
        jsdom: { url: 'http://localhost' }, // resolve relative fetch('/path') in tests
      },

      // --- Discovery / setup ---
      root: fileURLToPath(new URL('./', import.meta.url)),
      setupFiles: ['./tests/setup.ts'],
      globals: true,

      // --- Include / exclude test files ---
      // Keep Vitest defaults and add e2e folder to excludes
      include: configDefaults.include,
      exclude: [...configDefaults.exclude, 'e2e/**'],

      // --- Reporters: terminal + JUnit XML (for CI) ---
      reporters: [
        'default',
        ['junit', { suiteName: 'UI tests' }],
      ],
      outputFile: { junit: JUNIT_PATH },

      // --- Coverage configuration ---
      coverage: {
        enabled: COVERAGE_ENABLED,            // default ON; override via env or CLI
        provider: 'v8',                       // requires @vitest/coverage-v8
        reportsDirectory: './coverage',

        // Reporters for humans & tooling
        // - HTML for local inspection
        // - LCOV for Sonar/Codecov/GitHub badges
        // - JSON summary for dashboards/scripts
        reporter: ['text', 'html', 'lcov', 'json-summary'],

        // Consider all source files (even if not imported) for a realistic percentage.
        // Disable if you only want files touched by tests.
        all: true,

        // Broad include for TS/Vue sources
        include: ['src/**/*.{ts,tsx,js,jsx,vue}'],

        // Extend default coverage excludes so you don't lose them
        exclude: [
          // project-specific excludes
          'src/**/__tests__/**',
          'src/mocks/**',
          'tests/**',
          '**/*.d.ts',
          '**/vite.config.*',
          '**/vitest.config.*',
          // keep Vitest's defaults
          ...coverageConfigDefaults.exclude,
        ],

        // Enforce thresholds (Vitest 1.x syntax)
        thresholds: {
          lines: 70,
          statements: 70,
          functions: 60,
          branches: 50, // "C1" focus — branch/decision coverage
        },
      },
    },
  }),
)