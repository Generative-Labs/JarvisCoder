import React, { createContext, useContext } from "react";
import { VSCodeAPI } from "../chat";

// Ensure vscode API is available

interface VSCodeContextType {
  vscode: VSCodeAPI;
}

const VSCodeContext = createContext<VSCodeContextType | undefined>(undefined);

export const VSCodeProvider: React.FC<{
  children: React.ReactNode;
  vscode: VSCodeAPI;
}> = ({ children, vscode }) => {
  return (
    <VSCodeContext.Provider value={{ vscode }}>
      {children}
    </VSCodeContext.Provider>
  );
};

export const useVSCode = (): VSCodeContextType => {
  const context = useContext(VSCodeContext);
  if (context === undefined) {
    throw new Error("useVSCode must be used within a VSCodeProvider");
  }
  return context;
};
