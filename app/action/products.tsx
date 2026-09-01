"use server";

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const ProductSchema = z.object({
  name: z.string().min(1, { message: "Name is required." }).trim(),
  description: z.string().trim(),
  image: z.string().trim(),
  amount_stocked: z.coerce
    .number()
    .int({ message: "Stock must be a whole number." })
    .min(0, { message: "Stock cannot be negative." }),
  rental_rate: z.coerce.number().min(0, { message: "Rental rate cannot be negative." }),
  sell_price: z.coerce.number().min(0, { message: "Sell price cannot be negative." }),
  damage_rate: z.coerce.number().min(0, { message: "Damage rate cannot be negative." }),
  for_rent: z.boolean(),
});

// Numbers arrive as strings from the form inputs and are coerced by the schema.
export type ProductInput = {
  name: string;
  description: string;
  image: string;
  amount_stocked: string;
  rental_rate: string;
  sell_price: string;
  damage_rate: string;
  for_rent: boolean;
};

export async function createProduct(input: ProductInput) {
  const validated = ProductSchema.safeParse(input);
  if (!validated.success) {
    return { success: false, errors: validated.error.flatten().fieldErrors };
  }

  const supabase = await createClient();

  // RLS is the real boundary; this check only turns a policy rejection into a
  // message the form can display.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, error: "Not signed in" };
  }

  const { data: customer } = await supabase
    .from("customers")
    .select("is_admin")
    .eq("id", user.id)
    .single();
  if (!customer?.is_admin) {
    return { success: false, error: "Admins only" };
  }

  const { data: bike, error } = await supabase
    .from("bikes")
    .insert({ ...validated.data, image: validated.data.image || null })
    .select("bike_id")
    .single();

  if (error) {
    console.error("Error creating product:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/admin");
  revalidatePath("/");
  revalidatePath("/rentals");
  return { success: true, bikeId: bike.bike_id };
}
