import type { AttachmentMetadata } from './attachmentStorage';

export const MISSING_OFFICER_VALUE = 'Điền thiếu';

export type OfficerApplicationStatus =
    | 'Chờ tiếp nhận'
    | 'Đã tiếp nhận'
    | 'Đang xử lí'
    | 'Đã phê duyệt'
    | 'Đã từ chối'
    | typeof MISSING_OFFICER_VALUE;

export type OfficerApplication = {
    id: string;
    applicationCode: string;
    procedure: string;
    procedureType: string;
    procedureTypeLabel: string;
    procedureName: string;
    applicant: string;
    citizenId: string;
    phone: string;
    email: string;
    submittedAt: string;
    dueDate: string;
    channel: string;
    status: OfficerApplicationStatus;
    statusLabel: OfficerApplicationStatus;
    receivingAgency: string;
    provinceName: string;
    districtName: string;
    wardName: string;
    address: string;
    requestContent: string;
    documents: Array<{ name: string; state: 'Đã có' | 'Cần kiểm tra' }>;
    message: string;
    caseNote: string;
    officerNote: string;
    returnReason: string;
    responseMessage: string;
    details: Record<string, string>;
    attachments: AttachmentMetadata[];
};

export type OfficerApplicationFilters = {
    status: 'Tất cả' | Exclude<OfficerApplicationStatus, typeof MISSING_OFFICER_VALUE>;
};

const asRecord = (value: unknown): Record<string, unknown> => (
    value !== null && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {}
);

const withFallback = (value: unknown): string => {
    if (value === undefined || value === null) return MISSING_OFFICER_VALUE;
    const normalized = String(value).trim();
    return normalized || MISSING_OFFICER_VALUE;
};

const firstValue = (record: Record<string, unknown>, keys: string[]): string => {
    for (const key of keys) {
        const value = withFallback(record[key]);
        if (value !== MISSING_OFFICER_VALUE) return value;
    }
    return MISSING_OFFICER_VALUE;
};

const STATUS_ALIASES: Record<string, OfficerApplicationStatus> = {
    'chờ tiếp nhận': 'Chờ tiếp nhận',
    pending: 'Chờ tiếp nhận',
    pending_reception: 'Chờ tiếp nhận',
    'đã tiếp nhận': 'Đã tiếp nhận',
    received: 'Đã tiếp nhận',
    accepted: 'Đã tiếp nhận',
    'đang xử lí': 'Đang xử lí',
    'đang xử lý': 'Đang xử lí',
    processing: 'Đang xử lí',
    'đã phê duyệt': 'Đã phê duyệt',
    approved: 'Đã phê duyệt',
    'đã từ chối': 'Đã từ chối',
    rejected: 'Đã từ chối',
};

export const normalizeOfficerStatus = (value: unknown): OfficerApplicationStatus => {
    const normalized = withFallback(value);
    if (normalized === MISSING_OFFICER_VALUE) return MISSING_OFFICER_VALUE;
    return STATUS_ALIASES[normalized.toLocaleLowerCase('vi')] ?? MISSING_OFFICER_VALUE;
};

export const normalizeOfficerApplication = (
    rawApplication: unknown,
    fallbackId = 'Điền thiếu',
): OfficerApplication => {
    const raw = asRecord(rawApplication);
    const id = firstValue(raw, ['id', 'applicationCode', 'code']);
    const procedure = firstValue(raw, ['procedure', 'procedureName', 'procedureTypeLabel', 'procedureType']);
    const status = normalizeOfficerStatus(raw.statusLabel ?? raw.status);
    const rawDetails = asRecord(raw.details);
    const details = Object.fromEntries(
        Object.entries(rawDetails).map(([key, value]) => [key, withFallback(value)]),
    );
    const detailValue = (...keys: string[]) => {
        for (const key of keys) {
            const value = details[key];
            if (value && value !== MISSING_OFFICER_VALUE) return value;
        }
        return MISSING_OFFICER_VALUE;
    };
    const documents = Array.isArray(raw.documents)
        ? raw.documents.map((item) => {
            const document = asRecord(item);
            return {
                name: withFallback(document.name),
                state: document.state === 'Cần kiểm tra' ? 'Cần kiểm tra' as const : 'Đã có' as const,
            };
        })
        : [];
    const attachments = Array.isArray(raw.attachments)
        ? raw.attachments.filter((item): item is AttachmentMetadata => (
            item !== null && typeof item === 'object' && !Array.isArray(item)
        ))
        : [];
    const safeId = id === MISSING_OFFICER_VALUE ? fallbackId : id;

    return {
        id: safeId,
        applicationCode: safeId,
        procedure,
        procedureType: firstValue(raw, ['procedureType', 'procedure']),
        procedureTypeLabel: firstValue(raw, ['procedureTypeLabel', 'procedureName', 'procedure']),
        procedureName: firstValue(raw, ['procedureName', 'procedure']),
        applicant: firstValue(raw, ['applicant', 'applicantName', 'fullName']),
        citizenId: firstValue(raw, ['citizenId', 'identityNumber', 'cccd']),
        phone: firstValue(raw, ['phone', 'phoneNumber']),
        email: withFallback(raw.email),
        submittedAt: firstValue(raw, ['submittedAt', 'submissionDate', 'createdAt']),
        dueDate: firstValue(raw, ['dueDate', 'deadline']),
        channel: withFallback(raw.channel),
        status,
        statusLabel: status,
        receivingAgency: firstValue(raw, ['receivingAgency', 'agency']) !== MISSING_OFFICER_VALUE
            ? firstValue(raw, ['receivingAgency', 'agency'])
            : detailValue('Cơ quan tiếp nhận', 'Cơ quan thực hiện'),
        provinceName: firstValue(raw, ['provinceName', 'province']) !== MISSING_OFFICER_VALUE
            ? firstValue(raw, ['provinceName', 'province'])
            : detailValue('Tỉnh/Thành phố đề nghị', 'Tỉnh/Thành phố tạm trú'),
        districtName: firstValue(raw, ['districtName', 'district']) !== MISSING_OFFICER_VALUE
            ? firstValue(raw, ['districtName', 'district'])
            : detailValue('Quận/Huyện đề nghị'),
        wardName: firstValue(raw, ['wardName', 'ward']) !== MISSING_OFFICER_VALUE
            ? firstValue(raw, ['wardName', 'ward'])
            : detailValue('Phường/Xã đề nghị', 'Phường/Xã tạm trú'),
        address: firstValue(raw, ['address', 'applicantAddress']) !== MISSING_OFFICER_VALUE
            ? firstValue(raw, ['address', 'applicantAddress'])
            : detailValue('Địa chỉ hiện tại', 'Địa chỉ tạm trú'),
        requestContent: firstValue(raw, ['requestContent', 'message']),
        documents,
        message: withFallback(raw.message),
        caseNote: withFallback(raw.caseNote),
        officerNote: raw.officerNote === undefined ? '' : String(raw.officerNote),
        returnReason: firstValue(raw, ['returnReason', 'rejectReason', 'reason']),
        responseMessage: firstValue(raw, ['responseMessage', 'officerMessage', 'attachedMessage']),
        details,
        attachments,
    };
};

export const filterOfficerApplications = (
    applications: OfficerApplication[],
    filters: OfficerApplicationFilters,
): OfficerApplication[] => applications.filter((application) => (
    filters.status === 'Tất cả' || application.status === filters.status
));
