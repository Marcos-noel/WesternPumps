import { useEffect, useState } from "react";
import { Card, Table, Tag, Button, Space, DatePicker, Select, Modal, Descriptions, message } from "antd";
import { ReloadOutlined, SecurityScanOutlined, EyeOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { auditApi, type AuditLogResponse, type HashVerificationResponse, type AuditFilters } from "../api/audit";

const { RangePicker } = DatePicker;

export default function AuditPage() {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<AuditLogResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [filters, setFilters] = useState<AuditFilters>({});
  const [actions, setActions] = useState<string[]>([]);
  const [entityTypes, setEntityTypes] = useState<string[]>([]);
  const [hashVerification, setHashVerification] = useState<HashVerificationResponse | null>(null);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLogResponse | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  useEffect(() => {
    loadAuditLogs();
    loadFilterOptions();
  }, [page, pageSize, filters]);

  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      const response = await auditApi.list({ ...filters, page, page_size: pageSize });
      setLogs(response.items);
      setTotal(response.total);
    } catch (error) {
      message.error("Failed to load audit logs");
    } finally {
      setLoading(false);
    }
  };

  const loadFilterOptions = async () => {
    try {
      const [actionsRes, typesRes] = await Promise.all([
        auditApi.getActions(),
        auditApi.getEntityTypes(),
      ]);
      setActions(actionsRes);
      setEntityTypes(typesRes);
    } catch (error) {
      console.error("Failed to load filter options", error);
    }
  };

  const handleVerifyHash = async () => {
    setVerifyLoading(true);
    try {
      const result = await auditApi.verifyHash();
      setHashVerification(result);
      if (result.is_valid) {
        message.success("Audit log integrity verified successfully");
      } else {
        message.error("Audit log integrity check failed!");
      }
    } catch (error) {
      message.error("Failed to verify hash");
    } finally {
      setVerifyLoading(false);
    }
  };

  const handleFilterChange = (key: keyof AuditFilters, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const handleDateRangeChange = (dates: any) => {
    if (dates) {
      setFilters((prev) => ({
        ...prev,
        start_date: dates[0].toISOString(),
        end_date: dates[1].toISOString(),
      }));
    } else {
      setFilters((prev) => ({ ...prev, start_date: undefined, end_date: undefined }));
    }
    setPage(1);
  };

  const viewLogDetails = (log: AuditLogResponse) => {
    setSelectedLog(log);
    setDetailModalVisible(true);
  };

  const columns: ColumnsType<AuditLogResponse> = [
    {
      title: "ID",
      dataIndex: "id",
      width: 70,
    },
    {
      title: "Timestamp",
      dataIndex: "created_at",
      width: 180,
      render: (text) => new Date(text).toLocaleString(),
    },
    {
      title: "Action",
      dataIndex: "action",
      width: 150,
      render: (text) => <Tag color="blue">{text}</Tag>,
    },
    {
      title: "Entity Type",
      dataIndex: "entity_type",
      width: 150,
    },
    {
      title: "Entity ID",
      dataIndex: "entity_id",
      width: 100,
    },
    {
      title: "User ID",
      dataIndex: "user_id",
      width: 80,
      render: (id) => id || "-",
    },
    {
      title: "Detail",
      dataIndex: "detail",
      ellipsis: true,
      render: (text) => text || "-",
    },
    {
      title: "Actions",
      key: "actions",
      width: 100,
      render: (_, record) => (
        <Button
          type="text"
          icon={<EyeOutlined />}
          onClick={() => viewLogDetails(record)}
        />
      ),
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <h1>Audit Log</h1>
        <Space>
          <Button
            icon={<SecurityScanOutlined />}
            onClick={handleVerifyHash}
            loading={verifyLoading}
          >
            Verify Hash Chain
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={loadAuditLogs}
            loading={loading}
          >
            Refresh
          </Button>
        </Space>
      </div>

      {hashVerification && (
        <Card size="small" style={{ marginBottom: 16 }}>
          <Descriptions column={4} size="small">
            <Descriptions.Item label="Valid">{hashVerification.is_valid ? "✓ Yes" : "✗ No"}</Descriptions.Item>
            <Descriptions.Item label="Verified">{hashVerification.verified_entries} / {hashVerification.total_entries}</Descriptions.Item>
            <Descriptions.Item label="Details" span={2}>{hashVerification.details}</Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            placeholder="Action"
            allowClear
            style={{ width: 150 }}
            value={filters.action}
            onChange={(value) => handleFilterChange("action", value)}
            options={actions.map((a) => ({ value: a, label: a }))}
          />
          <Select
            placeholder="Entity Type"
            allowClear
            style={{ width: 150 }}
            value={filters.entity_type}
            onChange={(value) => handleFilterChange("entity_type", value)}
            options={entityTypes.map((t) => ({ value: t, label: t }))}
          />
          <RangePicker onChange={handleDateRangeChange} />
        </Space>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={logs}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (total) => `Total ${total} entries`,
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
            },
          }}
          scroll={{ x: 1000 }}
        />
      </Card>

      <Modal
        title="Audit Log Details"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={600}
      >
        {selectedLog && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="ID">{selectedLog.id}</Descriptions.Item>
            <Descriptions.Item label="Timestamp">{new Date(selectedLog.created_at).toLocaleString()}</Descriptions.Item>
            <Descriptions.Item label="User ID">{selectedLog.user_id || "-"}</Descriptions.Item>
            <Descriptions.Item label="Action">{selectedLog.action}</Descriptions.Item>
            <Descriptions.Item label="Entity Type">{selectedLog.entity_type}</Descriptions.Item>
            <Descriptions.Item label="Entity ID">{selectedLog.entity_id || "-"}</Descriptions.Item>
            <Descriptions.Item label="Detail">{selectedLog.detail || "-"}</Descriptions.Item>
            <Descriptions.Item label="Previous Hash">{selectedLog.prev_hash || "-"}</Descriptions.Item>
            <Descriptions.Item label="Entry Hash">{selectedLog.entry_hash || "-"}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}
