import { SegmentedControl } from '@/components/ui/segmented-control';

export type AdminSurveySection = 'news' | 'surveys';

export function AdminSurveyTabs({
  value,
  onChange,
}: {
  value: AdminSurveySection;
  onChange: (value: AdminSurveySection) => void;
}) {
  return (
    <SegmentedControl
      value={value}
      onChange={onChange}
      accessibilityLabel="Раздел управления"
      fill
      options={[
        { value: 'news', label: 'Новости' },
        { value: 'surveys', label: 'Опросы' },
      ]}
      style={{ marginHorizontal: 16, marginBottom: 16 }}
    />
  );
}
