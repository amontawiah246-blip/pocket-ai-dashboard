import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Basic formatters
export function formatPrice(price: number, decimals: number = 5) {
  return price.toFixed(decimals);
}

export function formatPercent(val: number) {
  const sign = val >= 0 ? "+" : "";
  return `${sign}${val.toFixed(2)}%`;
}
