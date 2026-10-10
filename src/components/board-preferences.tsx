"use client";

import { createContext, useContext, useState, type ReactNode } from 'react';

const BoardPreferences = createContext({ axes: true, toggleAxes: () => {} });

export function BoardPreferencesProvider({children}: {children: ReactNode}) {
  const [axes,setAxes] = useState(true);
  return <BoardPreferences.Provider value={{axes,toggleAxes:()=>setAxes(value=>!value)}}>{children}</BoardPreferences.Provider>;
}

export function useBoardPreferences() { return useContext(BoardPreferences); }
