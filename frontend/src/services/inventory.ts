import { request } from '../utils/request';

export interface StockInPayload {
  store_id: string;
  product_id: string;
  quantity: number;
}

export interface TransferStockPayload {
  from_store_id: string;
  to_store_id: string;
  product_id: string;
  quantity: number;
}

export interface SerialStockInPayload {
  store_id: string;
  product_id: string;
  sn_codes: string[];
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

export interface SerialStockInResponse {
  store_id: string;
  product_id: string;
  created_count: number;
  quantity: number;
  ledger_id: string;
}

export interface StockSummaryItem {
  inventory_id: string;
  store_id: string;
  store_name: string;
  product_id: string;
  product_name: string;
  sku: string;
  retail_price: number | string;
  quantity: number;
}

export interface InventoryLedgerRow {
  inventory_id: string;
  store_id: string;
  store_name: string;
  product_id: string;
  product_name: string;
  sku: string;
  quantity: number;
  cost_price: number | string;
  retail_price: number | string;
  has_sn_tracking: boolean;
}

export interface LedgerHistoryItem {
  ledger_id: string;
  created_at: string;
  store_id: string;
  store_name: string;
  product_id: string;
  product_name: string;
  sku: string;
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

export interface AvailableSerialItem {
  id: string;
  sn_code: string;
}

export interface SNTraceResult {
  sn_code: string;
  status: 'in_stock' | 'sold' | 'returned' | 'defective';
  product_name: string;
  store_name: string;
  customer_name: string | null;
  order_id: string | null;
  stocked_in_at: string;
  sold_at: string | null;
  warranty_ends_at: string | null;
  is_warranty_valid: boolean;
}

export async function stockIn(data: StockInPayload): Promise<StockInResponse> {
  const response = await request.post<StockInResponse>('/api/inventory/stock-in', data);
  return response.data;
}

export async function transferStock(data: TransferStockPayload): Promise<TransferStockResponse> {
  const response = await request.post<TransferStockResponse>('/api/inventory/transfer', data);
  return response.data;
}

export async function serialStockIn(data: SerialStockInPayload): Promise<SerialStockInResponse> {
  const response = await request.post<SerialStockInResponse>('/api/inventory/sn-stock-in', data);
  return response.data;
}

export async function snStockIn(
  storeId: string,
  productId: string,
  snCodes: string[],
): Promise<SerialStockInResponse> {
  return serialStockIn({
    store_id: storeId,
    product_id: productId,
    sn_codes: snCodes,
  });
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

export async function getAvailableSNs(storeId: string, productId: string): Promise<AvailableSerialItem[]> {
  const response = await request.get<AvailableSerialItem[]>('/api/inventory/available-sns', {
    params: {
      store_id: storeId,
      product_id: productId,
    },
  });
  return response.data;
}

export async function traceSN(snCode: string): Promise<SNTraceResult> {
  const response = await request.get<SNTraceResult>(`/api/inventory/trace-sn/${encodeURIComponent(snCode)}`);
  return response.data;
}
