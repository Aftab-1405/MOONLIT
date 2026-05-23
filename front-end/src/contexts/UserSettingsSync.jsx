/**
 * Loads account settings from the server on login and debounces saves on change.
 * @module UserSettingsSync
 */

import { useEffect, useRef } from 'react';
import { getUserSettings, saveUserSettings } from '@/api';
import {
  mapServerSettingsToClient,
  pickSyncableSettings,
} from '@/config/userSettings';
import { useAuth } from '@/contexts/AuthContext';
import { useSettings } from '@/contexts/SettingsContext';
import logger from '@/utils/logger';

const PERSIST_DEBOUNCE_MS = 700;

export function UserSettingsSync() {
  const { isAuthenticated, loading } = useAuth();
  const { settings, updateSettings } = useSettings();
  const hydratedRef = useRef(false);
  const skipPersistRef = useRef(true);

  useEffect(() => {
    if (!isAuthenticated || loading) {
      hydratedRef.current = false;
      skipPersistRef.current = true;
      return undefined;
    }

    let cancelled = false;

    const load = async () => {
      try {
        const data = await getUserSettings();
        if (cancelled) return;

        const patch = mapServerSettingsToClient(data);
        if (Object.keys(patch).length > 0) {
          updateSettings(patch);
        }
      } catch (error) {
        logger.warn('Failed to load user settings from server:', error);
      } finally {
        if (!cancelled) {
          hydratedRef.current = true;
          skipPersistRef.current = false;
        }
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, loading, updateSettings]);

  useEffect(() => {
    if (!isAuthenticated || loading || !hydratedRef.current || skipPersistRef.current) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      saveUserSettings(pickSyncableSettings(settings)).catch((error) => {
        logger.warn('Failed to save user settings to server:', error);
      });
    }, PERSIST_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [settings, isAuthenticated, loading]);

  return null;
}
