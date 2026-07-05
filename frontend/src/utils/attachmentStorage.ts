export type AttachmentMetadata = {
    id: string;
    fileName: string;
    mimeType: string;
    size: number;
    storageKey: string;
    submittedAt: string;
};

export const saveAttachmentFile = async (file: File): Promise<AttachmentMetadata> => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch('/api/v1/dashboard/applications/upload', {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        throw new Error('Failed to upload attachment');
    }

    const result = await response.json();
    if (!result.success) {
        throw new Error(result.error || 'Failed to upload attachment');
    }

    const id = `id-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    return {
        id,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        storageKey: result.storageKey,
        submittedAt: new Date().toISOString(),
    };
};

export const getAttachmentFile = async (storageKey: string): Promise<Blob | null> => {
    try {
        const response = await fetch(`/api/v1/dashboard/applications/attachments/${storageKey}`);
        if (!response.ok) return null;
        return await response.blob();
    } catch (error) {
        console.error('Failed to get attachment file', error);
        return null;
    }
};

export const deleteAttachmentFile = async (storageKey: string): Promise<void> => {
    console.log(`Deletion of ${storageKey} is skipped on backend (not implemented)`);
};
