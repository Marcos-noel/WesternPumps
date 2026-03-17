import { api } from "./client";

// Part Analysis (ABC Analysis)
export interface PartAnalysis {
  id: number;
  part_id: number;
  abc_class: string | null;
  turnover_rate: number | null;
  carrying_cost_rate: number | null;
  ordering_cost: number | null;
  eoq: number | null;
  reorder_point: number | null;
  safety_stock: number | null;
  last_analysis_date: string | null;
}

export interface PartAnalysisUpdate {
  abc_class?: string;
  turnover_rate?: number;
  carrying_cost_rate?: number;
  ordering_cost?: number;
  eoq?: number;
  reorder_point?: number;
  safety_stock?: number;
}

// Demand Forecasts
export interface DemandForecast {
  id: number;
  part_id: number;
  forecast_period: string;
  predicted_quantity: number;
  confidence_level: number | null;
  created_at: string;
}

export interface DemandForecastCreate {
  part_id: number;
  forecast_period: string;
  predicted_quantity: number;
  confidence_level?: number;
}

// Pick Waves
export interface PickWave {
  id: number;
  wave_number: string;
  status: string;
  request_ids: number[];
  assigned_to_user_id: number | null;
  created_at: string;
  completed_at: string | null;
}

export interface PickWaveCreate {
  request_ids: number[];
  assigned_to_user_id?: number;
}

export interface PickWaveUpdate {
  status?: string;
  assigned_to_user_id?: number;
}

// Return Authorizations (RMA)
export interface ReturnAuthorization {
  id: number;
  rma_number: string;
  part_id: number;
  quantity: number;
  reason: string;
  status: string;
  requested_by_user_id: number;
  processed_by_user_id: number | null;
  created_at: string;
  processed_at: string | null;
  notes: string | null;
}

export interface ReturnAuthorizationCreate {
  part_id: number;
  quantity: number;
  reason: string;
  notes?: string;
}

export interface ReturnAuthorizationUpdate {
  status?: string;
  processed_by_user_id?: number;
  notes?: string;
}

// Cost Layers (FIFO/LIFO)
export interface InventoryMovementCost {
  id: number;
  part_id: number;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  cost_method: string;
  layer_date: string;
  source_transaction_id: number | null;
}

export interface InventoryMovementCostCreate {
  part_id: number;
  quantity: number;
  unit_cost: number;
  cost_method: string;
  layer_date: string;
  source_transaction_id?: number;
}

export const inventoryScienceApi = {
  // Part Analysis
  getPartAnalysis: async (partId: number): Promise<PartAnalysis> => {
    const response = await api.get<PartAnalysis>(`/api/inventory-science/part-analysis/${partId}`);
    return response.data;
  },

  updatePartAnalysis: async (partId: number, data: PartAnalysisUpdate): Promise<PartAnalysis> => {
    const response = await api.patch<PartAnalysis>(`/api/inventory-science/part-analysis/${partId}`, data);
    return response.data;
  },

  // Demand Forecasts
  listForecasts: async (partId?: number, period?: string, limit = 100): Promise<DemandForecast[]> => {
    const params = new URLSearchParams();
    if (partId) params.append("part_id", partId.toString());
    if (period) params.append("period", period);
    params.append("limit", limit.toString());
    const response = await api.get<DemandForecast[]>(`/api/inventory-science/forecasts?${params.toString()}`);
    return response.data;
  },

  createForecast: async (data: DemandForecastCreate): Promise<DemandForecast> => {
    const response = await api.post<DemandForecast>("/api/inventory-science/forecasts", data);
    return response.data;
  },

  // Pick Waves
  listPickWaves: async (status?: string, limit = 100): Promise<PickWave[]> => {
    const params = new URLSearchParams();
    if (status) params.append("status", status);
    params.append("limit", limit.toString());
    const response = await api.get<PickWave[]>(`/api/inventory-science/pick-waves?${params.toString()}`);
    return response.data;
  },

  createPickWave: async (data: PickWaveCreate): Promise<PickWave> => {
    const response = await api.post<PickWave>("/api/inventory-science/pick-waves", data);
    return response.data;
  },

  updatePickWave: async (waveId: number, data: PickWaveUpdate): Promise<PickWave> => {
    const response = await api.patch<PickWave>(`/api/inventory-science/pick-waves/${waveId}`, data);
    return response.data;
  },

  // Return Authorizations (RMA)
  listReturns: async (status?: string, partId?: number, limit = 100): Promise<ReturnAuthorization[]> => {
    const params = new URLSearchParams();
    if (status) params.append("status", status);
    if (partId) params.append("part_id", partId.toString());
    params.append("limit", limit.toString());
    const response = await api.get<ReturnAuthorization[]>(`/api/inventory-science/returns?${params.toString()}`);
    return response.data;
  },

  createReturn: async (data: ReturnAuthorizationCreate): Promise<ReturnAuthorization> => {
    const response = await api.post<ReturnAuthorization>("/api/inventory-science/returns", data);
    return response.data;
  },

  updateReturn: async (rmaId: number, data: ReturnAuthorizationUpdate): Promise<ReturnAuthorization> => {
    const response = await api.patch<ReturnAuthorization>(`/api/inventory-science/returns/${rmaId}`, data);
    return response.data;
  },

  // Cost Layers
  listCostLayers: async (partId?: number, method?: string, limit = 100): Promise<InventoryMovementCost[]> => {
    const params = new URLSearchParams();
    if (partId) params.append("part_id", partId.toString());
    if (method) params.append("method", method);
    params.append("limit", limit.toString());
    const response = await api.get<InventoryMovementCost[]>(`/api/inventory-science/cost-layers?${params.toString()}`);
    return response.data;
  },

  createCostLayer: async (data: InventoryMovementCostCreate): Promise<InventoryMovementCost> => {
    const response = await api.post<InventoryMovementCost>("/api/inventory-science/cost-layers", data);
    return response.data;
  },
};
