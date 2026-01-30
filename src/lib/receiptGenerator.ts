// Receipt generation utilities for thermal and PDF printing

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

// Generate thermal printer receipt (ESC/POS format)
export const printThermalReceipt = async (data: ReceiptData): Promise<void> => {
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
  lines.push(center('SUPERPOS'));
  lines.push(center(data.branchName));
  if (data.branchAddress) {
    lines.push(center(data.branchAddress));
  }
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
    const total = `$${item.total.toFixed(2)}`.padStart(10);
    lines.push(`${name} ${qty} ${total}`);
    if (item.isBulk) {
      lines.push(`  @ $${item.unitPrice.toFixed(2)} (BULK)`);
    }
  });
  
  lines.push(thinSeparator);
  
  // Totals
  lines.push(`${'Subtotal:'.padEnd(30)}$${data.subtotal.toFixed(2).padStart(10)}`);
  lines.push(`${'Tax:'.padEnd(30)}$${data.taxAmount.toFixed(2).padStart(10)}`);
  lines.push(separator);
  lines.push(`${'TOTAL:'.padEnd(30)}$${data.total.toFixed(2).padStart(10)}`);
  lines.push(`${'Cash:'.padEnd(30)}$${data.cashReceived.toFixed(2).padStart(10)}`);
  lines.push(`${'Change:'.padEnd(30)}$${data.change.toFixed(2).padStart(10)}`);
  
  lines.push(separator);
  lines.push(center('Thank you for your purchase!'));
  lines.push(center('Please come again'));
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
          border-bottom: 2px solid #000;
        }
        .header h1 {
          font-size: 18px;
          margin-bottom: 5px;
        }
        .header p {
          font-size: 11px;
          color: #666;
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
          color: #666;
          font-style: italic;
        }
        .totals {
          border-top: 2px solid #000;
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
        <h1>SUPERPOS</h1>
        <p>${data.branchName}</p>
        ${data.branchAddress ? `<p>${data.branchAddress}</p>` : ''}
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
                  ${item.isBulk ? `<div class="bulk">@ $${item.unitPrice.toFixed(2)} (Bulk)</div>` : ''}
                </td>
                <td>${item.quantity}</td>
                <td>$${item.total.toFixed(2)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      
      <div class="totals">
        <div><span>Subtotal:</span><span>$${data.subtotal.toFixed(2)}</span></div>
        <div><span>Tax:</span><span>$${data.taxAmount.toFixed(2)}</span></div>
        <div class="grand-total"><span>TOTAL:</span><span>$${data.total.toFixed(2)}</span></div>
        <div><span>Cash:</span><span>$${data.cashReceived.toFixed(2)}</span></div>
        <div><span>Change:</span><span>$${data.change.toFixed(2)}</span></div>
      </div>
      
      <div class="footer">
        <p>Thank you for your purchase!</p>
        <p>Please come again</p>
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
