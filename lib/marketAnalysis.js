/**
 * Market snapshot for the services actually sold by this CRM (02 Sep 2026).
 *
 * Groups mirror `catalog_items.category` plus directions that exist only in
 * `order_lines` (noise insulation, car audio, upholstery).
 *
 * Prices are integers in RUB so the controller can compute deltas against our
 * own catalog. Source: docs/MARKET_ANALYSIS_2026_09.md — manual survey, not a
 * live scrape.
 */

const SNAPSHOT_DATE = "2026-09-02";

const SERVICE_GROUPS = [
  { id: "wash", label: "Мойка" },
  { id: "chem", label: "Химчистка" },
  { id: "protect", label: "Защита ЛКП" },
  { id: "electrics", label: "Автоэлектрика" },
  { id: "extras", label: "Допоборудование" },
  { id: "noise", label: "Шумоизоляция" },
  { id: "sound", label: "Автозвук" },
  { id: "upholstery", label: "Перетяжка" }
];

const GEOGRAPHIES = [
  { id: "local", label: "Чебоксары / Чувашия" },
  { id: "nearby", label: "Йошкар-Ола, Н. Новгород" },
  { id: "major", label: "Казань и крупные города" }
];

const SERVICE_GROUP_IDS = SERVICE_GROUPS.map((g) => g.id);
const GEOGRAPHY_IDS = GEOGRAPHIES.map((g) => g.id);

/**
 * @typedef {Object} BenchmarkRow
 * @property {string} group          one of SERVICE_GROUP_IDS
 * @property {string} geography      one of GEOGRAPHY_IDS
 * @property {string} name           service as the market names it
 * @property {string} unit
 * @property {number} min
 * @property {number} typicalLow
 * @property {number} typicalHigh
 * @property {number} high
 * @property {string[]} crmArticles  catalog_items.article codes we map to
 * @property {string[]|null} factMatch LIKE patterns for order_lines.name_lc
 * @property {string} competitors
 * @property {string} note
 */

