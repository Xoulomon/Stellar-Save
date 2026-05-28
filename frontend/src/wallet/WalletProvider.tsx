// frontend/src/wallet/WalletProvider.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getAddress } from '@stellar/freighter-api';

interface WalletContextType {
  publicKey: string | null;
  isConnected: boolean;
  loading: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export const WalletProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [loading, setLoading] = useState(false);

  const connect = async () => {
    try {
      setLoading(true);

      const addressObj = await getAddress();
      
      if (addressObj.error) {
        throw new Error(addressObj.error);
      }

      const key = addressObj.address;
      
      setPublicKey(key);
      setIsConnected(true);
      localStorage.setItem('stellarPublicKey', key);
    } catch (error: any) {
      console.error('Failed to connect wallet:', error);
      
      const errorMsg = error?.message || String(error);
      
      if (errorMsg.includes("Freighter") || errorMsg.includes("not found") || errorMsg.includes("extension")) {
        alert("❌ Freighter wallet extension not detected.\n\nPlease install Freighter from the Chrome Web Store and refresh this page.");
      } else {
        alert("Failed to connect wallet. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const disconnect = () => {
    setPublicKey(null);
    setIsConnected(false);
    localStorage.removeItem('stellarPublicKey');
  };

  // Auto-reconnect on page refresh
  useEffect(() => {
    const savedKey = localStorage.getItem('stellarPublicKey');
    if (savedKey) {
      setPublicKey(savedKey);
      setIsConnected(true);
    }
  }, []);

  return (
    <WalletContext.Provider value={{ publicKey, isConnected, loading, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
};

export const useWallet = () => {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
};