import api from './axios';
import type { ImpactStats } from '../types';

export const getImpactStats = async (): Promise<ImpactStats> => {
  const response = await api.get<{ success: boolean; data: ImpactStats }>('/dashboard/stats');
  return response.data.data;
};
