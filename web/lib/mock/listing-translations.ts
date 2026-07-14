// UZ-отображение для свободнотекстового поля Listing.color в мок-фикстурах
// (lib/mock/listings.ts). В отличие от city, color НЕ является enum'ом нигде
// в продукте — при размещении объявления продавец вводит цвет как обычный
// текст (components/sell/vehicle-details-step.tsx), поэтому переводить есть
// смысл только заранее известный конечный набор значений из самих фикстур,
// не поле формы (там ввод конкретного продавца, "переводить" нечего).
const COLOR_NAMES_UZ: Record<string, string> = {
  Белый: 'Oq',
  Чёрный: 'Qora',
  Серебристый: 'Kumushrang',
  Красный: 'Qizil',
  Синий: 'Koʻk',
  Серый: 'Kulrang',
  Коричневый: 'Jigarrang',
  Жёлтый: 'Sariq',
};

export function getColorDisplayName(color: string, locale: string): string {
  if (locale !== 'uz') return color;
  return COLOR_NAMES_UZ[color] ?? color;
}
