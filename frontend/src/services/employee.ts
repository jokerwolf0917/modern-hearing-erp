import { request } from '../utils/request';

export type EmployeeRole = 'admin' | 'store_manager' | 'staff';

export interface IEmployeeRecord {
  id: string;
  username: string;
  role: EmployeeRole;
  store_id: string | null;
  store_name: string | null;
  is_active: boolean;
}

export interface CreateEmployeePayload {
  username: string;
  password: string;
  role: EmployeeRole;
  store_id: string | null;
}

export interface UpdateEmployeePayload {
  username?: string;
  role?: EmployeeRole;
  store_id?: string | null;
}

export async function getEmployees(): Promise<IEmployeeRecord[]> {
  const response = await request.get<IEmployeeRecord[]>('/api/employees');
  return response.data;
}

export async function createEmployee(payload: CreateEmployeePayload): Promise<IEmployeeRecord> {
  const response = await request.post<IEmployeeRecord>('/api/employees', payload);
  return response.data;
}

export async function updateEmployee(id: string, payload: UpdateEmployeePayload): Promise<IEmployeeRecord> {
  const response = await request.put<IEmployeeRecord>(`/api/employees/${id}`, payload);
  return response.data;
}

export async function toggleEmployeeActive(id: string): Promise<IEmployeeRecord> {
  const response = await request.put<IEmployeeRecord>(`/api/employees/${id}/toggle-active`);
  return response.data;
}

export async function resetEmployeePassword(id: string, newPassword: string): Promise<{ message: string }> {
  const response = await request.put<{ message: string }>(`/api/employees/${id}/reset-password`, {
    new_password: newPassword,
  });
  return response.data;
}
