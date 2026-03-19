import React, { useMemo, useRef, useState } from "react";
import { Badge, Button, Card, Checkbox, Group, Loader, MultiSelect, ScrollArea, Select, Stack, Text, TextInput, Title } from "@mantine/core";
import { Search as MagnifyingGlassIcon, AutoAwesome as SparklesIcon } from "@mui/icons-material";
import { ColumnDef, flexRender, getCoreRowModel, getSortedRowModel, SortingState, useReactTable } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { notifications } from "@mantine/notifications";
import { useProducts } from "../hooks";
import type { Product } from "../types";

export default function ProductsPageV2() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([{ id: "updatedAt", desc: true }]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const { data, isLoading } = useProducts({
    page: 1,
    pageSize: 1000,
    search: search || undefined,
    status: status || undefined,
    sortBy: sorting[0]?.id,
    sortDir: sorting[0]?.desc ? "desc" : "asc"
  });

  const rows = data?.items ?? [];
  const columns = useMemo<ColumnDef<Product>[]>(
    () => [
      {
        id: "select",
        header: "",
        cell: ({ row }) => (
          <Checkbox
            checked={selectedIds.has(row.original.id)}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setSelectedIds((prev) => {
                const next = new Set(prev);
                if (e.currentTarget.checked) next.add(row.original.id);
                else next.delete(row.original.id);
                return next;
              });
            }}
          />
        ),
        size: 36
      },
      { accessorKey: "sku", header: "SKU" },
      { accessorKey: "name", header: "Product" },
      { accessorKey: "supplierName", header: "Supplier" },
      { accessorKey: "onHand", header: "On Hand" },
      { accessorKey: "minLevel", header: "Min Level" },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => {
          const value = row.original.status;
          const color = value === "in_stock" ? "teal" : value === "low_stock" ? "yellow" : "red";
          return <Badge color={color}>{value.replace(/_/g, " ")}</Badge>;
        }
      }
    ],
    [selectedIds]
  );

  const table = useReactTable({
    data: rows,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  const containerRef = useRef<HTMLDivElement | null>(null);
  const virtualizer = useVirtualizer({
    count: table.getRowModel().rows.length,
    estimateSize: () => 46,
    getScrollElement: () => containerRef.current,
    overscan: 12
  });

  const vRows = virtualizer.getVirtualItems();
  const totalHeight = virtualizer.getTotalSize();
  const paddedTop = vRows.length > 0 ? vRows[0].start : 0;
  const paddedBottom = vRows.length > 0 ? totalHeight - vRows[vRows.length - 1].end : 0;

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-end">
        <div>
          <Title order={2}>Products</Title>
          <Text c="dimmed">Search, filter, sort, and run bulk actions on inventory products.</Text>
        </div>
        <Group>
          <Button
            variant="light"
            leftSection={<SparklesIcon width={16} />}
            disabled={selectedIds.size === 0}
            onClick={() =>
              notifications.show({ title: "Bulk action stub", message: `Apply action to ${selectedIds.size} selected item(s).`, color: "blue" })
            }
          >
            Bulk Action
          </Button>
        </Group>
      </Group>

      <Card radius="xl" className="glass-panel">
        <Group grow align="flex-end">
          <TextInput
            label="Search"
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.currentTarget.value)}
            placeholder="SKU, name, supplier"
            leftSection={<MagnifyingGlassIcon width={16} />}
          />
          <Select
            label="Status"
            value={status}
            onChange={setStatus}
            clearable
            data={[
              { value: "in_stock", label: "In stock" },
              { value: "low_stock", label: "Low stock" },
              { value: "out_of_stock", label: "Out of stock" }
            ]}
          />
          <MultiSelect
            label="Quick Filters"
            data={[
              { value: "high_value", label: "High value" },
              { value: "fast_moving", label: "Fast moving" },
              { value: "recently_updated", label: "Recently updated" }
            ]}
            placeholder="Filter presets"
          />
        </Group>
      </Card>

      <Card radius="xl" className="glass-panel">
        <Group justify="space-between" mb="xs">
          <Text fw={600}>Products Grid</Text>
          <Text c="dimmed" fz="sm">{rows.length} result(s)</Text>
        </Group>

        <ScrollArea h={620} viewportRef={containerRef}>
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10 bg-white/85 dark:bg-slate-900/90 backdrop-blur">
              {table.getHeaderGroups().map((group: any) => (
                <tr key={group.id}>
                  {group.headers.map((header: any) => (
                    <th
                      key={header.id}
                      className="cursor-pointer border-b border-slate-200 p-2 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700"
                      onClick={header.column.getToggleSortingHandler()}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td className="p-6 text-sm text-slate-500"><Group gap="xs"><Loader size="sm" /> Loading products</Group></td>
                </tr>
              ) : (
                <>
                  {paddedTop > 0 ? (
                    <tr>
                      <td colSpan={columns.length} style={{ height: `${paddedTop}px` }} />
                    </tr>
                  ) : null}
                  {vRows.map((vr: any) => {
                    const row = table.getRowModel().rows[vr.index];
                    return (
                      <tr key={row.id} className="transition-colors hover:bg-cyan-50/70 dark:hover:bg-slate-800/65">
                        {row.getVisibleCells().map((cell: any) => (
                          <td key={cell.id} className="border-b border-slate-200 p-2 text-sm dark:border-slate-800">
                            {flexRender(cell.column.columnDef.cell, cell.getContext())}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                  {paddedBottom > 0 ? (
                    <tr>
                      <td colSpan={columns.length} style={{ height: `${paddedBottom}px` }} />
                    </tr>
                  ) : null}
                </>
              )}
            </tbody>
          </table>
        </ScrollArea>
      </Card>
    </Stack>
  );
}
