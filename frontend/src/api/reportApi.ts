import api from './axios';

export const createReport = async (targetType: 'opportunity' | 'resource' | 'user' | 'message' | 'promotion_request', targetId: string, reason: string) => {
  await api.post('/reports', { targetType, targetId, reason });
};
