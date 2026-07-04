interface PendingDocument {
    file: File;
    documentId: string;
    route: string;
    label?: string;
    createdAt: number;
}

let latestDocument: PendingDocument | null = null;

export const registerPendingDocumentForReview = (document: Omit<PendingDocument, 'createdAt'>) => {
    latestDocument = {
        ...document,
        createdAt: Date.now(),
    };
};

export const getLatestPendingDocumentForReview = () => latestDocument;

