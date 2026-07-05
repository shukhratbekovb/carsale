export interface UzCity {
  name: string;
  lat: number;
  lon: number;
}

export const UZ_CITIES: UzCity[] = [
  { name: 'Ташкент', lat: 41.2995, lon: 69.2401 },
  { name: 'Самарканд', lat: 39.6542, lon: 66.9597 },
  { name: 'Бухара', lat: 39.7747, lon: 64.4286 },
  { name: 'Наманган', lat: 41.0011, lon: 71.6725 },
  { name: 'Андижан', lat: 40.7821, lon: 72.3442 },
  { name: 'Фергана', lat: 40.3894, lon: 71.7864 },
  { name: 'Нукус', lat: 42.4531, lon: 59.6103 },
  { name: 'Карши', lat: 38.8606, lon: 65.7891 },
  { name: 'Термез', lat: 37.2242, lon: 67.2783 },
  { name: 'Ургенч', lat: 41.5506, lon: 60.6317 },
  { name: 'Джизак', lat: 40.1158, lon: 67.8422 },
  { name: 'Навои', lat: 40.0844, lon: 65.3792 },
];

export const DEFAULT_CITY = UZ_CITIES[0].name;
