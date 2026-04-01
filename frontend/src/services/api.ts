import { request } from '../utils/request';

export type TransactionType = 'INBOUND' | 'OUTBOUND' | 'SALE';
export type RepairStatus = 'PENDING' | 'FACTORY' | 'DELIVERED';

export interface CustomerResponse {
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

export interface StockTransactionResponse {
  id: string;
  transaction_date: string;
  store_id: string;
  store_name: string;
  product_id: string;
  product_code: string;
  category: string;
  category_display: string;
  brand: string;
  brand_display: string;
  product_name: string;
  product_name_en: string | null;
  specification: string | null;
  original_price: number | string;
  type: TransactionType;
  quantity: number;
  unit_price: number | string | null;
  handled_by: string | null;
  handled_by_name: string | null;
  target: string | null;
  remark: string | null;
}

export interface RepairRecordResponse {
  id: string;
  customer_id: string;
  customer_name?: string;
  customer_phone?: string;
  store_id: string;
  store_name: string;
  machine_model: string;
  receive_date: string;
  due_date: string;
  issue_description: string | null;
  status: RepairStatus;
  handled_by: string | null;
  handled_by_name: string | null;
}

export interface FittingRecordResponse {
  id: string;
  customer_id: string;
  store_id: string;
  product_id: string | null;
  fitting_date: string;
  device_name: string | null;
  fitting_notes: string | null;
  result_summary: string | null;
  created_by: string | null;
  created_at: string;
}

export interface CustomerDetailFittingRecordResponse {
  id: string;
  customer_id: string;
  store_id: string;
  store_name: string;
  product_id: string | null;
  product_name: string | null;
  fitting_date: string;
  device_name: string | null;
  fitting_notes: string | null;
  result_summary: string | null;
  created_by: string | null;
  created_by_name: string | null;
}

export interface CustomerDetailResponse extends CustomerResponse {
  transactions: StockTransactionResponse[];
  repairs: RepairRecordResponse[];
  fitting_records: CustomerDetailFittingRecordResponse[];
}

export interface CustomerListResponse {
  items: CustomerResponse[];
  total: number;
  page: number;
  page_size: number;
}

export interface CustomerCreatePayload {
  name: string;
  phone: string;
  gender?: string | null;
  birth_date?: string | null;
  address?: string | null;
  primary_store_id?: string | null;
}

export type CustomerUpdatePayload = CustomerCreatePayload;

export interface CustomerSaleRecordCreatePayload {
  store_id: string;
  product_id: string;
  transaction_date: string;
  quantity: number;
  unit_price: number;
  remark?: string | null;
}

export interface RepairRecordCreatePayload {
  customer_id: string;
  store_id: string;
  machine_model: string;
  receive_date: string;
  due_date: string;
  issue_description?: string | null;
  status?: RepairStatus;
  handled_by?: string | null;
}

export interface FittingRecordCreatePayload {
  customer_id: string;
  store_id: string;
  product_id?: string | null;
  fitting_date: string;
  device_name?: string | null;
  fitting_notes?: string | null;
  result_summary?: string | null;
  created_by?: string | null;
}

export interface CustomerImportResult {
  imported_count: number;
  skipped_count: number;
}

export interface RepairImportResult {
  imported_count: number;
  skipped_count: number;
}

export async function getCustomers(params?: {
  q?: string;
  page?: number;
  page_size?: number;
  store_id?: string;
}): Promise<CustomerListResponse> {
  const response = await request.get<CustomerListResponse>('/api/customers', { params });
  return response.data;
}

export async function createCustomer(payload: CustomerCreatePayload): Promise<CustomerResponse> {
  const response = await request.post<CustomerResponse>('/api/customers', payload, {
    headers: {
      'X-Skip-Global-Error': 'true',
    },
  });
  return response.data;
}

export async function updateCustomer(customerId: string, payload: CustomerUpdatePayload): Promise<CustomerResponse> {
  const response = await request.put<CustomerResponse>(`/api/customers/${customerId}`, payload, {
    headers: {
      'X-Skip-Global-Error': 'true',
    },
  });
  return response.data;
}

export async function getCustomerDetails(id: string): Promise<CustomerDetailResponse> {
  const response = await request.get<CustomerDetailResponse>(`/api/customers/${id}/details`);
  return response.data;
}

export async function createCustomerSaleRecord(
  customerId: string,
  payload: CustomerSaleRecordCreatePayload,
): Promise<StockTransactionResponse> {
  const response = await request.post<StockTransactionResponse>(`/api/customers/${customerId}/sales-records`, payload, {
    headers: {
      'X-Skip-Global-Error': 'true',
    },
  });
  return response.data;
}

export async function importCustomers(file: File): Promise<CustomerImportResult> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await request.post<CustomerImportResult>('/api/customers/import', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
}

export async function exportCustomers(): Promise<Blob> {
  const response = await request.get<Blob>('/api/customers/export', {
    responseType: 'blob',
  });
  return response.data;
}

export async function getRepairs(params?: {
  search?: string;
  store_id?: string;
}): Promise<RepairRecordResponse[]> {
  const response = await request.get<RepairRecordResponse[]>('/api/repairs', {
    params: {
      search: params?.search?.trim() || undefined,
      store_id: params?.store_id || undefined,
    },
  });
  return response.data;
}

export async function createRepairRecord(payload: RepairRecordCreatePayload): Promise<RepairRecordResponse> {
  const response = await request.post<RepairRecordResponse>('/api/repairs', payload, {
    headers: {
      'X-Skip-Global-Error': 'true',
    },
  });
  return response.data;
}

export async function importRepairs(file: File): Promise<RepairImportResult> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await request.post<RepairImportResult>('/api/repairs/import', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
}

export async function exportRepairs(): Promise<Blob> {
  const response = await request.get<Blob>('/api/repairs/export', {
    responseType: 'blob',
  });
  return response.data;
}

export async function getFittingRecords(customerId?: string): Promise<FittingRecordResponse[]> {
  const url = customerId ? `/api/fittings/customer/${customerId}` : '/api/fittings';
  const response = await request.get<FittingRecordResponse[]>(url);
  return response.data;
}

export async function createFittingRecord(payload: FittingRecordCreatePayload): Promise<FittingRecordResponse> {
  const response = await request.post<FittingRecordResponse>('/api/fittings', payload, {
    headers: {
      'X-Skip-Global-Error': 'true',
    },
  });
  return response.data;
}
