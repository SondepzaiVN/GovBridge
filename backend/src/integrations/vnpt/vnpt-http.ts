import { ExternalServiceError } from '../../common/errors/app-error.js';

export const fetchVnpt = async (url: string, init: RequestInit): Promise<Response> => {
  try {
    return await fetch(url, init);
  } catch (error) {
    const reason = error instanceof Error && error.name === 'TimeoutError'
      ? 'quá thời gian chờ'
      : 'không thể kết nối';
    throw new ExternalServiceError('Dịch vụ VNPT ' + reason + '.');
  }
};
