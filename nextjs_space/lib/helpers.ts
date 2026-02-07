export function generateTransactionNumber(): string {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  const timePart = now.getTime().toString().slice(-6);
  return `TXN-${datePart}-${timePart}`;
}

export function formatCurrency(amount: number | null | undefined): string {
  const safeAmount = amount ?? 0;
  return `$${safeAmount.toFixed(2)}`;
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "";
  const d = new Date(date);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function calculateTax(subtotal: number, taxRate: number): number {
  return Math.round(subtotal * (taxRate / 100) * 100) / 100;
}