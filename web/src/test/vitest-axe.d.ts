import 'vitest';
import type { AxeMatchers } from 'vitest-axe/matchers';

// expect.extend(matchers) в a11y.test.tsx добавляет toHaveNoViolations только
// в рантайме — здесь докидываем его в типы Assertion, иначе tsc падает.
declare module 'vitest' {
  interface Assertion<T = unknown> extends AxeMatchers {}
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}
