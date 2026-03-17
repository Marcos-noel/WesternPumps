import React from "react";
import { Alert, Card, Grid, Loader, Stack, Table, Text, Title } from "@mantine/core";
import { ExclamationTriangle as ExclamationTriangleIcon, Inventory as CubeIcon, AttachMoney as CurrencyDollarIcon, ShoppingCart as ShoppingCartIcon } from "@mui/icons-material";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import SummaryCard from "../SummaryCard";
import StockPulseLottie from "../StockPulseLottie";
import { useDashboardSummary, useProducts, useStockTrend } from "../hooks";
import type { Product } from "../types";

export default function DashboardPageV2() {
  const summary = useDashboardSummary();
  const trend = useStockTrend(30);
  const products = useProducts({ page: 1, pageSize: 8, status: "low_stock" });

  if (summary.isLoading || trend.isLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader />
      </div>
    );
  }

  const data = trend.data ?? [];
  const lowStockRows: Product[] = products.data?.items ?? [];
  return (
    <Stack gap="md">
      <div className="flex items-center justify-between">
        <div>
          <Title order={2}>Main Dashboard</Title>
          <Text c="dimmed">Summary metrics, stock trends, and low inventory alerts.</Text>
        </div>
        <StockPulseLottie />
      </div>

      <Grid>
        <Grid.Col span={{ base: 12, md: 6, lg: 3 }}>
          <SummaryCard title="Total SKUs" value={String(summary.data?.totalSkus ?? 0)} detail="Active product catalog" icon={<CubeIcon width={18} />} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6, lg: 3 }}>
          <SummaryCard title="Inventory Value" value={`KES ${(summary.data?.inventoryValue ?? 0).toLocaleString()}`} detail="Current stock valuation" icon={<CurrencyDollarIcon width={18} />} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6, lg: 3 }}>
          <SummaryCard title="Low Stock" value={String(summary.data?.lowStockCount ?? 0)} detail="Needs replenishment" icon={<ExclamationTriangleIcon width={18} />} />
        </Grid.Col>
        <Grid.Col span={{ base: 12, md: 6, lg: 3 }}>
          <SummaryCard title="Open Orders" value={String(summary.data?.openOrders ?? 0)} detail="Inbound pending receipts" icon={<ShoppingCartIcon width={18} />} />
        </Grid.Col>
      </Grid>

      <Grid>
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Card radius="xl" className="glass-panel">
            <Title order={4}>Stock Flow (30 days)</Title>
            <Text c="dimmed" mb="sm">Inbound vs outbound movement with forecast projection.</Text>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data}>
                  <defs>
                    <linearGradient id="stockIn" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.7} />
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0.05} />
                    </linearGradient>
                    <linearGradient id="stockOut" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.6} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="in" stroke="#0ea5e9" fill="url(#stockIn)" />
                  <Area type="monotone" dataKey="out" stroke="#f43f5e" fill="url(#stockOut)" />
                  <Area type="monotone" dataKey="forecast" stroke="#22c55e" strokeDasharray="5 5" fillOpacity={0} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 4 }}>
          <Card radius="xl" className="glass-panel">
            <Title order={4}>Low Stock Alerts</Title>
            {lowStockRows.length === 0 ? (
              <Alert mt="sm" color="teal" title="All clear">No low stock items right now.</Alert>
            ) : (
              <Table mt="sm" withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>SKU</Table.Th>
                    <Table.Th>On Hand</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {lowStockRows.map((p) => (
                    <Table.Tr key={p.id}>
                      <Table.Td>{p.sku}</Table.Td>
                      <Table.Td>{p.onHand}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Card>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
