import React, { createContext, useContext, useState, ReactNode } from 'react';

interface AnalysisContextType {
  smartLandData: {
    landDetails: any;
    report: string;
    hasResult: boolean;
    selectedAddress: any;
  } | null;
  setSmartLandData: (data: any) => void;
  regulationData: {
    data: any;
    insight: string;
  } | null;
  setRegulationData: (data: any) => void;
  riskData: {
    data: any;
    insight: string;
  } | null;
  setRiskData: (data: any) => void;
}

const AnalysisContext = createContext<AnalysisContextType | undefined>(undefined);

export const AnalysisProvider = ({ children }: { children: ReactNode }) => {
  const [smartLandData, setSmartLandData] = useState<any>(null);
  const [regulationData, setRegulationData] = useState<any>(null);
  const [riskData, setRiskData] = useState<any>(null);

  return (
    <AnalysisContext.Provider value={{
      smartLandData,
      setSmartLandData,
      regulationData,
      setRegulationData,
      riskData,
      setRiskData
    }}>
      {children}
    </AnalysisContext.Provider>
  );
};

export const useAnalysis = () => {
  const context = useContext(AnalysisContext);
  if (context === undefined) {
    throw new Error('useAnalysis must be used within an AnalysisProvider');
  }
  return context;
};
