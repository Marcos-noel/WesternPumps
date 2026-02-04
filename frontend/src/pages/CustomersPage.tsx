import React, { useEffect, useMemo, useState } from "react";
import { Button, Card, Form, Input, Table, Typography } from "antd";
import { createCustomer, listCustomers } from "../api/customers";
import type { Customer } from "../api/types";
import { getApiErrorMessage } from "../api/error";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setCustomers(await listCustomers());
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to load customers"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate() {
    setError(null);
    try {
      await createCustomer({
        name,
        contact_name: contactName || null,
        phone: phone || null,
        email: email || null
      });
      setName("");
      setContactName("");
      setPhone("");
      setEmail("");
      await refresh();
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to create customer"));
    }
  }

  const columns = useMemo(
    () => [
      { title: "Name", dataIndex: "name", key: "name" },
      { title: "Contact", dataIndex: "contact_name", key: "contact_name" },
      { title: "Phone", dataIndex: "phone", key: "phone" },
      { title: "Email", dataIndex: "email", key: "email" }
    ],
    []
  );

  return (
    <div className="container">
      <Typography.Title level={2} style={{ marginTop: 0 }}>
        Customers
      </Typography.Title>
      <div className="grid">
        <Card title="Add customer">
          <Form layout="vertical" onFinish={handleCreate}>
            <Form.Item label="Name" required>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Form.Item>
            <Form.Item label="Contact">
              <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
            </Form.Item>
            <Form.Item label="Phone">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Form.Item>
            <Form.Item label="Email">
              <Input value={email} onChange={(e) => setEmail(e.target.value)} />
            </Form.Item>
            <Button type="primary" htmlType="submit">
              Create
            </Button>
          </Form>
          {error ? <Typography.Text type="danger">{error}</Typography.Text> : null}
        </Card>

        <Card
          title="Customer list"
          extra={
            <Button onClick={refresh} disabled={loading}>
              Refresh
            </Button>
          }
        >
          <Table
            rowKey="id"
            loading={loading}
            dataSource={customers}
            columns={columns}
            pagination={false}
            locale={{ emptyText: "No customers yet." }}
          />
        </Card>
      </div>
    </div>
  );
}
