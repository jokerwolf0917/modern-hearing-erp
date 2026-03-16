import { request } from '../utils/request';

export interface IProduct {
  id: string;
  name: string;
  sku: string;
  category: string;
  cost_price: number | string;
  retail_price: number | string;
  brand: string | null;
  manufacturer: string | null;
  registration_no: string | null;
  has_sn_tracking: boolean;
}

export interface CreateProductPayload {
  name: string;
  sku: string;
  category: string;
  cost_price: number;
  retail_price: number;
  brand: string;
  manufacturer: string;
  registration_no: string;
  has_sn_tracking: boolean;
}

export interface UpdateProductPayload extends CreateProductPayload {}

export interface ImportResult {
  imported_count: number;
  skipped_count: number;
}

export async function getProducts(): Promise<IProduct[]> {
  const response = await request.get<IProduct[]>('/api/products');
  return response.data;
}

export async function createProduct(payload: CreateProductPayload): Promise<IProduct> {
  const response = await request.post<IProduct>('/api/products', payload);
  return response.data;
}

export async function updateProduct(productId: string, payload: UpdateProductPayload): Promise<IProduct> {
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
