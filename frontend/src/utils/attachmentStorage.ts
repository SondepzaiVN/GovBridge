export type AttachmentMetadata = {
    id: string;
    fileName: string;
    mimeType: string;
    size: number;
    storageKey: string;
    submittedAt: string;
};

const DB_NAME = 'GovBridgeDB';
const STORE_NAME = 'attachments';

const getDB = (): Promise<IDBDatabase> => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };
        request.onsuccess = (event) => resolve((event.target as IDBOpenDBRequest).result);
        request.onerror = () => reject(request.error);
    });
};

export const saveAttachmentFile = async (file: File): Promise<AttachmentMetadata> => {
    const db = await getDB();
    const storageKey = `att-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const id = `id-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(file, storageKey);
        
        request.onsuccess = () => {
            const metadata: AttachmentMetadata = {
                id,
                fileName: file.name,
                mimeType: file.type || 'application/octet-stream',
                size: file.size,
                storageKey,
                submittedAt: new Date().toISOString(),
            };
            resolve(metadata);
        };
        
        request.onerror = () => reject(request.error);
    });
};

export const getAttachmentFile = async (storageKey: string): Promise<Blob | null> => {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(storageKey);
        
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
    });
};

export const deleteAttachmentFile = async (storageKey: string): Promise<void> => {
    const db = await getDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(storageKey);
        
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
};
