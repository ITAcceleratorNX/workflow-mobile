import { employeeSubtitle, matchesEveryWord } from '@/lib/employee-display';
import {
  recentToSelection,
  type RecentRecipient,
  type RecipientCompany,
  type RecipientDirectory,
  type RecipientSelection,
} from '@/lib/task-recipients-api';

/**
 * Choices of the «Исполнитель» field (Figma «Выбор исполнителя»): the author («Я»), recent
 * recipients and search results — employees, departments, the user's teams and whole companies.
 */

export type RecipientOptionKind = 'user' | 'department' | 'team' | 'company';

export type RecipientOption = {
  /** Unique within the picker: «user:5». */
  key: string;
  kind: RecipientOptionKind;
  title: string;
  subtitle: string | null;
  selection: RecipientSelection;
};

export type RecipientTeam = { id: number; name: string; leader_id: number; members?: { id: number }[] };

export type RecipientSearchResult = {
  users: RecipientOption[];
  departments: RecipientOption[];
  teams: RecipientOption[];
  companies: RecipientOption[];
};

export const RECIPIENT_SECTION_TITLES: Record<RecipientOptionKind, string> = {
  user: 'Сотрудники',
  department: 'Отделы',
  team: 'Команды',
  company: 'Компании',
};

/** «5 сотрудников», «1 сотрудник», «3 сотрудника». */
export function pluralEmployees(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  const word =
    mod10 === 1 && mod100 !== 11 ? 'сотрудник' : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? 'сотрудника' : 'сотрудников';
  return `${count} ${word}`;
}

function teamSize(team: RecipientTeam): number {
  return new Set([team.leader_id, ...(team.members ?? []).map((member) => member.id)]).size;
}

function companyRef(company: RecipientCompany) {
  return { id: company.id, name: company.name };
}

/** Selection keys compare a choice with an option: «users:5», «department:3». */
export function selectionKey(selection: RecipientSelection | null): string {
  if (!selection) return 'self';
  switch (selection.type) {
    case 'users':
      return selection.users.length === 1 ? `user:${selection.users[0].id}` : `users:${selection.users.map((u) => u.id).join(',')}`;
    case 'legacy_user':
      return `user:${selection.user.id}`;
    case 'department':
      return `department:${selection.department.id}`;
    case 'company':
      return `company:${selection.company.id}`;
    case 'team':
      return `team:${selection.team.id}`;
  }
}

/** A «Недавние» row as a picker option. */
export function recentOption(recent: RecentRecipient): RecipientOption {
  const selection = recentToSelection(recent);
  const key = selectionKey(selection);
  switch (recent.type) {
    case 'user':
      return {
        key,
        kind: 'user',
        title: recent.user.full_name,
        subtitle: employeeSubtitle([recent.user.department?.name, recent.user.position]),
        selection,
      };
    case 'department':
      return { key, kind: 'department', title: recent.department.name, subtitle: `Отдел · ${recent.company.name}`, selection };
    case 'company':
      return { key, kind: 'company', title: recent.company.name, subtitle: 'Вся компания', selection };
    case 'team':
      return { key, kind: 'team', title: recent.team.name, subtitle: pluralEmployees(recent.team.members_count), selection };
  }
}

/**
 * Search over the directory and the user's teams. Employees match by name, position or
 * department; the author is left out (they are «Я»). `limit` caps every section.
 */
export function searchRecipients(
  query: string,
  {
    directory,
    teams,
    currentUserId,
    limit = 20,
    includeTeams = true,
  }: {
    directory: RecipientDirectory | null;
    teams: readonly RecipientTeam[];
    currentUserId: number | null;
    limit?: number;
    /** A task cannot be handed over to a team, so the transfer picker leaves them out. */
    includeTeams?: boolean;
  },
): RecipientSearchResult {
  const result: RecipientSearchResult = { users: [], departments: [], teams: [], companies: [] };
  if (!query.trim()) return result;
  const companies = directory ? [directory.my_company, ...directory.available_companies].filter((c): c is RecipientCompany => c != null) : [];
  const several = companies.length > 1;

  for (const company of companies) {
    const departmentName = new Map(company.departments.map((d) => [d.id, d.name]));
    for (const employee of company.employees) {
      if (employee.id === currentUserId || result.users.length >= limit) continue;
      const department = employee.department_id != null ? departmentName.get(employee.department_id) : null;
      if (!matchesEveryWord(query, [employee.full_name, employee.position, department])) continue;
      result.users.push({
        key: `user:${employee.id}`,
        kind: 'user',
        title: employee.full_name,
        subtitle: employeeSubtitle([several ? company.name : null, department, employee.position]),
        selection: { type: 'users', company: companyRef(company), users: [{ id: employee.id, full_name: employee.full_name }] },
      });
    }
    for (const department of company.departments) {
      if (result.departments.length >= limit || !matchesEveryWord(query, [department.name])) continue;
      result.departments.push({
        key: `department:${department.id}`,
        kind: 'department',
        title: department.name,
        subtitle: `Отдел · ${company.name}`,
        selection: { type: 'department', company: companyRef(company), department },
      });
    }
    const whole = company === directory?.my_company || company.whole;
    if (whole && result.companies.length < limit && matchesEveryWord(query, [company.name])) {
      result.companies.push({
        key: `company:${company.id}`,
        kind: 'company',
        title: company.name,
        subtitle: 'Вся компания',
        selection: { type: 'company', company: companyRef(company) },
      });
    }
  }

  if (includeTeams) {
    for (const team of teams) {
      if (result.teams.length >= limit || !matchesEveryWord(query, [team.name])) continue;
      result.teams.push({
        key: `team:${team.id}`,
        kind: 'team',
        title: team.name,
        subtitle: pluralEmployees(teamSize(team)),
        selection: { type: 'team', team: { id: team.id, name: team.name } },
      });
    }
  }
  return result;
}

export function hasResults(result: RecipientSearchResult): boolean {
  return result.users.length + result.departments.length + result.teams.length + result.companies.length > 0;
}

/** `assign` — «Исполнитель» of a new task (with «Я» and teams); `transfer` — «Передать задачу». */
export type RecipientPickerMode = 'assign' | 'transfer';

export type RecipientPickerEntry = {
  key: string;
  kind: RecipientOptionKind | 'self';
  title: string;
  subtitle: string | null;
  /** null — «Я»: the author's own task. */
  selection: RecipientSelection | null;
};

export const SELF_ENTRY: RecipientPickerEntry = { key: 'self', kind: 'self', title: 'Я', subtitle: 'Назначить себе', selection: null };

const SECTION_ORDER: RecipientOptionKind[] = ['user', 'department', 'team', 'company'];

/** Sections of the picker: «Я» and «Недавние» while the query is empty, search results otherwise. */
export function recipientPickerSections(
  query: string,
  mode: RecipientPickerMode,
  recent: readonly RecipientOption[],
  results: RecipientSearchResult
): { title: string; entries: RecipientPickerEntry[] }[] {
  if (!query.trim()) {
    const entries = [...(mode === 'assign' ? [SELF_ENTRY] : []), ...recent];
    return entries.length ? [{ title: 'Недавние', entries }] : [];
  }
  const groups: Record<RecipientOptionKind, RecipientOption[]> = {
    user: results.users,
    department: results.departments,
    team: results.teams,
    company: results.companies,
  };
  return SECTION_ORDER.filter((kind) => groups[kind].length > 0).map((kind) => ({
    title: RECIPIENT_SECTION_TITLES[kind],
    entries: groups[kind],
  }));
}
