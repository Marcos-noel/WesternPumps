import { useEffect, useState } from "react";
import { Card, Tabs, Table, Button, Space, DatePicker, Row, Col, Statistic, Tag, App } from "antd";
import { ReloadOutlined, DollarOutlined, TeamOutlined, InboxOutlined, DownloadOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { reportsV2Api, type ProfitabilitySummary, type JobProfitability, type ProductivitySummary, type ProductivityMetrics, type ValuationSummary, type InventoryValuation } from "../api/reportsV2";
import { formatKes } from "../utils/currency";

const { RangePicker } = DatePicker;

export default function ReportsV2Page() {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("profitability");
  const [dateRange, setDateRange] = useState<[string, string] | null>(null);
  const [profitability, setProfitability] = useState<ProfitabilitySummary | null>(null);
  const [profitabilityDetails, setProfitabilityDetails] = useState<JobProfitability[]>([]);
  const [productivity, setProductivity] = useState<ProductivitySummary | null>(null);
  const [productivityDetails, setProductivityDetails] = useState<ProductivityMetrics[]>([]);
  const [valuation, setValuation] = useState<ValuationSummary | null>(null);
  const [valuationDetails, setValuationDetails] = useState<InventoryValuation[]>([]);

  useEffect(() => {
    loadData();
  }, [activeTab, dateRange]);

  const loadData = async () => {
    setLoading(true);
    const filters = {
      start_date: dateRange?.[0],
      end_date: dateRange?.[1],
    };

    try {
      switch (activeTab) {
        case "profitability":
          const prof = await reportsV2Api.getProfitability(filters);
          setProfitability(prof);
          const profDetails = await reportsV2Api.getProfitabilityDetails(filters);
          setProfitabilityDetails(profDetails);
          break;
        case "productivity":
          const prod = await reportsV2Api.getProductivity(filters);
          setProductivity(prod);
          const prodDetails = await reportsV2Api.getProductivityDetails(filters);
          setProductivityDetails(prodDetails);
          break;
        case "valuation":
          const val = await reportsV2Api.getValuation(filters);
          setValuation(val);
          const valDetails = await reportsV2Api.getValuationDetails(filters);
          setValuationDetails(valDetails);
          break;
      }
    } catch (error) {
      message.error("Failed to load report data");
    } finally {
      setLoading(false);
    }
  };

  const handleDateChange = (dates: any) => {
    if (dates) {
      setDateRange([dates[0].format("YYYY-MM-DD"), dates[1].format("YYYY-MM-DD")]);
    } else {
      setDateRange(null);
    }
  };

  const profitabilityColumns: ColumnsType<JobProfitability> = [
    { title: "Job ID", dataIndex: "job_id", width: 80 },
    { title: "Job Title", dataIndex: "job_title", ellipsis: true },
    { title: "Customer", dataIndex: "customer_name" },
    { title: "Status", dataIndex: "status", render: (s) => <Tag>{s}</Tag> },
    { title: "Labor", dataIndex: "labor_cost", render: (v) => formatKes(v) },
    { title: "Parts", dataIndex: "parts_cost", render: (v) => formatKes(v) },
    { title: "Travel", dataIndex: "travel_cost", render: (v) => formatKes(v) },
    { title: "Total Cost", dataIndex: "total_cost", render: (v) => formatKes(v) },
    { title: "Revenue", dataIndex: "revenue", render: (v) => formatKes(v) },
    { title: "Profit", dataIndex: "profit", render: (v, record) => <span style={{ color: v >= 0 ? "#52c41a" : "#ff4d4f" }}>{formatKes(v)}</span> },
    { title: "Margin", dataIndex: "profit_margin", render: (v) => `${v?.toFixed(1)}%` },
  ];

  const productivityColumns: ColumnsType<ProductivityMetrics> = [
    { title: "Tech ID", dataIndex: "technician_id", width: 80 },
    { title: "Name", dataIndex: "technician_name" },
    { title: "Completed", dataIndex: "jobs_completed" },
    { title: "In Progress", dataIndex: "jobs_in_progress" },
    { title: "Labor Hours", dataIndex: "total_labor_hours", render: (v) => v?.toFixed(1) },
    { title: "Avg Duration", dataIndex: "average_job_duration", render: (v) => `${v?.toFixed(1)}h` },
    { title: "Parts Installed", dataIndex: "parts_installed" },
    { title: "Revenue", dataIndex: "revenue_generated", render: (v) => formatKes(v) },
  ];

  const valuationColumns: ColumnsType<InventoryValuation> = [
    { title: "Part ID", dataIndex: "part_id", width: 80 },
    { title: "Name", dataIndex: "part_name", ellipsis: true },
    { title: "SKU", dataIndex: "sku" },
    { title: "Qty", dataIndex: "quantity_on_hand" },
    { title: "Unit Cost", dataIndex: "unit_cost", render: (v) => formatKes(v) },
    { title: "Total Value", dataIndex: "total_value", render: (v) => formatKes(v) },
    { title: "Category", dataIndex: "category" },
    { title: "Location", dataIndex: "location" },
  ];

  return (
    <div className="container page-shell">
      <Row gutter={[12, 12]} align="middle" justify="space-between" style={{ marginBottom: 16 }}>
        <Col xs={24} md={10}>
          <h1 style={{ margin: 0 }}>Advanced Reports</h1>
        </Col>
        <Col xs={24} md={14} style={{ display: "flex", justifyContent: "flex-end" }}>
          <Space wrap>
            <RangePicker onChange={handleDateChange} />
            <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>
              Refresh
            </Button>
          </Space>
        </Col>
      </Row>

      {activeTab === "profitability" && profitability && (
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic title="Total Revenue" value={profitability.total_revenue} prefix={<>KSh </>} suffix={""} precision={2} />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic title="Total Costs" value={profitability.total_costs} prefix={<>KSh </>} suffix={""} precision={2} />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic title="Total Profit" value={profitability.total_profit} prefix={<>KSh </>} suffix={""} precision={2} valueStyle={{ color: profitability.total_profit >= 0 ? "#52c41a" : "#ff4d4f" }} />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic title="Avg Margin" value={profitability.average_margin} suffix="%" precision={1} />
            </Card>
          </Col>
        </Row>
      )}

      {activeTab === "productivity" && productivity && (
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={24} md={8}>
            <Card>
              <Statistic title="Total Jobs Completed" value={productivity.total_jobs_completed} />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card>
              <Statistic title="Total Labor Hours" value={productivity.total_labor_hours} precision={1} />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card>
              <Statistic title="Avg Job Duration" value={productivity.average_job_duration} suffix="h" precision={1} />
            </Card>
          </Col>
        </Row>
      )}

      {activeTab === "valuation" && valuation && (
        <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
          <Col xs={24} md={8}>
            <Card>
              <Statistic title="Total Inventory Value" value={valuation.total_inventory_value} prefix={<>KSh </>} suffix={""} precision={2} />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card>
              <Statistic title="Total Parts" value={valuation.total_parts} />
            </Card>
          </Col>
          <Col xs={24} md={8}>
            <Card>
              <Statistic title="Total Quantity" value={valuation.total_quantity} />
            </Card>
          </Col>
        </Row>
      )}

      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: "profitability",
              label: <span><DollarOutlined /> Profitability</span>,
              children: (
                <Table
                  columns={profitabilityColumns}
                  dataSource={profitabilityDetails}
                  rowKey="job_id"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: 1200 }}
                />
              ),
            },
            {
              key: "productivity",
              label: <span><TeamOutlined /> Productivity</span>,
              children: (
                <Table
                  columns={productivityColumns}
                  dataSource={productivityDetails}
                  rowKey="technician_id"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: 1000 }}
                />
              ),
            },
            {
              key: "valuation",
              label: <span><InboxOutlined /> Valuation</span>,
              children: (
                <Table
                  columns={valuationColumns}
                  dataSource={valuationDetails}
                  rowKey="part_id"
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: 1000 }}
                />
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}
