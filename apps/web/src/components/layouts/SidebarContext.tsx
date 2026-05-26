'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

type SidebarCtx = {
  isOpen: boolean;
  isCollapsed: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  toggleCollapsed: () => void;
};

const SidebarContext = createContext<SidebarCtx>({
  isOpen: false,
  isCollapsed: false,
  open: () => {},
  close: () => {},
  toggle: () => {},
  toggleCollapsed: () => {},
});

export function useSidebar() {
  return useContext(SidebarContext);
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((p) => !p), []);
  const toggleCollapsed = useCallback(() => setIsCollapsed((p) => !p), []);

  useEffect(() => {
    setIsCollapsed(window.localStorage.getItem('lumibach-sidebar-collapsed') === 'true');
  }, []);

  useEffect(() => {
    window.localStorage.setItem('lumibach-sidebar-collapsed', String(isCollapsed));
  }, [isCollapsed]);

  return (
    <SidebarContext.Provider value={{ isOpen, isCollapsed, open, close, toggle, toggleCollapsed }}>
      {children}
    </SidebarContext.Provider>
  );
}
