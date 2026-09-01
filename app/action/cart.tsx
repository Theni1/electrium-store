"use server";

import { createClient } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";

const CART_SESSION_COOKIE = "cart_session_id";

export interface CartItem {
  bike_id: number;
  name: string;
  description: string;
  image: string | null;
  amount_stocked: number;
  rental_rate: number;
  sell_price: number;
  damage_rate: number;
  for_rent: boolean;
  quantity: number;
  orderType: "rent" | "sell";
}

async function getOrCreateCartSessionId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const cookieStore = await cookies();
  const existingId = cookieStore.get(CART_SESSION_COOKIE)?.value;

  if (existingId) {
    const { data: existing } = await supabase
      .from("cart_sessions")
      .select("id")
      .eq("id", existingId)
      .eq("status", "active")
      .maybeSingle();
    if (existing) return existing.id;
  }

  // Guests get owner_id: null (session scoped by cookie possession, per RLS policy).
  const { data: created, error } = await supabase
    .from("cart_sessions")
    .insert({ owner_id: user?.id ?? null })
    .select("id")
    .single();

  if (error || !created) {
    console.error("Error creating cart session:", error);
    return null;
  }

  cookieStore.set(CART_SESSION_COOKIE, created.id, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30,
  });

  return created.id;
}

// Returns the current cart_session_id (creating one if needed) so the UI
// can build a shareable join link/QR code for it.
export async function getCartSessionIdForSharing(): Promise<string | null> {
  return getOrCreateCartSessionId();
}

// Called from the login flow: if the browser's cart session is a guest
// session (owner_id null), attach it to the newly authenticated user.
export async function claimCartSession() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const cookieStore = await cookies();
  const cartSessionId = cookieStore.get(CART_SESSION_COOKIE)?.value;
  if (!cartSessionId) return;

  await supabase
    .from("cart_sessions")
    .update({ owner_id: user.id })
    .eq("id", cartSessionId)
    .is("owner_id", null);
}

export async function getCart(): Promise<CartItem[]> {
  const supabase = await createClient();
  const cookieStore = await cookies();
  const cartSessionId = cookieStore.get(CART_SESSION_COOKIE)?.value;
  if (!cartSessionId) return [];

  const { data: items, error } = await supabase
    .from("user_cart_items")
    .select("bike_id, order_type, quantity, bikes(*)")
    .eq("cart_session_id", cartSessionId);

  if (error || !items) {
    console.error("Error fetching cart:", error);
    return [];
  }

  return items
    .filter((item: any) => item.bikes)
    .map((item: any) => ({
      ...item.bikes,
      quantity: item.quantity,
      orderType: item.order_type,
    }));
}

export async function addToCart(
  bikeId: number,
  orderType: "rent" | "sell",
  quantity: number
) {
  const supabase = await createClient();
  const cartSessionId = await getOrCreateCartSessionId();
  if (!cartSessionId) {
    return { success: false, error: "Not authenticated" };
  }

  const { error } = await supabase.from("user_cart_items").upsert(
    {
      cart_session_id: cartSessionId,
      bike_id: bikeId,
      order_type: orderType,
      quantity,
    },
    { onConflict: "cart_session_id,bike_id,order_type" }
  );

  if (error) {
    console.error("Error adding to cart:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/cart");
  revalidatePath("/checkout");
  return { success: true };
}

export async function updateCartItemQuantity(
  bikeId: number,
  orderType: "rent" | "sell",
  quantity: number
) {
  const supabase = await createClient();
  const cookieStore = await cookies();
  const cartSessionId = cookieStore.get(CART_SESSION_COOKIE)?.value;
  if (!cartSessionId) return { success: false, error: "No cart session" };

  const { error } = await supabase
    .from("user_cart_items")
    .update({ quantity })
    .eq("cart_session_id", cartSessionId)
    .eq("bike_id", bikeId)
    .eq("order_type", orderType);

  if (error) {
    console.error("Error updating cart item:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/cart");
  revalidatePath("/checkout");
  return { success: true };
}

export async function removeFromCart(bikeId: number, orderType: "rent" | "sell") {
  const supabase = await createClient();
  const cookieStore = await cookies();
  const cartSessionId = cookieStore.get(CART_SESSION_COOKIE)?.value;
  if (!cartSessionId) return { success: false, error: "No cart session" };

  const { error } = await supabase
    .from("user_cart_items")
    .delete()
    .eq("cart_session_id", cartSessionId)
    .eq("bike_id", bikeId)
    .eq("order_type", orderType);

  if (error) {
    console.error("Error removing cart item:", error);
    return { success: false, error: error.message };
  }

  revalidatePath("/cart");
  revalidatePath("/checkout");
  return { success: true };
}
