import { describe, expect, it, vi, afterEach } from 'vitest';
import {
        containedScrollDelta,
        containedScrollIntoView
} from '$lib/components/ui/command/contained-scroll-into-view';

describe('containedScrollDelta (pure math)', () => {
        // container viewport: top 100, bottom 300 (height 200)
        const container = { top: 100, bottom: 300, height: 200 };

        it('nearest: item fully visible scrolls nothing', () => {
                const item = { top: 150, bottom: 170, height: 20 };
                expect(containedScrollDelta(item, container, 'nearest')).toBe(0);
        });

        it('nearest: item exactly filling the container scrolls nothing', () => {
                const item = { top: 100, bottom: 300, height: 200 };
                expect(containedScrollDelta(item, container, 'nearest')).toBe(0);
        });

        it('nearest: item above the visible top scrolls up by the overhang', () => {
                const item = { top: 40, bottom: 60, height: 20 };
                expect(containedScrollDelta(item, container, 'nearest')).toBe(-60);
        });

        it('nearest: item below the visible bottom scrolls down by the overhang', () => {
                const item = { top: 340, bottom: 360, height: 20 };
                expect(containedScrollDelta(item, container, 'nearest')).toBe(60);
        });

        it('nearest: item straddling the bottom edge scrolls by the overlap only', () => {
                const item = { top: 290, bottom: 310, height: 20 };
                expect(containedScrollDelta(item, container, 'nearest')).toBe(10);
        });

        it('nearest: item taller than the container aligns its top', () => {
                const item = { top: 50, bottom: 400, height: 350 };
                expect(containedScrollDelta(item, container, 'nearest')).toBe(-50);
        });

        it('start aligns the item top with the container top', () => {
                const item = { top: 240, bottom: 260, height: 20 };
                expect(containedScrollDelta(item, container, 'start')).toBe(140);
        });

        it('end aligns the item bottom with the container bottom', () => {
                const item = { top: 240, bottom: 260, height: 20 };
                expect(containedScrollDelta(item, container, 'end')).toBe(-40);
        });

        it('center centers the item in the container', () => {
                const item = { top: 240, bottom: 260, height: 20 };
                // item center 250 - container center 200 = 50
                expect(containedScrollDelta(item, container, 'center')).toBe(50);
        });
});

describe('containedScrollIntoView (DOM patch)', () => {
        afterEach(() => {
                document.body.innerHTML = '';
                vi.restoreAllMocks();
        });

        function makeScroller() {
                const scroller = document.createElement('div');
                scroller.style.overflowY = 'auto';
                Object.defineProperty(scroller, 'scrollHeight', { value: 1000, configurable: true });
                Object.defineProperty(scroller, 'clientHeight', { value: 200, configurable: true });
                const item = document.createElement('div');
                scroller.appendChild(item);
                document.body.appendChild(scroller);
                return { scroller, item };
        }

        function fakeRects(item: HTMLElement, scroller: HTMLElement, itemTop: number, itemBottom: number, cTop = 0, cBottom = 200) {
                vi.spyOn(item, 'getBoundingClientRect').mockReturnValue({
                        top: itemTop,
                        bottom: itemBottom,
                        height: itemBottom - itemTop,
                        left: 0, right: 0, width: 0, x: 0, y: itemTop, toJSON: () => ({})
                } as DOMRect);
                vi.spyOn(scroller, 'getBoundingClientRect').mockReturnValue({
                        top: cTop,
                        bottom: cBottom,
                        height: cBottom - cTop,
                        left: 0, right: 0, width: 0, x: 0, y: cTop, toJSON: () => ({})
                } as DOMRect);
        }

        it('scrolls only the nearest scrollable ancestor', () => {
                const { scroller, item } = makeScroller();
                const release = containedScrollIntoView(item);
                // item sits 120px below the scroller's visible bottom
                fakeRects(item, scroller, 320, 340);
                scroller.scrollTop = 0;

                item.scrollIntoView({ block: 'nearest' });

                expect(scroller.scrollTop).toBe(140);
                expect(document.documentElement.scrollTop).toBe(0);
                release.destroy();
        });

        it('never falls back to the native page-level scroll', () => {
                const { item } = makeScroller();
                const native = vi
                        .spyOn(Element.prototype, 'scrollIntoView')
                        .mockImplementation(() => {});
                const release = containedScrollIntoView(item);

                // no scrollable ancestor: contained impl must be a no-op, not native
                item.parentElement!.style.overflowY = 'visible';
                item.scrollIntoView({ block: 'nearest' });

                expect(native).not.toHaveBeenCalled();
                expect(document.documentElement.scrollTop).toBe(0);
                release.destroy();
        });

        it('boolean argument forms map to start/end', () => {
                const { scroller, item } = makeScroller();
                const release = containedScrollIntoView(item);
                fakeRects(item, scroller, 320, 340);

                item.scrollIntoView(true); // align top
                expect(scroller.scrollTop).toBe(320);

                scroller.scrollTop = 0;
                item.scrollIntoView(false); // align bottom
                expect(scroller.scrollTop).toBe(140);

                release.destroy();
        });

        it('destroy restores the native method', () => {
                const { item } = makeScroller();
                const before = item.scrollIntoView;
                const release = containedScrollIntoView(item);
                expect(item.scrollIntoView).not.toBe(before);
                release.destroy();
                expect(item.scrollIntoView).toBe(before);
        });

        it('a visible item produces no scroll at all', () => {
                const { scroller, item } = makeScroller();
                const release = containedScrollIntoView(item);
                fakeRects(item, scroller, 10, 30);

                item.scrollIntoView({ block: 'nearest' });

                expect(scroller.scrollTop).toBe(0);
                release.destroy();
        });
});
