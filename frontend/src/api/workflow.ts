import { api } from "./client";

export interface WorkflowRules {
  rules: Record<string, Record<string, Record<string, string>>>;
}

export interface WorkflowRulesUpdate {
  rules: Record<string, Record<string, Record<string, string>>>;
}

export interface WorkflowEvaluatePayload {
  entity: string;
  event: string;
  current_state: string;
}

export interface WorkflowEvaluateResult {
  next_state: string | null;
  matched: boolean;
}

export const workflowApi = {
  // Get workflow rules
  getRules: async (): Promise<WorkflowRules> => {
    const response = await api.get<WorkflowRules>("/api/workflow/rules");
    return response.data;
  },

  // Update workflow rules (admin only)
  updateRules: async (rules: Record<string, Record<string, Record<string, string>>>): Promise<WorkflowRules> => {
    const response = await api.put<WorkflowRules>("/api/workflow/rules", { rules });
    return response.data;
  },

  // Evaluate a workflow transition
  evaluate: async (entity: string, event: string, currentState: string): Promise<WorkflowEvaluateResult> => {
    const response = await api.post<WorkflowEvaluateResult>("/api/workflow/evaluate", {
      entity,
      event,
      current_state: currentState,
    });
    return response.data;
  },
};
