import { request } from '../utils/request';

export interface IStore {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  store_type: 'hospital' | 'street';
  created_at: string;
}

export interface CreateStorePayload {
  name: string;
  address: string;
  phone: string;
  store_type?: 'hospital' | 'street';
}

export async function getStores(): Promise<IStore[]> {
  const response = await request.get<IStore[]>('/api/stores');
  return response.data;
}

export async function createStore(payload: CreateStorePayload): Promise<IStore> {
  const response = await request.post<IStore>('/api/stores', payload);
  return response.data;
}
