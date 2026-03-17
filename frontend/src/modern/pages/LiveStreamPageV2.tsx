import React from "react";
import { Badge, Card, Group, Stack, Text, Title } from "@mantine/core";
import { motion } from "framer-motion";
import { useRealtimeFeed } from "../RealtimeProvider";

export default function LiveStreamPageV2() {
  const { events, connected } = useRealtimeFeed();
  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={2}>Real-time Stock Stream</Title>
          <Text c="dimmed">Live operational feed from warehouse and receiving events.</Text>
        </div>
        <Badge color={connected ? "teal" : "gray"} size="lg">
          {connected ? "Connected" : "Disconnected"}
        </Badge>
      </Group>

      <Card radius="xl" className="glass-panel">
        <Stack gap="sm">
          {events.length === 0 ? (
            <Text c="dimmed">No events yet. Waiting for stream data...</Text>
          ) : (
            events.map((evt) => (
              <motion.div
                key={evt.id}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                className="rounded-xl border border-slate-200/70 bg-white/60 p-3 dark:border-slate-700 dark:bg-slate-900/45"
              >
                <Group justify="space-between">
                  <Text fw={600}>{evt.message}</Text>
                  <Text fz="xs" c="dimmed">{new Date(evt.createdAt).toLocaleTimeString()}</Text>
                </Group>
                <Group mt={6} gap="xs">
                  <Badge variant="light">{evt.type}</Badge>
                  {evt.sku ? <Badge color="cyan" variant="light">{evt.sku}</Badge> : null}
                  {typeof evt.delta === "number" ? <Badge color={evt.delta >= 0 ? "teal" : "red"}>{evt.delta >= 0 ? `+${evt.delta}` : evt.delta}</Badge> : null}
                </Group>
              </motion.div>
            ))
          )}
        </Stack>
      </Card>
    </Stack>
  );
}

