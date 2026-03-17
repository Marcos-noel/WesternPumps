import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { App as AntdApp } from "antd";
import { listRequests } from "../api/requests";
import { listJobs } from "../api/jobs";
import { listMyReturnSubmissions, listPendingReturns } from "../api/stock";
import { listDeliveryRequests } from "../api/deliveries";
import type { DeliveryRequest, Job, StockRequest } from "../api/types";
import { formatRequestRef } from "../utils/requestRef";
import { useAuth } from "./AuthContext";

type SystemNotification = {
  id: string;
  title: string;
  description: string;
  created_at: string;
  route: "/approvals" | "/requests" | "/jobs" | "/deliveries";
};

type RecentActivityItem = {
  id: string;
  title: string;
  meta: string;
  created_at: string;
  badge: string;
  badgeClass: string;
  route: "/approvals" | "/requests" | "/jobs" | "/deliveries";
};

type NotificationsContextValue = {
  pendingCount: number;
  unreadCount: number;
  notifications: SystemNotification[];
  recentActivity: RecentActivityItem[];
  markAllRead: () => void;
  refreshNow: () => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

type ActivityRoute = "/approvals" | "/requests";

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const { notification } = AntdApp.useApp();
  const { isAuthenticated, user, isAdmin } = useAuth();
  const role = user?.role ?? "technician";
  const isApprover = isAdmin || role === "manager" || role === "approver";
  const isStoreManager = isAdmin || role === "manager" || role === "store_manager";
  const isTechRole = role === "technician" || role === "lead_technician" || role === "staff";
  const isCourierRole = role === "rider" || role === "driver";
  const canUseDeliveries = isStoreManager || isTechRole || isCourierRole;

  const [pendingCount, setPendingCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>([]);

  const initializedRef = useRef(false);
  const previousPendingIdsRef = useRef<Set<number>>(new Set());
  const previousJobIdsRef = useRef<Set<number>>(new Set());
  const previousPendingReturnIdsRef = useRef<Set<number>>(new Set());
  const previousReturnDecisionByIdRef = useRef<Map<number, string>>(new Map());
  const previousDeliveryIdsRef = useRef<Set<number>>(new Set());
  const dismissedNotificationIdsRef = useRef<Set<string>>(new Set());
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioUnlockedRef = useRef(false);

  useEffect(() => {
    const unlock = () => {
      if (audioUnlockedRef.current) return;
      try {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return;
        const ctx = audioContextRef.current ?? new Ctx();
        audioContextRef.current = ctx;
        if (ctx.state === "suspended") {
          void ctx.resume();
        }
        audioUnlockedRef.current = true;
      } catch {
        // ignore
      }
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    window.addEventListener("touchstart", unlock, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };
  }, []);

  const playNotificationSound = useCallback(() => {
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctx) return;
      const ctx = audioContextRef.current ?? new Ctx();
      audioContextRef.current = ctx;
      if (ctx.state === "suspended") {
        void ctx.resume();
        return;
      }
      const now = ctx.currentTime;

      // --- First chime tone (C6 = 1047 Hz) ---
      const gain1 = ctx.createGain();
      gain1.gain.setValueAtTime(0.0001, now);
      gain1.gain.exponentialRampToValueAtTime(0.25, now + 0.02);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
      gain1.connect(ctx.destination);

      const osc1 = ctx.createOscillator();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(1047, now);
      osc1.connect(gain1);
      osc1.start(now);
      osc1.stop(now + 0.38);

      // --- Second chime tone (E6 = 1319 Hz, delayed 150ms) ---
      const gain2 = ctx.createGain();
      gain2.gain.setValueAtTime(0.0001, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.25, now + 0.17);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
      gain2.connect(ctx.destination);

      const osc2 = ctx.createOscillator();
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(1319, now + 0.15);
      osc2.connect(gain2);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.58);

      // --- Third chime tone (G6 = 1568 Hz, delayed 300ms) ---
      const gain3 = ctx.createGain();
      gain3.gain.setValueAtTime(0.0001, now + 0.30);
      gain3.gain.exponentialRampToValueAtTime(0.20, now + 0.32);
      gain3.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);
      gain3.connect(ctx.destination);

      const osc3 = ctx.createOscillator();
      osc3.type = "sine";
      osc3.frequency.setValueAtTime(1568, now + 0.30);
      osc3.connect(gain3);
      osc3.start(now + 0.30);
      osc3.stop(now + 0.78);
    } catch {
      // Audio playback can fail due to browser autoplay policy; ignore silently.
    }
  }, []);

  const markAllRead = useCallback(() => {
    const requestIds = new Set<number>();
    const jobIds = new Set<number>();
    notifications.forEach((n) => {
      if (n.id.startsWith("request-")) {
        const id = Number(n.id.replace("request-", ""));
        if (Number.isFinite(id)) requestIds.add(id);
      }
      if (n.id.startsWith("job-")) {
        const id = Number(n.id.replace("job-", ""));
        if (Number.isFinite(id)) jobIds.add(id);
      }
      if (n.id.startsWith("return-pending-")) {
        const id = Number(n.id.replace("return-pending-", ""));
        if (Number.isFinite(id)) previousPendingReturnIdsRef.current.add(id);
      }
      if (n.id.startsWith("return-decision-")) {
        const id = Number(n.id.replace("return-decision-", ""));
        if (Number.isFinite(id)) previousReturnDecisionByIdRef.current.set(id, "seen");
      }
    });
    // Mark currently visible IDs as seen so next poll doesn't re-increment unread count.
    if (requestIds.size > 0) previousPendingIdsRef.current = requestIds;
    if (jobIds.size > 0) previousJobIdsRef.current = jobIds;
    notifications.forEach((n) => dismissedNotificationIdsRef.current.add(n.id));
    initializedRef.current = true;
    setUnreadCount(0);
    setNotifications([]);
  }, [notifications]);

  const refreshNow = async () => {
    if (!isAuthenticated) {
      setPendingCount(0);
      setUnreadCount(0);
      setNotifications([]);
      setRecentActivity([]);
      previousPendingIdsRef.current = new Set();
      previousJobIdsRef.current = new Set();
      previousPendingReturnIdsRef.current = new Set();
      previousReturnDecisionByIdRef.current = new Map();
      previousDeliveryIdsRef.current = new Set();
      dismissedNotificationIdsRef.current = new Set();
      initializedRef.current = false;
      return;
    }

    try {
      const [requestRows, allRequests, jobs, pendingReturns, myReturnSubmissions, deliveries] = await Promise.all([
        listRequests({ status: "PENDING", mine: isApprover ? undefined : true }),
        listRequests({ mine: isApprover ? undefined : true }),
        listJobs(),
        isStoreManager || isApprover ? listPendingReturns() : Promise.resolve([]),
        isTechRole ? listMyReturnSubmissions({ limit: 50 }) : Promise.resolve([]),
        canUseDeliveries ? listDeliveryRequests() : Promise.resolve([]),
      ]);

      const relevantJobs = (jobs || []).filter((j: Job) => {
        if (isApprover || isStoreManager) return true;
        return (j.assigned_to_user_id ?? null) === (user?.id ?? null);
      });

      const requestIds = new Set(requestRows.map((r) => r.id));
      const prevRequestIds = previousPendingIdsRef.current;
      const newRequestIds = requestRows.filter((r) => !prevRequestIds.has(r.id)).map((r) => r.id);

      const jobIds = new Set(relevantJobs.map((j) => j.id));
      const prevJobIds = previousJobIdsRef.current;
      const newJobIds = relevantJobs.filter((j) => !prevJobIds.has(j.id)).map((j) => j.id);
      const pendingReturnIds = new Set((pendingReturns || []).map((r) => r.id));
      const prevPendingReturnIds = previousPendingReturnIdsRef.current;
      const newPendingReturnIds = (pendingReturns || []).filter((r) => !prevPendingReturnIds.has(r.id)).map((r) => r.id);
      const deliveryRows = (deliveries || []) as DeliveryRequest[];
      const deliveryIds = new Set(deliveryRows.map((d) => d.id));
      const prevDeliveryIds = previousDeliveryIdsRef.current;
      const newDeliveryIds = deliveryRows.filter((d) => !prevDeliveryIds.has(d.id)).map((d) => d.id);

      const decisions = (myReturnSubmissions || []).filter((row) => ["RETURN_APPROVED", "RETURN_REJECTED"].includes((row.status || "").toUpperCase()));
      const prevDecisionMap = previousReturnDecisionByIdRef.current;
      const newDecisionIds = decisions
        .filter((row) => {
          const prevStatus = prevDecisionMap.get(row.id);
          return prevStatus !== (row.status || "");
        })
        .map((row) => row.id);

      setPendingCount(requestRows.length);

      const requestNotifications = requestRows
        .slice()
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 8)
        .map((r: StockRequest) => ({
          id: `request-${r.id}`,
          title: `${formatRequestRef(r.id)} pending`,
          description: `${(r.lines ?? []).length} line(s) awaiting approval`,
          created_at: r.created_at,
          route: isApprover ? ("/approvals" as const) : ("/requests" as const),
        }));

      const jobNotifications = relevantJobs
        .slice()
        .sort((a, b) => new Date((b.updated_at || b.created_at)).getTime() - new Date((a.updated_at || a.created_at)).getTime())
        .slice(0, 8)
        .map((j: Job) => ({
          id: `job-${j.id}`,
          title: isTechRole && (j.assigned_to_user_id ?? null) === (user?.id ?? null) ? `Job #${j.id} assigned to you` : `Job #${j.id} update`,
          description: j.title,
          created_at: j.updated_at || j.created_at,
          route: "/jobs" as const,
        }));

      const returnPendingNotifications = (pendingReturns || [])
        .slice()
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 6)
        .map((r) => ({
          id: `return-pending-${r.id}`,
          title: `Return RET-${r.id} pending approval`,
          description: `${r.part_sku} x${r.quantity} (${r.condition})`,
          created_at: r.created_at,
          route: "/approvals" as const,
        }));

      const returnDecisionNotifications = decisions
        .slice()
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 6)
        .map((r) => ({
          id: `return-decision-${r.id}`,
          title: `Return RET-${r.id} ${r.status === "RETURN_APPROVED" ? "approved" : "rejected"}`,
          description: `${r.part_sku} x${r.quantity}`,
          created_at: r.created_at,
          route: "/requests" as const,
        }));

      const deliveryNotifications = deliveryRows
        .slice()
        .sort((a, b) => new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime())
        .slice(0, 8)
        .map((d) => ({
          id: `delivery-${d.id}`,
          title: `Delivery #${d.id} ${String(d.status || "").toLowerCase()}`,
          description: `${d.delivery_mode} | ${d.pickup_location || "Store"} -> ${d.dropoff_location || "Technician site"}`,
          created_at: d.updated_at || d.created_at,
          route: "/deliveries" as const,
        }));

      const merged = [...requestNotifications, ...jobNotifications, ...returnPendingNotifications, ...returnDecisionNotifications, ...deliveryNotifications]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 12);

      // Prune dismissed IDs that no longer exist in the latest notification window.
      const currentIds = new Set(merged.map((n) => n.id));
      dismissedNotificationIdsRef.current.forEach((id) => {
        if (!currentIds.has(id)) dismissedNotificationIdsRef.current.delete(id);
      });

      const visibleNotifications = merged.filter((n) => !dismissedNotificationIdsRef.current.has(n.id));
      setNotifications(visibleNotifications);

      const requestActivity = allRequests
        .slice()
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 12)
        .map((r: StockRequest) => {
          const statusKey = (r.status || "pending").toLowerCase();
          const lines = r.lines ?? [];
          const units = lines.reduce((sum, line) => sum + (line.quantity || 0), 0);
          const route: ActivityRoute = isApprover && statusKey === "pending" ? "/approvals" : "/requests";
          return {
            id: `request-activity-${r.id}`,
            title: formatRequestRef(r.id),
            meta: `${lines.length} lines / ${units} units`,
            created_at: r.created_at,
            badge: (r.status || "PENDING").toUpperCase(),
            badgeClass: `activity-pill--request activity-pill--${statusKey}`,
            route,
          };
        });
      setRecentActivity(requestActivity);

      if (initializedRef.current && (newRequestIds.length > 0 || newJobIds.length > 0 || newPendingReturnIds.length > 0 || newDecisionIds.length > 0 || newDeliveryIds.length > 0)) {
        const increment = newRequestIds.length + newJobIds.length + newPendingReturnIds.length + newDecisionIds.length + newDeliveryIds.length;
        setUnreadCount((v) => v + increment);
        playNotificationSound();

        if (newRequestIds.length > 0) {
          notification.info({
            message: newRequestIds.length === 1 ? "New pending request" : "New pending requests",
            description:
              newRequestIds.length === 1
                ? `${formatRequestRef(newRequestIds[0])} is pending.`
                : `${newRequestIds.length} new requests are pending.`,
            placement: "topRight",
            duration: 4,
            className: "lux-notification",
          });
        }

        if (newJobIds.length > 0) {
          notification.success({
            message: newJobIds.length === 1 ? "New job notification" : "New job notifications",
            description: isTechRole
              ? `${newJobIds.length} job(s) assigned to you.`
              : `${newJobIds.length} job update(s) in the system.`,
            placement: "topRight",
            duration: 4,
            className: "lux-notification",
          });
        }
        if (newPendingReturnIds.length > 0) {
          notification.warning({
            message: newPendingReturnIds.length === 1 ? "Return approval needed" : "Return approvals needed",
            description: `${newPendingReturnIds.length} return submission(s) are awaiting manager decision.`,
            placement: "topRight",
            duration: 4,
            className: "lux-notification",
          });
        }
        if (newDecisionIds.length > 0) {
          notification.success({
            message: newDecisionIds.length === 1 ? "Return decision update" : "Return decision updates",
            description: `${newDecisionIds.length} return submission(s) have a new decision.`,
            placement: "topRight",
            duration: 4,
            className: "lux-notification",
          });
        }
        if (newDeliveryIds.length > 0) {
          notification.info({
            message: newDeliveryIds.length === 1 ? "Delivery request update" : "Delivery request updates",
            description: `${newDeliveryIds.length} delivery update(s) are available.`,
            placement: "topRight",
            duration: 4,
            className: "lux-notification",
          });
        }
      }

      previousPendingIdsRef.current = requestIds;
      previousJobIdsRef.current = jobIds;
      previousPendingReturnIdsRef.current = pendingReturnIds;
      previousReturnDecisionByIdRef.current = new Map((myReturnSubmissions || []).map((row) => [row.id, row.status || ""]));
      previousDeliveryIdsRef.current = deliveryIds;
      if (!initializedRef.current) initializedRef.current = true;
      if (requestRows.length === 0 && relevantJobs.length === 0) {
        setUnreadCount(0);
      }
    } catch {
      setPendingCount(0);
      setRecentActivity([]);
    }
  };

  useEffect(() => {
    void refreshNow();
    const timer = window.setInterval(() => {
      void refreshNow();
    }, 30000);
    return () => window.clearInterval(timer);
  }, [isAuthenticated, isApprover, isStoreManager, isTechRole, canUseDeliveries, user?.id]);

  const value = useMemo<NotificationsContextValue>(
    () => ({
      pendingCount,
      unreadCount,
      notifications,
      recentActivity,
      markAllRead,
      refreshNow,
    }),
    [pendingCount, unreadCount, notifications, recentActivity, markAllRead]
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used within NotificationsProvider");
  return ctx;
}
