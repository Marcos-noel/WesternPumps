import React from "react";
import { Avatar, Badge, Card, Group, Loader, Stack, Table, Text, Title } from "@mantine/core";
import { useSuppliers } from "../hooks";
import type { Supplier } from "../types";

export default function SuppliersPageV2() {
  const { data, isLoading } = useSuppliers();
  const suppliers = data ?? [];

  return (
    <Stack gap="md">
      <div>
        <Title order={2}>Suppliers</Title>
        <Text c="dimmed">Manage vendor relationships, service levels, and lead times.</Text>
      </div>

      <Card radius="xl" className="glass-panel">
        <Table withTableBorder withColumnBorders striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Supplier</Table.Th>
              <Table.Th>Contact</Table.Th>
              <Table.Th>Email</Table.Th>
              <Table.Th>Phone</Table.Th>
              <Table.Th>Lead Time</Table.Th>
              <Table.Th>Status</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {isLoading ? (
              <Table.Tr>
                <Table.Td colSpan={6}><Group gap="xs"><Loader size="sm" /> Loading suppliers</Group></Table.Td>
              </Table.Tr>
            ) : suppliers.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={6}>No suppliers found.</Table.Td>
              </Table.Tr>
            ) : (
              suppliers.map((s: Supplier) => (
                <Table.Tr key={s.id}>
                  <Table.Td>
                    <Group gap="sm">
                      <Avatar radius="xl" color="cyan">{s.name.slice(0, 1).toUpperCase()}</Avatar>
                      <Text fw={600}>{s.name}</Text>
                    </Group>
                  </Table.Td>
                  <Table.Td>{s.contactName || "-"}</Table.Td>
                  <Table.Td>{s.email || "-"}</Table.Td>
                  <Table.Td>{s.phone || "-"}</Table.Td>
                  <Table.Td>{s.leadTimeDays ? `${s.leadTimeDays}d` : "-"}</Table.Td>
                  <Table.Td>
                    <Badge color={s.active ? "teal" : "gray"}>{s.active ? "Active" : "Inactive"}</Badge>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </Card>
    </Stack>
  );
}
