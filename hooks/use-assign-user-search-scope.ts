import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  getOfficeCompanies,
  getOffices,
  type Company,
  type Office,
  type SearchUsersForAssignOptions,
} from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

export type AssignUserSearchScope = 'company' | 'office';

function hasClientCompany(companyId: number | null | undefined): boolean {
  return companyId != null && Number.isFinite(Number(companyId)) && Number(companyId) > 0;
}

export function useAssignUserSearchScope() {
  const role = useAuthStore((s) => s.role);
  const user = useAuthStore((s) => s.user);

  const actorCompanyId = user?.company_id ?? null;
  const actorOfficeId = user?.office_id ?? null;

  const [scope, setScope] = useState<AssignUserSearchScope>(() =>
    hasClientCompany(actorCompanyId) ? 'company' : 'office'
  );
  const [officeFilterId, setOfficeFilterId] = useState<number | null>(null);
  const [companyFilterId, setCompanyFilterId] = useState<number | null>(null);
  const [offices, setOffices] = useState<Office[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);

  const canToggleScope = role === 'client' && hasClientCompany(actorCompanyId);
  const showCompanyPills = role === 'department-head';
  const showOfficePills = role === 'admin-worker';
  const showAdminCompanyPills =
    role === 'admin-worker' && officeFilterId != null && companies.length > 0;

  const loadOffices = useCallback(async () => {
    if (role !== 'admin-worker') return;
    const list = await getOffices();
    setOffices(list);
  }, [role]);

  const loadCompaniesForOffice = useCallback(async (officeId: number) => {
    const res = await getOfficeCompanies(officeId);
    setCompanies(res.ok ? res.data : []);
  }, []);

  useEffect(() => {
    if (role === 'admin-worker') {
      void loadOffices();
    }
  }, [role, loadOffices]);

  useEffect(() => {
    if (role === 'department-head' && actorOfficeId != null) {
      void loadCompaniesForOffice(actorOfficeId);
      return;
    }
    if (role === 'admin-worker' && officeFilterId != null) {
      void loadCompaniesForOffice(officeFilterId);
      return;
    }
    if (role === 'admin-worker') {
      setCompanies([]);
    }
  }, [role, actorOfficeId, officeFilterId, loadCompaniesForOffice]);

  const selectOfficeFilter = useCallback((officeId: number | null) => {
    setOfficeFilterId(officeId);
    setCompanyFilterId(null);
  }, []);

  const selectCompanyFilter = useCallback((companyId: number | null) => {
    setCompanyFilterId(companyId);
  }, []);

  const selectScope = useCallback((next: AssignUserSearchScope) => {
    setScope(next);
  }, []);

  const searchOptions = useMemo((): SearchUsersForAssignOptions => {
    if (role === 'admin-worker') {
      return {
        officeId: officeFilterId ?? undefined,
        companyId: companyFilterId ?? undefined,
      };
    }
    if (role === 'department-head') {
      return {
        companyId: companyFilterId ?? undefined,
      };
    }
    if (canToggleScope) {
      return { scope };
    }
    return {};
  }, [role, scope, officeFilterId, companyFilterId, canToggleScope]);

  return {
    role,
    scope,
    setScope: selectScope,
    canToggleScope,
    showCompanyPills,
    showOfficePills,
    showAdminCompanyPills,
    offices,
    companies,
    officeFilterId,
    companyFilterId,
    selectOfficeFilter,
    selectCompanyFilter,
    searchOptions,
  };
}
