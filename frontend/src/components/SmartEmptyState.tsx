import React from "react";
import { Empty, Space, Typography } from "antd";

type Props = {
  title: string;
  description?: string;
  compact?: boolean;
};

export default function SmartEmptyState({ title, description, compact = false }: Props) {
  return (
    <div className={`smart-empty ${compact ? "smart-empty--compact" : ""}`}>
      <Space direction="vertical" align="center" size={4}>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
        <Typography.Text strong>{title}</Typography.Text>
        {description ? <Typography.Text type="secondary">{description}</Typography.Text> : null}
      </Space>
    </div>
  );
}

