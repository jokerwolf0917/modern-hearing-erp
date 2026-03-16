import { request } from '../utils/request';

export type AppointmentStatus = 'pending' | 'completed' | 'cancelled';

export interface IAppointment {
  id: string;
  store_id: string;
  customer_id: string;
  employee_id: string;
  appointment_time: string;
  type: string;
  status: AppointmentStatus;
  notes: string | null;
  customer_name: string;
  customer_phone: string;
  employee_username: string;
  store_name: string;
  created_at: string;
}

export interface GetAppointmentsParams {
  startTime?: string;
  endTime?: string;
}

export interface CreateAppointmentPayload {
  store_id: string;
  customer_id: string;
  appointment_time: string;
  type: string;
  notes?: string;
}

export async function getAppointments(params: GetAppointmentsParams = {}): Promise<IAppointment[]> {
  const response = await request.get<IAppointment[]>('/api/appointments', {
    params: {
      start_time: params.startTime,
      end_time: params.endTime,
    },
  });
  return response.data;
}

export async function createAppointment(payload: CreateAppointmentPayload): Promise<IAppointment> {
  const response = await request.post<IAppointment>('/api/appointments', payload);
  return response.data;
}

export async function updateAppointmentStatus(
  id: string,
  status: AppointmentStatus,
): Promise<IAppointment> {
  const response = await request.put<IAppointment>(`/api/appointments/${id}/status`, { status });
  return response.data;
}
