/**
 * useUiActionDispatcher Hook
 *
 * Accepts a map of named handler callbacks and returns a stable dispatch function.
 * Calling dispatch(event) with a ui_action event routes to the matching handler.
 * Unknown actions are ignored with a console warning.
 * Handler errors are caught and logged without propagating.
 * Events received before handlers are registered are queued and drained on first dispatch.
 *
 * @module hooks/useUiActionDispatcher
 */

import { useCallback, useEffect, useRef } from 'react';
import { UI_ACTIONS } from '../../config/uiActions';

const DEDUPE_WINDOW_MS = 1500;

function getEventKey(action, payload) {
  return `${action}:${JSON.stringify(payload || {})}`;
}

function report(action, status, detail) {
  if (import.meta.env.DEV) {
    const method = status === 'error' ? 'warn' : 'debug';
    console[method]?.('[useUiActionDispatcher]', action, status, detail || '');
  }
}

function normalizePayload(event) {
  return event?.payload && typeof event.payload === 'object' ? event.payload : {};
}

function hasRegisteredHandler(handlers) {
  return Object.keys(UI_ACTIONS).some((action) => typeof handlers?.[action] === 'function');
}

/**
 * Pure dispatch factory — contains all routing logic and is testable without React.
 *
 * @param {() => object} getHandlers - Function that returns the current handlers map
 * @param {{ current: Array }} pendingQueueRef - Ref holding the pending event queue
 * @returns {(event: object) => void} dispatch function
 */
export function createUiActionDispatch(getHandlers, pendingQueueRef) {
  return function dispatch(event) {
    const handlers = getHandlers();
    const hasHandlers = hasRegisteredHandler(handlers);

    // Queue event if no handlers are registered yet
    if (!hasHandlers) {
      pendingQueueRef.current.push(event);
      return;
    }

    // Drain any pending queue first (before processing the current event)
    if (pendingQueueRef.current.length > 0) {
      const queue = pendingQueueRef.current.splice(0);
      queue.forEach((queuedEvent) => dispatch(queuedEvent));
    }

    const { action } = event;
    const payload = normalizePayload(event);

    // Ignore unknown actions
    const actionConfig = UI_ACTIONS[action];
    if (!actionConfig) {
      report(action, 'error', 'Unknown action. Ignoring.');
      return;
    }

    const handler = handlers[action];
    if (!handler) {
      report(action, 'error', 'No handler registered. Ignoring.');
      return;
    }

    const validation = actionConfig.validate?.({ payload, event }) || { ok: true, payload };
    if (!validation.ok) {
      report(action, 'error', validation.reason || 'Invalid payload. Ignoring.');
      handlers.onInvalidAction?.({ action, payload, reason: validation.reason });
      return;
    }

    const effectivePayload = validation.payload || {};
    const eventKey = getEventKey(action, effectivePayload);
    const now = Date.now();
    const seenRef = handlers.__seenActionsRef;
    if (seenRef?.current) {
      const lastSeenAt = seenRef.current.get(eventKey);
      if (lastSeenAt && now - lastSeenAt < DEDUPE_WINDOW_MS) {
        report(action, 'deduped');
        return;
      }
      seenRef.current.set(eventKey, now);
    }

    try {
      handler(effectivePayload);
      handlers.onActionTelemetry?.({ action, payload: effectivePayload, status: 'success' });
      report(action, 'success');
    } catch (err) {
      handlers.onActionTelemetry?.({ action, payload: effectivePayload, status: 'error', error: err });
      report(action, 'error', err);
    }
  };
}

/**
 * React hook wrapper for createUiActionDispatch.
 *
 * @param {object} handlers - Map of action names to handler callbacks
 * @returns {(event: object) => void} Stable dispatch function
 */
export function useUiActionDispatcher(handlers) {
  const handlersRef = useRef({});
  const seenActionsRef = useRef(new Map());
  const pendingQueueRef = useRef([]);
  const dispatch = useCallback((event) => {
    createUiActionDispatch(() => handlersRef.current, pendingQueueRef)(event);
  }, []);

  useEffect(() => {
    handlersRef.current = { ...handlers, __seenActionsRef: seenActionsRef };

    if (hasRegisteredHandler(handlers) && pendingQueueRef.current.length > 0) {
      const queue = pendingQueueRef.current.splice(0);
      queue.forEach((event) => dispatch(event));
    }
  }, [dispatch, handlers]);

  return dispatch;
}
