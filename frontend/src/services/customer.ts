import { request } from '../utils/request';

export interface ICustomer {
  id: string;
  name: string;
  phone: string;
  gender: string | null;
  birth_date: string | null;
  address: string | null;
  primary_store_id: string | null;
  primary_store_name: string | null;
  created_at: string;
}

export interface ICustomerListResponse {
  items: ICustomer[];
  total: number;
  page: number;
  page_size: number;
}

export interface CreateCustomerPayload {
  name: string;
  phone: string;
  gender?: string | null;
  birth_date?: string | null;
  address?: string | null;
  primary_store_id?: string | null;
}

export interface ImportResult {
  imported_count: number;
  skipped_count: number;
}

export async function getCustomers(params: {
  q?: string;
  page?: number;
  page_size?: number;
  store_id?: string;
}): Promise<ICustomerListResponse> {
  const response = await request.get<ICustomerListResponse>('/api/customers', { params });
  return response.data;
}

export async function createCustomer(payload: CreateCustomerPayload): Promise<ICustomer> {
  const response = await request.post<ICustomer>('/api/customers', payload);
  return response.data;
}

export async function importCustomers(file: File): Promise<ImportResult> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await request.post<ImportResult>('/api/customers/import', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
}
