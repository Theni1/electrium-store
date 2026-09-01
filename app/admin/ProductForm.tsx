"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { createProduct } from "@/app/action/products";

const EMPTY = {
  name: "",
  description: "",
  amount_stocked: "0",
  rental_rate: "0",
  sell_price: "0",
  damage_rate: "0",
  for_rent: true,
};

export default function ProductForm() {
  const router = useRouter();
  const [fields, setFields] = useState(EMPTY);
  const [file, setFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function uploadImage(): Promise<string | null> {
    if (!file) return "";

    const supabase = createClient();
    const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(path, file);

    if (uploadError) {
      setError(`Image upload failed: ${uploadError.message}`);
      return null;
    }

    return supabase.storage.from("product-images").getPublicUrl(path).data.publicUrl;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);
    setError(null);

    const image = await uploadImage();
    if (image === null) {
      setIsSaving(false);
      return;
    }

    const result = await createProduct({ ...fields, image });
    setIsSaving(false);

    if (!result.success) {
      setError(
        result.error ??
          Object.values(result.errors ?? {})
            .flat()
            .join(" ")
      );
      return;
    }

    setMessage(`Created "${fields.name}" (bike_id ${result.bikeId}).`);
    setFields(EMPTY);
    setFile(null);
    (e.target as HTMLFormElement).reset();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-lg">
      <div>
        <label className="block text-sm mb-1 text-[hsl(var(--text-secondary))]">
          Name
        </label>
        <input
          required
          className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--text-primary))] p-2"
          value={fields.name}
          onChange={(e) => setFields({ ...fields, name: e.target.value })}
        />
      </div>

      <div>
        <label className="block text-sm mb-1 text-[hsl(var(--text-secondary))]">
          Description
        </label>
        <textarea
          rows={3}
          className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--text-primary))] p-2"
          value={fields.description}
          onChange={(e) => setFields({ ...fields, description: e.target.value })}
        />
      </div>

      <div>
        <label className="block text-sm mb-1 text-[hsl(var(--text-secondary))]">
          Image
        </label>
        <input
          type="file"
          accept="image/*"
          className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--text-primary))] p-2"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm mb-1 text-[hsl(var(--text-secondary))]">
            Stock
          </label>
          <input
            type="number"
            min="0"
            step="1"
            className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--text-primary))] p-2"
            value={fields.amount_stocked}
            onChange={(e) => setFields({ ...fields, amount_stocked: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm mb-1 text-[hsl(var(--text-secondary))]">
            Sell price
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--text-primary))] p-2"
            value={fields.sell_price}
            onChange={(e) => setFields({ ...fields, sell_price: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm mb-1 text-[hsl(var(--text-secondary))]">
            Rental rate
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--text-primary))] p-2"
            value={fields.rental_rate}
            onChange={(e) => setFields({ ...fields, rental_rate: e.target.value })}
          />
        </div>
        <div>
          <label className="block text-sm mb-1 text-[hsl(var(--text-secondary))]">
            Damage rate
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            className="w-full rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--text-primary))] p-2"
            value={fields.damage_rate}
            onChange={(e) => setFields({ ...fields, damage_rate: e.target.value })}
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-[hsl(var(--text-secondary))]">
        <input
          type="checkbox"
          checked={fields.for_rent}
          onChange={(e) => setFields({ ...fields, for_rent: e.target.checked })}
        />
        Default to rental (shows &quot;Rent Now&quot; instead of &quot;Add to Cart&quot;)
      </label>

      <button
        type="submit"
        disabled={isSaving}
        className="bg-[hsl(var(--btn-primary))] hover:bg-[hsl(var(--btn-primary-hover))] text-[hsl(var(--btn-primary-text))] px-4 py-2 rounded-md font-semibold disabled:opacity-50"
      >
        {isSaving ? "Saving..." : "Add product"}
      </button>

      {message && (
        <p className="text-sm text-[hsl(var(--status-success-text))]">{message}</p>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </form>
  );
}
