import type {
  UserData,
  ChatRequest,
  ChatResponse,
  Property,
  PropertySearchParams,
  FinanceTools,
  PaymentResponse,
} from '../types/api';

const API_BASE_URL = import.meta.env.VITE_N8N_WEBHOOK_URL || 'https://your-n8n-domain.com/webhook/miniapp';

class N8nApiClient {
  private initData: string = '';

  setInitData(initData: string) {
    this.initData = initData;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${API_BASE_URL}/${endpoint}`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'X-Telegram-Init-Data': this.initData,
      ...options.headers,
    };

    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  async getUser(chatId: number): Promise<{ user: UserData }> {
    return this.request<{ user: UserData }>(`user?chat_id=${chatId}`, {
      method: 'GET',
    });
  }

  async sendChatMessage(request: ChatRequest): Promise<ChatResponse> {
    return this.request<ChatResponse>('chat', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async searchProperties(params: PropertySearchParams): Promise<{ properties: Property[] }> {
    const searchParams = new URLSearchParams();

    if (params.district) searchParams.set('district', params.district);
    if (params.min_area) searchParams.set('min_area', params.min_area.toString());
    if (params.max_area) searchParams.set('max_area', params.max_area.toString());
    if (params.min_price) searchParams.set('min_price', params.min_price.toString());
    if (params.max_price) searchParams.set('max_price', params.max_price.toString());
    if (params.jk_name) searchParams.set('jk_name', params.jk_name);
    if (params.mortgage_program) searchParams.set('mortgage_program', params.mortgage_program);

    return this.request<{ properties: Property[] }>(
      `properties?${searchParams.toString()}`,
      { method: 'GET' }
    );
  }

  async getFinanceTools(): Promise<FinanceTools> {
    return this.request<FinanceTools>('finance-tools', {
      method: 'GET',
    });
  }

  async createPayment(chatId: number): Promise<PaymentResponse> {
    return this.request<PaymentResponse>('payment', {
      method: 'POST',
      body: JSON.stringify({ chat_id: chatId }),
    });
  }
}

export const apiClient = new N8nApiClient();
export default apiClient;
