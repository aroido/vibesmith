import '@testing-library/jest-dom';
import { expect, afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import { toHaveNoViolations } from 'jest-axe';

// ResizeObserver polyfill for jsdom (React Flow, etc.)
const ResizeObserverMock = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
(globalThis as unknown as { ResizeObserver: typeof ResizeObserverMock }).ResizeObserver = ResizeObserverMock;

type StorageShape = Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'clear' | 'key' | 'length'>;

function createStorageMock(): StorageShape {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
}

function installStorageMock(target: object, key: 'localStorage' | 'sessionStorage', mock: StorageShape) {
  Object.defineProperty(target, key, {
    configurable: true,
    writable: true,
    value: mock,
  });
}

const localStorageMock = createStorageMock();
const sessionStorageMock = createStorageMock();

installStorageMock(globalThis, 'localStorage', localStorageMock);
installStorageMock(globalThis, 'sessionStorage', sessionStorageMock);

// node 환경에서는 window/DOM polyfill 건너뜀 (@vitest-environment node)
if (typeof window !== 'undefined') {
  // matchMedia polyfill for jsdom (theme detection, etc.)
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {}, // deprecated
      removeListener: () => {}, // deprecated
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => true,
    }),
  });

  installStorageMock(window, 'localStorage', localStorageMock);
  installStorageMock(window, 'sessionStorage', sessionStorageMock);

  // i18n 초기화 (useTranslation 사용 컴포넌트 테스트용)
  await import('@/i18n');

  // jest-axe matcher 추가
  expect.extend(toHaveNoViolations);

  // 각 테스트 후 cleanup
  afterEach(() => {
    cleanup();
  });
}
