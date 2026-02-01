'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, setOrganizacionId } from '../servicios/api';
import { useAuth } from './auth';

type OrgLite = { id: string; nombre: string };

type OrgSelectorContextType = {
  organizaciones: OrgLite[];
  selectedOrgId: string | null;
  setSelectedOrgId: (id: string | null) => void;
  loading: boolean;
  refresh: () => Promise<void>;
};

const OrgSelectorContext = createContext<OrgSelectorContextType | undefined>(undefined);

export function OrgSelectorProvider({ children }: { children: React.ReactNode }) {
  const { usuario } = useAuth();
  const [organizaciones, setOrganizaciones] = useState<OrgLite[]>([]);
  const [selectedOrgId, setSelectedOrgIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const data = await api<OrgLite[]>('/organizaciones');
      setOrganizaciones(Array.isArray(data) ? data : []);
    } catch {
      setOrganizaciones([]);
    }
  }, []);

  useEffect(() => {
    if (usuario?.roles?.includes('SUPERADMIN')) {
      setLoading(true);
      refresh().finally(() => setLoading(false));
    }
  }, [usuario?.roles, refresh]);

  const setSelectedOrgId = useCallback((id: string | null) => {
    setSelectedOrgIdState(id);
    const targetId = id || usuario?.organizacionId || '';
    if (targetId) setOrganizacionId(targetId);
  }, [usuario?.organizacionId]);

  const value = useMemo(() => ({
    organizaciones,
    selectedOrgId,
    setSelectedOrgId,
    loading,
    refresh,
  }), [organizaciones, selectedOrgId, setSelectedOrgId, loading, refresh]);

  return (
    <OrgSelectorContext.Provider value={value}>
      {children}
    </OrgSelectorContext.Provider>
  );
}

export function useOrgSelector() {
  const ctx = useContext(OrgSelectorContext);
  return ctx;
}