/** @type {BenchmarkRow[]} */
const benchmarkRows = [
  // ---------------------------------------------------------------- Мойка
  {
    group: "wash",
    geography: "local",
    name: "Комплексная мойка (кузов + салон)",
    unit: "авто",
    min: 800,
    typicalLow: 1100,
    typicalHigh: 2200,
    high: 2300,
    crmArticles: ["W-00035", "W-00036"],
    factMatch: null,
    competitors: "Clean Car 1550–2200 · Cleanol от 800 · H2O 1000–2300",
    note: "Наш «Комплекс Базовый» = 3 фазы + влажная уборка + пылесос + стёкла"
  },
  {
    group: "wash",
    geography: "local",
    name: "Двухфазная мойка кузова",
    unit: "авто",
    min: 700,
    typicalLow: 1000,
    typicalHigh: 1400,
    high: 1500,
    crmArticles: ["W-00005"],
    factMatch: null,
    competitors: "Clean Car евромойка от 1000 · H2O бесконтактная 500–1300",
    note: "Базовый класс; кроссовер/джип дороже на 20–40%"
  },
  {
    group: "wash",
    geography: "local",
    name: "Трёхфазная (нано) мойка",
    unit: "авто",
    min: 1000,
    typicalLow: 1300,
    typicalHigh: 1900,
    high: 2000,
    crmArticles: ["W-00009"],
    factMatch: null,
    competitors: "Clean Car нано-мойка от 1300",
    note: "Мы в рынке по базовому классу"
  },
  {
    group: "wash",
    geography: "local",
    name: "Техническая / экспресс мойка",
    unit: "авто",
    min: 200,
    typicalLow: 350,
    typicalHigh: 700,
    high: 800,
    crmArticles: ["W-00001"],
    factMatch: null,
    competitors: "H2O экспресс 200–800 · самообслуживание от 100",
    note: "Ниже рынка идти нельзя — упор на скорость, не на цену"
  },
  {
    group: "wash",
    geography: "local",
    name: "Детейлинг-мойка",
    unit: "авто",
    min: 4000,
    typicalLow: 4000,
    typicalHigh: 7000,
    high: 12999,
    crmArticles: ["W-00038"],
    factMatch: null,
    competitors: "Детейлинг Альянс (детейлинг мойка + глина) · студии от 4000",
    note: "Локально предложение узкое — можно держать верх диапазона"
  },
  {
    group: "wash",
    geography: "local",
    name: "Пылесос / влажная уборка салона",
    unit: "авто",
    min: 300,
    typicalLow: 400,
    typicalHigh: 700,
    high: 800,
    crmArticles: ["W-00013", "W-00017"],
    factMatch: null,
    competitors: "входит в комплексы у большинства моек",
    note: "Продаётся в основном как часть комплекса"
  },
  {
    group: "wash",
    geography: "local",
    name: "Антидождь (передняя полусфера)",
    unit: "авто",
    min: 1299,
    typicalLow: 1299,
    typicalHigh: 2500,
    high: 3000,
    crmArticles: ["W-00024"],
    factMatch: null,
    competitors: "Детейлинг Альянс от 1299 · студии НН 2500",
    note: "Мы на верхней границе; зеркала считаем отдельно (W-00022)"
  },
  {
    group: "wash",
    geography: "local",
    name: "Мойка двигателя (диэлектрическая)",
    unit: "авто",
    min: 2000,
    typicalLow: 2500,
    typicalHigh: 4500,
    high: 5000,
    crmArticles: ["W-00031"],
    factMatch: null,
    competitors: "Cleanol мойка двигателя · Казань химчистка ДВС 4500",
    note: "Диэлектрический состав — аргумент для верхней цены"
  },
  {
    group: "wash",
    geography: "local",
    name: "Металлические вкрапления / антибитум",
    unit: "кузов",
    min: 750,
    typicalLow: 750,
    typicalHigh: 2000,
    high: 2000,
    crmArticles: ["W-00030", "W-00028"],
    factMatch: null,
    competitors: "НН 750 за каждую операцию · входит в детейлинг-мойку",
    note: "Хорошая допродажа к 2-фазной мойке"
  },
  {
    group: "wash",
    geography: "local",
    name: "Озонация салона",
    unit: "авто",
    min: 500,
    typicalLow: 800,
    typicalHigh: 2500,
    high: 2500,
    crmArticles: ["W-00040"],
    factMatch: null,
    competitors: "Чебоксары озонирование 500 · Казань полный цикл 2500",
    note: "Разброс огромный — зависит от длительности цикла"
  },
  {
    group: "wash",
    geography: "nearby",
    name: "Двухфазная мойка кузова",
    unit: "седан / кроссовер / джип",
    min: 2500,
    typicalLow: 2500,
    typicalHigh: 3500,
    high: 3500,
    crmArticles: ["W-00005"],
    factMatch: null,
    competitors: "CUSTOM (Н. Новгород) 2500 / 3000 / 3500",
    note: "Детейлинг-студия, не поточная мойка"
  },
  {
    group: "wash",
    geography: "nearby",
    name: "Трёхфазная мойка + кварц",
    unit: "седан / кроссовер / джип",
    min: 3500,
    typicalLow: 3500,
    typicalHigh: 4500,
    high: 4500,
    crmArticles: ["W-00009", "W-00034"],
    factMatch: null,
    competitors: "CUSTOM (Н. Новгород) 3500 / 4000 / 4500",
    note: "Кварц включён в цену"
  },
  {
    group: "wash",
    geography: "major",
    name: "Комплексная мойка 3 фазы",
    unit: "авто",
    min: 2700,
    typicalLow: 2700,
    typicalHigh: 3500,
    high: 3500,
    crmArticles: ["W-00035"],
    factMatch: null,
    competitors: "v8auto (Казань) 2700–3500 · Aqua City евро-комплекс 2700–4400",
    note: "Наш комплекс совпадает с ценой Казани — это и есть главный вопрос"
  },
  {
    group: "wash",
    geography: "major",
    name: "Комплекс «всё включено»",
    unit: "авто",
    min: 3700,
    typicalLow: 3700,
    typicalHigh: 4600,
    high: 4600,
    crmArticles: ["W-00038"],
    factMatch: null,
    competitors: "v8auto (Казань) 3700–4600",
    note: "Мойка + воск + частичная химчистка"
  },
  {
    group: "wash",
    geography: "major",
    name: "Комплексный детейлинг",
    unit: "авто",
    min: 24000,
    typicalLow: 24000,
    typicalHigh: 36000,
    high: 110000,
    crmArticles: [],
    factMatch: null,
    competitors: "v8auto (Казань) 24000–36000 · полный комплекс 80000–110000",
    note: "Потолок рынка: мойка + ДВС + химчистка с разбором + полировка + керамика"
  },

  // ------------------------------------------------------------ Химчистка
  {
    group: "chem",
    geography: "local",
    name: "Полная химчистка салона",
    unit: "авто",
    min: 6500,
    typicalLow: 7000,
    typicalHigh: 10000,
    high: 10000,
    crmArticles: ["W-00006"],
    factMatch: null,
    competitors: "Формула 21 8000–10000 · частники 6500–8000 · greenholl 4900",
    note: "У нас 12000, но с полным разбором — надо подчёркивать разбор"
  },
  {
    group: "chem",
    geography: "local",
    name: "Углублённая уборка салона (без разбора)",
    unit: "авто",
    min: 2310,
    typicalLow: 3230,
    typicalHigh: 4900,
    high: 6880,
    crmArticles: ["W-00010"],
    factMatch: null,
    competitors: "Профи.ру Чебоксары от 2310, средн. 3230, макс. 6880",
    note: "Профи.ру — частные мастера, не студии"
  },
  {
    group: "chem",
    geography: "local",
    name: "Химчистка сиденья",
    unit: "1 шт",
    min: 460,
    typicalLow: 750,
    typicalHigh: 1000,
    high: 1200,
    crmArticles: ["W-00002"],
    factMatch: ["химчистка сидени%"],
    competitors: "Формула 21: 4 сиденья от 3000 → ~750/шт",
    note: "В каталоге 1000, по заказам уже продаём по 1500"
  },
  {
    group: "chem",
    geography: "local",
    name: "Химчистка дверных карт",
    unit: "1 дверь",
    min: 500,
    typicalLow: 500,
    typicalHigh: 700,
    high: 900,
    crmArticles: ["W-00014"],
    factMatch: null,
    competitors: "Формула 21 500–700 за дверь",
    note: "Наши 2000 — уточнить, за все карты или за одну"
  },
  {
    group: "chem",
    geography: "local",
    name: "Химчистка потолка",
    unit: "авто",
    min: 1520,
    typicalLow: 2500,
    typicalHigh: 3500,
    high: 3500,
    crmArticles: [],
    factMatch: ["химчистка потолка"],
    competitors: "Формула 21 2500–3500 · Профи.ру от 1520",
    note: "Нет в каталоге — а спрос стабильный"
  },
  {
    group: "chem",
    geography: "local",
    name: "Химчистка ковролина (пол)",
    unit: "авто",
    min: 2500,
    typicalLow: 2500,
    typicalHigh: 3500,
    high: 3500,
    crmArticles: [],
    factMatch: null,
    competitors: "Формула 21 2500–3500",
    note: "Нет в каталоге"
  },
  {
    group: "chem",
    geography: "local",
    name: "Химчистка багажника",
    unit: "авто",
    min: 1000,
    typicalLow: 1000,
    typicalHigh: 1500,
    high: 1500,
    crmArticles: [],
    factMatch: null,
    competitors: "Формула 21 1000–1500",
    note: "Нет в каталоге, простая допродажа"
  },
  {
    group: "chem",
    geography: "nearby",
    name: "Химчистка комплекс",
    unit: "авто",
    min: 3500,
    typicalLow: 11000,
    typicalHigh: 16000,
    high: 16000,
    crmArticles: ["W-00006"],
    factMatch: null,
    competitors: "NovaLux (Н. Новгород) 11000–16000 · autocentrenn от 3500 · Йошкар-Ола 6000–8000",
    note: "Разброс = разница между студией и поточным сервисом"
  },
  {
    group: "chem",
    geography: "major",
    name: "Комплексная химчистка с багажником",
    unit: "авто",
    min: 15000,
    typicalLow: 15000,
    typicalHigh: 21000,
    high: 21000,
    crmArticles: ["W-00010"],
    factMatch: null,
    competitors: "v8auto (Казань) 15000–21000",
    note: "Без разбора"
  },
  {
    group: "chem",
    geography: "major",
    name: "Детейлинг химчистка с разбором",
    unit: "авто",
    min: 20000,
    typicalLow: 20000,
    typicalHigh: 28000,
    high: 28000,
    crmArticles: ["W-00006"],
    factMatch: null,
    competitors: "v8auto (Казань) 20000–28000",
    note: "Прямой аналог нашей позиции за 12000 — потолок рынка"
  },
  {
    group: "chem",
    geography: "major",
    name: "Химчистка сиденья (ткань)",
    unit: "1 шт",
    min: 1000,
    typicalLow: 2000,
    typicalHigh: 2000,
    high: 2000,
    crmArticles: ["W-00002"],
    factMatch: null,
    competitors: "v8auto (Казань) ткань 2000, кожа 1000–1600",
    note: "Кожа дешевле ткани — меньше трудозатрат"
  },

  // --------------------------------------------------------- Защита ЛКП
  {
    group: "protect",
    geography: "local",
    name: "Полировка абразивная (весь кузов)",
    unit: "авто",
    min: 7999,
    typicalLow: 12999,
    typicalHigh: 18000,
    high: 18000,
    crmArticles: [],
    factMatch: ["полировка"],
    competitors: "Детейлинг Альянс: лёгкая коррекция 7999, абразивная 12999 · 100 Машин глубокая 18000",
    note: "Нет в каталоге. Самый крупный недобор по чеку"
  },
  {
    group: "protect",
    geography: "local",
    name: "Полировка защитная / восстановительная",
    unit: "авто",
    min: 2000,
    typicalLow: 3000,
    typicalHigh: 5000,
    high: 6000,
    crmArticles: [],
    factMatch: ["полировка"],
    competitors: "TonCar 2000–3000 · 100 Машин 3000 · частники 6000",
    note: "В заказах разово продавали за 1000 — вдвое ниже минимума рынка"
  },
  {
    group: "protect",
    geography: "local",
    name: "Полировка локальная (1 элемент)",
    unit: "элемент",
    min: 900,
    typicalLow: 1900,
    typicalHigh: 3800,
    high: 3800,
    crmArticles: [],
    factMatch: null,
    competitors: "Детейлинг Альянс: локальная 900, элемент 1900, крыша/капот 3800",
    note: "Удобно продавать точечно после мойки"
  },
  {
    group: "protect",
    geography: "local",
    name: "Керамическое покрытие (1 слой)",
    unit: "авто",
    min: 3000,
    typicalLow: 6999,
    typicalHigh: 15000,
    high: 30000,
    crmArticles: [],
    factMatch: null,
    competitors: "Детейлинг Альянс от 6999 · TonCar 3000–5000 · 100 Машин 15000–30000",
    note: "Нет в каталоге. Требует поста и материалов, но чек в 5–10 раз выше кварца"
  },
  {
    group: "protect",
    geography: "local",
    name: "Жидкое стекло",
    unit: "авто",
    min: 2000,
    typicalLow: 2000,
    typicalHigh: 3000,
    high: 3000,
    crmArticles: [],
    factMatch: null,
    competitors: "100 Машин 2000–3000",
    note: "Промежуточная ступень между кварцем и керамикой"
  },
  {
    group: "protect",
    geography: "local",
    name: "Твёрдый воск",
    unit: "авто",
    min: 1500,
    typicalLow: 2000,
    typicalHigh: 2500,
    high: 3000,
    crmArticles: ["W-00033"],
    factMatch: null,
    competitors: "входит в комплексы моек · отдельно 1500–2500",
    note: "Мы в рынке"
  },
  {
    group: "protect",
    geography: "local",
    name: "Растираемый кварц",
    unit: "авто",
    min: 1000,
    typicalLow: 1000,
    typicalHigh: 2000,
    high: 2500,
    crmArticles: ["W-00034"],
    factMatch: null,
    competitors: "CUSTOM (Н. Новгород) кварц включён в 3-фазу · локально отдельного прайса мало",
    note: "Мы в рынке, но это низ ценовой лестницы защиты"
  },
  {
    group: "protect",
    geography: "local",
    name: "Полировка фар",
    unit: "1 шт / пара",
    min: 899,
    typicalLow: 1500,
    typicalHigh: 3600,
    high: 3600,
    crmArticles: [],
    factMatch: null,
    competitors: "Детейлинг Альянс: 899/шт, химическая пара 3600",
    note: "Нет в каталоге, а фары мы и так снимаем на электрике"
  },
  {
    group: "protect",
    geography: "major",
    name: "Керамика кожи салона",
    unit: "салон",
    min: 12000,
    typicalLow: 17000,
    typicalHigh: 17000,
    high: 17000,
    crmArticles: [],
    factMatch: null,
    competitors: "v8auto (Казань): сиденья от 12000, весь салон 17000",
    note: "Логичное продолжение химчистки с разбором"
  },

  // ------------------------------------------------------- Автоэлектрика
  {
    group: "electrics",
    geography: "local",
    name: "Компьютерная диагностика",
    unit: "усл.",
    min: 300,
    typicalLow: 800,
    typicalHigh: 1500,
    high: 2000,
    crmArticles: ["W-00007"],
    factMatch: ["диагностика электрики"],
    competitors: "autoservice-cheboksary от 800 · Вольтаж от 300 · считывание кодов 800, диагностика проводки 1500",
    note: "Наши 500 ниже основной массы. Самый простой резерв цены"
  },
  {
    group: "electrics",
    geography: "local",
    name: "Электромонтажные работы",
    unit: "час",
    min: 855,
    typicalLow: 1000,
    typicalHigh: 1900,
    high: 2500,
    crmArticles: ["W-00003"],
    factMatch: null,
    competitors: "okmasterok: ремонт автоэлектрики от 1900, проводка от 855",
    note: "Наши 1500/час — в рынке"
  },
  {
    group: "electrics",
    geography: "local",
    name: "Ремонт проводки",
    unit: "усл.",
    min: 855,
    typicalLow: 1000,
    typicalHigh: 1500,
    high: 2000,
    crmArticles: [],
    factMatch: ["ремонт проводки", "работа с проводкой", "ревизия проводки%"],
    competitors: "Базовый пр. 9: замена/ремонт проводки 1000, диагностика 1500",
    note: "Продаём часто, но позиции в каталоге нет"
  },
  {
    group: "electrics",
    geography: "local",
    name: "Ремонт приборной панели",
    unit: "усл.",
    min: 1200,
    typicalLow: 2500,
    typicalHigh: 3000,
    high: 3500,
    crmArticles: [],
    factMatch: ["%приборной панели", "%приборной  панели"],
    competitors: "Базовый пр. 9: ремонт приборной панели 2500",
    note: "По заказам берём 1200–3000 — стоит зафиксировать 2500"
  },
  {
    group: "electrics",
    geography: "local",
    name: "Замена подрулевого шлейфа",
    unit: "усл.",
    min: 600,
    typicalLow: 2000,
    typicalHigh: 2000,
    high: 2500,
    crmArticles: [],
    factMatch: ["замена подрулевого шлейфа"],
    competitors: "Базовый пр. 9: 2000",
    note: "Наши 2000 — точно в рынке"
  },
  {
    group: "electrics",
    geography: "local",
    name: "Замена фар / габаритов",
    unit: "усл.",
    min: 200,
    typicalLow: 500,
    typicalHigh: 800,
    high: 1000,
    crmArticles: ["W-00008"],
    factMatch: null,
    competitors: "Базовый пр. 9 и частники 300–800",
    note: "Мы на верхней границе"
  },
  {
    group: "electrics",
    geography: "local",
    name: "Снятие / установка бампера",
    unit: "усл.",
    min: 1000,
    typicalLow: 1500,
    typicalHigh: 2500,
    high: 3000,
    crmArticles: ["W-00025"],
    factMatch: null,
    competitors: "кузовные и электро-сервисы 1000–2500",
    note: "Сопутствующая операция для ПТФ, парктроника, сеток"
  },

  // ---------------------------------------------------- Допоборудование
  {
    group: "extras",
    geography: "local",
    name: "Установка сигнализации (только работа)",
    unit: "усл.",
    min: 2375,
    typicalLow: 3000,
    typicalHigh: 5000,
    high: 6000,
    crmArticles: ["W-00027"],
    factMatch: null,
    competitors: "okmasterok от 2375 · Казань от 3700 · Н. Новгород: обратная связь 4000, автозапуск 5000",
    note: "Наши 8000 выше рынка. Разделить на «базовая» и «автозапуск + CAN»"
  },
  {
    group: "extras",
    geography: "local",
    name: "Установка парктроника",
    unit: "усл.",
    min: 1380,
    typicalLow: 2080,
    typicalHigh: 2900,
    high: 4000,
    crmArticles: ["W-00015"],
    factMatch: null,
    competitors: "Профи.ру от 1380, средн. 2080, макс. 3690 · сервисы 1500–2900",
    note: "Наши 2500 — в рынке, ближе к верху"
  },
  {
    group: "extras",
    geography: "local",
    name: "Установка камеры заднего вида",
    unit: "усл.",
    min: 1500,
    typicalLow: 2000,
    typicalHigh: 2200,
    high: 3500,
    crmArticles: ["W-00011"],
    factMatch: null,
    competitors: "СанпаGarage 2000 · Казань от 2200 · Киров от 3500",
    note: "Наши 2000 — ровно в рынке"
  },
  {
    group: "extras",
    geography: "local",
    name: "Установка ПТФ",
    unit: "усл.",
    min: 1500,
    typicalLow: 3000,
    typicalHigh: 3000,
    high: 3500,
    crmArticles: ["W-00023"],
    factMatch: null,
    competitors: "СанпаGarage 3000",
    note: "Наши 3000 без проводки — совпадает"
  },
  {
    group: "extras",
    geography: "local",
    name: "Установка видеорегистратора",
    unit: "усл.",
    min: 1200,
    typicalLow: 1550,
    typicalHigh: 2000,
    high: 2500,
    crmArticles: ["W-00018", "W-00032"],
    factMatch: null,
    competitors: "Казань от 1550 · скрытая проводка дороже",
    note: "У нас скрытое подключение 1200 и от сигнализации 1500"
  },
  {
    group: "extras",
    geography: "local",
    name: "Установка контурной подсветки",
    unit: "усл.",
    min: 3000,
    typicalLow: 5000,
    typicalHigh: 8000,
    high: 10000,
    crmArticles: ["W-00012"],
    factMatch: null,
    competitors: "тюнинг-ателье 3000–10000, открытых прайсов мало",
    note: "Ниша с непрозрачной ценой — держим 6000"
  },
  {
    group: "extras",
    geography: "local",
    name: "Установка «американок»",
    unit: "усл.",
    min: 2000,
    typicalLow: 3000,
    typicalHigh: 4000,
    high: 5000,
    crmArticles: ["W-00016"],
    factMatch: null,
    competitors: "тюнинг-ателье 2000–4000",
    note: "Мы в рынке"
  },
  {
    group: "extras",
    geography: "local",
    name: "Установка гудков",
    unit: "усл.",
    min: 500,
    typicalLow: 800,
    typicalHigh: 3200,
    high: 4000,
    crmArticles: ["W-00019", "W-00039"],
    factMatch: null,
    competitors: "прямых прайсов почти нет; считается как «доп. оборудование от 950»",
    note: "У нас разделено: без проводки 800, с проводкой 3200 — правильная логика"
  },
  {
    group: "extras",
    geography: "local",
    name: "Установка маяков / ГСМ, световых балок",
    unit: "усл.",
    min: 2000,
    typicalLow: 3000,
    typicalHigh: 4000,
    high: 5000,
    crmArticles: ["W-00029", "W-00004"],
    factMatch: null,
    competitors: "спецтранспорт-установщики 2000–5000",
    note: "B2B-ниша, цена договорная"
  },
  {
    group: "extras",
    geography: "major",
    name: "Установка сигнализации (работа)",
    unit: "усл.",
    min: 3700,
    typicalLow: 3700,
    typicalHigh: 5000,
    high: 5000,
    crmArticles: ["W-00027"],
    factMatch: null,
    competitors: "Авторазбор-М7 (Казань) от 3700 · Н. Новгород 4000–5000",
    note: "Даже в Казани работа дешевле наших 8000"
  },
  {
    group: "extras",
    geography: "major",
    name: "Охранный комплекс StarLine с установкой",
    unit: "комплект",
    min: 14950,
    typicalLow: 20000,
    typicalHigh: 45400,
    high: 74300,
    crmArticles: [],
    factMatch: ["сигнализация starline"],
    competitors: "Фирменный центр StarLine (Чебоксары, Лесная 2): A63 от 14950, A93 20450, S97 40450, B97 74300",
    note: "Ориентир «под ключ»: оборудование + работа у авторизованного центра"
  },

  // ------------------------------------------------------- Шумоизоляция
  {
    group: "noise",
    geography: "local",
    name: "Шумоизоляция двери",
    unit: "1 дверь",
    min: 1500,
    typicalLow: 2500,
    typicalHigh: 3750,
    high: 6000,
    crmArticles: [],
    factMatch: ["шумоизоляция двери%", "шумоизоляция обшивки двери"],
    competitors: "autoservice-cheboksary 4 двери от 6000 (~1500/шт) · antikorlab от 15000 (~3750/шт)",
    note: "Продаём по 2500 — в рынке, но позиции в каталоге нет"
  },
  {
    group: "noise",
    geography: "local",
    name: "Шумоизоляция колесной арки",
    unit: "1 арка",
    min: 500,
    typicalLow: 2200,
    typicalHigh: 2500,
    high: 14250,
    crmArticles: [],
    factMatch: ["шумоизоляция колесных арок"],
    competitors: "autoservice-cheboksary 4 арки от 2000 (~500/шт) · antikorlab 10000 (~2500/шт) · Prestige премиум 47500–57000 за 4",
    note: "Продаём по 2200 — верх массового сегмента"
  },
  {
    group: "noise",
    geography: "local",
    name: "Комплекс: 4 двери + 4 арки",
    unit: "авто",
    min: 13900,
    typicalLow: 15000,
    typicalHigh: 30000,
    high: 30000,
    crmArticles: [],
    factMatch: null,
    competitors: "dress4car 13900 (седан) · autoservice-cheboksary от 15000 · Prestige «Стандарт» 25000–30000",
    note: "Наш эквивалент по факту ~18800. Пакет продавать выгоднее, чем поштучно"
  },
  {
    group: "noise",
    geography: "local",
    name: "Шумоизоляция пола",
    unit: "авто",
    min: 8000,
    typicalLow: 8000,
    typicalHigh: 20000,
    high: 20000,
    crmArticles: [],
    factMatch: null,
    competitors: "autoservice-cheboksary от 8000 · antikorlab от 20000",
    note: "Требует арматурных работ (разбор салона) — считать отдельно"
  },
  {
    group: "noise",
    geography: "local",
    name: "Шумоизоляция багажника / крыши / капота",
    unit: "зона",
    min: 4000,
    typicalLow: 6000,
    typicalHigh: 10000,
    high: 10000,
    crmArticles: [],
    factMatch: null,
    competitors: "капот от 4000 · крыша от 6000 · багажник 6000–10000",
    note: "Логичные допродажи к комплексу"
  },
  {
    group: "noise",
    geography: "local",
    name: "Арматурные работы (разбор салона)",
    unit: "авто",
    min: 4000,
    typicalLow: 4000,
    typicalHigh: 5000,
    high: 5000,
    crmArticles: [],
    factMatch: null,
    competitors: "autoservice-cheboksary от 4000 (без торпедо)",
    note: "Отдельная строка — иначе трудозатраты уходят в минус"
  },
  {
    group: "noise",
    geography: "local",
    name: "Комплексная шумоизоляция автомобиля",
    unit: "авто",
    min: 15000,
    typicalLow: 25000,
    typicalHigh: 50000,
    high: 131100,
    crmArticles: [],
    factMatch: null,
    competitors: "autoservice-cheboksary от 15000 · antikorlab от 50000 · Prestige «Люкс» до 131100",
    note: "Верх рынка — премиальные материалы и полный разбор"
  },

  // ----------------------------------------------------------- Автозвук
  {
    group: "sound",
    geography: "local",
    name: "Установка усилителя / сабвуфера",
    unit: "усл.",
    min: 1850,
    typicalLow: 2000,
    typicalHigh: 3500,
    high: 8000,
    crmArticles: [],
    factMatch: ["%усилител%", "%сабвуфер%"],
    competitors: "локальные прайсы закрыты (StarLine Чебоксары делает автоакустику без публичной цены)",
    note: "Продаём инсталляцию за 3500 — верх массового сегмента"
  },
  {
    group: "sound",
    geography: "local",
    name: "Замена дверных карт + установка динамиков",
    unit: "1 дверь",
    min: 500,
    typicalLow: 1000,
    typicalHigh: 1600,
    high: 2000,
    crmArticles: [],
    factMatch: ["%динамик%"],
    competitors: "Казань: установка/замена динамиков от 500/дверь",
    note: "У нас 1600/дверь с протяжкой провода — оправдано объёмом работ"
  },
  {
    group: "sound",
    geography: "major",
    name: "Установка сабвуфера",
    unit: "усл.",
    min: 1250,
    typicalLow: 1850,
    typicalHigh: 2400,
    high: 2400,
    crmArticles: [],
    factMatch: ["%сабвуфер%"],
    competitors: "Казань: Premium Motors от 1250, Авторазбор-М7 от 1850, студии до 2400",
    note: "Массовый сегмент Казани дешевле нашего"
  },
  {
    group: "sound",
    geography: "major",
    name: "Установка + настройка усилителя (студия)",
    unit: "усл.",
    min: 1900,
    typicalLow: 2000,
    typicalHigh: 8000,
    high: 12500,
    crmArticles: [],
    factMatch: ["%усилител%"],
    competitors: "Казань: эконом от 1900–2000 · VinylKazan установка 8000 + настройка 4500",
    note: "Разрыв 4x между эконом- и студийным исполнением — есть куда расти"
  },
  {
    group: "sound",
    geography: "major",
    name: "Установка магнитолы (2 din / Android)",
    unit: "усл.",
    min: 700,
    typicalLow: 1200,
    typicalHigh: 1450,
    high: 2500,
    crmArticles: [],
    factMatch: ["%магнитол%"],
    competitors: "Казань: 1 din от 700–850, 2 din от 1200–1450, с камерой 2500",
    note: "Нет ни в каталоге, ни в заказах — потенциальная услуга"
  },

  // ---------------------------------------------------------- Перетяжка
  {
    group: "upholstery",
    geography: "local",
    name: "Перетяжка руля",
    unit: "1 руль",
    min: 500,
    typicalLow: 2500,
    typicalHigh: 4000,
    high: 5080,
    crmArticles: [],
    factMatch: ["перетяжка руля"],
    competitors: "MiDi 2500 · alonti 4000 · dress4car 3000 · Профи.ру средн. 3160, макс. 5080",
    note: "Продаём по 1500 — ниже минимума ателье. Явный резерв"
  },
  {
    group: "upholstery",
    geography: "local",
    name: "Перетяжка потолка",
    unit: "авто",
    min: 6000,
    typicalLow: 6000,
    typicalHigh: 7000,
    high: 8470,
    crmArticles: [],
    factMatch: ["перетяжка потолка"],
    competitors: "MiDi 6000 · alonti со стойками от 7000 · алькантара до 8470",
    note: "Продаём по 5000 — ниже локального минимума"
  },
  {
    group: "upholstery",
    geography: "local",
    name: "Перетяжка дверных карт",
    unit: "1 элемент",
    min: 1000,
    typicalLow: 1500,
    typicalHigh: 2500,
    high: 2500,
    crmArticles: [],
    factMatch: ["перетяжка дверных карт"],
    competitors: "MiDi 1000–2500 · dress4car 1500",
    note: "Хорошая допродажа к шумоизоляции дверей"
  },
  {
    group: "upholstery",
    geography: "local",
    name: "Перетяжка салона (комплект сидений)",
    unit: "комплект",
    min: 10000,
    typicalLow: 10000,
    typicalHigh: 35000,
    high: 35000,
    crmArticles: [],
    factMatch: null,
    competitors: "alonti от 10000 (без материала) · MiDi 35000 под ключ",
    note: "Разброс = с материалом или без. Считать двумя строками"
  },
  {
    group: "upholstery",
    geography: "local",
    name: "Перетяжка / ремонт торпедо",
    unit: "усл.",
    min: 5000,
    typicalLow: 5000,
    typicalHigh: 7000,
    high: 7000,
    crmArticles: [],
    factMatch: null,
    competitors: "MiDi 7000 · alonti восстановление от 5000",
    note: "Нет в каталоге"
  },
  {
    group: "upholstery",
    geography: "local",
    name: "Перетяжка юбки КПП / подлокотника",
    unit: "1 элемент",
    min: 600,
    typicalLow: 600,
    typicalHigh: 1500,
    high: 2000,
    crmArticles: [],
    factMatch: null,
    competitors: "MiDi юбка КПП 600 · подлокотники от 2180 (Профи.ру)",
    note: "Мелкая допродажа при снятой консоли"
  },
  {
    group: "upholstery",
    geography: "local",
    name: "Ремонт сидений (протёртые места, поролон)",
    unit: "1 элемент",
    min: 1380,
    typicalLow: 1500,
    typicalHigh: 2000,
    high: 3000,
    crmArticles: [],
    factMatch: null,
    competitors: "alonti замена протёртых мест от 1500 · Профи.ру замена поролона от 1380",
    note: "Мы уже снимаем/разбираем сиденья на электрике — синергия"
  },
  {
    group: "upholstery",
    geography: "local",
    name: "Обтяжка пластика карпетом",
    unit: "1 элемент",
    min: 500,
    typicalLow: 1000,
    typicalHigh: 1500,
    high: 2000,
    crmArticles: [],
    factMatch: ["обтяжка пластика карпета", "покраска пластика"],
    competitors: "MiDi ремонт пластиковых элементов 1500",
    note: "Продаём по 500 — вдвое ниже ателье"
  }
];

