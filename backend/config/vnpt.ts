// VNPT API Configuration
// Cấu hình API keys cho VNPT eKYC, SmartVoice, Smartbot

export const VNPT_CONFIG = {
  // ---- eKYC (OCR CCCD) ----
  ekyc: {
    baseUrl: import.meta.env.VITE_VNPT_EKYC_URL || 'https://api.idg.vnpt.vn',
    proxyUrl: '/ekyc-api',
    accessToken: import.meta.env.VITE_VNPT_EKYC_ACCESS_TOKEN || '',
    tokenId: import.meta.env.VITE_VNPT_EKYC_TOKEN_ID || '',
    tokenKey: import.meta.env.VITE_VNPT_EKYC_TOKEN_KEY || '',
  },

  // ---- SmartVoice (STT / TTS) ----
  voice: {
    sttUrl: import.meta.env.VITE_VNPT_STT_URL || 'wss://stt.vnpt.vn/ws/asr',
    ttsUrl: import.meta.env.VITE_VNPT_TTS_URL || 'https://api.idg.vnpt.vn/tts-service/v2/grpc',
    apiKey: import.meta.env.VITE_VNPT_VOICE_KEY || 'MOCK_VOICE_KEY',
    // STT settings
    sttLanguage: 'vi-VN',
    sttSampleRate: 16000,
    // TTS settings
    ttsVoice: import.meta.env.VITE_VNPT_TTS_VOICE || 'female_south',
    ttsSpeed: 1.0,
  },

  // ---- Smartbot (LLM) ----
  smartbot: {
    baseUrl: import.meta.env.VITE_VNPT_SMARTBOT_URL || 'https://smartbot.vnpt.vn/api/v1',
    apiKey: import.meta.env.VITE_VNPT_SMARTBOT_KEY || 'MOCK_SMARTBOT_KEY',
    botId: import.meta.env.VITE_VNPT_BOT_ID || 'MOCK_BOT_ID',
  },
} as const;

// Kiểm tra xem có đang dùng mock hay API thật (cho eKYC)
export const IS_EKYC_CONFIGURED =
  !!VNPT_CONFIG.ekyc.accessToken &&
  !!VNPT_CONFIG.ekyc.tokenId &&
  !!VNPT_CONFIG.ekyc.tokenKey;

// Mock mode check chung (để tương thích ngược với các file khác)
export const IS_MOCK_MODE =
  VNPT_CONFIG.smartbot.apiKey === 'MOCK_SMARTBOT_KEY' ||
  !import.meta.env.VITE_VNPT_SMARTBOT_KEY;

// Headers cho VNPT eKYC API
export const getEKYCHeaders = () => ({
  'Content-Type': 'application/json',
  'Authorization': VNPT_CONFIG.ekyc.accessToken,
  'Token-id': VNPT_CONFIG.ekyc.tokenId,
  'Token-key': VNPT_CONFIG.ekyc.tokenKey,
  'mac-address': 'TEST1',
});

// Headers chuẩn cho VNPT APIs (JSON)
export const getVNPTHeaders = (apiKey: string) => ({
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${apiKey}`,
  'Accept': 'application/json',
});

// Headers cho form-data uploads
export const getVNPTFormHeaders = (apiKey: string) => ({
  'Authorization': `Bearer ${apiKey}`,
  'Accept': 'application/json',
});
