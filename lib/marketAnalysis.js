/**
 * Static market snapshot for auto-interior / colored seat belts (22 Jul 2026).
 * Source: docs/MARKET_ANALYSIS_AUTO_INTERIOR_2026.md — not live Avito scrape.
 */

const SNAPSHOT_DATE = "2026-07-22";

const priceRows = [
  {
    service: "belts",
    geography: "local",
    name: "Цветная лента, однотонная",
    unit: "1 ремень под ключ",
    min: "нет предложений",
    typical: "тест: 5 900 ₽",
    high: "—",
    competitors: "0 прямых",
    note: "Свободная ниша в просмотренной локальной выборке"
  },
  {
    service: "belts",
    geography: "russia",
    name: "Цветная лента, однотонная",
    unit: "1 ремень",
    min: "3 500 ₽ + метраж",
    typical: "5 500–12 000 ₽",
    high: "12 750 ₽",
    competitors: "11+ с ценой",
    note: "Основная масса стандартных офферов 5 000–9 000 ₽"
  },
  {
    service: "belts",
    geography: "russia",
    name: "Лента с принтом",
    unit: "1 ремень",
    min: "7 500 ₽",
    typical: "7 500–9 000 ₽",
    high: "15 000 ₽",
    competitors: "4 с ценой",
    note: "Верхний ориентир включает расширенную кастомизацию"
  },
  {
    service: "belts",
    geography: "russia",
    name: "Однотонный комплект",
    unit: "4–5 ремней",
    min: "20 000 ₽",
    typical: "20 000–30 000 ₽",
    high: "37 500 ₽",
    competitors: "5 с ценой",
    note: "Цена зависит от модели и сложности разборки"
  },
  {
    service: "interior",
    geography: "local",
    name: "Полный салон",
    unit: "комплект",
    min: "10 000 ₽ без материала",
    typical: "от 35 000 ₽",
    high: "—",
    competitors: "12 лидов / 6 подтверждены",
    note: "10 000 ₽ без материала; MiDi — от 35 000 ₽"
  },
  {
    service: "interior",
    geography: "russia",
    name: "Комплект сидений / 1–2 ряда",
    unit: "комплект",
    min: "10 000 ₽",
    typical: "50 000–78 375 ₽",
    high: "180 000 ₽",
    competitors: "30 наблюдений",
    note: "Материал и число рядов различаются"
  },
  {
    service: "interior",
    geography: "local",
    name: "Потолок",
    unit: "автомобиль",
    min: "6 000 ₽",
    typical: "от 6 000 ₽",
    high: "—",
    competitors: "2 подтверждены",
    note: "Стойки и люк могут считаться отдельно"
  },
  {
    service: "interior",
    geography: "russia",
    name: "Потолок, базовый материал",
    unit: "автомобиль",
    min: "6 000 ₽",
    typical: "10 000–20 000 ₽",
    high: "165 000 ₽",
    competitors: "21 наблюдение",
    note: "Премиальные материалы расширяют верх"
  },
  {
    service: "interior",
    geography: "local",
    name: "Руль",
    unit: "1 руль",
    min: "2 500 ₽",
    typical: "2 500–4 000 ₽",
    high: "4 000 ₽",
    competitors: "4 подтверждены",
    note: "Форма руля и материал меняют смету"
  },
  {
    service: "interior",
    geography: "russia",
    name: "Руль",
    unit: "1 руль",
    min: "2 500 ₽",
    typical: "3 500–6 500 ₽",
    high: "15 000 ₽",
    competitors: "37 наблюдений",
    note: "Модель, материал, airbag и подогрев влияют"
  },
  {
    service: "interior",
    geography: "russia",
    name: "Поролон сиденья",
    unit: "1 элемент",
    min: "1 900 ₽",
    typical: "1 900–5 500 ₽",
    high: "5 500 ₽",
    competitors: "2 явных прайса",
    note: "Данных недостаточно для медианы"
  },
  {
    service: "interior",
    geography: "local",
    name: "Дверная карта",
    unit: "1 элемент",
    min: "1 000 ₽",
    typical: "1 000–2 500 ₽",
    high: "2 500 ₽",
    competitors: "2 подтверждены",
    note: "Материал обычно влияет отдельно"
  },
  {
    service: "interior",
    geography: "local",
    name: "Юбка КПП",
    unit: "1 элемент",
    min: "600 ₽",
    typical: "от 600 ₽",
    high: "—",
    competitors: "3 подтверждены",
    note: "Подходит как допродажа"
  }
];

