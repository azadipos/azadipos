"use client";

// IndexedDB-based inventory cache for offline POS operation
// Caches all active items for a company so barcode scans and searches
// work even when the server is unreachable.

const DB_NAME = "azadipos_cache";
const DB_VERSION = 1;
const ITEMS_STORE = "items";
const META_STORE = "meta";
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

export interface CachedItem {
  id: string;
  name: string;
  barcode: string;
  price: number;
  isWeightPriced: boolean;
  isAgeRestricted: boolean;
  quantityOnHand: number;
  category: { id: string; taxRate: number; isAgeRestricted?: boolean } | null;
  vendor?: { id: string; name: string } | null;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(ITEMS_STORE)) {
        const store = db.createObjectStore(ITEMS_STORE, { keyPath: "id" });
        store.createIndex("barcode", "barcode", { unique: false });
        store.createIndex("name", "name", { unique: false });
        store.createIndex("companyId", "companyId", { unique: false });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getCacheTimestamp(companyId: string): Promise<number | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(META_STORE, "readonly");
      const store = tx.objectStore(META_STORE);
      const req = store.get(`lastSync_${companyId}`);
      req.onsuccess = () => resolve(req.result?.timestamp ?? null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function isCacheStale(companyId: string): Promise<boolean> {
  const ts = await getCacheTimestamp(companyId);
  if (!ts) return true;
  return Date.now() - ts > CACHE_TTL;
}

// Refresh the local cache from the server
export async function refreshInventoryCache(companyId: string): Promise<boolean> {
  try {
    const res = await fetch(
      `/api/items?companyId=${encodeURIComponent(companyId)}&limit=50000`
    );
    if (!res.ok) return false;

    const items: any[] = await res.json();
    const db = await openDB();

    // Clear old items for this company, then insert new ones
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([ITEMS_STORE, META_STORE], "readwrite");
      const itemStore = tx.objectStore(ITEMS_STORE);
      const metaStore = tx.objectStore(META_STORE);

      // Delete existing items for this company using cursor
      const idx = itemStore.index("companyId");
      const range = IDBKeyRange.only(companyId);
      const cursorReq = idx.openCursor(range);
      cursorReq.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      // Wait for cursor to finish then insert new items
      tx.oncomplete = () => {
        // Now insert in a new transaction
        const tx2 = db.transaction([ITEMS_STORE, META_STORE], "readwrite");
        const itemStore2 = tx2.objectStore(ITEMS_STORE);
        const metaStore2 = tx2.objectStore(META_STORE);

        for (const item of items) {
          itemStore2.put({
            id: item.id,
            companyId,
            name: item.name,
            barcode: item.barcode,
            price: Number(item.price),
            isWeightPriced: item.isWeightPriced ?? false,
            isAgeRestricted: item.category?.isAgeRestricted ?? false,
            quantityOnHand: item.quantityOnHand ?? 0,
            category: item.category
              ? {
                  id: item.category.id,
                  taxRate: Number(item.category.taxRate ?? 0),
                  isAgeRestricted: item.category.isAgeRestricted ?? false,
                }
              : null,
            vendor: item.vendor
              ? { id: item.vendor.id, name: item.vendor.name }
              : null,
          });
        }

        metaStore2.put({
          key: `lastSync_${companyId}`,
          timestamp: Date.now(),
          count: items.length,
        });

        tx2.oncomplete = () => resolve();
        tx2.onerror = () => reject(tx2.error);
      };
      tx.onerror = () => reject(tx.error);
    });

    return true;
  } catch (err) {
    console.error("Failed to refresh inventory cache:", err);
    return false;
  }
}

// Search items in the local cache (used as offline fallback)
export async function searchCachedItems(
  companyId: string,
  query: string,
  limit = 15
): Promise<CachedItem[]> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(ITEMS_STORE, "readonly");
      const store = tx.objectStore(ITEMS_STORE);
      const idx = store.index("companyId");
      const range = IDBKeyRange.only(companyId);
      const results: CachedItem[] = [];
      const q = query.toLowerCase();

      const cursorReq = idx.openCursor(range);
      cursorReq.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor && results.length < limit) {
          const item = cursor.value;
          if (
            item.barcode.toLowerCase().startsWith(q) ||
            item.name.toLowerCase().includes(q)
          ) {
            results.push(item);
          }
          cursor.continue();
        } else {
          // Sort: barcode prefix matches first, then name prefix, then rest
          results.sort((a, b) => {
            const aBar = a.barcode.toLowerCase().startsWith(q);
            const bBar = b.barcode.toLowerCase().startsWith(q);
            if (aBar && !bBar) return -1;
            if (!aBar && bBar) return 1;
            const aName = a.name.toLowerCase().startsWith(q);
            const bName = b.name.toLowerCase().startsWith(q);
            if (aName && !bName) return -1;
            if (!aName && bName) return 1;
            return a.name.localeCompare(b.name);
          });
          resolve(results);
        }
      };
      cursorReq.onerror = () => resolve([]);
    });
  } catch {
    return [];
  }
}

// Look up a single item by barcode from the cache
export async function lookupCachedBarcode(
  companyId: string,
  barcode: string
): Promise<CachedItem | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(ITEMS_STORE, "readonly");
      const store = tx.objectStore(ITEMS_STORE);
      const idx = store.index("barcode");
      const req = idx.getAll(barcode);

      req.onsuccess = () => {
        const matches = (req.result || []).filter(
          (item: any) => item.companyId === companyId
        );
        resolve(matches.length > 0 ? matches[0] : null);
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

// Get cache stats for display
export async function getCacheStats(
  companyId: string
): Promise<{ count: number; lastSync: number | null } | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(META_STORE, "readonly");
      const store = tx.objectStore(META_STORE);
      const req = store.get(`lastSync_${companyId}`);
      req.onsuccess = () => {
        if (req.result) {
          resolve({
            count: req.result.count ?? 0,
            lastSync: req.result.timestamp ?? null,
          });
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}
