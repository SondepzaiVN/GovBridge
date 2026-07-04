import { documentReviewService } from '../api/aiServices';
import { ApiClientError } from '../api/client';
import type { DocumentReviewUiState } from '../types';
import { agentEventBus } from './eventBus';
import { notifyAttachmentReviewExternalProcessing } from './externalProcessingNotices';

interface ReviewUploadedDocumentOptions {
    file: File;
    label?: string;
    currentRoute: string;
    formValues?: Record<string, unknown>;
    onStatusChange: (state: DocumentReviewUiState) => void;
}

const getErrorMessage = (error: unknown) => {
    if (error instanceof ApiClientError) {
        return error.message + (error.code ? ` (${error.code})` : '');
    }
    if (error instanceof Error && error.message.trim()) return error.message;
    return 'Không thể kiểm tra tệp đính kèm. Vui lòng thử tải lại tệp hoặc kiểm tra thủ công.';
};

const compactFormValues = (values: Record<string, unknown>): Record<string, string> =>
    Object.fromEntries(
        Object.entries(values)
            .filter(([, value]) => typeof value === 'string' && value.trim())
            .map(([key, value]) => [key, value as string]),
    );

export const reviewUploadedDocument = async ({
    file,
    label,
    currentRoute,
    formValues = {},
    onStatusChange,
}: ReviewUploadedDocumentOptions): Promise<DocumentReviewUiState> => {
    const fileLabel = label || file.name;
    notifyAttachmentReviewExternalProcessing();
    onStatusChange({
        status: 'checking',
        text: `Đang kiểm tra ${fileLabel} bằng VNPT SmartReader...`,
    });

    try {
        const result = await documentReviewService.reviewCt01(file, {
            currentRoute,
            formValues: compactFormValues(formValues),
        });
        const nextState: DocumentReviewUiState = {
            status: result.flag === 'green' ? 'valid' : 'invalid',
            flag: result.flag,
            text: result.text,
            result,
        };
        onStatusChange(nextState);
        agentEventBus.emit({
            type: 'CHAT',
            message: `Kết quả kiểm tra ${fileLabel}: ${result.text}`,
            data: { documentReview: result },
            suggestions: result.flag === 'green'
                ? ['Tiếp tục nộp hồ sơ', 'Kiểm tra tệp khác']
                : ['Tải lại tệp đã sửa', 'Tôi cần sửa gì?'],
        });
        return nextState;
    } catch (error) {
        const message = getErrorMessage(error);
        const nextState: DocumentReviewUiState = {
            status: 'error',
            flag: 'red',
            text: message,
        };
        onStatusChange(nextState);
        agentEventBus.emit({
            type: 'CHAT',
            message: `Không thể kiểm tra ${fileLabel}: ${message}`,
            suggestions: ['Tải lại tệp', 'Kiểm tra thủ công'],
        });
        return nextState;
    }
};
