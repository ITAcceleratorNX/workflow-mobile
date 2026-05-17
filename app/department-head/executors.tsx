import { Redirect } from 'expo-router';

/** @deprecated Используйте /department-head/users */
export default function DepartmentHeadExecutorsRedirect() {
  return <Redirect href="/department-head/users" />;
}
