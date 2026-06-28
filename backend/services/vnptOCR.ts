import type { CCCDInfo } from '../types';
import { VNPT_CONFIG, IS_EKYC_CONFIGURED, getEKYCHeaders } from '../config/vnpt';

// ============================================================
// Mock OCR response for demo
// ============================================================
const MOCK_CCCD_RESULT: CCCDInfo = {
  id: '012345678901',
  hoTen: 'LÊ THỊ THÚY QUỲNH',
  ngaySinh: '2006-10-22',
  gioiTinh: 'Nữ',
  queQuan: 'Thới Sơn, Tịnh Biên, An Giang',
  thuongTru: 'Thới Sơn, Tịnh Biên, An Giang',
  ngayCap: '2023-10-22',
  noiCap: 'Cục Cảnh sát QLHC về TTXH',
};

// ============================================================
// Utils
// ============================================================

const parseDate = (dateStr: string) => {
  if (!dateStr) return '';
  // Convert DD/MM/YYYY → YYYY-MM-DD
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  return dateStr;
};

const parseEKYCResponse = (res: any): CCCDInfo => {
  const info = res.object || res.data?.[0] || res.data || {};
  return {
    id: info.id || info.so_cmnd || '',
    hoTen: (info.name || info.ho_ten || '').toUpperCase(),
    ngaySinh: parseDate(info.birth_day || info.ngay_sinh || ''),
    gioiTinh: info.gender || info.gioi_tinh || 'Nam',
    queQuan: info.origin_location || info.que_quan || '',
    thuongTru: info.recent_location || info.dia_chi || '',
    ngayCap: parseDate(info.issue_date || info.ngay_cap || ''),
    noiCap: info.issue_place || info.noi_cap || '',
  };
};

// ============================================================
// OCR Service
// ============================================================
export class OCRService {
  async extractCCCDInfo(imageFile: File): Promise<CCCDInfo> {
    if (IS_EKYC_CONFIGURED) {
      // 1️⃣ Dùng VNPT eKYC
      return await this.callVNPTeKYC(imageFile);
    } else {
      // 2️⃣ Mock mode fallback
      await new Promise((resolve) => setTimeout(resolve, 1500));
      return { ...MOCK_CCCD_RESULT };
    }
  }

  private async uploadImageToMinio(imageFile: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', imageFile);
    formData.append('title', 'CCCD');
    formData.append('description', 'Front image');

    let baseUrl = import.meta.env.DEV ? VNPT_CONFIG.ekyc.proxyUrl : VNPT_CONFIG.ekyc.baseUrl;
    let url = `${baseUrl}/file-service/v1/addFile`;
    const headers = getEKYCHeaders() as any;
    delete headers['Content-Type']; // Let browser set multipart/form-data boundary

    if (!import.meta.env.DEV) {
      url = '/api/vnpt/ekyc';
      headers['x-vnpt-path'] = '/file-service/v1/addFile';
    }

    console.log('[VNPT eKYC] Uploading image to:', url);

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Upload failed: ${res.status} - ${errText}`);
    }

    const data = await res.json();
    console.log('[VNPT eKYC] Upload Response:', data);

    if (data.message !== 'IDG-00000000') {
      throw new Error(`Upload error: ${data.message}`);
    }

    return data.object.hash;
  }

  private async callVNPTeKYC(imageFile: File): Promise<CCCDInfo> {
    // 1. Upload ảnh lấy mã hash Minio
    const hash = await this.uploadImageToMinio(imageFile);

    // 2. Gửi mã hash đi bóc tách
    const body = {
      img_front: hash,
      client_session: `WEB_BROWSER_${Date.now()}`,
      type: -1, // -1: cmt cũ, mới, CCCD
      validate_postcode: false,
      token: VNPT_CONFIG.ekyc.tokenId, // Dùng tạm tokenId làm định danh
    };

    let baseUrl = import.meta.env.DEV ? VNPT_CONFIG.ekyc.proxyUrl : VNPT_CONFIG.ekyc.baseUrl;
    let url = `${baseUrl}/ai/v1/ocr/id/front`;
    const headers = getEKYCHeaders() as any;

    if (!import.meta.env.DEV) {
      url = '/api/vnpt/ekyc';
      headers['x-vnpt-path'] = '/ai/v1/ocr/id/front';
    }
    
    console.log('[VNPT eKYC] Sending OCR request to:', url);

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
        const errorText = await res.text();
        console.error('[VNPT eKYC] OCR API Error:', res.status, errorText);
        throw new Error(`eKYC OCR API error: ${res.status} - ${errorText}`);
    }

    const resData = await res.json();
    console.log('[VNPT eKYC] OCR API Response:', resData);
    
    if (resData.message !== 'Success' && resData.message !== 'IDG-00000000' && resData.errorCode !== 0) {
        throw new Error(`eKYC OCR error: ${resData.message || resData.errorMessage || 'Unknown error'}`);
    }

    return parseEKYCResponse(resData);
  }

  // Resize image before upload to reduce payload
  async resizeImage(file: File, maxWidth = 1024): Promise<File> {
    return new Promise((resolve) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;

      img.onload = () => {
        const ratio = Math.min(maxWidth / img.width, 1);
        canvas.width = img.width * ratio;
        canvas.height = img.height * ratio;
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        
        canvas.toBlob(
          (blob) => {
            resolve(new File([blob!], file.name, { type: 'image/jpeg' }));
          },
          'image/jpeg',
          0.85
        );
      };

      img.src = URL.createObjectURL(file);
    });
  }
}

export const ocrService = new OCRService();
