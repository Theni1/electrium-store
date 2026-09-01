"use client";

import { useState, useEffect } from "react";
import QRCode from "qrcode";
import { getCartSessionIdForSharing } from "@/app/action/cart";

export default function ShareCart() {
  const [isOpen, setIsOpen] = useState(false);
  const [joinUrl, setJoinUrl] = useState("");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const handleOpen = async () => {
    setIsOpen(true);
    const sessionId = await getCartSessionIdForSharing();
    if (!sessionId) return;

    const url = `${window.location.origin}/cart/join?session=${sessionId}`;
    setJoinUrl(url);
    setQrDataUrl(await QRCode.toDataURL(url));
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mb-8">
      <button
        onClick={handleOpen}
        className="bg-[hsl(var(--btn-secondary))] text-[hsl(var(--btn-secondary-text))] px-4 py-2 rounded-xl hover:bg-[hsl(var(--btn-secondary-hover))]"
      >
        Share Cart
      </button>

      {isOpen && (
        <div className="mt-4 p-6 rounded-xl bg-[hsl(var(--surface))] border border-[hsl(var(--border))] flex flex-col items-center gap-4 max-w-sm">
          <p className="text-sm text-[hsl(var(--text-secondary))] text-center">
            Anyone with this link can view and add items to this cart.
          </p>
          {qrDataUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrDataUrl} alt="Cart share QR code" className="w-40 h-40" />
          )}
          <div className="flex w-full gap-2">
            <input
              readOnly
              value={joinUrl}
              className="flex-1 text-xs border border-[hsl(var(--border))] rounded-md p-2 bg-[hsl(var(--background))] text-[hsl(var(--text-primary))]"
            />
            <button
              onClick={handleCopy}
              className="bg-[hsl(var(--btn-primary))] text-[hsl(var(--btn-primary-text))] px-3 py-2 rounded-md text-sm whitespace-nowrap"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="text-xs text-[hsl(var(--text-muted))] underline"
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