const beltOffers = [
  {
    name: "Швейный цех",
    city: "Санкт-Петербург",
    solid: "от 3 500 ₽ + лента",
    print: "—",
    note: "раздельный прайс",
    priceRub: 3500
  },
  {
    name: "MA Studio",
    city: "Санкт-Петербург",
    solid: "5 000 ₽",
    print: "—",
    note: "горячий рез и запайка",
    priceRub: 5000
  },
  {
    name: "Medvedev AutoLab",
    city: "Екатеринбург",
    solid: "5 000 ₽",
    print: "8 000 ₽",
    note: "комплект 20–32 тыс. ₽",
    priceRub: 5000
  },
  {
    name: "Platinum Garage",
    city: "Санкт-Петербург",
    solid: "6 000 ₽",
    print: "7 500 ₽",
    note: "снятие/установка включены",
    priceRub: 6000
  },
  {
    name: "Vinyl Style",
    city: "Казань",
    solid: "6 000 ₽",
    print: "—",
    note: "пара 12 тыс.; 5 шт. 30 тыс.",
    priceRub: 6000
  },
  {
    name: "АвтоХайп",
    city: "Москва/Екатеринбург",
    solid: "7 000 ₽",
    print: "9 000 ₽",
    note: "2 шт. 11 тыс.; 5 шт. 25 тыс.",
    priceRub: 7000
  },
  {
    name: "Eastline Garage",
    city: "Москва",
    solid: "8 000 ₽",
    print: "+6 000 ₽",
    note: "демонтаж от 1 500 ₽ отдельно",
    priceRub: 8000
  },
  {
    name: "ПерешивАвтоСалона",
    city: "Москва",
    solid: "8 500 ₽",
    print: "—",
    note: "весь салон от 37 500 ₽",
    priceRub: 8500
  },
  {
    name: "Grand Design",
    city: "Москва",
    solid: "9 000 ₽",
    print: "—",
    note: "срок от 4 часов",
    priceRub: 9000
  },
  {
    name: "Hell Hound Custom",
    city: "Санкт-Петербург",
    solid: "12 750 ₽",
    print: "+4–15 тыс. ₽",
    note: "премиальная пара 25 500 ₽",
    priceRub: 12750
  }
];

const localCompetition = [
  {
    service: "Цветные ремни",
    competitors: "0 прямых",
    price: "нет локальной цены",
    verdict: "главная возможность"
  },
  {
    service: "Салон/сиденья",
    competitors: "12 / 6 подтверждены",
    price: "10 000 ₽ без материала",
    verdict: "занятый рынок"
  },
  {
    service: "Поролон",
    competitors: "1 подтверждён",
    price: "по фото/осмотру",
    verdict: "цена непрозрачна"
  },
  {
    service: "Потолок",
    competitors: "2 подтверждены",
    price: "от 6 000 ₽",
    verdict: "ценовая конкуренция"
  },
  {
    service: "Руль",
    competitors: "4 подтверждены",
    price: "2 500–4 000 ₽",
    verdict: "самая видимая ниша"
  },
  {
    service: "Дверные карты",
    competitors: "2",
    price: "1 000–2 500 ₽",
    verdict: "хорошая допродажа"
  }
];

const launchPrices = [
  { package: "Снятая катушка", price: "3 900 ₽/шт.", includes: "лента, перемотка, проверка хода" },
  { package: "Один ремень под ключ", price: "5 900 ₽/шт.", includes: "демонтаж, монтаж, фото процесса" },
  { package: "Два передних", price: "10 900 ₽", includes: "однотонная лента" },
  { package: "Четыре ремня", price: "19 900 ₽", includes: "однотонный комплект" },
  { package: "Пять ремней", price: "23 900 ₽", includes: "однотонный комплект" },
  { package: "Принт", price: "+2 500 ₽/шт.", includes: "после проверки поставщика" }
];

const tips = [
  "Один специализированный оффер по ремням, а не перечень всех услуг в одном заголовке.",
  "Заголовки Avito: «Цветные ремни безопасности под ключ», «Замена ленты ремня безопасности».",
  "Фото до продвижения: до/после, палитра, строчка, документы на материал, видео возврата ремня.",
  "Не смешивать замену ленты с ремонтом пиропатрона/SRS.",
  "Платное усиление — после 2–3 собственных кейсов; менять одну переменную за раз."
];

const KPI_BASE = {
  localLeads: "12 / 6",
  localLeadsLabel: "лидов / подтверждено",
  directBeltOffers: 0,
  russiaBeltTypical: "5,5–12 тыс.",
  recommendedStart: "5 900 ₽"
};

function normalizeFilter(value, allowed, fallback) {
  const v = String(value ?? fallback).toLowerCase();
  return allowed.includes(v) ? v : fallback;
}

/**
 * @param {{ service?: string, geography?: string }} filters
 */
function filterMarketData(filters = {}) {
  const service = normalizeFilter(filters.service, ["all", "belts", "interior"], "all");
  const geography = normalizeFilter(filters.geography, ["all", "local", "russia"], "all");

  const filteredPriceRows = priceRows.filter(
    (row) =>
      (service === "all" || row.service === service) &&
      (geography === "all" || row.geography === geography)
  );

  const showBelts = service === "all" || service === "belts";
  const showLocal = geography === "all" || geography === "local";

  return {
    snapshotDate: SNAPSHOT_DATE,
    service,
    geography,
    kpi: { ...KPI_BASE },
    priceRows: filteredPriceRows,
    beltOffers: showBelts ? beltOffers : [],
    beltChart: showBelts
      ? {
          labels: beltOffers.map((o) => o.name),
          prices: beltOffers.map((o) => o.priceRub),
          medianRub: 7000
        }
      : { labels: [], prices: [], medianRub: 7000 },
    localCompetition: showLocal ? localCompetition : [],
    launchPrices,
    tips
  };
}

module.exports = {
  SNAPSHOT_DATE,
  priceRows,
  beltOffers,
  localCompetition,
  launchPrices,
  tips,
  filterMarketData
};
