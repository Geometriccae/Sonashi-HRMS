import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const SidebarContext = createContext();
const COLLAPSED_KEY = 'sidebarCollapsed';
const MOBILE_BREAKPOINT = 991;

const readCollapsed = () => {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
};

export const SidebarProvider = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(readCollapsed);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_KEY, String(isCollapsed));
    } catch {
      /* ignore */
    }
  }, [isCollapsed]);

  const isMobileView = () =>
    typeof window !== 'undefined' && window.innerWidth <= MOBILE_BREAKPOINT;

  const toggleSidebar = useCallback(() => {
    if (isMobileView()) {
      setIsOpen((prev) => !prev);
    } else {
      setIsCollapsed((prev) => !prev);
    }
  }, []);

  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => !prev);
  }, []);

  const closeSidebar = useCallback(() => {
    setIsOpen(false);
  }, []);

  const expandSidebar = useCallback(() => {
    setIsCollapsed(false);
  }, []);

  const collapseSidebar = useCallback(() => {
    setIsCollapsed(true);
  }, []);

  return (
    <SidebarContext.Provider
      value={{
        isOpen,
        isCollapsed,
        toggleSidebar,
        toggleCollapse,
        closeSidebar,
        expandSidebar,
        collapseSidebar,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
};

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error('useSidebar must be used within a SidebarProvider');
  }
  return context;
};
