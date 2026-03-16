/** Элемент новости/инсайта для главной и страницы всех новостей */
export interface NewsItem {
  id: string;
  tag: string;
  title: string;
  desc: string;
  image: string;
  /** Дата публикации YYYY-MM-DD (опционально для обратной совместимости) */
  date?: string;
}

export const NEWS_ITEMS: NewsItem[] = [
  { id: '1', tag: 'Wellness', title: 'Оптимизируйте сон', desc: 'Новые метрики показывают: сон на 15 мин раньше может повысить концентрацию на 20%.', image: 'https://images.unsplash.com/photo-1541783245831-57d6fb0926d3?w=600', date: '' },
  { id: '2', tag: 'Умный дом', title: 'Экономия энергии', desc: 'Ваши умные устройства экономят энергию, синхронизируясь с расписанием.', image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600', date: '' },
  { id: '3', tag: 'Продуктивность', title: 'Советы на день', desc: 'Рекомендуем сделать перерыв через 45 минут работы.', image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600', date: '' },
  { id: '4', tag: 'Wellness', title: 'Утренняя зарядка', desc: '10 минут лёгкой зарядки утром повышают продуктивность на весь день.', image: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=600', date: '' },
  { id: '5', tag: 'Умный дом', title: 'Автоматизация освещения', desc: 'Настройте сценарии освещения под время суток для комфорта глаз.', image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600', date: '' },
  { id: '6', tag: 'Продуктивность', title: 'Фокус-режим', desc: 'Отключите уведомления на 2 часа для глубокой работы над задачами.', image: 'https://images.unsplash.com/photo-1484480974693-6ca0a78fb36b?w=600', date: '' },
  { id: '7', tag: 'Wellness', title: 'Гидратация', desc: 'Старайтесь выпивать стакан воды каждый час в рабочее время.', image: 'https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=600', date: '' },
  { id: '8', tag: 'Умный дом', title: 'Климат-контроль', desc: 'Оптимальная температура в помещении: 20–22°C для продуктивности.', image: 'https://images.unsplash.com/photo-1620121692029-d088224ddc74?w=600', date: '' },
].map((item, i) => {
  const d = new Date();
  d.setDate(d.getDate() - i);
  return { ...item, date: d.toISOString().slice(0, 10) };
});
