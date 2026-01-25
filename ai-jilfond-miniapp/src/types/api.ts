export interface UserData {
  chat_id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  subscription_status: 'demo' | 'paid' | 'expired';
  days_left: number;
  end_sub: string;
  is_free: boolean;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestions?: string[];
}

export interface ChatRequest {
  chat_id: number;
  message: string;
  type: 'text' | 'voice';
}

export interface ChatResponse {
  response: string;
  suggestions?: string[];
}

export interface Property {
  id: string;
  jk_name: string;
  district: string;
  apartments: number;
  floors: number;
  ceiling_height: string;
  mortgage_programs: string[];
  installment?: string;
  discounts?: string[];
  agent_kv: string;
  curator_phone: string;
  price_from?: number;
  price_to?: number;
  area_from?: number;
  area_to?: number;
  image_url?: string;
  address?: string;
  deadline?: string;
}

export interface PropertySearchParams {
  district?: string;
  min_area?: number;
  max_area?: number;
  min_price?: number;
  max_price?: number;
  jk_name?: string;
  mortgage_program?: string;
}

export interface FinanceTools {
  mortgages: MortgageProgram[];
  installments: Installment[];
  discounts: Discount[];
}

export interface MortgageProgram {
  id: string;
  name: string;
  bank: string;
  rate: number;
  min_payment: number;
  max_term: number;
  requirements?: string;
}

export interface Installment {
  id: string;
  name: string;
  term: number;
  first_payment: number;
  monthly_payment?: number;
}

export interface Discount {
  id: string;
  name: string;
  value: string;
  conditions?: string;
  valid_until?: string;
}

export interface PaymentResponse {
  payment_url: string;
  payment_id: string;
}
