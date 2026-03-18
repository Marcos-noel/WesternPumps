import React, { useEffect, useState } from "react";
import { Card, Table, DatePicker, Space, Typography, Row, Col, Statistic, Tag, Button } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import { getStockUsageReport, getFrequentlyUsedItems, getStockUsageByTechnician, type StockUsage, type FrequentlyUsedItem, type StockUsageByTechnician } from "../api/reportsV2";
import { useAuth } from "../state/AuthContext";

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

export default function StoreManagerReportsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [stockUsage, setStockUsage] = useState<StockUsage[]>([]);
  const [frequentItems, setFrequentItems] = useState<FrequentlyUsedItem[]>([]);
  const [usageByTech, setUsageByTech] = useState<StockUsageByTechnician[]>([]);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Initialize dates on mount
  useEffect(() => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    setEndDate(now.toISOString().split("T")[0]);
    setStartDate(thirtyDaysAgo.toISOString().split("T")[0]);
  }, []);

  const canView = user?.role === "store_manager" || user?.role === "manager" || user?.role === "admin" || user?.role === "finance";

  useEffect(() => {
    if (canView && startDate && endDate) {
      loadReports();
    }
  }, [canView, startDate, endDate]);

  async function loadReports() {
    setLoading(true);
    try {
      const [usage, frequent, byTech] = await Promise.all([
        getStockUsageReport(startDate, endDate, 50),
        getFrequentlyUsedItems(startDate, endDate, 20),
        getStockUsageByTechnician(startDate, endDate),
      ]);

      setStockUsage(usage);
      setFrequentItems(frequent);
      setUsageByTech(byTech);
    } catch (err) {
      console.error("Failed to load reports:", err);
    } finally {
      setLoading(false);
    }
  }

  function handleDateChange(dates: any, dateStrings: [string, string]) {
    if (dates) {
      setStartDate(dateStrings[0]);
      setEndDate(dateStrings[1]);
    }
  }

  if (!canView) {
    return (
      <Card>
        <Typography.Text type="danger">Access denied. Store Manager role required.</Typography.Text>
      </Card>
    );
  }

  const stockUsageColumns = [
    { title: "SKU", dataIndex: "sku", key: "sku" },
    { title: "Part Name", dataIndex: "part_name", key: "part_name" },
    { title: "Category", dataIndex: "category", key: "category" },
    { title: "Total Used", dataIndex: "total_used", key: "total_used", render: (v: number) => v.toLocaleString() },
    { title: "Total Value", dataIndex: "total_value", key: "total_value", render: (v: number) => `$${v.toFixed(2)}` },
    { title: "Usage Count", dataIndex: "usage_count", key: "usage_count" },
  ];

  const frequentColumns = [
    { title: "SKU", dataIndex: "sku", key: "sku" },
    { title: "Part Name", dataIndex: "part_name", key: "part_name" },
    { title: "Category", dataIndex: "category", key: "category" },
    { title: "Usage Count", dataIndex: "usage_count", key: "usage_count" },
    { title: "Total Qty", dataIndex: "total_quantity", key: "total_quantity" },
    { title: "Avg/Use", dataIndex: "average_per_use", key: "average_per_use", render: (v: number) => v.toFixed(2) },
  ];

  const techColumns = [
    { title: "Technician", dataIndex: "technician_name", key: "technician_name" },
    { title: "Transactions", dataIndex: "total_transactions", key: "total_transactions" },
    { title: "Parts Used", dataIndex: "total_parts_used", key: "total_parts_used" },
    { title: "Total Value", dataIndex: "total_value", key: "total_value", render: (v: number) => `$${v.toFixed(2)}` },
  ];

  return (
    <div style={{ padding: 24 }}>
      <Space style={{ marginBottom: 16, justifyContent: "space-between", width: "100%" }}>
        <Title level={3}>Store Manager Reports</Title>
        <Space>
          <Text>Date Range:</Text>
          <RangePicker onChange={handleDateChange} />
          <Button icon={<DownloadOutlined />}>Export</Button>
        </Space>
      </Space>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Stock Items Used"
              value={stockUsage.length}
              loading={loading}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Total Usage Value"
              value={stockUsage.reduce((sum, i) => sum + i.total_value, 0)}
              prefix="$"
              precision={2}
              loading={loading}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Technicians Active"
              value={usageByTech.length}
              loading={loading}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Top Item Used"
              value={frequentItems[0]?.part_name || "N/A"}
              loading={loading}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={24}>
          <Card title="Stock Usage Report" style={{ marginBottom: 16 }}>
            <Table
              dataSource={stockUsage}
              columns={stockUsageColumns}
              rowKey="part_id"
              loading={loading}
              pagination={{ pageSize: 10 }}
              size="small"
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Card title="Most Frequently Used Items" style={{ marginBottom: 16 }}>
            <Table
              dataSource={frequentItems}
              columns={frequentColumns}
              rowKey="part_id"
              loading={loading}
              pagination={{ pageSize: 10 }}
              size="small"
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Usage by Technician" style={{ marginBottom: 16 }}>
            <Table
              dataSource={usageByTech}
              columns={techColumns}
              rowKey="technician_id"
              loading={loading}
              pagination={{ pageSize: 10 }}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
