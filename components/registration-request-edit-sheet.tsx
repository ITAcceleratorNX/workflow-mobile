import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, TextInput } from 'react-native';

import { Select } from '@/components/ui';
import {
  FormBottomSheet,
  FormBottomSheetFieldLabel,
  formBottomSheetFieldStyles,
} from '@/components/ui/form-bottom-sheet';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import {
  getOfficeCompanies,
  updateRegistrationRequest,
  type Company,
  type Office,
  type RegistrationRequestItem,
} from '@/lib/api';
import { COMPANY_OTHER_VALUE } from '@/lib/registration';

const NONE_VALUE = '__none__';

export interface RegistrationRequestEditSheetProps {
  visible: boolean;
  request: RegistrationRequestItem | null;
  offices: Office[];
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Редактирование pending-заявки администратором перед approve:
 * офис и компания (для client) — в том же bottom sheet, что «Принять заявку».
 */
export function RegistrationRequestEditSheet({
  visible,
  request,
  offices,
  onClose,
  onSaved,
}: RegistrationRequestEditSheetProps) {
  const textColor = useThemeColor({}, 'text');
  const mutedColor = useThemeColor({}, 'textMuted');
  const borderColor = useThemeColor({}, 'border');
  const backgroundColor = useThemeColor({}, 'background');
  const dangerColor = useThemeColor({}, 'danger');

  const [officeId, setOfficeId] = useState<string>('');
  const [companyId, setCompanyId] = useState<string>('');
  const [companyOtherName, setCompanyOtherName] = useState<string>('');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isClient = request?.role === 'client';

  useEffect(() => {
    if (!request) return;
    setOfficeId(request.office_id != null ? String(request.office_id) : '');
    if (!isClient) {
      setCompanyId('');
      setCompanyOtherName('');
      return;
    }
    if (request.company_id != null) {
      setCompanyId(String(request.company_id));
      setCompanyOtherName('');
    } else if (request.company_other_name) {
      setCompanyId(COMPANY_OTHER_VALUE);
      setCompanyOtherName(request.company_other_name);
    } else {
      setCompanyId(NONE_VALUE);
      setCompanyOtherName('');
    }
    setError(null);
  }, [request, isClient]);

  useEffect(() => {
    if (!visible || !isClient) {
      setCompanies([]);
      return;
    }
    const oid = Number(officeId);
    if (!Number.isFinite(oid) || oid <= 0) {
      setCompanies([]);
      return;
    }
    setCompaniesLoading(true);
    getOfficeCompanies(oid).then((res) => {
      setCompanies(res.ok ? res.data : []);
      setCompaniesLoading(false);
    });
  }, [visible, isClient, officeId]);

  const officeOptions = useMemo(
    () => offices.map((o) => ({ value: String(o.id), label: o.name })),
    [offices],
  );

  const companyOptions = useMemo(
    () => [
      { value: NONE_VALUE, label: 'Не указана' },
      ...companies.map((c) => ({ value: String(c.id), label: c.name })),
      { value: COMPANY_OTHER_VALUE, label: 'Другое' },
    ],
    [companies],
  );

  const handleOfficeChange = (v: string) => {
    setOfficeId(v);
    if (isClient) {
      setCompanyId('');
      setCompanyOtherName('');
    }
  };

  const handleSave = async () => {
    if (!request) return;
    const oid = Number(officeId);
    if (!Number.isFinite(oid) || oid <= 0) {
      setError('Выберите офис');
      return;
    }
    setSaving(true);
    setError(null);
    const body: {
      office_id?: number;
      company_id?: number | null;
      company_other_name?: string | null;
    } = {};
    if (oid !== Number(request.office_id)) {
      body.office_id = oid;
    }
    if (isClient) {
      if (companyId === COMPANY_OTHER_VALUE) {
        const otherName = companyOtherName.trim();
        if (!otherName) {
          setSaving(false);
          setError('Укажите название компании или выберите другую опцию');
          return;
        }
        body.company_other_name = otherName;
        body.company_id = null;
      } else if (companyId === NONE_VALUE || companyId === '') {
        body.company_id = null;
        body.company_other_name = null;
      } else {
        const cid = Number(companyId);
        if (Number.isFinite(cid) && cid > 0) {
          body.company_id = cid;
          body.company_other_name = null;
        }
      }
    }

    if (Object.keys(body).length === 0) {
      setSaving(false);
      onClose();
      return;
    }

    const result = await updateRegistrationRequest(request.id, body);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSaved();
    onClose();
  };

  return (
    <FormBottomSheet
      visible={visible}
      title="Изменить заявку"
      subtitle={request?.full_name}
      loading={saving}
      onClose={onClose}
      primaryLabel="Сохранить"
      onPrimaryPress={handleSave}
      primaryDisabled={!request}
    >
      <FormBottomSheetFieldLabel>Офис</FormBottomSheetFieldLabel>
      <Select
        value={officeId}
        onValueChange={handleOfficeChange}
        options={officeOptions}
        placeholder="Выберите офис"
      />

      {isClient ? (
        <>
          <FormBottomSheetFieldLabel>Компания</FormBottomSheetFieldLabel>
          <Select
            value={companyId}
            onValueChange={(v) => {
              setCompanyId(v);
              if (v !== COMPANY_OTHER_VALUE) {
                setCompanyOtherName('');
              }
            }}
            options={companyOptions}
            placeholder={companiesLoading ? 'Загрузка…' : 'Выберите компанию'}
          />

          {companyId === COMPANY_OTHER_VALUE ? (
            <>
              <FormBottomSheetFieldLabel>Название компании</FormBottomSheetFieldLabel>
              <TextInput
                style={[
                  formBottomSheetFieldStyles.input,
                  { color: textColor, borderColor, backgroundColor },
                ]}
                placeholder="Введите название"
                placeholderTextColor={mutedColor}
                value={companyOtherName}
                onChangeText={setCompanyOtherName}
                maxLength={255}
                returnKeyType="done"
                blurOnSubmit
              />
            </>
          ) : null}
        </>
      ) : (
        <ThemedText style={[styles.hint, { color: mutedColor }]}>
          Для роли «{request?.role ?? '—'}» компания не назначается.
        </ThemedText>
      )}

      {error ? (
        <ThemedText style={[styles.error, { color: dangerColor }]}>{error}</ThemedText>
      ) : null}
    </FormBottomSheet>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  error: { fontSize: 13, marginTop: 10 },
});
