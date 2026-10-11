import { MOSAIC_TABLES } from '../infrastructure/mosaic-backend.mjs';

export const BUCKET_LIST_EXPECTED = MOSAIC_TABLES.find((item) => item.id === 'bucket_list_items');
