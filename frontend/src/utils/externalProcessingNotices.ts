export type ExternalProcessingNoticeKind = 'openai-review' | 'vnpt-ekyc';

export interface ExternalProcessingNotice {
    id: string;
    kind: ExternalProcessingNoticeKind;
    title: string;
    message: string;
    actionLabel: string;
}

type ExternalProcessingNoticeListener = (notice: ExternalProcessingNotice) => void;

const listeners = new Set<ExternalProcessingNoticeListener>();
let pendingNotice: ExternalProcessingNotice | null = null;

export const subscribeExternalProcessingNotices = (listener: ExternalProcessingNoticeListener) => {
    listeners.add(listener);
    if (pendingNotice) {
        listener(pendingNotice);
        pendingNotice = null;
    }
    return () => {
        listeners.delete(listener);
    };
};

const showNotice = (notice: Omit<ExternalProcessingNotice, 'id'>) => {
    if (typeof window === 'undefined') return;
    const nextNotice: ExternalProcessingNotice = {
        ...notice,
        id: `${notice.kind}-${Date.now()}`,
    };
    if (listeners.size === 0) {
        pendingNotice = nextNotice;
        return;
    }
    listeners.forEach((listener) => listener(nextNotice));
};

export const notifyAttachmentReviewExternalProcessing = () => {
    showNotice({
        kind: 'openai-review',
        title: 'Kiểm tra hồ sơ bằng AI',
        message: 'GovBridge sẽ gửi tệp đính kèm cùng các thông tin bạn đã nhập trên biểu mẫu đến OpenAI để đối chiếu với bộ quy tắc nghiệp vụ. Dữ liệu chỉ được dùng cho bước kiểm tra tính hợp lệ của hồ sơ.',
        actionLabel: 'Đã hiểu',
    });
};

export const notifyCccdOcrExternalProcessing = () => {
    showNotice({
        kind: 'vnpt-ekyc',
        title: 'Đọc thông tin CCCD',
        message: 'Ảnh CCCD bạn cung cấp sẽ được gửi đến VNPT eKYC để trích xuất dữ liệu định danh. GovBridge chỉ dùng kết quả trả về để hỗ trợ điền biểu mẫu hiện tại.',
        actionLabel: 'Tôi đã rõ',
    });
};
