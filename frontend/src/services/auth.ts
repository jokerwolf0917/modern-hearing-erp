import { request } from '../utils/request';

export interface IEmployee {
  id: string;
  username: string;
  role: 'admin' | 'store_manager' | 'staff';
  store_id: string | null;
  is_active: boolean;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  employee: IEmployee;
}

export async function login(username: string, password: string): Promise<LoginResponse> {
  const payload = new URLSearchParams();
  payload.append('username', username);
  payload.append('password', password);

  const response = await request.post<LoginResponse>('/api/auth/login', payload, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  return response.data;
}
