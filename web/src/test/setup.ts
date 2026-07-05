import '@testing-library/jest-dom/vitest';

// jsdom does not implement matchMedia; several UI primitives (dialogs, responsive
// components) probe it, so tests would otherwise crash before rendering anything.
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}