/**
 * Directions we sell (or could sell) with no catalog position at all.
 * Rendered as a separate card so the owner can create the item right away.
 */
const niches = [
  {
    name: "Абразивная полировка кузова",
    localPrice: "7 999 – 18 000 ₽",
    competitors: "Детейлинг Альянс, 100 Машин, TonCar",
    why: "Мы уже делаем мойку и кварц — полировка это следующая ступень чека"
  },
  {
    name: "Керамическое покрытие",
    localPrice: "6 999 – 30 000 ₽",
    competitors: "Детейлинг Альянс от 6999, 100 Машин 15000–30000",
    why: "Чек в 5–10 раз выше растираемого кварца при том же посте"
  },
  {
    name: "Полировка фар",
    localPrice: "899 – 3 600 ₽",
    competitors: "Детейлинг Альянс 899/шт, химическая пара 3600",
    why: "Фары и так снимаем на электрике — операция почти без доп. затрат"
  },
  {
    name: "Химчистка потолка и багажника отдельно",
    localPrice: "1 000 – 3 500 ₽",
    competitors: "Формула 21: потолок 2500–3500, багажник 1000–1500",
    why: "Сейчас продаётся только внутри полной химчистки"
  },
  {
    name: "Установка магнитолы (2 din / Android)",
    localPrice: "1 200 – 2 500 ₽",
    competitors: "Казань 1200–1450, с камерой 2500",
    why: "Инфраструктура для автозвука уже есть"
  }
];

