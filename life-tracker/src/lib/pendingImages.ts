import Dexie, { type Table } from 'dexie';

const DB_NAME = 'mosaic_pending_images';
const LOCAL_PREFIX = 'localimg_';

interface PendingImageEntry {
  id: string;
  ownerUserId: string;
  blob: Blob;
  createdAt: string;
}

class PendingImagesDatabase extends Dexie {
  images!: Table<PendingImageEntry, string>;

  constructor() {
    super(DB_NAME);
    this.version(1).stores({
      images: 'id',
    });
  }
}

let db: PendingImagesDatabase | null = null;

function getDB(): PendingImagesDatabase {
  db ??= new PendingImagesDatabase();
  return db;
}

function makePendingId(): string {
  const bytes = new Uint8Array(13);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, '0')
  ).join('');
  return `${LOCAL_PREFIX}${hex}`;
}

export function isPendingImageId(fileId: string): boolean {
  return fileId.startsWith(LOCAL_PREFIX);
}

export async function createPendingImage(
  ownerUserId: string,
  blob: Blob
): Promise<string> {
  if (!ownerUserId) throw new Error('Pending image requires an owner.');
  const id = makePendingId();
  await getDB().images.put({
    id,
    ownerUserId,
    blob,
    createdAt: new Date().toISOString(),
  });
  return id;
}

export async function getPendingImage(
  fileId: string,
  expectedOwnerUserId?: string
): Promise<Blob | null> {
  if (!isPendingImageId(fileId)) return null;
  const entry = await getDB().images.get(fileId);
  if (!entry) return null;
  if (
    expectedOwnerUserId &&
    entry.ownerUserId !== expectedOwnerUserId
  ) {
    return null;
  }
  return entry.blob;
}

export async function deletePendingImage(
  fileId: string,
  expectedOwnerUserId?: string
): Promise<void> {
  if (!isPendingImageId(fileId)) return;
  if (expectedOwnerUserId) {
    const entry = await getDB().images.get(fileId);
    if (!entry || entry.ownerUserId !== expectedOwnerUserId) return;
  }
  await getDB().images.delete(fileId);
}

export async function clearAllPendingImages(): Promise<void> {
  await getDB().images.clear();
}

export async function clearPendingImagesForUser(
  ownerUserId: string
): Promise<void> {
  const database = getDB();
  await database.transaction('rw', database.images, async () => {
    const entries = await database.images.toArray();
    const ownedIds = entries
      .filter((entry) => entry.ownerUserId === ownerUserId)
      .map((entry) => entry.id);
    await database.images.bulkDelete(ownedIds);
  });
}

export function resetPendingImagesForTests(): void {
  db?.close();
  db = null;
}
