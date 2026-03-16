import { request } from '../utils/request';

export interface IEarThresholds {
  '250Hz': number | null;
  '500Hz': number | null;
  '1kHz': number | null;
  '2kHz': number | null;
  '4kHz': number | null;
  '8kHz': number | null;
}

export interface IAudiogramResponse {
  customer_name: string | null;
  left_ear_thresholds: IEarThresholds;
  right_ear_thresholds: IEarThresholds;
  hearing_aid_model_mentioned: string | null;
  raw_text_summary: string;
}

const AI_PARSE_TIMEOUT_MS = 180_000;

export async function uploadAudiogram(file: File): Promise<IAudiogramResponse> {
  const formData = new FormData();
  formData.append('file', file);

  const response = await request.post<IAudiogramResponse>('/api/ai/parse-audiogram', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    timeout: AI_PARSE_TIMEOUT_MS,
  });

  return response.data;
}
