/**
 * offline-banner.js — Shows/hides the amber offline banner
 * based on navigator.onLine and online/offline events.
 */

import { syncPendingRecords } from '../db.js';

export function initOfflineBanner() {
  const banner = document.getElementById('offline-banner');
  if (!banner) return;

  async function update() {
    const isOnline = navigator.onLine;
    banner.hidden = isOnline;

    // Shift page down to make room for the banner
    document.body.style.paddingTop = isOnline ? '' : `${banner.offsetHeight}px`;

    if (isOnline) {
      try {
        const result = await syncPendingRecords();
        if (!result.skipped && (result.pushed || result.conflicts)) {
          document.dispatchEvent(new CustomEvent('salon:sync-complete', { detail: result }));
        }
      } catch (err) {
        console.warn('Sync push failed:', err);
      }
    }
  }

  window.addEventListener('online',  update);
  window.addEventListener('offline', update);
  update(); // set initial state
}
