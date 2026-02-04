export type Token = {
  access_token: string;
  token_type: "bearer";
};

export type UserRole = "admin" | "staff" | "store_manager" | "technician" | "manager" | "approver";

export type User = {
  id: number;
  email: string;
  full_name?: string | null;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
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
  tracking_type?: string;
  unit_of_measure?: string | null;
  category_id?: number | null;
  location_id?: number | null;
  supplier_id?: number | null;
  created_at: string;
  updated_at: string;
};

export type Category = {
  id: number;
  name: string;
  parent_id?: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type Location = {
  id: number;
  name: string;
  description?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ItemInstance = {
  id: number;
  part_id: number;
  serial_number: string;
  status: string;
  location_id?: number | null;
  created_at: string;
  updated_at: string;
};

export type StockRequestLine = {
  id: number;
  part_id: number;
  quantity: number;
  unit_cost?: number | null;
  tracking_type?: string | null;
  created_at: string;
  updated_at: string;
};

export type StockRequest = {
  id: number;
  requested_by_user_id: number;
  customer_id?: number | null;
  job_id?: number | null;
  status: string;
  total_value?: number | null;
  required_approval_role?: string | null;
  approved_by_user_id?: number | null;
  approved_at?: string | null;
  rejected_reason?: string | null;
  lines: StockRequestLine[];
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
