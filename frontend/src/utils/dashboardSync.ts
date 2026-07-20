const MISSING_VALUE = 'Điền thiếu';

export const withFallback = (value: unknown): string => {
    if (value === undefined || value === null || value === '' || (typeof value === 'number' && isNaN(value))) {
        return MISSING_VALUE;
    }
    return String(value).trim() || MISSING_VALUE;
};

import type { AttachmentMetadata } from './attachmentStorage';
import { withAuthHeaders } from '../services/authService';

export type DashboardDocument = { name: string; state: 'Đã có' | 'Cần kiểm tra' };

export type DashboardApplication = Record<string, unknown>;

export type SyncApplicationPayload = {
    clientSubmissionId?: string;
    procedure: string;
    applicant: string;
    citizenId: string;
    phone: string;
    email: string;
    channel?: string;
    documents: DashboardDocument[];
    message?: string;
    caseNote?: string;
    officerNote?: string;
    officerNoteFlag?: string;
    details?: Record<string, string>;
    attachments?: AttachmentMetadata[];
};

const SUBMISSION_ID_PREFIX = 'govbridge-submission-id:';

const createSubmissionId = () => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export const getOrCreateSubmissionId = (scope: string): string => {
    if (typeof window === 'undefined') return createSubmissionId();

    const key = `${SUBMISSION_ID_PREFIX}${scope}`;
    const existing = window.sessionStorage.getItem(key);
    if (existing) return existing;

    const next = createSubmissionId();
    window.sessionStorage.setItem(key, next);
    return next;
};

export const clearSubmissionId = (scope: string): void => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.removeItem(`${SUBMISSION_ID_PREFIX}${scope}`);
};

export const getDashboardApplicationCode = (application: DashboardApplication): string => {
    const rawCode = application.applicationCode ?? application.id;
    return typeof rawCode === 'string' ? rawCode : '';
};

export const saveApplicationToDashboard = async (payload: SyncApplicationPayload): Promise<DashboardApplication> => {
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
        applicationCode,
        clientSubmissionId: payload.clientSubmissionId,
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
        officerNote: payload.officerNote || '',
        officerNoteFlag: payload.officerNoteFlag || '',
        details,
        attachments: payload.attachments || [],
    };

    const response = await fetch('/api/v1/dashboard/applications', {
        method: 'POST',
        headers: withAuthHeaders({
            'Content-Type': 'application/json',
        }),
        body: JSON.stringify(newApplication),
    });

    let result: { success?: boolean; data?: DashboardApplication; error?: string } | null;
    try {
        result = await response.json();
    } catch {
        result = null;
    }

    if (!response.ok || !result?.success || !result.data) {
        throw new Error(result?.error || `Backend chưa xác nhận hồ sơ (${response.status}).`);
    }

    window.dispatchEvent(new Event('dashboard-updated'));

    return result.data;
};
