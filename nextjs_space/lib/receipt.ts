import { formatCurrency } from "@/lib/helpers";

interface ReceiptData {
  companyName: string;
  address?: string | null;
  phone?: string | null;
  logoUrl?: string | null;
  receiptHeader?: string | null;
  receiptFooter?: string | null;
  transactionNumber: string;
  date: string;
  cashierName: string;
  items: { name: string; quantity: number; unitPrice: number; lineTotal: number; isWeightItem?: boolean }[];
  subtotal: number;
  tax: number;
  total: number;
  loyaltyRewardDiscount?: number;
  paymentMethod: string;
  cashGiven?: number | null;
  changeDue?: number | null;
  customerName?: string | null;
  loyaltyPointsEarned?: number;
  loyaltyPointsRedeemed?: number;
}

// Generate Code 128B barcode as SVG path data
function generateCode128SVG(text: string): string {
  // Code 128B encoding table (characters 0-94 map to ASCII 32-126)
  const CODE128B: number[][] = [
    [2,1,2,2,2,2],[2,2,2,1,2,2],[2,2,2,2,2,1],[1,2,1,2,2,3],[1,2,1,3,2,2],
    [1,3,1,2,2,2],[1,2,2,2,1,3],[1,2,2,3,1,2],[1,3,2,2,1,2],[2,2,1,2,1,3],
    [2,2,1,3,1,2],[2,3,1,2,1,2],[1,1,2,2,3,2],[1,2,2,1,3,2],[1,2,2,2,3,1],
    [1,1,3,2,2,2],[1,2,3,1,2,2],[1,2,3,2,2,1],[2,2,3,2,1,1],[2,2,1,1,3,2],
    [2,2,1,2,3,1],[2,1,3,2,1,2],[2,2,3,1,1,2],[3,1,2,1,3,1],[3,1,1,2,2,2],
    [3,2,1,1,2,2],[3,2,1,2,2,1],[3,1,2,2,1,2],[3,2,2,1,1,2],[3,2,2,2,1,1],
    [2,1,2,1,2,3],[2,1,2,3,2,1],[2,3,2,1,2,1],[1,1,1,3,2,3],[1,3,1,1,2,3],
    [1,3,1,3,2,1],[1,1,2,3,1,3],[1,3,2,1,1,3],[1,3,2,3,1,1],[2,1,1,3,1,3],
    [2,3,1,1,1,3],[2,3,1,3,1,1],[1,1,2,1,3,3],[1,1,2,3,3,1],[1,3,2,1,3,1],
    [1,1,3,1,2,3],[1,1,3,3,2,1],[1,3,3,1,2,1],[3,1,3,1,2,1],[2,1,1,3,3,1],
    [2,3,1,1,3,1],[2,1,3,1,1,3],[2,1,3,3,1,1],[2,1,3,1,3,1],[3,1,1,1,2,3],
    [3,1,1,3,2,1],[3,3,1,1,2,1],[3,1,2,1,1,3],[3,1,2,3,1,1],[3,3,2,1,1,1],
    [3,1,4,1,1,1],[2,2,1,4,1,1],[4,3,1,1,1,1],[1,1,1,2,2,4],[1,1,1,4,2,2],
    [1,2,1,1,2,4],[1,2,1,4,2,1],[1,4,1,1,2,2],[1,4,1,2,2,1],[1,1,2,2,1,4],
    [1,1,2,4,1,2],[1,2,2,1,1,4],[1,2,2,4,1,1],[1,4,2,1,1,2],[1,4,2,2,1,1],
    [2,4,1,2,1,1],[2,2,1,1,1,4],[4,1,3,1,1,1],[2,4,1,1,1,2],[1,3,4,1,1,1],
    [1,1,1,2,4,2],[1,2,1,1,4,2],[1,2,1,2,4,1],[1,1,4,2,1,2],[1,2,4,1,1,2],
    [1,2,4,2,1,1],[4,1,1,2,1,2],[4,2,1,1,1,2],[4,2,1,2,1,1],[2,1,2,1,4,1],
    [2,1,4,1,2,1],[4,1,2,1,2,1],[1,1,1,1,4,3],[1,1,1,3,4,1],[1,3,1,1,4,1],
    [1,1,4,1,1,3],[1,1,4,3,1,1],[4,1,1,1,1,3],[4,1,1,3,1,1],[1,1,3,1,4,1],
    [1,1,4,1,3,1],[3,1,1,1,4,1],[4,1,1,1,3,1],[2,1,1,4,1,2],[2,1,1,2,1,4],
    [2,1,1,2,3,2],[2,3,3,1,1,1,2],
  ];
  
  const STOP = [2,3,3,1,1,1,2];
  const START_B = 104;
  
  // Encode
  const codes: number[][] = [];
  codes.push(CODE128B[START_B]);
  let checksum = START_B;
  
  for (let i = 0; i < text.length; i++) {
    const charCode = text.charCodeAt(i) - 32;
    if (charCode >= 0 && charCode < 95) {
      codes.push(CODE128B[charCode]);
      checksum += charCode * (i + 1);
    }
  }
  
  codes.push(CODE128B[checksum % 103]);
  codes.push(STOP);
  
  // Convert to bars
  let bars = '';
  let x = 0;
  const barWidth = 2;
  const height = 50;
  
  for (const code of codes) {
    for (let i = 0; i < code.length; i++) {
      const w = code[i] * barWidth;
      if (i % 2 === 0) { // bar (black)
        bars += `<rect x="${x}" y="0" width="${w}" height="${height}" fill="black"/>`;
      }
      x += w;
    }
  }
  
  return `<svg xmlns="https://upload.wikimedia.org/wikipedia/commons/6/6b/Bitmap_VS_SVG.svg" viewBox="0 0 ${x} ${height + 15}" width="${x}" height="${height + 15}">
    ${bars}
    <text x="${x/2}" y="${height + 12}" text-anchor="middle" font-family="monospace" font-size="11">${text}</text>
  </svg>`;
}

