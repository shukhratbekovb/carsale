// Catalog Module (BE-4, FR-04, §6.6): публичный каталог с фильтрами/сортировкой/пагинацией,
// Redis-кэш TTL 60с, «похожие» при пустой выдаче, публичная карточка (без VIN/plate — BR-3)
import { stubRouter } from '../stub-router.js';

export const catalogRouter = stubRouter('catalog');
