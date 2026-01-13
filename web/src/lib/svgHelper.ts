// web/src/lib/svgHelper.ts
import React from 'react'; // Import React
import ReactDOMServer from 'react-dom/server';

export function svgToDataUrl<P extends object>(
  SvgComponent: React.ComponentType<P> | React.ElementType,
  props?: P,
  size: number = 24,
  color: string = 'white'
): string {
  const elementProps = { size, color, ...(props || {}) } as P & { size?: number; color?: string };
  const svgString = ReactDOMServer.renderToStaticMarkup(
    React.createElement(SvgComponent, elementProps)
  );
  const encodedSvg = encodeURIComponent(svgString);
  return `data:image/svg+xml;charset=utf-8,${encodedSvg}`;
}