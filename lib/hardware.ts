/**
 * Hardware Abstraction Layer for AzadiPOS
 * 
 * Provides unified interfaces for:
 * - Card Payment Terminals (Verifone, Ingenico, etc.)
 * - Scanner/Scale Units (Magellan, NCR, etc.)
 * - Thermal Receipt Printers (ESC/POS compatible)
 * 
 * In Electron mode, these communicate via IPC to the main process
 * which handles serial port / USB HID / network connections.
 * In browser mode, they fall back to manual input / window.print().
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CardPaymentRequest {
  amount: number;           // Total amount in dollars
  transactionId: string;    // POS transaction reference
  merchantId?: string;      // Optional merchant ID
}

export interface CardPaymentResponse {
  success: boolean;
  approved: boolean;
  declineReason?: string;   // "Insufficient Funds", "Card Expired", etc.
  cardType?: string;        // "Visa", "Mastercard", "Amex", "Discover", "Apple Pay", "Google Pay"
  lastFour?: string;        // Last 4 digits of card: "9928"
  approvalCode?: string;    // Auth code from processor: "A12345"
  referenceNumber?: string; // Processor reference number
  entryMethod?: string;     // "chip", "tap", "swipe", "manual"
  cardholderName?: string;  // Name on card (if available)
  error?: string;           // Error message if success is false
}

export interface ScaleReading {
  weight: number;           // Weight in current unit
  unit: "lb" | "kg" | "oz";
  stable: boolean;          // Whether the reading is stable
  error?: string;
}

export interface PrintRequest {
  html: string;             // HTML content to print
  printerName?: string;     // Specific printer name (default: system default)
  copies?: number;          // Number of copies
  silent?: boolean;         // Skip print dialog (default: true for thermal)
  width?: number;           // Paper width in mm (default: 80 for thermal)
}

export interface PrintResponse {
  success: boolean;
  error?: string;
}

// ─── Electron Bridge Detection ───────────────────────────────────────────────

interface ElectronHardwareAPI {
  sendPayment: (request: CardPaymentRequest) => Promise<CardPaymentResponse>;
  cancelPayment: () => Promise<void>;
  readScale: () => Promise<ScaleReading>;
  subscribeScale: (callback: (reading: ScaleReading) => void) => () => void;
  printSilent: (request: PrintRequest) => Promise<PrintResponse>;
  getPrinters: () => Promise<string[]>;
  getScaleStatus: () => Promise<{ connected: boolean; model?: string }>;
  getTerminalStatus: () => Promise<{ connected: boolean; model?: string }>;
}

declare global {
  interface Window {
    electronHardware?: ElectronHardwareAPI;
  }
}

/**
 * Check if running inside Electron with hardware bridge available
 */
export function isElectronHardwareAvailable(): boolean {
  return typeof window !== "undefined" && !!window.electronHardware;
}

/**
 * Check if specific hardware is connected
 */
export async function getHardwareStatus(): Promise<{
  terminal: { connected: boolean; model?: string };
  scale: { connected: boolean; model?: string };
  printer: { connected: boolean; printers: string[] };
}> {
  if (!isElectronHardwareAvailable()) {
    return {
      terminal: { connected: false },
      scale: { connected: false },
      printer: { connected: false, printers: [] },
    };
  }

  const api = window.electronHardware!;
  const [terminal, scale, printers] = await Promise.all([
    api.getTerminalStatus().catch(() => ({ connected: false })),
    api.getScaleStatus().catch(() => ({ connected: false })),
    api.getPrinters().catch(() => []),
  ]);

  return {
    terminal,
    scale,
    printer: { connected: printers.length > 0, printers },
  };
}

// ─── Card Payment Terminal ───────────────────────────────────────────────────

/**
 * Send a payment request to the card terminal.
 * In Electron mode: communicates via serial/network to Verifone/Ingenico.
 * In browser mode: returns a simulated "manual" flow response.
 */
export async function sendCardPayment(
  request: CardPaymentRequest
): Promise<CardPaymentResponse> {
  if (isElectronHardwareAvailable()) {
    try {
      return await window.electronHardware!.sendPayment(request);
    } catch (err: any) {
      return {
        success: false,
        approved: false,
        error: err?.message || "Terminal communication error",
      };
    }
  }

  // Browser fallback: no terminal connected, manual confirmation mode
  return {
    success: true,
    approved: true,
    cardType: "Manual",
    lastFour: "----",
    entryMethod: "manual",
    approvalCode: "MANUAL",
    referenceNumber: `REF-${Date.now()}`,
  };
}

/**
 * Cancel an in-progress payment on the terminal
 */
export async function cancelCardPayment(): Promise<void> {
  if (isElectronHardwareAvailable()) {
    await window.electronHardware!.cancelPayment();
  }
}

// ─── Scanner/Scale ───────────────────────────────────────────────────────────

/**
 * Read the current weight from a connected scale (Magellan, NCR, etc.).
 * Returns null if no scale is connected.
 */
export async function readScale(): Promise<ScaleReading | null> {
  if (isElectronHardwareAvailable()) {
    try {
      return await window.electronHardware!.readScale();
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * Subscribe to real-time scale weight updates.
 * Returns an unsubscribe function.
 * Returns null if no scale bridge is available.
 */
export function subscribeToScale(
  callback: (reading: ScaleReading) => void
): (() => void) | null {
  if (isElectronHardwareAvailable()) {
    return window.electronHardware!.subscribeScale(callback);
  }
  return null;
}

// ─── Thermal Printer ─────────────────────────────────────────────────────────

/**
 * Print content silently to a thermal printer.
 * In Electron mode: uses Electron's webContents.print() with silent=true.
 * In browser mode: falls back to window.print() with a new window.
 */
export async function printThermal(
  request: PrintRequest
): Promise<PrintResponse> {
  const printReq = { ...request, silent: request.silent !== false, width: request.width || 80 };

  if (isElectronHardwareAvailable()) {
    try {
      return await window.electronHardware!.printSilent(printReq);
    } catch (err: any) {
      return { success: false, error: err?.message || "Print failed" };
    }
  }

  // Browser fallback: open print window
  try {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      return { success: false, error: "Popup blocked – allow popups for receipt printing" };
    }
    printWindow.document.write(printReq.html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    // Close after a delay to allow print dialog
    setTimeout(() => printWindow.close(), 2000);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "Print failed" };
  }
}

/**
 * Get list of available printers
 */
export async function getAvailablePrinters(): Promise<string[]> {
  if (isElectronHardwareAvailable()) {
    return window.electronHardware!.getPrinters();
  }
  return [];
}
