import { useEffect, useState } from "react";
import { Card, Tabs, Table, Tag, Button, Space, message, Statistic, Row, Col } from "antd";
import { ReloadOutlined, BarChartOutlined, ExperimentOutlined, UnorderedListOutlined, SwapOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { inventoryScienceApi, type PickWave, type ReturnAuthorization, type InventoryMovementCost, type DemandForecast } from "../api/inventoryScience";

export default function InventorySciencePage() {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("pick-waves");
  const [pickWaves, setPickWaves] = useState<PickWave[]>([]);
  const [returns, setReturns] = useState<ReturnAuthorization[]>([]);
  const [costLayers, setCostLayers] = useState<InventoryMovementCost[]>([]);
  const [forecasts, setForecasts] = useState<DemandForecast[]>([]);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case "pick-waves":
          const waves = await inventoryScienceApi.listPickWaves();
          setPickWaves(waves);
          break;
        case "returns":
          const rms = await inventoryScienceApi.listReturns();
          setReturns(rms);
          break;
        case "cost-layers":
          const layers = await inventoryScienceApi.listCostLayers();
          setCostLayers(layers);
          break;
        case "forecasts":
          const fcsts = await inventoryScienceApi.listForecasts();
          setForecasts(fcsts);
          break;
      }
    } catch (error) {
      message.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const pickWaveColumns: ColumnsType<PickWave> = [
    { title: "ID", dataIndex: "id", width: 60 },
    { title: "Wave Number", dataIndex: "wave_number" },
    { title: "Status", dataIndex: "status", render: (s) => <Tag color={s === "completed" ? "green" : "blue"}>{s}</Tag> },
    { title: "Request IDs", dataIndex: "request_ids", render: (ids) => ids?.join(", ") || "-" },
    { title: "Created", dataIndex: "created_at", render: (d) => new Date(d).toLocaleString() },
  ];

  const returnColumns: ColumnsType<ReturnAuthorization> = [
    { title: "ID", dataIndex: "id", width: 60 },
    { title: "RMA Number", dataIndex: "rma_number" },
    { title: "Part ID", dataIndex: "part_id" },
    { title: "Quantity", dataIndex: "quantity" },
    { title: "Reason", dataIndex: "reason", ellipsis: true },
    { title: "Status", dataIndex: "status", render: (s) => <Tag color={s === "completed" ? "green" : s === "pending" ? "orange" : "blue"}>{s}</Tag> },
    { title: "Created", dataIndex: "created_at", render: (d) => new Date(d).toLocaleDateString() },
  ];

  const costLayerColumns: ColumnsType<InventoryMovementCost> = [
    { title: "ID", dataIndex: "id", width: 60 },
    { title: "Part ID", dataIndex: "part_id" },
    { title: "Quantity", dataIndex: "quantity" },
    { title: "Unit Cost", dataIndex: "unit_cost", render: (v) => `$${v?.toFixed(2)}` },
    { title: "Total Cost", dataIndex: "total_cost", render: (v) => `$${v?.toFixed(2)}` },
    { title: "Method", dataIndex: "cost_method", render: (m) => <Tag>{m}</Tag> },
    { title: "Date", dataIndex: "layer_date", render: (d) => new Date(d).toLocaleDateString() },
  ];

  const forecastColumns: ColumnsType<DemandForecast> = [
    { title: "ID", dataIndex: "id", width: 60 },
    { title: "Part ID", dataIndex: "part_id" },
    { title: "Period", dataIndex: "forecast_period" },
    { title: "Predicted Qty", dataIndex: "predicted_quantity" },
    { title: "Confidence", dataIndex: "confidence_level", render: (v) => v ? `${(v * 100).toFixed(1)}%` : "-" },
    { title: "Created", dataIndex: "created_at", render: (d) => new Date(d).toLocaleDateString() },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Inventory Science</h1>
        <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
          Refresh
        </Button>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="Pick Waves" value={pickWaves.length} prefix={<BarChartOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="RMAs" value={returns.length} prefix={<SwapOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Cost Layers" value={costLayers.length} prefix={<ExperimentOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Forecasts" value={forecasts.length} prefix={<UnorderedListOutlined />} />
          </Card>
        </Col>
      </Row>

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: "pick-waves",
              label: "Pick Waves",
              children: (
                <Table
                  columns={pickWaveColumns}
                  dataSource={pickWaves}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                />
              ),
            },
            {
              key: "returns",
              label: "Returns (RMA)",
              children: (
                <Table
                  columns={returnColumns}
                  dataSource={returns}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                />
              ),
            },
            {
              key: "cost-layers",
              label: "Cost Layers (FIFO/LIFO)",
              children: (
                <Table
                  columns={costLayerColumns}
                  dataSource={costLayers}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                />
              ),
            },
            {
              key: "forecasts",
              label: "Demand Forecasts",
              children: (
                <Table
                  columns={forecastColumns}
                  dataSource={forecasts}
                  rowKey="id"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                />
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
