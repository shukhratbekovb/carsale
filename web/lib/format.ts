// NFR-29: цены форматируются как "1 000 000 сум", не "1000000"
export function formatUzs(amountUzs: number): string {
  return `${new Intl.NumberFormat('ru-RU').format(amountUzs)} сум`;
}

export function formatMileage(mileageKm: number): string {
  return `${new Intl.NumberFormat('ru-RU').format(mileageKm)} км`;
}
