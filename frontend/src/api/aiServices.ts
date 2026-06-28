import type { AIResponse } from '../types';

export const smartbotService = {
    setCurrentRoute: (_route: string) => {},
    clearHistory: () => {
        console.log('[Mock Backend] Lịch sử chat đã được xoá ở frontend. Bạn sẽ cần gọi API để xoá history ở backend.');
    },
    getBackendInfo: () => 'Backend API (Mock)',
    sendMessage: async (_message: string): Promise<AIResponse> => {
        try {
            // Simulate backend delay
            await new Promise((resolve) => setTimeout(resolve, 1000));

            return {
                intent: 'CHAT',
                message:
                    'Chức năng chat đang được thiết kế ở backend. Hiện tại hệ thống đang chạy ở chế độ frontend mock.',
                suggestions: ['Hướng dẫn điền form', 'Đăng ký khai sinh'],
            };
        } catch (e) {
            return {
                intent: 'CHAT',
                message: 'Lỗi kết nối tới Backend API. Hãy chắc chắn backend đang chạy.',
            };
        }
    },
};

export const sttService = {
    startListening: async (callback: (transcript: string, isFinal: boolean) => void) => {
        // Simulate listening
        let dots = '';
        const interval = setInterval(() => {
            dots += '.';
            if (dots.length > 3) dots = '.';
            callback(`Đang nghe từ backend${dots}`, false);
        }, 500);

        setTimeout(() => {
            clearInterval(interval);
            callback('Chức năng giọng nói đang được chuyển xuống backend để xử lý.', true);
        }, 2500);
    },
    stopListening: () => {},
};

export const ttsService = {
    speak: async (_text: string, onStatusChange?: (isPlaying: boolean) => void) => {
        onStatusChange?.(true);
        // Simulate speaking delay
        await new Promise((resolve) => setTimeout(resolve, 2000));
        onStatusChange?.(false);
    },
    stop: () => {},
};

export const ocrService = {
    resizeImage: async (file: File) => file,
    extractCCCDInfo: async (_file: File) => {
        // Call backend API in the future
        // const formData = new FormData();
        // formData.append('file', file);
        // return await apiClient<any>('/ocr', { method: 'POST', body: formData });

        // Simulate delay
        await new Promise((resolve) => setTimeout(resolve, 1500));

        return {
            id: '012345678901',
            hoTen: 'NGUYỄN VĂN A (MOCK)',
            ngaySinh: '2000-01-01',
            gioiTinh: 'Nam',
            queQuan: 'Hà Nội',
            thuongTru: 'Hà Nội',
            ngayCap: '2020-01-01',
            noiCap: 'Cục Cảnh sát QLHC về TTXH',
        };
    },
};
