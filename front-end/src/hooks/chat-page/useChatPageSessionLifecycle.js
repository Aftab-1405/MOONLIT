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

export function useChatPageSessionLifecycle({ isDbConnected, connectionPersistenceMinutes }) {
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
      }).catch(() => { });
    };

    window.addEventListener('beforeunload', handleTabClose);
    window.addEventListener('pagehide', handleTabClose);

    return () => {
      window.removeEventListener('beforeunload', handleTabClose);
      window.removeEventListener('pagehide', handleTabClose);
    };
  }, [isDbConnected, connectionPersistenceMinutes]);

  useEffect(() => {
    if (!isDbConnected) return;

    const ping = () => {
      const sessionInstanceId = readSessionInstanceId();
      sessionActive(sessionInstanceId).catch(() => { });
    };

    const timerId = setInterval(ping, 15000);
    return () => {
      clearInterval(timerId);
    };
  }, [isDbConnected]);
}
