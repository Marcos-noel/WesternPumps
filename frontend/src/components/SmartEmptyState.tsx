import React from "react";
import { Empty, Space, Typography } from "antd";
import { motion } from "framer-motion";
import { fadeInVariants } from "../utils/motion";

type Props = {
  title: string;
  description?: string;
  compact?: boolean;
};

export default function SmartEmptyState({ title, description, compact = false }: Props) {
  return (
    <motion.div
      className={`smart-empty ${compact ? "smart-empty--compact" : ""}`}
      initial="initial"
      animate="animate"
      variants={fadeInVariants}
    >
      <Space direction="vertical" align="center" size={4}>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} />
        <Typography.Text strong>{title}</Typography.Text>
        {description ? <Typography.Text type="secondary">{description}</Typography.Text> : null}
      </Space>
    </motion.div>
  );
}

