// web/src/lib/svgHelper.ts
import React from 'react'; // Import React
import ReactDOMServer from 'react-dom/server';

export async function svgToDataUrl(SvgComponent: React.ElementType, props?: any, size: number = 24, color: string = 'white'): Promise<string> {
  const svgString = ReactDOMServer.renderToStaticMarkup(
    React.createElement(SvgComponent, { size, color, ...props })
  );
  const encodedSvg = encodeURIComponent(svgString);
  return `data:image/svg+xml;charset=utf-8,${encodedSvg}`;
}