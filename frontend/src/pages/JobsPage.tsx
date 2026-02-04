import React, { useEffect, useMemo, useState } from "react";
import { Button, Card, Form, Input, Select, Table, Typography } from "antd";
import { listCustomers } from "../api/customers";
import { createJob, listJobs } from "../api/jobs";
import type { Customer, Job } from "../api/types";
import { getApiErrorMessage } from "../api/error";

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [customerId, setCustomerId] = useState<number | "">("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const [c, j] = await Promise.all([listCustomers(), listJobs()]);
      setCustomers(c);
      setJobs(j);
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to load jobs"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate() {
    setError(null);
    if (customerId === "") {
      setError("Select a customer");
      return;
    }
    try {
      await createJob({
        customer_id: customerId,
        title,
        description: description || null
      });
      setCustomerId("");
      setTitle("");
      setDescription("");
      await refresh();
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to create job"));
    }
  }

  const customerNameById = useMemo(() => new Map(customers.map((c) => [c.id, c.name])), [customers]);

  const columns = useMemo(
    () => [
      { title: "ID", dataIndex: "id", key: "id" },
      {
        title: "Customer",
        dataIndex: "customer_id",
        key: "customer_id",
        render: (value: number) => customerNameById.get(value) ?? value
      },
      { title: "Title", dataIndex: "title", key: "title" },
      { title: "Status", dataIndex: "status", key: "status" },
      { title: "Priority", dataIndex: "priority", key: "priority" }
    ],
    [customerNameById]
  );

  return (
    <div className="container">
      <Typography.Title level={2} style={{ marginTop: 0 }}>
        Jobs
      </Typography.Title>
      <div className="grid">
        <Card title="Create job">
          <Form layout="vertical" onFinish={handleCreate}>
            <Form.Item label="Customer" required>
              <Select<number>
                value={customerId === "" ? undefined : customerId}
                onChange={(value) => setCustomerId(value)}
                placeholder="Select..."
              >
                {customers.map((c) => (
                  <Select.Option key={c.id} value={c.id}>
                    {c.name}
                  </Select.Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item label="Title" required>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </Form.Item>
            <Form.Item label="Description">
              <Input.TextArea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} />
            </Form.Item>
            <Button type="primary" htmlType="submit">
              Create
            </Button>
          </Form>
          {error ? <Typography.Text type="danger">{error}</Typography.Text> : null}
        </Card>

        <Card
          title="Job list"
          extra={
            <Button onClick={refresh} disabled={loading}>
              Refresh
            </Button>
          }
        >
          <Table
            rowKey="id"
            loading={loading}
            dataSource={jobs}
            columns={columns}
            pagination={false}
            locale={{ emptyText: "No jobs yet." }}
          />
        </Card>
      </div>
    </div>
  );
}
