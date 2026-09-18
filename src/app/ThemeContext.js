'use client';

import { createContext, useContext, useState, useEffect } from 'react';

const themes = {
  dark: {
    mode: 'dark',

    // Main backgrounds
    bgPage: '#050a0e',
    bgCard: '#0d1a22',
    bgInput: '#071014',
    bg: '#050a0e',
    bg2: '#071018',

    // Borders
    border: '#0d2030',
    borderStrong: '#0d2d40',

    // Text
    text: '#cccccc',
    textStrong: '#ffffff',
    textMuted: '#3a5060',
    textFaint: '#1e3040',

    // Accent
    accent: '#00e5ff',
    accentBg: 'rgba(0,229,255,.08)',
    accentBorder: 'rgba(0,229,255,.35)',

    // Status
    danger: '#ff6b6b',
    dangerMuted: 'rgba(255,76,76,.5)',

    // Toggle
    toggleOff: '#1a2a34',
    toggleOffBorder: '#1a2d3a',
    toggleKnobOff: '#3a5060',

    // Legacy CSS variables
    admCyan: '#00e5ff',
    admText: '#ffffff',
    admText2: '#cccccc',
    admText3: '#3a5060',
    admText4: '#4c6374',
  },

  light: {
    mode: 'light',

    // Main backgrounds
    bgPage: '#f4f7f9',
    bgCard: '#ffffff',
    bgInput: '#f0f4f6',
    bg: '#f4f7f9',
    bg2: '#ffffff',

    // Borders
    border: '#e2e8ed',
    borderStrong: '#d3e4ea',

    // Text
    text: '#2b3944',
    textStrong: '#0d1a22',
    textMuted: '#6b7c87',
    textFaint: '#b7c4cc',

    // Accent
    accent: '#0090a8',
    accentBg: 'rgba(0,144,168,.08)',
    accentBorder: 'rgba(0,144,168,.35)',

    // Status
    danger: '#d94848',
    dangerMuted: 'rgba(217,72,72,.5)',

    // Toggle
    toggleOff: '#dde5e9',
    toggleOffBorder: '#c9d4da',
    toggleKnobOff: '#8ea0aa',

    // Legacy CSS variables
    admCyan: '#0090a8',
    admText: '#0d1a22',
    admText2: '#2b3944',
    admText3: '#6b7c87',
    admText4: '#8695a0',
  },
};

const ThemeContext = createContext({
  theme: themes.dark,
  mode: 'dark',
  toggleMode: () => {},
});

export function ThemeProvider({ children, defaultMode = 'dark' }) {
  const [mode, setMode] = useState(defaultMode);

  const toggleMode = () => {
    setMode(current =>
      current === 'dark' ? 'light' : 'dark'
    );
  };

  const theme = themes[mode];

  useEffect(() => {
    const root = document.documentElement;

    // Main background variables
    root.style.setProperty('--adm-bg', theme.bgPage);
    root.style.setProperty('--adm-bg2', theme.bg2);
    root.style.setProperty('--adm-card', theme.bgCard);
    root.style.setProperty('--adm-input', theme.bgInput);

    // Border variables
    root.style.setProperty('--adm-border', theme.border);
    root.style.setProperty(
      '--adm-border-strong',
      theme.borderStrong
    );

    // Text / accent variables
    root.style.setProperty('--adm-cyan', theme.admCyan);
    root.style.setProperty('--adm-text', theme.admText);
    root.style.setProperty('--adm-text2', theme.admText2);
    root.style.setProperty('--adm-text3', theme.admText3);
    root.style.setProperty('--adm-text4', theme.admText4);

    // Optional status variables
    root.style.setProperty('--adm-danger', theme.danger);

    // Keep browser UI colors consistent
    root.style.setProperty('color-scheme', mode);
  }, [mode, theme]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        mode,
        toggleMode,
      }}
    >
      <div
        style={{
          background: theme.bgPage,
          color: theme.text,
          minHeight: '100vh',
          transition: 'background .2s, color .2s',
        }}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}