/**
 * Concrete price moves backed by the rows above.
 */
const priceAdvice = [
  {
    service: "Диагностика электрики",
    current: "500 ₽",
    suggested: "800 ₽",
    reason: "Локальный рынок 800–1500 ₽; ниже нас только выездные частники"
  },
  {
    service: "Перетяжка руля",
    current: "1 500 ₽ (по заказам)",
    suggested: "2 500 – 3 000 ₽",
    reason: "MiDi 2500, alonti 4000, средняя Профи.ру 3160"
  },
  {
    service: "Перетяжка потолка",
    current: "5 000 ₽ (по заказам)",
    suggested: "6 500 ₽",
    reason: "Ниже локального минимума 6000 ₽"
  },
  {
    service: "Химчистка сиденья",
    current: "1 000 ₽ в каталоге",
    suggested: "1 500 ₽",
    reason: "Уже продаём по 1500; Казань 2000/шт"
  },
  {
    service: "Шумоизоляция 4 двери + 4 арки",
    current: "~18 800 ₽ поштучно",
    suggested: "Пакет 19 900 ₽",
    reason: "Локальные пакеты 15000–30000 ₽; пакет продаётся легче поштучного"
  },
  {
    service: "Установка сигнализации",
    current: "8 000 ₽ одной позицией",
    suggested: "Базовая 4 000 ₽ / с автозапуском и CAN 8 000 ₽",
    reason: "Рынок работы 2375–5000 ₽; единая цена 8000 отпугивает простые заказы"
  },
  {
    service: "Комплекс Базовый (мойка)",
    current: "3 000 – 3 600 ₽",
    suggested: "Добавить эконом-комплекс 1 900 ₽",
    reason: "Локальные комплексы 800–2200 ₽; нужен вход в воронку, верх оставить как есть"
  },
  {
    service: "Полная химчистка с разбором",
    current: "12 000 ₽",
    suggested: "Оставить, усилить подачу «с разбором»",
    reason: "Локально без разбора 8000–10000, Казань с разбором 20000–28000 — мы дешёвые"
  }
];

