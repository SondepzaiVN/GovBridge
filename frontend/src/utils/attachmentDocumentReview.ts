import { documentReviewService, smartbotService } from '../api/aiServices';
import { ApiClientError } from '../api/client';
import type { DocumentReviewRuleType, DocumentReviewUiState } from '../types';
import { agentEventBus } from './eventBus';
import { notifyAttachmentReviewExternalProcessing } from './externalProcessingNotices';

interface ReviewUploadedDocumentOptions {
    file: File;
    label?: string;
    currentRoute: string;
    documentType?: DocumentReviewRuleType;
    onStatusChange: (state: DocumentReviewUiState) => void;
}

const getErrorMessage = (error: unknown) => {
    if (error instanceof ApiClientError) {
        return error.message + (error.code ? ` (${error.code})` : '');
    }
    if (error instanceof Error && error.message.trim()) return error.message;
    return 'Không thể kiểm tra tệp đính kèm. Vui lòng thử tải lại tệp hoặc kiểm tra thủ công.';
};

const isHeicFile = (file: File) => {
    const normalizedType = file.type.toLowerCase();
    const normalizedName = file.name.toLowerCase();
    return normalizedType === 'image/heic'
        || normalizedType === 'image/heif'
        || normalizedName.endsWith('.heic')
        || normalizedName.endsWith('.heif');
};

const convertHeicToJpeg = async (file: File): Promise<File> => {
    if (!isHeicFile(file)) return file;
    const { default: heic2any } = await import('heic2any');
    const converted = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.92,
    });
    const blob = Array.isArray(converted) ? converted[0] : converted;
    if (!blob) throw new Error('Không thể chuyển đổi ảnh HEIC/HEIF.');
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'attachment';
    return new File([blob], `${baseName}.jpg`, { type: 'image/jpeg' });
};

const normalizeDocumentLabel = (value: string) => value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

export const inferDocumentReviewRuleType = (label = ''): DocumentReviewRuleType | null => {
    const normalized = normalizeDocumentLabel(label);
    if (normalized.includes('ct01') || normalized.includes('ct02')) {
        return 'ct01';
    }
    if (
        normalized.includes('chung minh cho o')
        || normalized.includes('cho o hop phap')
        || normalized.includes('quyen su dung dat')
        || normalized.includes('so huu nha')
        || normalized.includes('hop dong thue')
        || normalized.includes('cho o nho')
        || normalized.includes('residence-proof')
        || normalized.includes('housing-proof')
        || normalized.includes('area-proof')
        || normalized.includes('facility-legal-doc')
        || normalized.includes('rent-contract')
    ) {
        return 'chung_minh_cho_o_hop_phap';
    }
    return null;
};

export const reviewUploadedDocument = async ({
    file,
    label,
    currentRoute,
    documentType,
    onStatusChange,
}: ReviewUploadedDocumentOptions): Promise<DocumentReviewUiState> => {
    const fileLabel = label || file.name;
    const ruleType = documentType || inferDocumentReviewRuleType(fileLabel);

    if (!ruleType) {
        const message = `Hệ thống chưa có bộ quy tắc kiểm tra tự động cho ${fileLabel}. Vui lòng kiểm tra thủ công giấy tờ này.`;
        const nextState: DocumentReviewUiState = {
            status: 'error',
            flag: 'red',
            text: message,
        };
        onStatusChange(nextState);
        agentEventBus.emit({
            type: 'CHAT',
            message,
            suggestions: ['Kiểm tra thủ công', 'Tải giấy tờ khác'],
        });
        return nextState;
    }

    notifyAttachmentReviewExternalProcessing();
    onStatusChange({
        status: 'checking',
        text: isHeicFile(file)
            ? `Đang chuyển ${fileLabel} sang JPEG trước khi kiểm tra...`
            : `Đang kiểm tra ${fileLabel} bằng VNPT SmartReader...`,
    });

    try {
        const reviewFile = await convertHeicToJpeg(file);
        if (reviewFile !== file) {
            onStatusChange({
                status: 'checking',
                text: `Đã chuyển ${fileLabel} sang JPEG. Đang kiểm tra bằng VNPT SmartReader...`,
            });
        }

        const result = await documentReviewService.reviewCt01(reviewFile, {
            currentRoute,
            documentType: ruleType,
        });
        const reviewStatus = result.flag === 'green' ? 'valid' : 'invalid';
        const nextState: DocumentReviewUiState = {
            status: reviewStatus,
            flag: result.flag,
            text: result.text,
            result,
        };
        smartbotService.rememberDocumentReview({
            label: fileLabel,
            fileName: file.name,
            documentType: ruleType,
            status: reviewStatus,
            flag: result.flag,
            text: result.text,
            warnings: result.warnings,
            readerProvider: result.readerProvider,
            reviewerProvider: result.provider,
            checkedAt: new Date().toISOString(),
        });
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
        smartbotService.rememberDocumentReview({
            label: fileLabel,
            fileName: file.name,
            documentType: ruleType,
            status: 'error',
            flag: 'red',
            text: message,
            checkedAt: new Date().toISOString(),
        });
        onStatusChange(nextState);
        agentEventBus.emit({
            type: 'CHAT',
            message: `Không thể kiểm tra ${fileLabel}: ${message}`,
            suggestions: ['Tải lại tệp', 'Kiểm tra thủ công'],
        });
        return nextState;
    }
};
