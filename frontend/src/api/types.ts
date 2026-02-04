export type Token = {
  access_token: string;
  token_type: "bearer";
};

export type Customer = {
  id: number;
  name: string;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
};

export type Job = {
  id: number;
  customer_id: number;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  assigned_to_user_id?: number | null;
  created_by_user_id?: number | null;
  created_at: string;
  updated_at: string;
};

export type Item = {
  id: number;
  sku: string;
  name: string;
  description?: string | null;
  unit_price?: number | null;
  quantity_on_hand: number;
  min_quantity: number;
  supplier_id?: number | null;
  created_at: string;
  updated_at: string;
};

export type Supplier = {
  id: number;
  name: string;
  contact_name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type StockTransactionType = "IN" | "OUT" | "ADJUST";

export type StockTransaction = {
  id: number;
  part_id: number;
  transaction_type: StockTransactionType;
  quantity_delta: number;
  supplier_id?: number | null;
  notes?: string | null;
  created_by_user_id?: number | null;
  created_at: string;
  updated_at: string;
};

export type Paginated<T> = {
  items: T[];
  page: number;
  page_size: number;
  total: number;
};
