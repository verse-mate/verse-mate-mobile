import React, { createContext, useContext, useState } from 'react';
import { Toast } from '@/components/ui/Toast';

interface ToastContextType {
  showToast: (message: string, duration?: number) => void;
  hideToast: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [duration, setDuration] = useState(2000);

  const showToast = (msg: string, dur = 2000) => {
    setMessage(msg);
    setDuration(dur);
    setVisible(true);
  };

  const hideToast = () => {
    setVisible(false);
  };

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      <Toast 
        visible={visible} 
        message={message} 
        duration={duration} 
        onHide={hideToast} 
      />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
