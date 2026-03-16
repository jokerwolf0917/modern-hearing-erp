import { request } from '../utils/request';

export interface RevenueTrendPoint {
  date: string;
  revenue: number | string;
}

export interface TopProductItem {
  product_name: string;
  sales_volume: number;
}

export interface DashboardSummary {
  total_revenue: number | string;
  total_orders: number;
  revenue_trend: RevenueTrendPoint[];
  top_products: TopProductItem[];
}

export async function getDashboardSummary(): Promise<DashboardSummary> {
  const response = await request.get<DashboardSummary>('/api/analytics/summary');
  return response.data;
}