const sources = [
  { name: "2ГИС Чебоксары (Clean Car, Cleanol, S-Class)", scope: "мойка" },
  { name: "H2O Auto — прайс по 5 классам", scope: "мойка" },
  { name: "Формула 21, Марпосадское шоссе 7Б", scope: "химчистка" },
  { name: "Профи.ру Чувашия / Казань", scope: "химчистка, руль, парктроник" },
  { name: "Детейлинг студия Альянс", scope: "полировка, керамика, антидождь" },
  { name: "100 Машин, TonCar", scope: "полировка, керамика, тонировка" },
  { name: "autoservice-cheboksary.ru", scope: "диагностика, шумоизоляция" },
  { name: "Автосервис Вольтаж, Хевешская 36г", scope: "автоэлектрика" },
  { name: "antikorlab, Prestige Detailing, dress4car", scope: "шумоизоляция" },
  { name: "Автоателье MiDi, alonti", scope: "перетяжка" },
  { name: "СанпаGarage, Клубная 15А", scope: "ПТФ, камера" },
  { name: "Фирменный центр StarLine, Лесная 2", scope: "сигнализации" },
  { name: "Aqua City, v8auto (Казань)", scope: "бенчмарк мойка, химчистка" },
  { name: "CUSTOM, NovaLux (Н. Новгород)", scope: "бенчмарк мойка, химчистка" },
  { name: "VinylKazan, Авторазбор-М7 (Казань)", scope: "бенчмарк автозвук" }
];

