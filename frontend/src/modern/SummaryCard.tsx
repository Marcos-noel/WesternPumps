import React from "react";
import { Card, Group, Text, ThemeIcon } from "@mantine/core";
import { motion } from "framer-motion";

export default function SummaryCard(props: {
  title: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
}) {
  const { title, value, detail, icon } = props;
  return (
    <motion.div whileHover={{ y: -2 }} whileTap={{ scale: 0.995 }}>
      <Card radius="xl" shadow="sm" className="glass-panel">
        <Group justify="space-between" align="flex-start">
          <div>
            <Text c="dimmed" fz="xs" tt="uppercase">{title}</Text>
            <Text fz="xl" fw={700}>{value}</Text>
            <Text c="dimmed" fz="sm">{detail}</Text>
          </div>
          <ThemeIcon size="lg" variant="light" color="cyan">{icon}</ThemeIcon>
        </Group>
      </Card>
    </motion.div>
  );
}

