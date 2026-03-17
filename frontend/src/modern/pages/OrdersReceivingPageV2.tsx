import React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button, Card, Group, NumberInput, Select, Stack, Text, TextInput, Title } from "@mantine/core";
import { DateTimePicker } from "@mantine/dates";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { notifications } from "@mantine/notifications";
import { z } from "zod";
import { useProducts, useReceiveOrderMutation, useSuppliers } from "../hooks";
import type { Product, Supplier } from "../types";

const lineSchema = z.object({
  productId: z.coerce.number().int().positive(),
  quantity: z.coerce.number().int().positive(),
  unitCost: z.coerce.number().nonnegative()
});

const receivingSchema = z.object({
  supplierId: z.coerce.number().int().positive(),
  poNumber: z.string().min(2),
  receivedAt: z.date(),
  notes: z.string().optional(),
  lines: z.array(lineSchema).min(1)
});

type ReceivingForm = z.infer<typeof receivingSchema>;

export default function OrdersReceivingPageV2() {
  const suppliers = useSuppliers();
  const products = useProducts({ page: 1, pageSize: 1000 });
  const mutation = useReceiveOrderMutation();

  const form = useForm<ReceivingForm>({
    resolver: zodResolver(receivingSchema),
    defaultValues: {
      supplierId: 0,
      poNumber: "",
      receivedAt: new Date(),
      notes: "",
      lines: [{ productId: 0, quantity: 1, unitCost: 0 }]
    }
  });
  const lines = useFieldArray({ control: form.control, name: "lines" });

  const submit = form.handleSubmit(async (values: ReceivingForm) => {
    await mutation.mutateAsync({
      ...values,
      receivedAt: values.receivedAt.toISOString()
    });
    notifications.show({ title: "Receiving posted", message: "Order receiving stub was submitted successfully.", color: "teal" });
    form.reset();
  });

  return (
    <Stack gap="md">
      <div>
        <Title order={2}>Orders & Receiving</Title>
        <Text c="dimmed">Capture inbound stock receipts with validated forms and structured line items.</Text>
      </div>

      <Card radius="xl" className="glass-panel">
        <form onSubmit={submit}>
          <Stack gap="md">
            <Group grow align="flex-start">
              <Controller
                control={form.control}
                name="supplierId"
                render={({ field, fieldState }) => (
                  <Select
                    label="Supplier"
                    data={(suppliers.data ?? []).map((s: Supplier) => ({ value: String(s.id), label: s.name }))}
                    value={field.value ? String(field.value) : null}
                    onChange={(value: string | null) => field.onChange(Number(value || 0))}
                    error={fieldState.error?.message}
                  />
                )}
              />
              <Controller
                control={form.control}
                name="poNumber"
                render={({ field, fieldState }) => (
                  <TextInput label="PO Number" placeholder="PO-2026-0012" {...field} error={fieldState.error?.message} />
                )}
              />
            </Group>

            <Controller
              control={form.control}
              name="receivedAt"
              render={({ field, fieldState }) => (
                <DateTimePicker label="Received at" value={field.value} onChange={(v: Date | null) => field.onChange(v || new Date())} error={fieldState.error?.message} />
              )}
            />

            <Text fw={600}>Line items</Text>
            {lines.fields.map((line, index) => (
              <Group key={line.id} grow align="flex-end">
                <Controller
                  control={form.control}
                  name={`lines.${index}.productId`}
                  render={({ field, fieldState }) => (
                    <Select
                      label="Product"
                      searchable
                      data={(products.data?.items ?? []).map((p: Product) => ({ value: String(p.id), label: `${p.sku} - ${p.name}` }))}
                      value={field.value ? String(field.value) : null}
                      onChange={(value: string | null) => field.onChange(Number(value || 0))}
                      error={fieldState.error?.message}
                    />
                  )}
                />
                <Controller
                  control={form.control}
                  name={`lines.${index}.quantity`}
                  render={({ field, fieldState }) => (
                    <NumberInput label="Quantity" min={1} value={field.value} onChange={(v: string | number) => field.onChange(Number(v) || 1)} error={fieldState.error?.message} />
                  )}
                />
                <Controller
                  control={form.control}
                  name={`lines.${index}.unitCost`}
                  render={({ field, fieldState }) => (
                    <NumberInput label="Unit Cost" min={0} decimalScale={2} value={field.value} onChange={(v: string | number) => field.onChange(Number(v) || 0)} error={fieldState.error?.message} />
                  )}
                />
                <Button variant="light" color="red" onClick={() => lines.remove(index)}>Remove</Button>
              </Group>
            ))}

            <Group justify="space-between">
              <Button variant="light" onClick={() => lines.append({ productId: 0, quantity: 1, unitCost: 0 })}>Add line</Button>
              <Button type="submit" loading={mutation.isPending}>Submit receiving</Button>
            </Group>
          </Stack>
        </form>
      </Card>
    </Stack>
  );
}
