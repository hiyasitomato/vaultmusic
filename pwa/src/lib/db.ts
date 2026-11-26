const DB_NAME = "vaultmusic";
const DB_VERSION = 1;

export type StoreName = "kv" | "audio" | "covers" | "downloads";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB が使えません"));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const store of ["kv", "audio", "covers", "downloads"] as StoreName[]) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store);
        }
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB を開けません"));
  });
  return dbPromise;
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB 操作に失敗しました"));
  });
}

export async function dbGet<T>(store: StoreName, key: string): Promise<T | null> {
  const db = await openDb();
  const value = await requestToPromise<T | undefined>(
    db.transaction(store, "readonly").objectStore(store).get(key)
  );
  return value ?? null;
}

export async function dbPut(store: StoreName, key: string, value: unknown): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB への保存に失敗しました"));
  });
}

export async function dbDelete(store: StoreName, key: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB からの削除に失敗しました"));
  });
}

export async function dbAll<T>(store: StoreName): Promise<T[]> {
  const db = await openDb();
  return requestToPromise<T[]>(db.transaction(store, "readonly").objectStore(store).getAll());
}

export async function dbKeys(store: StoreName): Promise<string[]> {
  const db = await openDb();
  const keys = await requestToPromise<IDBValidKey[]>(
    db.transaction(store, "readonly").objectStore(store).getAllKeys()
  );
  return keys.map((key) => String(key));
}
