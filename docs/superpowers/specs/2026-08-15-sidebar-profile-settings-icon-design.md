# Sidebar Profile Settings Icon Design

## Problem

The expanded sidebar profile/settings trigger renders `ExpandMoreIcon`. The trigger opens the
profile menu and does not expand inline content, so a reverse caret communicates the wrong action.

## Design

Use the existing semantic `SettingsIcon` export in the footer trigger. Preserve the avatar, user
name, button label, click handler, responsive collapse behavior, size, color, and focus/hover states.
Do not change the profile menu or introduce another icon dependency.

## Regression Contract

The interaction audit must assert that the sidebar imports and renders `SettingsIcon` in the footer
and no longer imports or renders `ExpandMoreIcon` there. Browser verification must cover the
expanded sidebar trigger and confirm that opening and closing the profile menu still works.

## Scope

Only the sidebar footer icon and its regression assertion are in scope. No Phase 2 sidebar redesign,
menu restructuring, or data mutation is authorized.
