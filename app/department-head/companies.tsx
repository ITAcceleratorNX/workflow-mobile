import { CompaniesManagementScreen } from '@/components/companies-management-screen';

/** Управление компаниями только своего офиса (для офис-менеджера). */
export default function DepartmentHeadCompaniesScreen() {
  return <CompaniesManagementScreen variant="department-head" />;
}
