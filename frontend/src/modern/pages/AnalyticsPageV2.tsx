import React, { useState } from "react";
import { Card, Grid, SegmentedControl, Stack, Text, Title } from "@mantine/core";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useStockTrend } from "../hooks";

export default function AnalyticsPageV2() {
  const [days, setDays] = useState("30");
  const trend = useStockTrend(Number(days));
  const data = trend.data ?? [];

  return (
    <Stack gap="md">
      <div className="flex items-end justify-between">
        <div>
          <Title order={2}>Analytics & Forecasting</Title>
          <Text c="dimmed">Demand behavior, trend lines, and forecast overlays.</Text>
        </div>
        <SegmentedControl value={days} onChange={setDays} data={["14", "30", "90"]} />
      </div>

      <Grid>
        <Grid.Col span={{ base: 12, lg: 7 }}>
          <Card radius="xl" className="glass-panel">
            <Text fw={600} mb="xs">Consumption vs Replenishment</Text>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="out" fill="#f97316" />
                  <Bar dataKey="in" fill="#0ea5e9" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, lg: 5 }}>
          <Card radius="xl" className="glass-panel">
            <Text fw={600} mb="xs">Forecast projection</Text>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line dataKey="out" stroke="#f43f5e" strokeWidth={2} />
                  <Line dataKey="forecast" stroke="#22c55e" strokeDasharray="5 5" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}

