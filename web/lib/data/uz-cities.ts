export interface UzCity {
  name: string;
  nameUz: string;
  lat: number;
  lon: number;
}

// name (кириллица/рус.) — канонический ключ: используется в фильтрах каталога,
// z.enum в vehicleDetailsSchema и как значение Listing.city/form-полей.
// nameUz — только для отображения на UZ-локали (getCityDisplayName ниже),
// сам ключ матчинга/валидации не меняется — иначе пришлось бы синхронно
// переписывать все фильтры/мок-данные под два разных набора значений.
export const UZ_CITIES: UzCity[] = [
  { name: 'Ташкент', nameUz: 'Toshkent', lat: 41.2995, lon: 69.2401 },
  { name: 'Самарканд', nameUz: 'Samarqand', lat: 39.6542, lon: 66.9597 },
  { name: 'Бухара', nameUz: 'Buxoro', lat: 39.7747, lon: 64.4286 },
  { name: 'Наманган', nameUz: 'Namangan', lat: 41.0011, lon: 71.6725 },
  { name: 'Андижан', nameUz: 'Andijon', lat: 40.7821, lon: 72.3442 },
  { name: 'Фергана', nameUz: 'Fargʻona', lat: 40.3894, lon: 71.7864 },
  { name: 'Нукус', nameUz: 'Nukus', lat: 42.4531, lon: 59.6103 },
  { name: 'Карши', nameUz: 'Qarshi', lat: 38.8606, lon: 65.7891 },
  { name: 'Термез', nameUz: 'Termiz', lat: 37.2242, lon: 67.2783 },
  { name: 'Ургенч', nameUz: 'Urganch', lat: 41.5506, lon: 60.6317 },
  { name: 'Джизак', nameUz: 'Jizzax', lat: 40.1158, lon: 67.8422 },
  { name: 'Навои', nameUz: 'Navoiy', lat: 40.0844, lon: 65.3792 },
];

export const DEFAULT_CITY = UZ_CITIES[0].name;

// Отображаемое имя города по текущей локали — city остаётся ключом матчинга
// (фильтры/форма/URL query), меняется только то, что видит пользователь.
// Неизвестный город (например, будущие мок-данные вне списка) — возвращается как есть.
export function getCityDisplayName(city: string, locale: string): string {
  if (locale !== 'uz') return city;
  return UZ_CITIES.find((c) => c.name === city)?.nameUz ?? city;
}
