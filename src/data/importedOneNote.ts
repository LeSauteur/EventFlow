import { stageToStatus } from '../config/servicePresets.ts'
import type { Event, EventStage, ServiceInstance, ServiceType, TimelineEntry, WaitingItem, WorkChecklistItem } from '../types/index.ts'

const IMPORTED_AT = '2026-09-29T18:00:00.000Z'

type ChecklistSpec = [title: string, completed: boolean]
type WaitingSpec = [text: string, completed?: boolean]
type TimelineSpec = [timestamp: string, text: string]

interface ServiceSpec {
  type: ServiceType
  title: string
  providerName?: string
  providerContact?: string
  checklist?: ChecklistSpec[]
  notes?: string
}

interface ImportedEventSpec {
  id: string
  title: string
  dateFrom: string
  dateTo?: string
  stage: EventStage
  sector?: string
  city?: string
  company?: string
  initiator?: string
  participants?: number
  services?: ServiceSpec[]
  commonChecklist?: ChecklistSpec[]
  waitingItems?: WaitingSpec[]
  nextStep?: string
  workTourNumbers?: string[]
  timeline?: TimelineSpec[]
}

function checklistItem(eventId: string, group: string, index: number, [title, completed]: ChecklistSpec): WorkChecklistItem {
  return {
    id: `${eventId}-${group}-${index + 1}`,
    title,
    completed,
    completedAt: completed ? IMPORTED_AT : null,
  }
}

function service(eventId: string, index: number, spec: ServiceSpec): ServiceInstance {
  const id = `${eventId}-service-${index + 1}`
  return {
    id,
    eventId,
    type: spec.type,
    title: spec.title,
    providerName: spec.providerName ?? '',
    providerContact: spec.providerContact ?? '',
    checklist: (spec.checklist ?? []).map((item, itemIndex) => checklistItem(eventId, `service-${index + 1}`, itemIndex, item)),
    notes: spec.notes ?? '',
  }
}

function waitingItem(eventId: string, index: number, [text, completed = false]: WaitingSpec): WaitingItem {
  return {
    id: `${eventId}-waiting-${index + 1}`,
    text,
    completed,
    createdAt: IMPORTED_AT,
    completedAt: completed ? IMPORTED_AT : null,
  }
}

function timelineEntry(eventId: string, index: number, [timestamp, text]: TimelineSpec): TimelineEntry {
  return { id: `${eventId}-timeline-${index + 1}`, eventId, text, timestamp, source: 'user' }
}

function importedEvent(spec: ImportedEventSpec): Event {
  const services = (spec.services ?? []).map((item, index) => service(spec.id, index, item))
  const commonChecklist = (spec.commonChecklist ?? []).map((item, index) => checklistItem(spec.id, 'common', index, item))
  const completed = [...commonChecklist, ...services.flatMap((item) => item.checklist)].filter((item) => item.completed).length
  const total = commonChecklist.length + services.reduce((sum, item) => sum + item.checklist.length, 0)
  return {
    id: spec.id,
    title: spec.title,
    client: spec.company ?? '',
    city: spec.city ?? '',
    date: spec.dateFrom,
    guests: spec.participants ?? 0,
    budget: 0,
    type: spec.sector ?? 'Мероприятие',
    status: stageToStatus(spec.stage),
    progress: total ? Math.round(completed / total * 100) : 0,
    createdAt: IMPORTED_AT,
    updatedAt: IMPORTED_AT,
    dateFrom: spec.dateFrom,
    dateTo: spec.dateTo ?? spec.dateFrom,
    sector: spec.sector ?? '',
    company: spec.company ?? '',
    initiator: spec.initiator ?? '',
    participants: spec.participants ?? 0,
    stage: spec.stage,
    services,
    commonChecklist,
    workTourNumbers: spec.workTourNumbers ?? [],
    waitingItems: (spec.waitingItems ?? []).map((item, index) => waitingItem(spec.id, index, item)),
    nextStep: spec.nextStep ?? '',
    timeline: (spec.timeline ?? []).map((item, index) => timelineEntry(spec.id, index, item)),
  }
}

