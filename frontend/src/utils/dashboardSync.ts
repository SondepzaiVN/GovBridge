const MISSING_VALUE = 'Điền thiếu';

export const withFallback = (value: unknown): string => {
    if (value === undefined || value === null || value === '' || (typeof value === 'number' && isNaN(value))) {
        return MISSING_VALUE;
    }
    return String(value).trim() || MISSING_VALUE;
};

import type { AttachmentMetadata } from './attachmentStorage';

export type DashboardDocument = { name: string; state: 'Đã có' | 'Cần kiểm tra' };

export type SyncApplicationPayload = {
    procedure: string;
    applicant: string;
    citizenId: string;
    phone: string;
    email: string;
    channel?: string;
    documents: DashboardDocument[];
    message?: string;
    caseNote?: string;
    details?: Record<string, string>;
    attachments?: AttachmentMetadata[];
};

export const saveApplicationToDashboard = (payload: SyncApplicationPayload) => {
    const STORAGE_KEY = 'officerApplications_v2';
    
    try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        const currentApplications = stored ? JSON.parse(stored) : [];

        const now = new Date();
        const dueDate = new Date();
        dueDate.setDate(now.getDate() + 3);

        const padZero = (n: number) => n.toString().padStart(2, '0');
        
        const submittedAt = `${padZero(now.getDate())}/${padZero(now.getMonth() + 1)}/${now.getFullYear()} ${padZero(now.getHours())}:${padZero(now.getMinutes())}`;
        const dueDateStr = `${padZero(dueDate.getDate())}/${padZero(dueDate.getMonth() + 1)}/${dueDate.getFullYear()}`;
        
        const applicationCode = `GOV-${now.getFullYear()}-${String(Math.floor(Math.random() * 1000000)).padStart(6, '0')}`;

        const details: Record<string, string> = {};
        if (payload.details) {
            for (const [k, v] of Object.entries(payload.details)) {
                details[k] = withFallback(v);
            }
        }

        const newApplication = {
            id: applicationCode,
            procedure: withFallback(payload.procedure),
            applicant: withFallback(payload.applicant),
            citizenId: withFallback(payload.citizenId),
            phone: withFallback(payload.phone),
            email: withFallback(payload.email),
            submittedAt,
            dueDate: dueDateStr,
            channel: withFallback(payload.channel || 'Cổng dịch vụ công'),
            status: 'Chờ tiếp nhận',
            documents: payload.documents.length > 0 ? payload.documents : [],
            message: payload.message || MISSING_VALUE,
            caseNote: payload.caseNote || MISSING_VALUE,
            details,
            attachments: payload.attachments || [],
        };

        const updatedApplications = [newApplication, ...currentApplications];
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedApplications));
        
        return newApplication;
    } catch (error) {
        console.error('Failed to sync application to dashboard', error);
        return null;
    }
};
