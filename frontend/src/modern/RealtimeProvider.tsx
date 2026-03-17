import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { notifications } from "@mantine/notifications";
import type { StockEvent } from "./types";

type RealtimeContextValue = {
  events: StockEvent[];
  connected: boolean;
};

const RealtimeContext = createContext<RealtimeContextValue>({ events: [], connected: false });

function normalizeEvent(raw: any): StockEvent {
  return {
    id: String(raw?.id ?? crypto.randomUUID()),
    type: raw?.type ?? "stock_delta",
    productId: raw?.productId ?? raw?.product_id,
    sku: raw?.sku,
    message: raw?.message ?? "Inventory event received",
    delta: raw?.delta,
    createdAt: raw?.createdAt ?? raw?.created_at ?? new Date().toISOString()
  };
}

export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient();
  const [events, setEvents] = useState<StockEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);
  const wsUrl = import.meta.env.VITE_WS_URL || "";

  useEffect(() => {
    if (!wsUrl) {
      setConnected(false);
      return;
    }
    let active = true;

    const connect = () => {
      if (!active) return;
      if (retryCountRef.current >= 5) {
        setConnected(false);
        return;
      }
      try {
        const socket = new WebSocket(wsUrl);
        socketRef.current = socket;
        socket.onopen = () => {
          retryCountRef.current = 0;
          setConnected(true);
        };
        socket.onclose = () => {
          setConnected(false);
          if (!active) return;
          retryCountRef.current += 1;
          reconnectRef.current = window.setTimeout(connect, 2000);
        };
        socket.onerror = () => {
          setConnected(false);
        };
        socket.onmessage = (evt) => {
          try {
            const parsed = normalizeEvent(JSON.parse(evt.data));
            setEvents((prev) => [parsed, ...prev].slice(0, 80));
            queryClient.invalidateQueries({ queryKey: ["modern"] });
            notifications.show({
              title: "Live stock update",
              message: parsed.message,
              color: "teal",
              autoClose: 2500
            });
          } catch {
            // ignore malformed events
          }
        };
      } catch {
        setConnected(false);
      }
    };

    connect();
    return () => {
      active = false;
      if (reconnectRef.current) window.clearTimeout(reconnectRef.current);
      socketRef.current?.close();
    };
  }, [queryClient, wsUrl]);

  const value = useMemo(() => ({ events, connected }), [events, connected]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtimeFeed() {
  return useContext(RealtimeContext);
}
