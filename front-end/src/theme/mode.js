export const THEME_STORAGE_KEY = 'moonlit-settings';
export const THEME_ATTRIBUTE = 'data-moonlit-color-scheme';
export const INPUT_MODALITY_ATTRIBUTE = 'data-moonlit-input-modality';
export const CANONICAL_THEME_MODE = 'dark';

export const getEffectiveThemeMode = (_pathname, _preferredMode) => CANONICAL_THEME_MODE;
