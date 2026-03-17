export type StockStatus = "in_stock" | "low_stock" | "out_of_stock";

export type Product = {
  id: number;
  sku: string;
  name: string;
  category?: string;
  supplierName?: string;
  onHand: number;
  minLevel: number;
  unitPrice: number;
  status: StockStatus;
  updatedAt: string;
};

export type Supplier = {
  id: number;
  name: string;
  contactName?: string;
  email?: string;
  phone?: string;
  active: boolean;
  leadTimeDays?: number;
};

export type StockEvent = {
  id: string;
  type: "stock_delta" | "order_received" | "low_stock_alert";
  productId?: number;
  sku?: string;
  message: string;
  delta?: number;
  createdAt: string;
};

export type DashboardSummary = {
  totalSkus: number;
  inventoryValue: number;
  lowStockCount: number;
  openOrders: number;
};

export type TrendPoint = {
  date: string;
  in: number;
  out: number;
  forecast?: number;
};

export type ReceivingPayload = {
  supplierId: number;
  poNumber: string;
  receivedAt: string;
  lines: Array<{
    productId: number;
    quantity: number;
    unitCost: number;
  }>;
  notes?: string;
};

