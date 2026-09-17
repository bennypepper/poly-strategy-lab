export interface Asset {
  symbol: string;
  name: string;
  icon: string;
  isCustom?: boolean;
}

export const DEFAULT_CRYPTO_ASSETS: Asset[] = [
  { symbol: "BTC-USD", name: "Bitcoin", icon: "₿" },
  { symbol: "ETH-USD", name: "Ethereum", icon: "Ξ" },
  { symbol: "SOL-USD", name: "Solana", icon: "◎" },
  { symbol: "BNB-USD", name: "BNB", icon: "⬡" },
  { symbol: "XRP-USD", name: "XRP", icon: "✕" },
  { symbol: "ADA-USD", name: "Cardano", icon: "₳" },
  { symbol: "DOGE-USD", name: "Dogecoin", icon: "Ð" },
  { symbol: "AVAX-USD", name: "Avalanche", icon: "▲" },
  { symbol: "LINK-USD", name: "Chainlink", icon: "⬡" },
  { symbol: "NEAR-USD", name: "NEAR", icon: "Ⓝ" },
];

export const CUSTOM_ASSETS_STORAGE_KEY = "poly_custom_assets";
export const CUSTOM_ASSETS_EVENT = "poly_custom_assets_changed";

export function getCustomAssets(): Asset[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = localStorage.getItem(CUSTOM_ASSETS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item) => item && typeof item.symbol === "string")
      .map((item) => ({
        symbol: item.symbol.toUpperCase(),
        name: typeof item.name === "string" ? item.name : item.symbol.replace("-USD", ""),
        icon: typeof item.icon === "string" ? item.icon : "◈",
        isCustom: true,
      }));
  } catch (err) {
    console.warn("Failed to load custom assets from localStorage:", err);
    return [];
  }
}

export function saveCustomAsset(rawSymbol: string): Asset[] {
  if (typeof window === "undefined") return [];

  const clean = rawSymbol.trim().toUpperCase();
  if (!clean) return getCustomAssets();

  // Check if symbol already exists in default assets
  if (DEFAULT_CRYPTO_ASSETS.some((a) => a.symbol === clean)) {
    return getCustomAssets();
  }

  const existing = getCustomAssets();
  if (existing.some((a) => a.symbol === clean)) {
    return existing;
  }

  const newAsset: Asset = {
    symbol: clean,
    name: clean.replace("-USD", ""),
    icon: "◈",
    isCustom: true,
  };

  const updated = [...existing, newAsset];

  try {
    localStorage.setItem(CUSTOM_ASSETS_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event(CUSTOM_ASSETS_EVENT));
  } catch (err) {
    console.warn("Failed to persist custom asset to localStorage:", err);
  }

  return updated;
}

export function removeCustomAsset(symbolToRemove: string): Asset[] {
  if (typeof window === "undefined") return [];

  const existing = getCustomAssets();
  const updated = existing.filter(
    (a) => a.symbol.toUpperCase() !== symbolToRemove.toUpperCase()
  );

  try {
    localStorage.setItem(CUSTOM_ASSETS_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new Event(CUSTOM_ASSETS_EVENT));
  } catch (err) {
    console.warn("Failed to update custom assets in localStorage:", err);
  }

  return updated;
}

export function subscribeToCustomAssets(callback: (assets: Asset[]) => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handler = () => {
    callback(getCustomAssets());
  };

  window.addEventListener(CUSTOM_ASSETS_EVENT, handler);
  window.addEventListener("storage", handler);

  return () => {
    window.removeEventListener(CUSTOM_ASSETS_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}
