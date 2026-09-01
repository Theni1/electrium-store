"use client";

import React, { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { FaAngleLeft } from "react-icons/fa";
import { CheckoutBike } from "@/utils/getBike";
import {
  getCart,
  updateCartItemQuantity,
  removeFromCart,
  getCartSessionIdForSharing,
} from "@/app/action/cart";
import ShareCart from "./ShareCart";
import { createClient } from "@/utils/supabase/client";

// Display products in shopping cart
function Product({
  bike,
  handleQuantityChange,
  handleDelete,
}: {
  bike: CheckoutBike;
  handleQuantityChange: (id: number, newQuantity: number) => void;
  handleDelete: (id: number) => void;
}) {
  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newQuantity = parseInt(event.target.value, 10);
    handleQuantityChange(bike.bike_id, newQuantity);
  };

  const handleOnClick = () => {
    handleDelete(bike.bike_id);
  };

  const subtotal =
    bike.orderType === "rent"
      ? bike.rental_rate * bike.quantity
      : bike.sell_price * bike.quantity;

  return (
    <div className="flex w-full md:w-[750px] bg-[hsl(var(--surface))] mb-8 p-6 rounded-2xl shadow-md items-center">
      {/* Product Image */}
      <div className="flex-shrink-0 mr-6">
        <Image
          src={bike.image || "/img/placeholder.png"}
          alt={bike.name}
          unoptimized
          width={100}
          height={100}
          style={{ objectFit: "contain" }}
          className="rounded-lg bg-background border border-border p-2"
        />
      </div>
      {/* Product Details */}
      <div className="flex flex-1 flex-col md:flex-row md:items-center w-full justify-between gap-4">
        {/* Name */}
        <div className="min-w-[120px] flex-1">
          <p className="font-bold text-lg text-[hsl(var(--text-primary))] mb-1">
            {bike.name}
          </p>
        </div>
        {/* Price */}
        <div className="min-w-[100px] text-[hsl(var(--text-primary))] text-center">
          <p className="text-sm font-semibold mb-1 text-[hsl(var(--text-primary))]">
            Price
          </p>
          <p>
            {bike.orderType === "rent"
              ? `CA $${bike.rental_rate.toFixed(2)}/hour`
              : `CA $${bike.sell_price.toFixed(2)}`}
          </p>
        </div>
        {/* Quantity */}
        <div className="min-w-[100px] text-center">
          <p className="text-sm font-semibold mb-1 text-[hsl(var(--text-primary))]">
            Quantity
          </p>
          <input
            type="number"
            value={bike.quantity}
            min={1}
            max={bike.amount_stocked}
            className="border border-[hsl(var(--border))] rounded-lg p-2 w-16 text-center bg-[hsl(var(--surface))] text-[hsl(var(--text-primary))] focus:ring-2 focus:ring-[hsl(var(--border-focus))] focus:border-[hsl(var(--border-focus))]"
            onChange={handleInputChange}
          />
        </div>
        {/* Subtotal */}
        <div className="min-w-[100px] text-center">
          <p className="text-sm font-semibold mb-1 text-[hsl(var(--text-primary))]">
            Subtotal
          </p>
          <p className="text-[hsl(var(--text-primary))]">
            CA${subtotal.toFixed(2)}
          </p>
        </div>
        {/* Delete Button */}
        <div className="min-w-[80px] text-center">
          <button
            className="text-status-error underline"
            onClick={handleOnClick}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ShoppingCartPage() {
  const [cart, setCart] = useState<CheckoutBike[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getCart().then((items) => {
      setCart(items);
      setIsLoading(false);
    });
  }, []);

  // Live-sync: re-fetch the cart whenever any item in this cart session
  // changes (added/updated/removed by this browser or another one sharing
  // the same session via the QR/link join flow).
  useEffect(() => {
    let channel: ReturnType<ReturnType<typeof createClient>["channel"]> | null = null;

    getCartSessionIdForSharing().then((cartSessionId) => {
      if (!cartSessionId) return;

      const supabase = createClient();
      channel = supabase
        .channel(`cart-${cartSessionId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "user_cart_items",
            filter: `cart_session_id=eq.${cartSessionId}`,
          },
          () => {
            getCart().then(setCart);
          }
        )
        .subscribe();
    });

    return () => {
      if (channel) createClient().removeChannel(channel);
    };
  }, []);

  const subtotal = cart.reduce((sum, bike) => {
    return (
      sum +
      (bike.orderType === "rent"
        ? bike.rental_rate * bike.quantity
        : bike.sell_price * bike.quantity)
    );
  }, 0);

  let shipping = 10; // Fixed shipping cost for now
  let total = subtotal + shipping;

  const handleQuantityChange = (id: number, newQuantity: number) => {
    const item = cart.find((b) => b.bike_id === id);
    if (!item) return;

    setCart(cart.map((b) => (b.bike_id === id ? { ...b, quantity: newQuantity } : b)));
    updateCartItemQuantity(id, item.orderType as "rent" | "sell", newQuantity);
  };

  const handleDelete = (id: number) => {
    const item = cart.find((b) => b.bike_id === id);
    if (!item) return;

    setCart(cart.filter((b) => b.bike_id !== id));
    removeFromCart(id, item.orderType as "rent" | "sell");
  };

  if (isLoading) {
    return null;
  }

  if (cart.length === 0) {
    return (
      <div className="flex flex-col items-center min-h-screen bg-[hsl(var(--background))]">
        <main className="w-full p-16">
          <h1 className="text-center mb-10 md:text-4xl text-3xl lg:leading-normal leading-normal font-bold text-[hsl(var(--text-primary))]">
            Your Shopping Cart
          </h1>
          <div className="text-center">
            <p className="text-[hsl(var(--text-primary))] mb-8">
              Your cart is empty
            </p>
            <Link
              href="/"
              className="bg-[hsl(var(--btn-primary))] text-[hsl(var(--btn-primary-text))] flex items-center justify-center gap-4 pr-4 w-52 h-12 mb-12 rounded-2xl hover:bg-[hsl(var(--btn-primary-hover))]"
            >
              <FaAngleLeft
                size={24}
                className="text-[hsl(var(--btn-primary-text))]"
              />
              Continue Shopping
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center min-h-screen bg-[hsl(var(--background))]">
      <main className="w-full p-16">
        <h1 className="text-center mb-10 md:text-4xl text-3xl lg:leading-normal leading-normal font-bold text-[hsl(var(--text-primary))]">
          Your Shopping Cart
        </h1>
        <div className="flex justify-center">
          <ShareCart />
        </div>
        <div className="flex flex-col md:flex-row pb-8 justify-center">
          <div className="flex flex-col md:mr-10">
            {cart.map((bike) => (
              <Product
                key={bike.bike_id}
                bike={bike}
                handleQuantityChange={handleQuantityChange}
                handleDelete={handleDelete}
              />
            ))}

            <Link
              href="/"
              className="bg-[hsl(var(--btn-primary))] text-[hsl(var(--btn-primary-text))] flex items-center justify-center gap-4 pr-4 w-52 h-12 mb-12 rounded-2xl hover:bg-[hsl(var(--btn-primary-hover))] mx-auto"
            >
              <FaAngleLeft
                size={24}
                className="text-[hsl(var(--btn-primary-text))]"
              />
              Continue Shopping
            </Link>
          </div>

          <div className="bg-[hsl(var(--surface))] p-8 rounded-lg shadow-md h-fit">
            <h2 className="font-bold mb-6 text-lg text-[hsl(var(--text-primary))]">
              Cart Summary
            </h2>
            <p className="text-[hsl(var(--text-primary))] mb-6">
              Shipping and tax are determined based on your selected option.
            </p>
            <div className="flex mb-6 justify-between text-[hsl(var(--text-primary))]">
              <p>Subtotal</p>
              <p>CA${subtotal.toFixed(2)}</p>
            </div>
            <div className="flex mb-6 justify-between text-[hsl(var(--text-primary))]">
              <p>Shipping</p>
              <p>CA${shipping.toFixed(2)}</p>
            </div>
            <hr className="border-[hsl(var(--border))]" />
            <div className="flex my-6 justify-between font-bold text-[hsl(var(--text-primary))]">
              <h3>Order Total</h3>
              <h3>CA${total.toFixed(2)}</h3>
            </div>

            <Link href="/checkout">
              <button className="bg-[hsl(var(--btn-primary))] text-[hsl(var(--btn-primary-text))] w-full h-11 mb-10 rounded-2xl hover:bg-[hsl(var(--btn-primary-hover))]">
                Secure Checkout
              </button>
            </Link>
            <h2 className="font-bold mb-4 text-lg text-[hsl(var(--text-primary))]">
              Discount
            </h2>
            <p className="text-[hsl(var(--text-primary))] mb-3">
              Enter code for discount.
            </p>
            <input
              type="text"
              placeholder="Enter code"
              className="border border-[hsl(var(--border))] rounded-md p-2 mb-6 w-full bg-[hsl(var(--surface))] text-[hsl(var(--text-primary))] focus:ring-2 focus:ring-[hsl(var(--border-focus))] focus:border-[hsl(var(--border-focus))]"
            />
            <button className="bg-[hsl(var(--btn-primary))] text-[hsl(var(--btn-primary-text))] w-full h-11 rounded-2xl hover:bg-[hsl(var(--btn-primary-hover))]">
              Apply
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
