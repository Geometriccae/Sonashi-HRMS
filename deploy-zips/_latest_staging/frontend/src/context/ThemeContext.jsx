import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

const THEME_KEY = 'sonashi_theme';
const FONT_KEY = 'sonashi_font';
const SIZE_KEY = 'sonashi_size';

export const ThemeProvider = ({ children }) => {
  // Default values
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'classic');
  const [fontFamily, setFontFamily] = useState(() => localStorage.getItem(FONT_KEY) || 'inter');
  const [fontSize, setFontSize] = useState(() => localStorage.getItem(SIZE_KEY) || 'm');

  useEffect(() => {
    localStorage.setItem(THEME_KEY, theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(FONT_KEY, fontFamily);
    document.documentElement.setAttribute('data-font', fontFamily);
  }, [fontFamily]);

  useEffect(() => {
    localStorage.setItem(SIZE_KEY, fontSize);
    document.documentElement.setAttribute('data-size', fontSize);
  }, [fontSize]);

  return (
    <ThemeContext.Provider value={{
      theme, setTheme,
      fontFamily, setFontFamily,
      fontSize, setFontSize
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
