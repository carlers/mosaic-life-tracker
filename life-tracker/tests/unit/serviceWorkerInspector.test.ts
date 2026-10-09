import { describe, expect, it } from 'vitest';
import { inspectServiceWorker } from '../../scripts/lib/inspect-service-worker.mjs';

describe('service worker inspector', () => {
  it('records checked-in supplemental scripts without executing them', async () => {
    const source = String.raw`
      define(["./workbox-deadbeef"], function(workbox) {
        "use strict";
        importScripts("/push-sw.js");
        self.addEventListener("message", (event) => {
          if (event.data && event.data.type === "SKIP_WAITING") {
            self.skipWaiting();
          }
        });
        workbox.precacheAndRoute([{ url: "index.html" }]);
        workbox.registerRoute(
          new workbox.NavigationRoute(
            workbox.createHandlerBoundToURL("index.html"),
            { denylist: [/^\/v1\//, /^\/api\//] }
          )
        );
      });
    `;

    const result = await inspectServiceWorker(source);

    expect(result.importedScripts).toEqual(['/push-sw.js']);
    expect(result.precacheUrls).toEqual(['index.html']);
    expect(result.navigationFallback).toBe('index.html');
    expect(result.skipWaitingOnRequest).toBe(true);
    expect(result.skipWaitingOnUnrelatedMessage).toBe(false);
  });
});
