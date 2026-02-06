---
"cerebro": patch
---

perf(war-planning): optimize map generation speed

-   **MapImageService**: Reduced internal image resize target from 128px to 64px. This reduces the size of embedded base64 images in the SVG by ~75%, significantly speeding up SVG parsing and PNG rendering.
-   **WarPlanDistributor**: Updated champion image fetching to request 64px thumbnails from the source (CDN) instead of 128px, reducing network payload and download time.
