import { request } from '../utils/request';

export interface CreateOrderItemPayload {
  product_id: string;
  quantity: number;
  sn_codes: string[];
}

export interface CreateOrderPayload {
  customer_id: string;
  store_id: string;
  items: CreateOrderItemPayload[];
}

export interface IOrderItem {
  id: string;
  product_id: string;
  product_name: string;
  sku: string;
  quantity: number;
  unit_price: number | string;
  line_total: number | string;
  sn_codes: string[];
}

export interface IOrder {
  id: string;
  customer_id: string;
  store_id: string;
  total_amount: number | string;
  status: 'paid' | 'returned' | 'cancelled';
  created_at: string;
  items: IOrderItem[];
}

export interface IOrderListItem {
  items: Array<{
    product_name: string;
    sku: string;
    quantity: number;
    unit_price: number | string;
    serial_details: Array<{
      sn_code: string;
      warranty_ends_at: string | null;
    }>;
  }>;
  id: string;
  customer_id: string;
  customer_name: string;
  store_id: string;
  store_name: string;
  total_amount: number | string;
  status: 'paid' | 'returned' | 'cancelled';
  created_at: string;
}

export interface GetOrdersParams {
  customerName?: string;
  orderId?: string;
}

export async function createOrder(payload: CreateOrderPayload): Promise<IOrder> {
  const response = await request.post<IOrder>('/api/orders', payload);
  return response.data;
}

export async function getOrders(params: GetOrdersParams = {}): Promise<IOrderListItem[]> {
  const response = await request.get<IOrderListItem[]>('/api/orders', {
    params: {
      customer_name: params.customerName?.trim() || undefined,
      order_id_prefix: params.orderId?.trim() || undefined,
    },
  });
  return response.data;
}

export async function returnOrder(orderId: string): Promise<IOrder> {
  const response = await request.post<IOrder>(`/api/orders/${orderId}/return`);
  return response.data;
}
