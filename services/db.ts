
const DB_NAME = 'RVDesignerDB';
const DB_VERSION = 1;
const STORE_NAME = 'images';

let db: IDBDatabase | null = null;

export interface StoredImage {
    id: string;
    mimeType: string;
    data: string; // base64
}

export const initDB = (): Promise<boolean> => {
    return new Promise((resolve, reject) => {
        if (db) {
            resolve(true);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = (event) => {
            console.error("IndexedDB error:", request.error);
            reject(false);
        };

        request.onsuccess = (event) => {
            db = request.result;
            resolve(true);
        };

        request.onupgradeneeded = (event) => {
            const tempDb = request.result;
            if (!tempDb.objectStoreNames.contains(STORE_NAME)) {
                tempDb.createObjectStore(STORE_NAME, { keyPath: 'id' });
            }
        };
    });
};

export const saveImage = (image: StoredImage): Promise<void> => {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject("DB not initialized");
            return;
        }

        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);

        const request = store.put(image);

        request.onsuccess = () => {
            resolve();
        };

        request.onerror = () => {
            console.error("Error saving image:", request.error);
            reject(request.error);
        };
    });
};

export const getImage = (id: string): Promise<StoredImage | undefined> => {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject("DB not initialized");
            return;
        }

        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);

        const request = store.get(id);

        request.onsuccess = () => {
            resolve(request.result as StoredImage | undefined);
        };

        request.onerror = () => {
            console.error("Error getting image:", request.error);
            reject(request.error);
        };
    });
};
