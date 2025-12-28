# useLocalStorage Hook Documentation

## Overview

`useLocalStorage` is a custom React hook that provides reactive, type-safe access to `localStorage` with automatic cross-tab synchronization.

| Property | Value |
|----------|-------|
| **File Location** | `src/hooks/useLocalStorage.js` |
| **Lines of Code** | 199 |
| **Dependencies** | None (React only) |
| **Integrated With** | `SettingsContext.jsx`, `DatabaseModal.jsx` |

---

## API Reference

### Signature

```jsx
const [value, setValue, removeValue] = useLocalStorage(key, initialValue);
```

### Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `key` | `string` | localStorage key name |
| `initialValue` | `any` | Default value if key doesn't exist |

### Returns

| Index | Name | Type | Description |
|-------|------|------|-------------|
| 0 | `value` | `T` | Current stored value |
| 1 | `setValue` | `(value \| (prev) => value)` | Update function (like useState) |
| 2 | `removeValue` | `() => void` | Clears key and resets to initial |

---

## Features

| Feature | Description |
|---------|-------------|
| **Cross-Tab Sync** | Changes in one tab auto-update all other tabs |
| **Type Preservation** | Objects, arrays, booleans retain their type |
| **Error Handling** | Graceful handling of quota exceeded and JSON parse errors |
| **SSR Safe** | Won't crash in non-browser environments |
| **Functional Updates** | Supports `setValue(prev => !prev)` pattern |

---

## Integration with Frontend UI

### Current Usage

| Consumer | Key | Purpose |
|----------|-----|---------|
| `SettingsContext.jsx` | `moonlit-settings` | All user preferences |
| `DatabaseModal.jsx` | `moonlit-saved-connection` | Remember connection details |

### Settings Synced Across Tabs

| Setting | UI Location | Effect of Cross-Tab Sync |
|---------|-------------|--------------------------|
| `theme` | Settings → Appearance | Dark/light mode updates instantly |
| `idleAnimation` | Settings → Appearance | Starfield animation toggles |
| `confirmBeforeRun` | Settings → AI | Query confirmation dialog setting |
| `queryTimeout` | Settings → AI | Timeout value applies |
| `maxRows` | Settings → AI | Row limit applies |
| `nullDisplay` | Settings → AI | NULL display format updates |
| `defaultDbType` | Settings → Database | Default DB type in modal |
| `connectionPersistence` | Settings → Database | Persistence timeout applies |
| `enableReasoning` | Settings → AI | AI reasoning toggle |
| `reasoningEffort` | Settings → AI | Reasoning level applies |

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser Tab 1                            │
│  ┌─────────────┐    ┌──────────────────┐    ┌───────────────┐  │
│  │ Settings UI │───▶│ SettingsContext  │───▶│ useLocalStorage│  │
│  └─────────────┘    └──────────────────┘    └───────┬───────┘  │
│                                                      │          │
│                                                      ▼          │
│                                              ┌──────────────┐   │
│                                              │ localStorage │   │
│                                              └──────┬───────┘   │
└─────────────────────────────────────────────────────┼───────────┘
                                                      │
                                     storage event    │
                                                      ▼
┌─────────────────────────────────────────────────────┼───────────┐
│                        Browser Tab 2                │           │
│  ┌───────────────┐    ┌──────────────────┐    ┌─────┴─────────┐ │
│  │ useLocalStorage│◀───│ storage listener │◀───│ storage event │ │
│  └───────┬───────┘    └──────────────────┘    └───────────────┘ │
│          │                                                       │
│          ▼                                                       │
│  ┌──────────────────┐    ┌─────────────┐                        │
│  │ SettingsContext  │───▶│ Settings UI │  (auto-updates!)       │
│  └──────────────────┘    └─────────────┘                        │
└──────────────────────────────────────────────────────────────────┘
```

---

## Usage Examples

### Basic Usage

```jsx
import { useLocalStorage } from '../hooks/useLocalStorage';

function MyComponent() {
  const [theme, setTheme] = useLocalStorage('theme', 'dark');
  
  return (
    <button onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}>
      Current: {theme}
    </button>
  );
}
```

### With Object

```jsx
const [user, setUser] = useLocalStorage('user', { name: '', email: '' });

// Update single property
setUser(prev => ({ ...prev, name: 'John' }));
```

### With Remove

```jsx
const [token, setToken, removeToken] = useLocalStorage('auth-token', null);

// On logout
removeToken(); // Clears localStorage and resets to null
```

---

## Testing Scenarios

| # | Scenario | Steps | Expected Result |
|---|----------|-------|-----------------|
| 1 | Theme sync | Change theme in Tab 1 | Tab 2 updates instantly |
| 2 | Settings sync | Toggle any setting in Tab 1 | Tab 2 reflects change |
| 3 | Refresh persistence | Change setting, refresh page | Setting persists |
| 4 | Clear storage | Call `removeValue()` | Key removed, value reset |
| 5 | Invalid JSON | Manually corrupt localStorage | Falls back to default |

---

## Future Expansion Opportunities

| Use Case | Key | Benefit |
|----------|-----|---------|
| Sidebar state | `sidebar-collapsed` | Remember collapsed state |
| Draft messages | `draft-message` | Preserve unsent messages |
| Recent queries | `recent-queries` | Quick access to past SQL |
| Last conversation | `last-conversation-id` | Resume where left off |
