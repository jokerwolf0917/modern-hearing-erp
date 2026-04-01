import { request } from '../utils/request';

export interface StockInPayload {
  store_id: string;
  product_id: string;
  quantity: number;
  transaction_date?: string;
  remark?: string;
}

export interface TransferStockPayload {
  from_store_id: string;
  to_store_id: string;
  product_id: string;
  quantity: number;
  transaction_date?: string;
  remark?: string;
}

export interface StockInResponse {
  inventory_id: string;
  store_id: string;
  product_id: string;
  quantity: number;
  ledger_id: string;
}

export interface TransferStockResponse {
  transfer_id: string;
  from_store_id: string;
  to_store_id: string;
  product_id: string;
  quantity: number;
  status: string;
  remaining_stock: number;
  ledger_id: string;
}

export interface StockSummaryItem {
  inventory_id: string;
  store_id: string;
  store_name: string;
  product_id: string;
  product_code: string;
  category: string;
  category_display: string;
  brand: string;
  brand_display: string;
  name_cn: string;
  name_en: string | null;
  specification: string | null;
  original_price: number | string;
  quantity: number;
  unit: string | null;
}

export interface InventoryLedgerRow {
  inventory_id: string;
  store_id: string;
  store_name: string;
  product_id: string;
  product_code: string;
  category: string;
  category_display: string;
  brand: string;
  brand_display: string;
  name_cn: string;
  name_en: string | null;
  specification: string | null;
  original_price: number | string;
  last_month_stock: number;
  in_this_month: number;
  out_this_month: number;
  sales_this_month: number;
  expected_stock: number;
  actual_stock: number;
  unit: string | null;
  remark: string | null;
}

export interface LedgerHistoryItem {
  ledger_id: string;
  created_at: string;
  store_id: string;
  store_name: string;
  product_id: string;
  product_code: string;
  product_name: string;
  reference_type: string;
  change_amount: number;
  quantity_before: number;
  quantity_after: number;
}

export interface DashboardMetrics {
  total_inventory_items: number;
  today_stock_in_count: number;
  today_transfer_count: number;
  low_stock_warning_count: number;
}

export async function stockIn(data: StockInPayload): Promise<StockInResponse> {
  const response = await request.post<StockInResponse>('/api/inventory/stock-in', data);
  return response.data;
}

export async function transferStock(data: TransferStockPayload): Promise<TransferStockResponse> {
  const response = await request.post<TransferStockResponse>('/api/inventory/transfer', data);
  return response.data;
}

export async function getStockSummary(): Promise<StockSummaryItem[]> {
  const response = await request.get<StockSummaryItem[]>('/api/inventory/stock-summary');
  return response.data;
}

export async function getInventoryLedger(params?: {
  storeId?: string;
  productName?: string;
}): Promise<InventoryLedgerRow[]> {
  const response = await request.get<InventoryLedgerRow[]>('/api/inventory/ledger', {
    params: {
      store_id: params?.storeId || undefined,
      product_name: params?.productName?.trim() || undefined,
    },
  });
  return response.data;
}

export async function getLedgerHistory(): Promise<LedgerHistoryItem[]> {
  const response = await request.get<LedgerHistoryItem[]>('/api/inventory/ledger-history');
  return response.data;
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const response = await request.get<DashboardMetrics>('/api/inventory/dashboard-metrics');
  return response.data;
}
