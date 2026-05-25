export const PRICE_CURRENCY_SYMBOLS = {
  EUR: "€",
  USD: "$",
  GBP: "£",
  CHF: "Fr.",
  JPY: "¥",
};

export function getDishPriceValue(dish) {
  const raw = dish?.price ?? dish?.priceAmount ?? dish?.restaurantPrice;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function formatDishPrice(dish) {
  const value = getDishPriceValue(dish);
  if (!value) return "";
  const code = String(dish?.priceCurrency || dish?.currency || "EUR").toUpperCase();
  const symbol = PRICE_CURRENCY_SYMBOLS[code] || code || "€";
  const amount = value % 1 === 0 ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
  return code === "USD" || code === "GBP" || code === "JPY" ? `${symbol}${amount}` : `${amount}${symbol}`;
}
