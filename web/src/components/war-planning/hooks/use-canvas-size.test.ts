import { act, createElement, useLayoutEffect } from 'react';
import { KonvaRenderer } from 'react-konva/lib/ReactKonvaCore';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SceneCanvas } from 'konva/lib/Canvas';
import { useCanvasSize } from './use-canvas-size';

let callback: ResizeObserverCallback;
let size: ReturnType<typeof useCanvasSize>;
let root: ReturnType<typeof KonvaRenderer.createContainer>;
const ref = { current: {} as HTMLElement };
function Probe() {
  const value = useCanvasSize(ref, false);
  useLayoutEffect(() => { size = value; });
  return null;
}
async function resize(width: number, height: number) {
  await act(async () => { callback([{ contentRect: { width, height } } as ResizeObserverEntry], {} as ResizeObserver); });
}
async function frame() {
  await act(async () => { vi.advanceTimersByTime(16); });
}
beforeEach(async () => {
  vi.useFakeTimers();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => setTimeout(() => fn(0), 16));
  vi.stubGlobal('cancelAnimationFrame', clearTimeout);
  vi.stubGlobal('ResizeObserver', class {
    constructor(fn: ResizeObserverCallback) { callback = fn; }
    observe() {}
    disconnect() {}
  });
  const onError = (error: unknown) => { throw error; };
  root = KonvaRenderer.createContainer({}, 1, null, false, null, '', onError, onError, onError, () => {}, null);
  await act(async () => { KonvaRenderer.updateContainer(createElement(Probe), root, null); });
});
afterEach(async () => {
  await act(async () => { KonvaRenderer.updateContainer(null, root, null); });
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('war-map canvas sizing', () => {
  it('never passes a positive subpixel measurement that becomes a zero-pixel canvas', async () => {
    // Browser canvas width/height IDL attributes truncate positive fractional pixels.
    class CanvasBoundary {
      style = {};
      private w = 0;
      private h = 0;
      get width() { return this.w; }
      set width(value: number) { this.w = Math.trunc(value); }
      get height() { return this.h; }
      set height(value: number) { this.h = Math.trunc(value); }
      getContext() { return { scale: () => {} }; }
    }
    vi.stubGlobal('document', { createElement: () => new CanvasBoundary() });
    await resize(0.4, 500);
    await frame();
    const buffer = new SceneCanvas({ ...size, pixelRatio: 1 });
    expect(buffer._canvas.width).toBeGreaterThan(0);
    expect(buffer._canvas.height).toBeGreaterThan(0);
  });

  it('retains the last drawable size while its panel is hidden', async () => {
    await resize(360, 640);
    await frame();
    await resize(0, 0);
    await frame();
    expect(size).toEqual({ width: 360, height: 640 });
  });

  it('cancels pending work and ignores late observer callbacks after unmount', async () => {
    const cancel = vi.spyOn(globalThis, 'cancelAnimationFrame');
    await resize(360, 640);
    await act(async () => { KonvaRenderer.updateContainer(null, root, null); });
    expect(cancel).toHaveBeenCalledOnce();
    await resize(800, 600);
    await frame();
    expect(size).toEqual({ width: 1000, height: 800 });
  });

  it('coalesces fractional measurements and updates outside ResizeObserver delivery', async () => {
    await resize(360.2, 640.9);
    await resize(361.8, 641.1);
    expect(size).toEqual({ width: 1000, height: 800 });
    await frame();
    expect(size).toEqual({ width: 361, height: 641 });
    const accepted = size;
    await resize(361.1, 641.9);
    await frame();
    expect(size).toBe(accepted);
  });
});
