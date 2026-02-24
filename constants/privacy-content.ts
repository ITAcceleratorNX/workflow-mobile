export type PrivacyLanguage = 'ru' | 'en';

interface PrivacySection {
  heading: string;
  content: string;
}

interface PrivacyDocument {
  title: string;
  subtitle: string;
  lastUpdate: string;
  sections: PrivacySection[];
}

export const PRIVACY_CONTENT: Record<PrivacyLanguage, PrivacyDocument> = {
  ru: {
    title: 'ПОЛИТИКА КОНФИДЕНЦИАЛЬНОСТИ',
    subtitle: 'Work Flow',
    lastUpdate: 'Дата последнего обновления: 18 февраля 2026 года',
    sections: [
      {
        heading: '1. Оператор данных и контакты',
        content: `Оператор персональных данных: TMK Techno Horizon, Республика Казахстан, г. Алматы.

Контакты для вопросов по приватности:
Email (Support): support@tmk-technohorizon.kz
Телефон: +7 (707) 227-29-73
Почтовый адрес: workflow@tmk-limited.com`,
      },
      {
        heading: '2. Для кого предназначено приложение',
        content:
          'Work Flow предназначено для корпоративного использования. Доступ предоставляется пользователям, связанным с организацией (например, сотрудникам), в соответствии с ролью и правами доступа.',
      },
      {
        heading: '3. Какие данные мы собираем и обрабатываем',
        content: `Объём данных зависит от ваших настроек, роли и функций, доступных в вашей организации.

3.1 Данные аккаунта и профиля
ФИО
номер телефона
адрес электронной почты
(возможное будущее расширение) привязка к офису/кабинету и организационные атрибуты

3.2 Данные заявок и сервисных обращений
содержание заявок (текст, категории, статусы, история изменений)
комментарии/переписка по заявке
вложения (например, фото/файлы), если вы их добавляете

3.3 Бронирование переговорных
данные бронирования: компания/организация, время, пользователь, создавший бронь, и параметры расписания

Важно: кабинет и переговорная комната — разные сущности.
Сотрудник может быть закреплён за кабинетом (с функциями умного дома). Переговорные доступны для бронирования сотрудниками (в пределах прав доступа).

3.4 Умный кабинет / умный дом
команды управления (например, включение света)
технические события и (при наличии) журналы действий, необходимые для безопасности и аудита (например, кто и когда выполнил действие)

3.5 Wellness-уведомления (напоминания о смене активности)
Приложение может предоставлять wellness-уведомления (например, напоминания сделать перерыв, размяться или пройтись), чтобы поддерживать комфортный режим в течение рабочего дня.
Функция не является медицинской и не предназначена для диагностики, лечения или предотвращения заболеваний. Пользователь может настраивать и отключать эту функцию (если включено в версии организации).
В рамках работы функции могут использоваться данные датчиков устройства (например, положение/движение телефона) для оценки активности, если это предусмотрено текущей реализацией. Мы не позиционируем эти данные как медицинские.

3.6 Примерное местоположение (опционально)
В некоторых версиях/в будущем Приложение может использовать приблизительное местоположение для сценариев, связанных с офисной инфраструктурой (например, умный кабинет).
Другие пользователи не видят ваше местоположение. Доступ к местоположению контролируется разрешениями устройства и может быть отключён пользователем.

3.7 Технические данные и безопасность
информация об устройстве и приложении (версия ОС, версия приложения, параметры устройства)
технические логи, события безопасности и диагностики (например, для расследования инцидентов и защиты)`,
      },
      {
        heading: '4. Как мы используем данные (цели обработки)',
        content: `Мы используем данные для:
регистрации/создания учётной записи и управления доступом (включая подтверждение номера телефона и восстановление доступа)
предоставления функций Приложения: заявки, бронирования, умный кабинет, личный кабинет
отправки сервисных уведомлений (например, статусы заявок, события бронирования, системные сообщения)
обеспечения безопасности, предотвращения злоупотреблений и ведения аудита
улучшения качества Приложения, поддержки и устранения ошибок`,
      },
      {
        heading: '5. Правовые основания обработки',
        content: `Мы обрабатываем данные на основании:
необходимости исполнения функций Приложения и корпоративных процессов вашей организации
законных интересов (обеспечение безопасности, аудит, предотвращение злоупотреблений)
вашего согласия — когда оно требуется (например, разрешения устройства на доступ к некоторым функциям)`,
      },
      {
        heading: '6. Передача данных третьим лицам',
        content: `Мы не продаём персональные данные и не передаём их третьим лицам для рекламных целей.
Мы можем передавать данные третьим лицам только в объёме, необходимом для работы Приложения и/или по закону:

6.1 SMS-верификация
Для отправки SMS-кода подтверждения и восстановления доступа номер телефона может передаваться провайдеру SMS-рассылки: Mobizon.

6.2 Интеграции умного дома
Для работы функций умного кабинета Приложение может взаимодействовать со сторонними платформами/поставщиками умного дома через API. В рамках интеграции могут передаваться технические данные, необходимые для выполнения команды и обеспечения безопасности.

6.3 Требования законодательства
Мы можем раскрывать данные, если это требуется законом, по запросу уполномоченных органов, или для защиты прав и безопасности Компании и пользователей.`,
      },
      {
        heading: '7. Хранение данных и сроки',
        content: `Мы храним данные столько, сколько необходимо для:
предоставления функций Приложения
обеспечения безопасности, аудита и поддержки
выполнения требований законодательства

Сроки хранения могут различаться по типам данных. Если вы запросите удаление данных, мы обработаем запрос, как правило, в течение до 30 дней, если более длительное хранение не требуется по закону или для обеспечения безопасности и аудита.`,
      },
      {
        heading: '8. Безопасность данных',
        content: `Мы применяем разумные технические и организационные меры защиты, включая:
контроль доступа по ролям
защиту передачи данных (например, шифрование при передаче)
мониторинг и аудит событий безопасности
Однако ни один метод передачи или хранения данных не гарантирует абсолютную безопасность.`,
      },
      {
        heading: '9. Права пользователя и управление данными',
        content: `Вы можете:
запросить доступ к вашим персональным данным
запросить исправление данных
запросить удаление аккаунта и/или данных
запросить ограничение обработки — в случаях, предусмотренных законом

Удаление аккаунта и данных
Удаление может быть доступно:
внутри Приложения (если включено в вашей версии), и/или
через администратора вашей организации, и/или
через службу поддержки: support@tmk-technohorizon.kz`,
      },
      {
        heading: '10. Дети',
        content:
          'Приложение предназначено для корпоративного использования и не ориентировано на детей. Мы не собираем персональные данные детей намеренно.',
      },
      {
        heading: '11. Международная передача данных',
        content:
          'Данные могут обрабатываться на серверах, расположенных в Казахстане. Если в вашей инфраструктуре или интеграциях задействуются зарубежные поставщики, данные могут передаваться за пределы страны в объёме, необходимом для работы функций (например, поставщики технологических сервисов). В таком случае мы принимаем меры для защиты данных в соответствии с применимыми требованиями.',
      },
      {
        heading: '12. Изменения политики',
        content: `Мы можем обновлять эту Политику. Актуальная версия публикуется на сайте Компании: https://workflow-service-front.vercel.app/login
Дата обновления указывается в начале документа.`,
      },
      {
        heading: '13. Контакты',
        content: `По вопросам приватности и запросам пользователей:
Email (support): support@tmk-technohorizon.kz
Телефон: +7 (707) 227-29-73
Адрес: г. Алматы., проспект Аль-Фараби., дом 19/1`,
      },
    ],
  },
  en: {
    title: 'PRIVACY POLICY',
    subtitle: 'Work Flow',
    lastUpdate: 'Last updated: February 18, 2026',
    sections: [
      {
        heading: '1. Data Controller and Contact Information',
        content: `Data Controller: TMK Techno Horizon, Republic of Kazakhstan, Almaty.

Privacy contact details:
Support Email: support@tmk-technohorizon.kz
Phone: +7 (707) 227-29-73
Mailing address: workflow@tmk-limited.com`,
      },
      {
        heading: '2. Who the Application Is Intended For',
        content:
          'Work Flow is designed for corporate use. Access is granted to users associated with an organization (e.g., employees) according to their assigned role and access rights.',
      },
      {
        heading: '3. What Data We Collect and Process',
        content: `The scope of data depends on your settings, role, and the features available within your organization.

3.1 Account and Profile Data
Full name
Phone number
Email address
(Possible future extension) Office/cabinet assignment and organizational attributes

3.2 Requests and Service Tickets
Ticket content (text, categories, statuses, change history)
Comments and communication related to the ticket
Attachments (e.g., photos/files) if provided by you

3.3 Meeting Room Booking
Booking details: company/organization, time, user who created the booking, scheduling parameters

Important: An office cabinet and a meeting room are separate entities.
An employee may be assigned to a cabinet (with smart office features). Meeting rooms are available for booking by employees within their access rights.

3.4 Smart Office / Smart Cabinet
Control commands (e.g., turning lights on/off)
Technical events and (if applicable) activity logs necessary for security and audit purposes (e.g., who performed an action and when)

3.5 Wellness Notifications
The Application may provide wellness notifications (e.g., reminders to take breaks, stretch, or walk) to support comfort during the workday.
This feature is not medical in nature and is not intended for diagnosis, treatment, or prevention of disease. Users may configure or disable this feature (if enabled in their organization's version).
Device sensor data (e.g., phone position/movement) may be used to estimate activity, depending on implementation. Such data is not considered medical data.

3.6 Approximate Location (Optional)
In certain versions (or in future updates), the Application may use approximate location data for office-related scenarios (e.g., smart cabinet access).
Your location is not visible to other users. Location access is controlled by device permissions and can be disabled by the user.

3.7 Technical and Security Data
Device and application information (OS version, app version, device parameters)
Technical logs, security events, and diagnostics (e.g., for incident investigation and protection)`,
      },
      {
        heading: '4. How We Use Data (Purpose of Processing)',
        content: `We use data for:
Account registration and access management (including phone verification and recovery)
Providing Application features: service tickets, bookings, smart office, personal cabinet
Sending service notifications (e.g., ticket updates, booking events, system messages)
Ensuring security, preventing abuse, and maintaining audit logs
Improving the Application, support, and troubleshooting`,
      },
      {
        heading: '5. Legal Basis for Processing',
        content: `We process data based on:
The necessity to provide Application functionality and support your organization's corporate processes
Legitimate interests (security, audit, abuse prevention)
Your consent where required (e.g., device permissions for certain features)`,
      },
      {
        heading: '6. Data Sharing with Third Parties',
        content: `We do not sell personal data and do not share it with third parties for advertising purposes.
We may share data only as necessary for the Application's operation and/or as required by law.

6.1 SMS Verification
For sending verification or recovery codes, phone numbers may be shared with an SMS provider: Mobizon.

6.2 Smart Home Integrations
For smart office functionality, the Application may interact with third-party smart home platforms/providers via API. Technical data necessary to execute commands and ensure security may be transmitted.

6.3 Legal Requirements
We may disclose data if required by law, by authorized authorities, or to protect the rights and safety of the Company and users.`,
      },
      {
        heading: '7. Data Retention',
        content: `We retain data as long as necessary to:
Provide Application functionality
Ensure security, audit, and support
Comply with legal obligations

Retention periods vary depending on the data type.
If you request deletion of your data, we will process the request within up to 30 days, unless longer retention is required by law or for security and audit purposes.`,
      },
      {
        heading: '8. Data Security',
        content: `We implement reasonable technical and organizational measures, including:
Role-based access control
Secure data transmission (e.g., encryption in transit)
Monitoring and auditing of security events

However, no transmission or storage method guarantees absolute security.`,
      },
      {
        heading: '9. User Rights and Data Management',
        content: `You may:
Request access to your personal data
Request correction of your data
Request deletion of your account and/or data
Request restriction of processing (where legally applicable)

Account and Data Deletion
Deletion may be available:
Within the Application (if enabled in your version), and/or
Through your organization's administrator, and/or
Via support: support@tmk-technohorizon.kz`,
      },
      {
        heading: '10. Children',
        content:
          'The Application is intended for corporate use and is not directed at children. We do not knowingly collect personal data from children.',
      },
      {
        heading: '11. International Data Transfers',
        content:
          'Data may be processed on servers located in Kazakhstan. If international providers are involved in infrastructure or integrations, data may be transferred outside the country as necessary for functionality. In such cases, we implement appropriate safeguards in accordance with applicable laws.',
      },
      {
        heading: '12. Policy Changes',
        content: `We may update this Privacy Policy. The latest version is published on the Company's website:
https://workflow-service-front.vercel.app/login

The update date is indicated at the beginning of this document.`,
      },
      {
        heading: '13. Contact Information',
        content: `For privacy inquiries and user requests:
Support Email: support@tmk-technohorizon.kz
Phone: +7 (707) 227-29-73
Address: Almaty, Al-Farabi Avenue 19/1`,
      },
    ],
  },
};
