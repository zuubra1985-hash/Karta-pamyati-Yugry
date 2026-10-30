import { organization as org } from '../organization';
export default function OrganizationDetails() {
  return <section className="organization-details" aria-label="Организация проекта">
    <div className="organization-heading">
      <div><h3>{org.shortName}</h3><p>Автор проекта «Карта памяти Югры»</p></div>
      <a href={`mailto:${org.email}`}>{org.email}</a>
    </div>
    <dl className="organization-requisites">
      <div><dt>ИНН</dt><dd>{org.inn}</dd></div>
      <div><dt>ОГРН</dt><dd>{org.ogrn}</dd></div>
    </dl>
    <details className="organization-legal">
      <summary>Реквизиты, права и обращения</summary>
      <p>{org.fullName}.</p>
      <p>Все права на оригинальные материалы и оформление проекта защищены. Права на архивные документы, фотографии и воспоминания других авторов сохраняются за их правообладателями. Указание источника не означает разрешения на свободное копирование.</p>
      <p>Для исправления, удаления или использования материала напишите в редакцию на email выше. Укажите ссылку на карточку или номер отправленного материала.</p>
    </details>
  </section>;
}