export function generateReceiptHtml(data: ReceiptData): string {
  const barcodeSvg = generateCode128SVG(data.transactionNumber);
  
  const itemRows = data.items.map(item => {
    const qtyLabel = item.isWeightItem ? `${item.quantity.toFixed(3)} lb` : `${item.quantity}`;
    return `<div class="item-row"><span>${item.name} x${qtyLabel}</span><span>${formatCurrency(item.lineTotal)}</span></div>`;
  }).join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Receipt</title>
<style>
  @page { margin: 0; size: 80mm auto; }
  body { font-family: 'Courier New', monospace; font-size: 11px; width: 280px; margin: 0 auto; padding: 10px; color: #000; }
  .center { text-align: center; }
  .bold { font-weight: bold; }
  .line { border-top: 1px dashed #000; margin: 6px 0; }
  .item-row { display: flex; justify-content: space-between; margin: 2px 0; }
  .logo { max-width: 120px; max-height: 60px; }
  .barcode { margin: 8px auto; text-align: center; }
  .barcode svg { max-width: 250px; height: auto; }
  @media print { body { margin: 0; padding: 5px; } }
</style></head><body>
  <div class="center">
    ${data.logoUrl ? `<img src="${data.logoUrl}" class="logo" alt="Logo" /><br>` : ''}
    <div class="bold" style="font-size:14px;">${data.companyName}</div>
    ${data.address ? `<div>${data.address}</div>` : ''}
    ${data.phone ? `<div>Tel: ${data.phone}</div>` : ''}
    ${data.receiptHeader ? `<div style="margin-top:4px;">${data.receiptHeader}</div>` : ''}
  </div>
  <div class="line"></div>
  <div class="center bold">SALE</div>
  <div>Date: ${data.date}</div>
  <div>Trans #: ${data.transactionNumber}</div>
  <div>Cashier: ${data.cashierName}</div>
  ${data.customerName ? `<div>Customer: ${data.customerName}</div>` : ''}
  <div class="line"></div>
  ${itemRows}
  <div class="line"></div>
  <div class="item-row"><span>Subtotal:</span><span>${formatCurrency(data.subtotal)}</span></div>
  <div class="item-row"><span>Tax:</span><span>${formatCurrency(data.tax)}</span></div>
  ${(data.loyaltyRewardDiscount ?? 0) > 0 ? `<div class="item-row" style="color:#c00;"><span>Loyalty Reward:</span><span>-${formatCurrency(data.loyaltyRewardDiscount!)}</span></div>` : ''}
  <div class="line"></div>
  <div class="item-row bold" style="font-size:14px;"><span>TOTAL:</span><span>${formatCurrency(data.total)}</span></div>
  <div class="line"></div>
  <div class="item-row"><span>Payment: ${data.paymentMethod.charAt(0).toUpperCase() + data.paymentMethod.slice(1)}</span></div>
  ${data.cashGiven ? `<div class="item-row"><span>Cash Given:</span><span>${formatCurrency(data.cashGiven)}</span></div>` : ''}
  ${data.changeDue && data.changeDue > 0 ? `<div class="item-row bold"><span>Change:</span><span>${formatCurrency(data.changeDue)}</span></div>` : ''}
  ${(data.loyaltyPointsEarned ?? 0) > 0 ? `<div style="margin-top:6px;text-align:center;font-size:10px;">⭐ You earned ${data.loyaltyPointsEarned} loyalty points!</div>` : ''}
  ${(data.loyaltyPointsRedeemed ?? 0) > 0 ? `<div style="text-align:center;font-size:10px;">🎁 ${data.loyaltyPointsRedeemed} points redeemed</div>` : ''}
  <div class="barcode">${barcodeSvg}</div>
  <div class="center" style="font-size:10px;margin-top:4px;">
    ${data.receiptFooter || 'Thank you for your purchase!'}
    <div style="margin-top:3px;color:#666;">Powered by AzadiPOS</div>
  </div>
</body></html>`;
}

export function printReceipt(data: ReceiptData) {
  const html = generateReceiptHtml(data);
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}