const tips = [
  "Цены «от» на сайтах конкурентов — это базовый класс авто. Сравнивать нужно по нашему tier 1.",
  "Мойка держит цену Казани в Чебоксарах — либо усиливаем аргументацию комплекса, либо добавляем эконом-вход.",
  "Услуги вне каталога (шумка, автозвук, перетяжка) — занести позициями, иначе цена каждый раз договорная и нет статистики.",
  "Защита ЛКП: между нашим кварцем 1–2 тыс. и локальной керамикой 7–30 тыс. пустая ступень. Это самый крупный резерв маржи.",
  "Профи.ру показывает ставки частных мастеров, а не студий — использовать как нижнюю границу, не как ориентир."
];

function normalizeFilter(value, allowed, fallback) {
  const v = String(value ?? fallback).toLowerCase();
  return allowed.includes(v) ? v : fallback;
}

function normalizeService(value) {
  return normalizeFilter(value, ["all", ...SERVICE_GROUP_IDS], "all");
}

function normalizeGeography(value) {
  return normalizeFilter(value, ["all", ...GEOGRAPHY_IDS], "all");
}

/**
 * Pure filtering over the static snapshot. DB-aware comparison lives in
 * lib/marketBenchmark.js.
 *
 * @param {{ service?: string, geography?: string }} filters
 */
function filterMarketData(filters = {}) {
  const service = normalizeService(filters.service);
  const geography = normalizeGeography(filters.geography);

  const rows = benchmarkRows.filter(
    (row) =>
      (service === "all" || row.group === service) &&
      (geography === "all" || row.geography === geography)
  );

  return {
    snapshotDate: SNAPSHOT_DATE,
    service,
    geography,
    serviceGroups: SERVICE_GROUPS,
    geographies: GEOGRAPHIES,
    rows,
    niches,
    priceAdvice,
    sources,
    tips
  };
}

module.exports = {
  SNAPSHOT_DATE,
  SERVICE_GROUPS,
  GEOGRAPHIES,
  SERVICE_GROUP_IDS,
  GEOGRAPHY_IDS,
  benchmarkRows,
  niches,
  priceAdvice,
  sources,
  tips,
  filterMarketData,
  normalizeService,
  normalizeGeography
};
