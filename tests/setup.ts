import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/svelte';
import { afterEach } from 'vitest';

// ---- jsdom polyfills required by bits-ui / floating-ui / sui --------------

class MockResizeObserver {
        observe() {}
        unobserve() {}
        disconnect() {}
}

class MockIntersectionObserver {
        private callback: IntersectionObserverCallback;
        constructor(callback: IntersectionObserverCallback) {
                this.callback = callback;
        }
        observe() {}
        unobserve() {}
        disconnect() {}
        takeRecords(): IntersectionObserverEntry[] {
                return [];
        }
}

globalThis.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver;
globalThis.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver;

// matchMedia is used by several UI primitives for rtl/media queries
Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: (query: string) => ({
                matches: false,
                media: query,
                onchange: null,
                addListener: () => {},
                removeListener: () => {},
                addEventListener: () => {},
                removeEventListener: () => {},
                dispatchEvent: () => false
        })
});

// element.scrollIntoView is not implemented in jsdom
if (!Element.prototype.scrollIntoView) {
        Element.prototype.scrollIntoView = () => {};
}

// jsdom has no layout engine: getClientRects() returns [], which bits-ui's
// `isReferenceHidden` check reads as "anchor is hidden" — popovers then keep
// `visibility: hidden` forever and become invisible to role queries. Return
// the bounding rect (zeros in jsdom) so floating-ui treats elements as laid out.
if (document.createElement('div').getClientRects().length === 0) {
        Element.prototype.getClientRects = function (this: Element): DOMRectList {
                const rect = this.getBoundingClientRect();
                return {
                        length: 1,
                        item: () => rect,
                        [Symbol.iterator]: function* () {
                                yield rect;
                        }
                } as DOMRectList;
        };
}

// pointer capture APIs are missing in jsdom but used by bits-ui + user-event
Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false);
Element.prototype.setPointerCapture = Element.prototype.setPointerCapture ?? (() => {});
Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {});

// bits-ui reads crypto.randomUUID for ids in dev
if (!('randomUUID' in globalThis.crypto)) {
        Object.defineProperty(globalThis.crypto, 'randomUUID', {
                value: () => `test-${Math.random().toString(36).slice(2)}`
        });
}

// ---- testing-library lifecycle ---------------------------------------------

afterEach(() => {
        cleanup();
});

// silence jsdom "not implemented" noise
const originalError = console.error;
console.error = (...args: unknown[]) => {
        if (typeof args[0] === 'string' && args[0].includes('not implemented')) return;
        originalError(...args);
};
