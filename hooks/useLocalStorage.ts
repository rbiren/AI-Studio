
import React, { useState, useEffect } from 'react';

const sanitizeForStorage = (key: string, value: any) => {
  if (key !== 'rvDesignerChats' || !Array.isArray(value)) {
    return value;
  }
  
  // Deep copy to avoid mutating the in-memory React state
  const copy = JSON.parse(JSON.stringify(value));

  copy.forEach((chat: any) => {
    if (chat.messages && Array.isArray(chat.messages)) {
      chat.messages.forEach((message: any) => {
        if (message.images && Array.isArray(message.images)) {
          message.images.forEach((image: any) => {
            delete image.data; // Remove the large base64 string before storing
          });
        }
      });
    }
  });
  return copy;
};

export function useLocalStorage<T,>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      // Keep the full data in memory for the current session
      setStoredValue(valueToStore);
      
      // Save a sanitized version (without image data) to localStorage
      const sanitizedValue = sanitizeForStorage(key, valueToStore);
      window.localStorage.setItem(key, JSON.stringify(sanitizedValue));
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key) {
        try {
          setStoredValue(e.newValue ? JSON.parse(e.newValue) : initialValue);
        } catch (error) {
          console.error(error);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [key, initialValue]);

  return [storedValue, setValue];
}
