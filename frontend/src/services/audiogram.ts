import { request } from '../utils/request';


export interface IAudiogram {
  id: string;
  customer_id: string;
  test_date: string;
  left_ear_data: Record<string, number>;
  right_ear_data: Record<string, number>;
  notes: string | null;
  created_at: string;
}


export interface CreateAudiogramPayload {
  test_date: string;
  left_ear_data: Record<string, number>;
  right_ear_data: Record<string, number>;
  notes?: string;
}


export async function getCustomerAudiograms(customerId: string): Promise<IAudiogram[]> {
  const response = await request.get<IAudiogram[]>(`/api/customers/${customerId}/audiograms`);
  return response.data;
}


export async function createCustomerAudiogram(
  customerId: string,
  payload: CreateAudiogramPayload,
): Promise<IAudiogram> {
  const response = await request.post<IAudiogram>(`/api/customers/${customerId}/audiograms`, payload);
  return response.data;
}
