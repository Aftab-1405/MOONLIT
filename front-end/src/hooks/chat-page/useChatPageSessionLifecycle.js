import { useEffect, useLayoutEffect } from 'react';
import { sessionActive, USER } from '@/api';

const readSessionInstanceId = () => {
  try {
    return sessionStorage.getItem('moonlit-session-instance-id');
  } catch {
    return null;
  }
};

const readCsrfToken = () => {
  try {
    const prefix = 'csrf_token=';
    const cookie = document.cookie
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(prefix));
    return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null;
  } catch {
    return null;
  }
};

export function useChatPageSessionLifecycle({
  isDbConnected,
  connectionPersistenceMinutes,
  onVisibilityRestored,
}) {
  useEffect(() => {
    document.title = 'Moonlit - Chat';
  }, []);

  useLayoutEffect(() => {
    const htmlEl = document.documentElement;
    const bodyEl = document.body;
    const rootEl = document.getElementById('root');
    const prevHtmlOverflow = htmlEl.style.overflow;
    const prevBodyOverflow = bodyEl.style.overflow;
    const prevRootOverflow = rootEl?.style.overflow;

    htmlEl.style.overflow = 'hidden';
    bodyEl.style.overflow = 'hidden';
    if (rootEl) rootEl.style.overflow = 'hidden';

    return () => {
      htmlEl.style.overflow = prevHtmlOverflow;
      bodyEl.style.overflow = prevBodyOverflow;
      if (rootEl) rootEl.style.overflow = prevRootOverflow || '';
    };
  }, []);

  useEffect(() => {
    let closeSent = false;

    const handleTabClose = () => {
      if (!isDbConnected || closeSent) return;
      closeSent = true;
      const sessionInstanceId = readSessionInstanceId();
      const payload = { connectionPersistenceMinutes, sessionInstanceId };
      const body = JSON.stringify(payload);

      const closeUrl = `${window.location.origin}${USER.SESSION_CLOSE}`;
      const csrfToken = readCsrfToken();
      const headers = { 'Content-Type': 'application/json' };
      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken;
      }

      void fetch(closeUrl, {
        method: 'POST',
        credentials: 'include',
        keepalive: true,
        headers,
        body,
      }).catch(() => {});
    };

    window.addEventListener('beforeunload', handleTabClose);
    window.addEventListener('pagehide', handleTabClose);

    return () => {
      window.removeEventListener('beforeunload', handleTabClose);
      window.removeEventListener('pagehide', handleTabClose);
    };
  }, [isDbConnected, connectionPersistenceMinutes]);

  // ── Heartbeat + visibility-change re-sync ───────────────────────────────
  //
  // The heartbeat runs every 15 seconds while the tab is visible. When the
  // tab is hidden (user switched to another tab/app), browsers throttle
  // setInterval — Chrome to once per minute after 5 min, mobile Safari may
  // suspend entirely. When the tab becomes visible again, we:
  //
  //   1. Immediately send a heartbeat to update `session_active_at`.
  //   2. Re-sync the connection state by invalidating the `dbStatus` query
  //      and re-fetching. This ensures the frontend's `isConnected` flag
  //      matches the backend's actual state, in case the backend's implicit-
  //      close fallback fired during the throttle period.
  //
  // This prevents the "auto-disconnect while tab is open" bug where the
  // backend's grace period expired due to throttled heartbeats, and the
  // frontend continued showing "disconnected" until a manual page refresh.
  useEffect(() => {
    if (!isDbConnected) return;

    const sendHeartbeat = () => {
      const sessionInstanceId = readSessionInstanceId();
      sessionActive(sessionInstanceId).catch(() => {});
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Tab is back in focus — immediately heartbeat to update
        // `session_active_at` on the backend, then re-sync the connection
        // state via the DatabaseContext's `refreshStatus` method.
        sendHeartbeat();
        // `onVisibilityRestored` is `DatabaseContext.refreshStatus` — it
        // invalidates the `dbStatus` query, re-fetches `syncConnectionState`,
        // and dispatches `SYNC_STATUS` so the UI matches the backend's
        // actual state. This is the same call that runs on page mount.
        onVisibilityRestored?.();
      }
    };

    // Periodic heartbeat while tab is visible.
    const timerId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        sendHeartbeat();
      }
      // If tab is hidden, skip the heartbeat — the browser is throttling
      // us anyway, and we'll catch up on visibility change.
    }, 15000);

    // Re-sync when the tab becomes visible again.
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Also re-sync on window focus (covers cases where visibilitychange
    // doesn't fire, e.g., clicking back to the window from another app
    // on some Linux WMs).
    window.addEventListener('focus', handleVisibilityChange);

    return () => {
      clearInterval(timerId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
    };
  }, [isDbConnected, onVisibilityRestored]);
}
