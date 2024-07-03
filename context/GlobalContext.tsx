// @ts-nocheck
"use client"

import React, { createContext, useContext, useState } from 'react';

const GlobalStateContext = createContext();

export const GlobalStateProvider: React.FC = ({ children }) => {
  const [selectedPdfUrl, setSelectedPdfUrl] = useState(null);

  return (
    <GlobalStateContext.Provider value={{ selectedPdfUrl, setSelectedPdfUrl }}>
      {children}
    </GlobalStateContext.Provider>
  );
};

export const useGlobalState = () => {
  return useContext(GlobalStateContext);
};