export const importedOneNoteEvents: Event[] = [
  importedEvent({
    id: 'onenote-todo-2026-07-10',
    title: 'TO-DO LIST 10 июля',
    dateFrom: '2026-07-10',
    stage: 'WORKING',
    sector: 'TO-DO',
    services: [
      { type: 'custom', title: '1 сент_сотрудники', checklist: [['Кейтеринг выбор_меню', false], ['Предв.смета', true]] },
      { type: 'custom', title: '13-17 сент Кенвью', checklist: [['Предложение', true]] },
      { type: 'custom', title: '3 окт Казань', checklist: [['Смета 1С', false], ['Запросы поставщикам', false]] },
      { type: 'custom', title: '13 авг Улан Удэ', checklist: [['Письмо', false], ['Смета предв', false]] },
      { type: 'custom', title: '12-13 авг', checklist: [['Меню', false]] },
    ],
  }),
  importedEvent({
    id: 'onenote-kurgan-2026-10-05',
    title: '05 окт Курган',
    dateFrom: '2026-10-05',
    stage: 'WORKING',
    sector: 'Медтех',
    city: 'Курган',
    initiator: 'Лапшина Анна',
    participants: 1,
    services: [
      { type: 'logistics', title: 'Логистика лектора: билеты / трансфер' },
      { type: 'accommodation', title: 'Проживание', providerName: 'Авеню Парк отель' },
      { type: 'catering', title: 'Обед в ЛПУ на 9 чел' },
    ],
    commonChecklist: [['PO', false], ['Смета предв. отправлена', true], ['Смета предв. согласована', false], ['Ваучеры отправлены', false], ['WORK Смета', true], ['Авиабилеты', false], ['ЖД билет', false], ['Ваучер Отель', false], ['Ваучер Трансфер', false], ['Меню Кейтеринг', false]],
    timeline: [['2026-09-17T12:00:00.000Z', 'Смета предв.']],
  }),

  importedEvent({
    id: 'onenote-lvn35b62shc',
    title: '25-26.09 LVN35B62SHC Новосибирск',
    dateFrom: '2026-09-25',
    dateTo: '2026-09-26',
    stage: 'PO',
    sector: 'Янсен',
    city: 'Новосибирск',
    workTourNumbers: ['LVN35B62SHC'],
    services: [
      { type: 'venue', title: 'Конференц-зал' },
      { type: 'equipment', title: 'Оборудование' },
      { type: 'catering', title: '2 кофе-брейка / обед' },
      { type: 'coordination', title: 'Сопровождение' },
      { type: 'transfer', title: 'Индив. трансфер' },
      { type: 'direct', title: 'ССЗ прямое взаимодействие' },
    ],
    commonChecklist: [['PO', true], ['Смета предв. отправлена', true], ['Смета предв. согласована', true], ['GBL отправлен', false], ['Ваучеры отправлены', false], ['WORK Смета', true], ['Авиабилеты', false], ['Проживание ваучеры', false]],
    waitingItems: [['ССЗ для логистики']],
    timeline: [['2026-09-16T12:00:00.000Z', 'Связаться с ССЗ по билетам.\nОформить билеты.\nСогласовать питание с отелем.\nПолучить счёт от отеля.\nПередать конференц-площадке, что будет 2 дня телемоста.']],
  }),
  importedEvent({
    id: 'onenote-p3nd7q6zyvl',
    title: '19.09.26 P3ND7Q6ZYVL СПб Янсен',
    dateFrom: '2026-09-19',
    stage: 'PO',
    sector: 'Янсен',
    city: 'СПб',
    company: 'Johnson & Johnson',
    initiator: 'Грибкова Анна',
    participants: 40,
    workTourNumbers: ['P3ND7Q6ZYVL'],
    services: [
      { type: 'venue', title: 'Площадка', providerName: 'Новотель СПб Центр', providerContact: 'Баландина Ольга', checklist: [['Предложение получено', true], ['Подтверждение', true], ['Счёт за конференц-зал и оборудование', true]] },
      { type: 'equipment', title: 'Оборудование — система голосования QR-код', providerName: 'Смышляев Владислав', providerContact: 'vs@conferent.ru', checklist: [['Предложение получено', true], ['Подтверждение', true], ['Счёт', true]] },
      { type: 'catering', title: 'Питание: 2 кофе-брейка / обед', checklist: [['Меню', true], ['Счёт', false]], notes: 'Счёт за меню??' },
      { type: 'coordination', title: 'Сопровождение', checklist: [['Счёт', true]] },
      { type: 'transfer', title: 'Индив. трансфер' },
      { type: 'direct', title: 'ССЗ прямое взаимодействие', notes: 'ССЗ: 4 чел + прямое взаимодействие' },
    ],
    commonChecklist: [['PO', true], ['Смета предв. отправлена', true], ['Смета предв. согласована', false], ['ELMA создана', false], ['GBL отправлен', false], ['Ваучеры отправлены', false], ['WORK Смета', true]],
    waitingItems: [['Отправлена смета, жду корректировок от инициатора']],
    nextStep: 'PO',
    timeline: [['2026-09-16T12:00:00.000Z', 'Направлены на трансфер!']],
  }),
  importedEvent({
    id: 'onenote-d7nbqtr35c3',
    title: '14.10.26 D7NBQTR35C3 Москва логистика',
    dateFrom: '2026-10-14',
    stage: 'PO',
    sector: 'Янсен',
    city: 'Москва',
    company: 'Johnson & Johnson',
    initiator: 'Овчарова Мария',
    participants: 4,
    workTourNumbers: ['D7NBQTR35C3'],
    services: [
      { type: 'logistics', title: 'Логистика' },
      { type: 'accommodation', title: 'Проживание Москва' },
      { type: 'transfer', title: 'Трансфер индивидуальный' },
      { type: 'coordination', title: 'Координатор на симпозиум' },
      { type: 'direct', title: 'Прямое взаимодействие ССЗ' },
    ],
    commonChecklist: [['PO', false], ['Смета предварительная', true], ['1С WORK Смета', false]],
    timeline: [['2026-07-07T12:00:00.000Z', 'Отправила смету — проживание и сопровождение']],
  }),
  importedEvent({
    id: 'onenote-z6nzvnqmcwc',
    title: '03.10 Z6NZVNQMCWC Казань',
    dateFrom: '2026-10-03',
    stage: 'PO',
    sector: 'Янсен',
    city: 'Казань',
    initiator: 'Лысенко Ирина',
    participants: 40,
    workTourNumbers: ['Z6NZVNQMCWC'],
    services: [
      { type: 'venue', title: 'Аренда зала' },
      { type: 'equipment', title: 'Оборудование для голосования по QR-коду' },
      { type: 'equipment', title: 'Оборудование для трансляции' },
      { type: 'catering', title: 'Питание' },
      { type: 'logistics', title: 'Логистика для лекторов' },
    ],
    commonChecklist: [['PO', false], ['Смета предв. отправлена', false], ['Смета предв. согласована', false], ['Ваучеры отправлены', false], ['WORK Смета', false], ['Меню', false]],
    timeline: [['2026-07-07T12:00:00.000Z', 'Направила уточняющие детали']],
  }),
  importedEvent({
    id: 'onenote-f5nyb9b9lxs',
    title: '28.09-02.10 F5NYB9B9LXS сотрудники Москва',
    dateFrom: '2026-09-15',
    dateTo: '2026-09-18',
    stage: 'PO',
    sector: 'Янсен',
    city: 'Москва',
    company: 'Johnson & Johnson — Сотрудники',
    participants: 60,
    workTourNumbers: ['F5NYB9B9LXS'],
    services: [
      { type: 'logistics', title: 'Логистика' },
      { type: 'accommodation', title: 'Проживание — предложение по отелям', checklist: [['Конгресс-отель Ареал — Костина Екатерина <e.kostina@areal-hotel.ru>', true], ['«Арткорт Москва Центр» — Victoria Lukina <Victoria.Lukina@activhotels.ru>', true], ['AZIMUT Сити Отель Смоленская Москва — Aleksandra Kurilenko <akurilenko@azimuthotels.com>', true], ['Истра Холидей — sales@istraholiday.ru', false], ['Арт Вилладж 4 — sale@artvillage.club', false]] },
      { type: 'transfer', title: 'Трансфер индивидуальный' },
      { type: 'accommodation', title: 'Проживание' },
      { type: 'event', title: 'Мероприятие' },
    ],
    commonChecklist: [['PO', false], ['Смета предв. отправлена', true], ['Смета предв. согласована', false], ['ELMA создана', false], ['GBL отправлен', false], ['Ваучеры отправлены', false], ['WORK Смета', false]],
    timeline: [['2026-07-07T12:00:00.000Z', 'Направлены предложения по отелям'], ['2026-09-29T18:00:00.000Z', 'В OneNote в названии страницы указано «28.09–02.10», а в паспорте — «15–18 сентября 2026». В EventFlow сохранены обе исходные записи: название страницы и даты паспорта.']],
  }),

  importedEvent({
    id: 'onenote-xsnmq4w543n',
    title: '01.09 XSNMQ4W543N Kenvue сотрудники Москва',
    dateFrom: '2026-09-01',
    stage: 'PROCESSING',
    sector: 'Вистакон',
    city: 'Москва',
    company: 'Kenvue — сотрудники',
    initiator: 'Сиротина Ксения',
    participants: 30,
    workTourNumbers: ['XSNMQ4W543N'],
    services: [{ type: 'custom', title: 'Яхта' }, { type: 'catering', title: 'Кейтеринг' }],
    commonChecklist: [['PO', false], ['Смета предв. отправлена', false], ['Смета предв. согласована', false], ['ELMA создана', false], ['GBL отправлен', false], ['Ваучеры отправлены', false], ['WORK Смета', false]],
    timeline: [['2026-07-07T12:00:00.000Z', 'Отправила яхтам письмо']],
  }),
  importedEvent({
    id: 'onenote-id-2643',
    title: '17.09 id_2643 Kenvue сотрудники',
    dateFrom: '2026-09-13',
    dateTo: '2026-09-17',
    stage: 'PROCESSING',
    sector: 'Кенвью',
    city: 'Москва',
    company: 'Kenvue — сотрудники',
    workTourNumbers: ['id_2643'],
    services: [
      { type: 'logistics', title: 'Логистика' },
      { type: 'accommodation', title: 'Проживание — запрос направлен', checklist: [['Cosmos Collection Изумрудный Лес 5* — sales.izmr@cosmoscollection.ru', true], ['Артурс Спа Отель by Mercure — hb922-sl@accor.ru', true], ['Хилтон Гарден Инн Москва Новая Рига — mownr.reservations@hilton.com', true], ['LES Art Resort — sales@lesresort.ru', true], ['Конгресс-отель Ареал', true]] },
      { type: 'transfer', title: 'Трансфер индивидуальный' },
      { type: 'accommodation', title: 'Проживание' },
      { type: 'event', title: 'Мероприятие' },
    ],
    commonChecklist: [['PO', false], ['Смета предв. отправлена', true], ['Смета предв. согласована', false], ['ELMA создана', false], ['GBL отправлен', false], ['Ваучеры отправлены', false], ['WORK Смета', false]],
    timeline: [['2026-09-29T18:00:00.000Z', 'Запрос направлен']],
  }),

  importedEvent({
    id: 'onenote-archive-medtech-spb-10-11-june',
    title: '🟣10-11.06.2026 Медтех СПб',
    dateFrom: '2026-06-10',
    dateTo: '2026-06-11',
    stage: 'ARCHIVE',
    sector: 'MedTech / Медтех',
    city: 'СПб',
    company: 'Johnson & Johnson',
    initiator: 'Елизавета Гремицких',
    participants: 6,
    services: [{ type: 'transfer', title: 'Трансфер на 3 пассажиров' }, { type: 'catering', title: 'Кейтеринг / обеды в ЛПУ на 2 дня' }],
    commonChecklist: [['PO', true], ['Меню', true], ['Смета предварительная', true], ['1С WORK Смета', true], ['Счёт кейтеринг', false], ['Ваучер трансфер', true], ['Счёт трансфер', false], ['Финальная смета', false]],
  }),
  importedEvent({
    id: 'onenote-archive-medtech-moscow-10-11-june',
    title: '🟣05-06.06 Медтех Москва',
    dateFrom: '2026-06-10',
    dateTo: '2026-06-11',
    stage: 'ARCHIVE',
    sector: 'MedTech / Медтех',
    city: 'Москва',
    company: 'Johnson & Johnson',
    initiator: 'Анна Лапшина',
    participants: 1,
    services: [{ type: 'transfer', title: 'Индивидуальный трансфер' }, { type: 'accommodation', title: 'Проживание', providerName: 'Рэдиссон Славянская' }],
    commonChecklist: [['PO', true], ['Смета предварительная', true], ['1С WORK Смета', true], ['Счёт Рэдиссон Славянская', true], ['Счёт трансфер', false], ['Ваучер Трансфер', true]],
    waitingItems: [['Финальные суммы трансфера']],
    timeline: [['2026-09-29T18:00:00.000Z', 'В названии страницы OneNote указано «05–06.06», в паспорте — «10–11 июня 2026». В EventFlow сохранены название страницы и даты паспорта.']],
  }),
  importedEvent({
    id: 'onenote-archive-medtech-moscow-03-06-june',
    title: '🟣03-06.06 Медтех Москва',
    dateFrom: '2026-06-03',
    dateTo: '2026-06-06',
    stage: 'ARCHIVE',
    sector: 'MedTech / Медтех',
    city: 'Москва',
    company: 'Johnson & Johnson',
    initiator: 'Анна Лапшина',
    participants: 1,
    services: [{ type: 'transfer', title: 'Трансфер на 1 пассажира' }, { type: 'visa', title: 'Электронная виза (Индия)' }],
    commonChecklist: [['PO', true], ['Смета предварительная', true], ['1С WORK Смета', true], ['Счёт виза', true], ['Счёт трансфер', false], ['Ваучер Трансфер', true]],
    waitingItems: [['Финальные суммы трансфера']],
  }),
  importedEvent({
    id: 'onenote-f4n4hdymtnb',
    title: '27.06.26 F4N4HDYMTNB Трансфер 2 чел',
    dateFrom: '2026-06-27',
    stage: 'ARCHIVE',
    sector: 'Янсен',
    city: 'СПб',
    initiator: 'Кондратьева',
    participants: 2,
    workTourNumbers: ['F4N4HDYMTNB'],
    services: [{ type: 'transfer', title: 'Трансфер индивидуальный 2 чел', notes: 'Для Хобейш: проезд по ЗСД.' }],
    commonChecklist: [['PO', true], ['Смета предв. отправлена', true], ['Смета предв. согласована', true], ['ELMA создана', true], ['GBL отправлен', true], ['Ваучеры', true], ['WORK Смета', false]],
    waitingItems: [['PO', true], ['ССЗ для трансфера', true]],
  }),
  importedEvent({
    id: 'onenote-hjnm2fn6lqj',
    title: '25-26.06.26 HJNM2FN6LQJСПб 1 чел',
    dateFrom: '2026-06-25',
    dateTo: '2026-06-26',
    stage: 'ARCHIVE',
    sector: 'Медтех',
    city: 'СПб',
    initiator: 'Даршина',
    participants: 1,
    workTourNumbers: ['HJNM2FN6LQJ'],
    services: [
      { type: 'flights', title: 'Авиа СПб–Москва 1 чел', notes: 'Отмена' },
      { type: 'accommodation', title: 'Проживание СПб 1 чел', notes: 'Отмена' },
      { type: 'transfer', title: 'Трансфер индивидуальный', checklist: [['Ваучер', true], ['Счёт', false]] },
    ],
    commonChecklist: [['PO', true], ['Смета предварительная', true], ['1С WORK Смета', false], ['ССЗ данные', true]],
  }),
  importedEvent({
    id: 'onenote-ztn9c53z8sc-a',
    title: '3.07.26 ZTN9C53Z8SC г. Кызыл Круглый стол',
    dateFrom: '2026-07-03',
    stage: 'ARCHIVE',
    sector: 'Янссен',
    city: 'Кызыл',
    initiator: 'Воробьева',
    participants: 30,
    workTourNumbers: ['ZTN9C53Z8SC'],
    services: [
      { type: 'venue', title: 'Конференция 13:00–16:00', providerName: 'Отель «Чалама»', checklist: [['Ваучер', false], ['Счёт', true]], notes: 'Направлен запрос. Ответа нет.' },
      { type: 'catering', title: 'Кофе-брейк 15:45 на 30 чел', providerName: 'ИП Кристина 89994802511', checklist: [['Меню направила на согласование', true], ['Счёт', true]], notes: 'Направила запрос в Макс.' },
    ],
    commonChecklist: [['PO', true], ['Смета предварительная', true], ['Смета финальная', false], ['Меню согласовано', true], ['1С WORK Смета', true]],
  }),
  importedEvent({
    id: 'onenote-ztn9c53z8sc-b',
    title: '3.07.26 ZTN9C53Z8SC г. Кызыл Круглый стол',
    dateFrom: '2026-07-03',
    stage: 'ARCHIVE',
    sector: 'Янссен',
    city: 'Кызыл',
    initiator: 'Воробьева',
    participants: 30,
    workTourNumbers: ['ZTN9C53Z8SC'],
    services: [
      { type: 'venue', title: 'Конференция 13:00–16:00', providerName: 'Отель «Чалама»', checklist: [['Ваучер', false], ['Счёт', true]], notes: 'Направлен запрос. Ответа нет.' },
      { type: 'catering', title: 'Кофе-брейк 15:45 на 30 чел', providerName: 'ИП Кристина 89994802511', checklist: [['Меню направила на согласование', true], ['Счёт', true]], notes: 'Направила запрос в Макс.' },
    ],
    commonChecklist: [['PO', true], ['Смета предварительная', true], ['Смета финальная', false], ['Меню согласовано', true], ['1С WORK Смета', false]],
    timeline: [['2026-09-29T18:00:00.000Z', 'В OneNote существует вторая отдельная страница с тем же названием; сохранена как отдельная карточка.']],
  }),
  importedEvent({
    id: 'onenote-hmn2t8fzl72',
    title: '15-18.09.26 HMN2T8FZL72 Москва',
    dateFrom: '2026-09-15',
    dateTo: '2026-09-18',
    stage: 'ARCHIVE',
    sector: 'Янсен',
    city: 'Москва',
    company: 'Johnson & Johnson',
    participants: 4,
    workTourNumbers: ['HMN2T8FZL72'],
    services: [
      { type: 'logistics', title: 'Логистика СПб–Москва 2 чел' },
      { type: 'accommodation', title: 'Проживание Москва 2 чел', providerName: 'Рэдиссон Славянская', checklist: [['Предложение получено', true]] },
      { type: 'transfer', title: 'Трансфер индивидуальный' },
      { type: 'coordination', title: 'Сопровождение', providerName: 'Анастасия Ришко', checklist: [['Предложение получено', true]] },
      { type: 'direct', title: 'Прямое взаимодействие ССЗ' },
    ],
    commonChecklist: [['PO', false], ['Смета предв. отправлена', true], ['Смета предв. согласована', false], ['ELMA создана', false], ['GBL отправлен', false], ['Ваучеры отправлены', false], ['WORK Смета', true]],
    waitingItems: [['PO'], ['ССЗ для трансфера']],
    timeline: [['2026-06-25T12:00:00.000Z', 'Сообщение от Марии: «Мы вернёмся позже к согласованию сметы, ждём финального списка экспертов».']],
  }),
  importedEvent({
    id: 'onenote-jtnh3435nsh',
    title: '12-13.08 JTNH3435NSH',
    dateFrom: '2026-08-12',
    dateTo: '2026-08-13',
    stage: 'ARCHIVE',
    sector: 'Медтех профед',
    city: 'Москва',
    initiator: 'Лысенко Ирина',
    participants: 7,
    workTourNumbers: ['JTNH3435NSH'],
    services: [{ type: 'catering', title: 'Кейтеринг: 2 кофе-брейка, 2 обеда, ужин', providerName: '«Садко»', checklist: [['Меню', true]], notes: '06.07 Меню на согласовании.' }],
    commonChecklist: [['PO', false], ['Смета предв. отправлена', true], ['Смета предв. согласована', false], ['Ваучеры отправлены', false], ['WORK Смета', false], ['Меню', true]],
    waitingItems: [['Меню']],
    timeline: [['2026-07-06T12:00:00.000Z', 'Меню на согласовании']],
  }),
]
