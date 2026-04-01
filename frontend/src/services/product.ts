import { request } from '../utils/request';

export interface IProduct {
  id: string;
  product_code: string;
  category: string;
  category_display: string;
  brand: string;
  brand_display: string;
  name_cn: string;
  name_en: string | null;
  specification: string | null;
  matrix: string | null;
  original_price: number | string;
  unit: string | null;
  remark: string | null;
  created_at: string;
}

export interface ProductPayload {
  product_code: string;
  category: string;
  brand: string;
  name_cn: string;
  name_en?: string | null;
  specification?: string | null;
  matrix?: string | null;
  original_price: number;
  unit?: string | null;
  remark?: string | null;
}

export interface ImportResult {
  imported_count: number;
  skipped_count: number;
}

export async function getProducts(storeId?: string): Promise<IProduct[]> {
  const response = await request.get<IProduct[]>('/api/products', {
    params: {
      store_id: storeId || undefined,
    },
  });
  return response.data;
}

export async function createProduct(payload: ProductPayload): Promise<IProduct> {
  const response = await request.post<IProduct>('/api/products', payload);
  return response.data;
}

export async function updateProduct(productId: string, payload: ProductPayload): Promise<IProduct> {
  const response = await request.put<IProduct>(`/api/products/${productId}`, payload);
  return response.data;
}

export async function importProducts(file: File): Promise<ImportResult> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await request.post<ImportResult>('/api/products/import', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
}

export async function exportProducts(): Promise<Blob> {
  const response = await request.get<Blob>('/api/products/export', {
    responseType: 'blob',
  });
  return response.data;
}
