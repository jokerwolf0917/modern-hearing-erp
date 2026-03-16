import { request } from '../utils/request';

export interface ICustomer {
  id: string;
  name: string;
  phone: string;
  age: number | null;
  gender: string | null;
  hearing_loss_type: string | null;
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
  age: number;
  gender: '男' | '女' | '未知';
  hearing_loss_type: '正常' | '轻度' | '中度' | '重度' | '极重度';
}

export interface ImportResult {
  imported_count: number;
  skipped_count: number;
}

export async function getCustomers(params: { q?: string; page?: number; page_size?: number }): Promise<ICustomerListResponse> {
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
