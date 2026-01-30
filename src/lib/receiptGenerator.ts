// Receipt generation utilities for thermal and PDF printing

export interface ShopBranding {
  shopName: string;
  tagline?: string;
  logoUrl?: string;
  receiptHeader: string;
  receiptFooter: string;
  currencySymbol: string;
  primaryColor?: string;
}

export interface ReceiptData {
  receiptNumber: string;
  date: Date;
  branchName: string;
  branchAddress: string;
  cashierName: string;
  items: {
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
    isBulk: boolean;
  }[];
  subtotal: number;
  taxAmount: number;
  total: number;
  cashReceived: number;
  change: number;
  branding?: ShopBranding;
}

// Format date for receipt
const formatDate = (date: Date): string => {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// Format price with currency symbol
const formatPrice = (amount: number, symbol: string = '$'): string => {
  return `${symbol}${amount.toFixed(2)}`;
};

// Generate thermal printer receipt (ESC/POS format)
export const printThermalReceipt = async (data: ReceiptData): Promise<void> => {
  const symbol = data.branding?.currencySymbol || '$';
  const shopName = data.branding?.shopName || 'SUPERPOS';
  const headerMsg = data.branding?.receiptHeader || 'Thank you for your purchase!';
  const footerMsg = data.branding?.receiptFooter || 'Please come again';
  
  // Build receipt text
  const lines: string[] = [];
  const width = 42; // Standard thermal receipt width
  
  const center = (text: string) => {
    const padding = Math.floor((width - text.length) / 2);
    return ' '.repeat(Math.max(0, padding)) + text;
  };
  
  const separator = '='.repeat(width);
  const thinSeparator = '-'.repeat(width);
  
  // Header
  lines.push(center(shopName.toUpperCase()));
  if (data.branding?.tagline) {
    lines.push(center(data.branding.tagline));
  }
  lines.push(center(data.branchName));
  if (data.branchAddress) {
    lines.push(center(data.branchAddress));
  }
  lines.push(separator);
  lines.push(center(headerMsg));
  lines.push(separator);
  lines.push(`Receipt: ${data.receiptNumber}`);
  lines.push(`Date: ${formatDate(data.date)}`);
  lines.push(`Cashier: ${data.cashierName}`);
  lines.push(separator);
  
  // Items
  lines.push('ITEM                    QTY    TOTAL');
  lines.push(thinSeparator);
  
  data.items.forEach(item => {
    const name = item.name.substring(0, 22).padEnd(22);
    const qty = item.quantity.toString().padStart(3);
    const total = formatPrice(item.total, symbol).padStart(10);
    lines.push(`${name} ${qty} ${total}`);
    if (item.isBulk) {
      lines.push(`  @ ${formatPrice(item.unitPrice, symbol)} (BULK)`);
    }
  });
  
  lines.push(thinSeparator);
  
  // Totals
  lines.push(`${'Subtotal:'.padEnd(30)}${formatPrice(data.subtotal, symbol).padStart(10)}`);
  lines.push(`${'Tax:'.padEnd(30)}${formatPrice(data.taxAmount, symbol).padStart(10)}`);
  lines.push(separator);
  lines.push(`${'TOTAL:'.padEnd(30)}${formatPrice(data.total, symbol).padStart(10)}`);
  lines.push(`${'Cash:'.padEnd(30)}${formatPrice(data.cashReceived, symbol).padStart(10)}`);
  lines.push(`${'Change:'.padEnd(30)}${formatPrice(data.change, symbol).padStart(10)}`);
  
  lines.push(separator);
  lines.push(center(footerMsg));
  lines.push('');
  lines.push('');
  lines.push('');
  
  const receiptText = lines.join('\n');
  
  // Try to print using the Web Serial API or fall back to copy
  if ('serial' in navigator) {
    try {
      // @ts-ignore - Web Serial API
      const port = await navigator.serial.requestPort();
      await port.open({ baudRate: 9600 });
      
      const encoder = new TextEncoder();
      const writer = port.writable.getWriter();
      
      // ESC/POS commands
      const ESC = 0x1B;
      const GS = 0x1D;
      
      // Initialize printer
      await writer.write(new Uint8Array([ESC, 0x40]));
      
      // Print text
      await writer.write(encoder.encode(receiptText));
      
      // Cut paper
      await writer.write(new Uint8Array([GS, 0x56, 0x00]));
      
      writer.releaseLock();
      await port.close();
    } catch (error) {
      console.log('Serial printing not available, falling back to window print');
      printViaWindow(receiptText);
    }
  } else {
    printViaWindow(receiptText);
  }
};

// Fallback print via window
const printViaWindow = (text: string) => {
  const printWindow = window.open('', '_blank', 'width=400,height=600');
  if (printWindow) {
    printWindow.document.write(`
      <html>
        <head>
          <title>Receipt</title>
          <style>
            body {
              font-family: 'Courier New', monospace;
              font-size: 12px;
              padding: 10px;
              max-width: 300px;
              margin: 0 auto;
            }
            pre {
              white-space: pre-wrap;
              word-wrap: break-word;
            }
            @media print {
              body { margin: 0; padding: 0; }
            }
          </style>
        </head>
        <body>
          <pre>${text}</pre>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    printWindow.close();
  }
};

// Generate PDF receipt
export const generateReceiptPDF = async (data: ReceiptData): Promise<void> => {
  const symbol = data.branding?.currencySymbol || '$';
  const shopName = data.branding?.shopName || 'SUPERPOS';
  const tagline = data.branding?.tagline || '';
  const headerMsg = data.branding?.receiptHeader || 'Thank you for your purchase!';
  const footerMsg = data.branding?.receiptFooter || 'Please come again';
  const primaryColor = data.branding?.primaryColor || '#7c3aed';
  const logoUrl = data.branding?.logoUrl;

  // Create a simple HTML-based PDF using browser print
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Receipt ${data.receiptNumber}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: Arial, sans-serif;
          font-size: 12px;
          padding: 20px;
          max-width: 300px;
          margin: 0 auto;
        }
        .header {
          text-align: center;
          margin-bottom: 15px;
          padding-bottom: 10px;
          border-bottom: 2px solid ${primaryColor};
        }
        .logo {
          max-width: 80px;
          max-height: 60px;
          margin-bottom: 8px;
        }
        .header h1 {
          font-size: 18px;
          margin-bottom: 3px;
          color: ${primaryColor};
        }
        .header .tagline {
          font-size: 10px;
          color: #666;
          margin-bottom: 5px;
        }
        .header p {
          font-size: 11px;
          color: #666;
        }
        .header-message {
          font-style: italic;
          color: #333;
          margin-top: 8px;
          padding-top: 8px;
          border-top: 1px dashed #ccc;
        }
        .info {
          margin-bottom: 15px;
          padding-bottom: 10px;
          border-bottom: 1px dashed #ccc;
        }
        .info div {
          display: flex;
          justify-content: space-between;
          margin-bottom: 3px;
        }
        .items {
          margin-bottom: 15px;
        }
        .items table {
          width: 100%;
          border-collapse: collapse;
        }
        .items th, .items td {
          text-align: left;
          padding: 5px 2px;
          border-bottom: 1px solid #eee;
        }
        .items th:last-child, .items td:last-child {
          text-align: right;
        }
        .items .bulk {
          font-size: 10px;
          color: ${primaryColor};
          font-style: italic;
        }
        .totals {
          border-top: 2px solid ${primaryColor};
          padding-top: 10px;
        }
        .totals div {
          display: flex;
          justify-content: space-between;
          margin-bottom: 5px;
        }
        .totals .grand-total {
          font-size: 16px;
          font-weight: bold;
          border-top: 1px solid #000;
          padding-top: 5px;
          margin-top: 5px;
          color: ${primaryColor};
        }
        .footer {
          text-align: center;
          margin-top: 20px;
          padding-top: 10px;
          border-top: 1px dashed #ccc;
          color: #666;
        }
        @media print {
          body { padding: 0; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        ${logoUrl ? `<img src="${logoUrl}" alt="Logo" class="logo" />` : ''}
        <h1>${shopName}</h1>
        ${tagline ? `<p class="tagline">${tagline}</p>` : ''}
        <p>${data.branchName}</p>
        ${data.branchAddress ? `<p>${data.branchAddress}</p>` : ''}
        <p class="header-message">${headerMsg}</p>
      </div>
      
      <div class="info">
        <div><span>Receipt:</span><span>${data.receiptNumber}</span></div>
        <div><span>Date:</span><span>${formatDate(data.date)}</span></div>
        <div><span>Cashier:</span><span>${data.cashierName}</span></div>
      </div>
      
      <div class="items">
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Qty</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            ${data.items.map(item => `
              <tr>
                <td>
                  ${item.name}
                  ${item.isBulk ? `<div class="bulk">@ ${formatPrice(item.unitPrice, symbol)} (Bulk)</div>` : ''}
                </td>
                <td>${item.quantity}</td>
                <td>${formatPrice(item.total, symbol)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      
      <div class="totals">
        <div><span>Subtotal:</span><span>${formatPrice(data.subtotal, symbol)}</span></div>
        <div><span>Tax:</span><span>${formatPrice(data.taxAmount, symbol)}</span></div>
        <div class="grand-total"><span>TOTAL:</span><span>${formatPrice(data.total, symbol)}</span></div>
        <div><span>Cash:</span><span>${formatPrice(data.cashReceived, symbol)}</span></div>
        <div><span>Change:</span><span>${formatPrice(data.change, symbol)}</span></div>
      </div>
      
      <div class="footer">
        <p>${footerMsg}</p>
      </div>
    </body>
    </html>
  `;

  // Create blob and download
  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  
  // Open in new window for printing/saving as PDF
  const printWindow = window.open(url, '_blank');
  if (printWindow) {
    printWindow.onload = () => {
      printWindow.print();
    };
  }
  
  URL.revokeObjectURL(url);
};
