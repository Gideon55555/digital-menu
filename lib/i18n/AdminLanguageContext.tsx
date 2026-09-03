'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { AdminLanguage, adminTranslations, AdminTranslations } from './admin-translations';

interface AdminLanguageContextType {
  language: AdminLanguage;
  setLanguage: (lang: AdminLanguage) => void;
  t: AdminTranslations;
}

const AdminLanguageContext = createContext<AdminLanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  t: adminTranslations.en,
});

export function AdminLanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<AdminLanguage>('en');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('admin_language') as AdminLanguage | null;
      if (saved === 'am' || saved === 'en') {
        setLanguageState(saved);
      }
    } catch (e) {
      // ignore
    }

    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'admin_language' && (e.newValue === 'am' || e.newValue === 'en')) {
        setLanguageState(e.newValue);
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const setLanguage = (newLang: AdminLanguage) => {
    setLanguageState(newLang);
    try {
      localStorage.setItem('admin_language', newLang);
      window.dispatchEvent(new CustomEvent('admin_language_change', { detail: newLang }));
    } catch (e) {
      // ignore
    }
  };

  const t = adminTranslations[language] || adminTranslations.en;

  return (
    <AdminLanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </AdminLanguageContext.Provider>
  );
}

export function useAdminLanguage() {
  return useContext(AdminLanguageContext);
}
