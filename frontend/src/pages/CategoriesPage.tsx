import React, { useEffect, useMemo, useState } from "react";
import { Button, Card, Form, Input, Select, Table, Tag, Typography } from "antd";
import { createCategory, listCategories, updateCategory } from "../api/categories";
import type { Category } from "../api/types";
import { getApiErrorMessage } from "../api/error";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<number | "">("");

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setCategories(await listCategories({ include_inactive: true }));
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to load categories"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleCreate() {
    setError(null);
    if (!name.trim()) {
      setError("Category name is required");
      return;
    }
    try {
      await createCategory({ name: name.trim(), parent_id: parentId === "" ? null : Number(parentId) });
      setName("");
      setParentId("");
      await refresh();
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to create category"));
    }
  }

  async function toggleActive(category: Category) {
    try {
      await updateCategory(category.id, { is_active: !category.is_active });
      await refresh();
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to update category"));
    }
  }

  const categoryNameById = useMemo(() => new Map(categories.map((c) => [c.id, c.name])), [categories]);

  const columns = useMemo(
    () => [
      { title: "Name", dataIndex: "name", key: "name" },
      {
        title: "Parent",
        dataIndex: "parent_id",
        key: "parent_id",
        render: (value: number | null) => (value ? categoryNameById.get(value) ?? value : "")
      },
      {
        title: "Status",
        dataIndex: "is_active",
        key: "is_active",
        render: (value: boolean) => (value ? <Tag color="green">Active</Tag> : <Tag color="red">Inactive</Tag>)
      },
      {
        title: "Actions",
        key: "actions",
        render: (_: unknown, category: Category) => (
          <Button onClick={() => toggleActive(category)}>{category.is_active ? "Deactivate" : "Activate"}</Button>
        )
      }
    ],
    [categoryNameById]
  );

  return (
    <div className="container">
      <Typography.Title level={2} style={{ marginTop: 0 }}>
        Categories
      </Typography.Title>
      <div className="grid">
        <Card title="Add category">
          <Form layout="vertical" onFinish={handleCreate}>
            <Form.Item label="Name" required>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Form.Item>
            <Form.Item label="Parent (optional)">
              <Select<number>
                value={parentId === "" ? undefined : parentId}
                onChange={(value) => setParentId(value)}
                placeholder="None"
                allowClear
              >
                {categories
                  .filter((c) => c.is_active)
                  .map((c) => (
                    <Select.Option key={c.id} value={c.id}>
                      {c.name}
                    </Select.Option>
                  ))}
              </Select>
            </Form.Item>
            <Button type="primary" htmlType="submit">
              Create
            </Button>
          </Form>
          {error ? <Typography.Text type="danger">{error}</Typography.Text> : null}
        </Card>

        <Card
          title="Category list"
          extra={
            <Button onClick={refresh} disabled={loading}>
              Refresh
            </Button>
          }
        >
          <Table
            rowKey="id"
            loading={loading}
            dataSource={categories}
            columns={columns}
            pagination={false}
            locale={{ emptyText: "No categories yet." }}
          />
        </Card>
      </div>
    </div>
  );
}
