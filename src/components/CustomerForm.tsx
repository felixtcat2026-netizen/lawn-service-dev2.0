"use client";

import { useActionState } from "react";

export interface CustomerFormValues {
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string | null;
  address_line1?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  default_price_cents?: number;
  general_notes?: string | null;
  property_notes?: string | null;
  gate_code?: string | null;
  access_notes?: string | null;
}

type ActionFn = (
  prevState: { error: string | null },
  formData: FormData,
) => Promise<{ error: string | null }>;

export function CustomerForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: ActionFn;
  defaultValues?: CustomerFormValues;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, { error: null });
  const v = defaultValues ?? {};
  const defaultPrice =
    v.default_price_cents !== undefined ? (v.default_price_cents / 100).toFixed(2) : "";

  return (
    <form action={formAction} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="First name" name="first_name" defaultValue={v.first_name} required />
        <Field label="Last name" name="last_name" defaultValue={v.last_name} required />
      </div>
      <Field label="Phone" name="phone" defaultValue={v.phone} required />
      <Field label="Email (optional)" name="email" type="email" defaultValue={v.email ?? ""} />
      <Field label="Service address" name="address_line1" defaultValue={v.address_line1} required />
      <div className="grid grid-cols-3 gap-3">
        <Field label="City" name="city" defaultValue={v.city} required />
        <Field label="State" name="state" defaultValue={v.state} required />
        <Field label="Postal code" name="postal_code" defaultValue={v.postal_code} required />
      </div>
      <Field
        label="Default visit price"
        name="default_price"
        defaultValue={defaultPrice}
        placeholder="50.00"
        required
      />
      <TextArea label="General notes" name="general_notes" defaultValue={v.general_notes ?? ""} />
      <TextArea
        label="Property notes"
        name="property_notes"
        defaultValue={v.property_notes ?? ""}
      />
      <Field label="Gate code" name="gate_code" defaultValue={v.gate_code ?? ""} />
      <TextArea
        label="Pet / access notes"
        name="access_notes"
        defaultValue={v.access_notes ?? ""}
      />

      {state.error && (
        <p role="alert" className="text-sm text-(--color-danger)">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-(--color-primary) px-4 py-3 text-base font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Saving..." : submitLabel}
      </button>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  required,
  type = "text",
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        placeholder={placeholder}
        className="w-full rounded-lg border border-(--color-border) px-3 py-2 text-base"
      />
    </label>
  );
}

function TextArea({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue?: string;
}) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{label}</span>
      <textarea
        name={name}
        defaultValue={defaultValue}
        rows={2}
        className="w-full rounded-lg border border-(--color-border) px-3 py-2 text-base"
      />
    </label>
  );
}
