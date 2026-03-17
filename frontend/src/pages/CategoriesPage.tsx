import React, { useEffect, useMemo, useState } from "react";
import { Button, Card, Form, Input, Select, Space, Table, Tag, Typography } from "antd";
import { createCategory, listCategories, updateCategory } from "../api/categories";
import type { Category } from "../api/types";
import { getApiErrorMessage } from "../api/error";
import { formatDateTime } from "../utils/datetime";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<number | "">("");
  const [showForm, setShowForm] = useState(false);

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

  function resetForm() {
    setEditing(null);
    setName("");
    setParentId("");
    setError(null);
    setShowForm(false);
  }

  function startEdit(category: Category) {
    setShowForm(true);
    setEditing(category);
    setName(category.name);
    setParentId(category.parent_id ?? "");
    setError(null);
  }

  async function handleSave() {
    setError(null);
    if (!name.trim()) {
      setError("Category name is required");
      return;
    }
    try {
      const payload = { name: name.trim(), parent_id: parentId === "" ? null : Number(parentId) };
      if (editing) {
        await updateCategory(editing.id, payload);
      } else {
        await createCategory(payload);
      }
      resetForm();
      await refresh();
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Failed to save category"));
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
        title: "Created",
        dataIndex: "created_at",
        key: "created_at",
        render: (value: string) => formatDateTime(value)
      },
      {
        title: "Updated",
        dataIndex: "updated_at",
        key: "updated_at",
        render: (value: string) => formatDateTime(value)
      },
      {
        title: "Actions",
        key: "actions",
        render: (_: unknown, category: Category) => (
          <Space>
            <Button onClick={() => startEdit(category)}>Edit</Button>
            <Button onClick={() => toggleActive(category)}>{category.is_active ? "Deactivate" : "Activate"}</Button>
          </Space>
        )
      }
    ],
    [categoryNameById]
  );

  return (
    <div className="container page-shell">
      <Typography.Title level={2} style={{ marginTop: 0 }}>
        Categories
      </Typography.Title>
      <Space>
        <Button
          onClick={() => {
            if (showForm && !editing) {
              resetForm();
              return;
            }
            setShowForm((prev) => !prev);
          }}
        >
          {showForm ? (editing ? "Editing Category" : "Hide Add Category") : "Add New Category"}
        </Button>
      </Space>
      <div className="grid">
        {showForm ? (
        <Card title={editing ? "Edit category" : "Add category"}>
          <Form layout="vertical" onFinish={handleSave}>
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
                  .filter((c) => c.is_active && c.id !== editing?.id)
                  .map((c) => (
                    <Select.Option key={c.id} value={c.id}>
                      {c.name}
                    </Select.Option>
                  ))}
              </Select>
            </Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editing ? "Save changes" : "Create"}
              </Button>
              <Button onClick={resetForm}>Cancel</Button>
            </Space>
          </Form>
          {error ? <Typography.Text type="danger">{error}</Typography.Text> : null}
        </Card>
        ) : null}

        <Card
          title="Category list"
          extra={
            <Button onClick={refresh} disabled={loading}>
              Refresh
            </Button>
          }
          style={{ gridColumn: "1 / -1" }}
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
