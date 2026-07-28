import jsPDF from 'jspdf';
import { formatDateDisplay, formatAmount } from '@/lib/dateUtils';

export const LOGO_URL = 'https://media.base44.com/images/public/6a2682ee2374bcbebfc01176/2dfe06e06_generated_image.png';

const COMPANY = {
  name: 'Phaeton Trucking Services',
  address: 'Block 3 Lot 1, Pacita 2-B, Cyan St., Brgy. San Lazaro, City of San Pedro, Laguna, Philippines',
  phone: '0931-974-6058',
  email: 'operations@phaetontrucking.com',
  birReg: 'NON-VAT',
  tin: '274-546-612-00000',
};

const PAGE = { w: 210, h: 297, margin: 15 };

const dashedLine = (doc, y, x1, x2) => {
  doc.setLineDashPattern([0.6, 0.6], 0);
  doc.setLineWidth(0.2);
  doc.line(x1, y, x2, y);
  doc.setLineDashPattern([], 0);
};

const loadImageDataUrl = (url) =>
  new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 300;
        canvas.height = img.naturalHeight || 300;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });

const drawLogo = (doc, cx, y, imgData) => {
  const r = 5;
  if (imgData) {
    doc.addImage(imgData, 'PNG', cx - r, y, r * 2, r * 2);
  } else {
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.6);
    doc.circle(cx, y + r, r, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('PT', cx, y + r + 1.6, { align: 'center' });
  }
};

export async function generateBillingStatementPDF({ cycle, client, trips = [], soaDate, preparedBy }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  doc.setFont('helvetica');
  doc.setTextColor(0, 0, 0);
  const mL = PAGE.margin, mR = PAGE.w - PAGE.margin;
  const contentW = mR - mL;
  let y = PAGE.margin;

  // --- Period Covered & Warehouse (derived from trips) ---
  const dates = trips.map(t => t.delivery_date).filter(Boolean).sort();
  const periodCovered = dates.length
    ? `${formatDateDisplay(dates[0])} - ${formatDateDisplay(dates[dates.length - 1])}`
    : '—';
  const warehouses = [...new Set(trips.map(t => t.pickup_location).filter(Boolean))];
  const warehouse = warehouses.join(', ') || '—';

  const totalGross = trips.reduce((s, t) => s + (t.gross_rate || 0), 0);
  const totalTax = totalGross * 0.02;
  const amountDue = totalGross - totalTax;

  // --- 1. Centered circular logo badge (image, vector fallback) ---
  const cx = PAGE.w / 2;
  const logoData = await loadImageDataUrl(LOGO_URL);
  drawLogo(doc, cx, y, logoData);
  y += 12;

  // --- 2. Company name + address/phone/email centered ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(COMPANY.name, cx, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(COMPANY.address, cx, y);
  y += 4;
  doc.text(`${COMPANY.phone} | ${COMPANY.email}`, cx, y);
  y += 5;

  // --- 3. BIR Registration (left) + TIN (right) ---
  doc.setFontSize(8);
  doc.text(`BIR Registration: ${COMPANY.birReg}`, mL, y);
  doc.text(`TIN: ${COMPANY.tin}`, mR, y, { align: 'right' });
  y += 4;

  // --- 4. Dashed line ---
  dashedLine(doc, y, mL, mR);
  y += 6;

  // --- Bold centered title ---
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('BILLING STATEMENT / STATEMENT OF ACCOUNT', cx, y, { align: 'center' });
  y += 5;

  dashedLine(doc, y, mL, mR);
  y += 8;

  // --- 5. Statement metadata block ---
  doc.setFontSize(9);
  const metaH = 5.5;
  const metaColW = contentW / 2;

  const metaRow = (label, value, xi, highlight = false) => {
    doc.setFont('helvetica', 'normal');
    doc.text(label, xi, y);
    if (highlight) {
      const tw = doc.getTextWidth(value, { fontSize: 9 }) + 2;
      doc.setFillColor(240, 240, 240);
      doc.rect(xi + doc.getTextWidth(label, { fontSize: 9 }) + 1, y - 3.2, tw, 4.6, 'F');
    }
    doc.setFont('helvetica', 'bold');
    doc.text(value, xi + doc.getTextWidth(label, { fontSize: 9 }) + 1.5, y);
  };

  metaRow('Statement No.:', cycle?.cycle_name || '', mL, true);
  metaRow('SOA / Billing Date:', formatDateDisplay(soaDate), mL + metaColW);
  y += metaH;
  metaRow('Period Covered:', periodCovered, mL);
  metaRow('Credit Terms:', '30 Days', mL + metaColW);
  y += metaH + 3;

  // --- 6. Bill To section ---
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setLineDashPattern([0.4, 0.4], 0);
  doc.setLineWidth(0.2);
  doc.line(mL, y, mL + 28, y);
  doc.setLineDashPattern([], 0);
  doc.setFontSize(8);
  doc.text('Bill To:', mL, y);
  y += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(client?.client_name || '—', mL, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  if (client?.address) { doc.text(client.address, mL, y); y += 4.5; }
  if (client?.tin) { doc.text(`TIN: ${client.tin}`, mL, y); y += 4.5; }
  doc.text(`Warehouse: ${warehouse}`, mL, y);
  y += 7;

  // --- 7. Dashed line + Description of Services Rendered + dashed line ---
  dashedLine(doc, y, mL, mR);
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('Description of Services Rendered', cx, y, { align: 'center' });
  y += 4;
  dashedLine(doc, y, mL, mR);
  y += 6;

  // --- 8 & 9. Bordered 4-column trip table with multi-page support ---
  const colDate = 25;
  const colTruck = 25;
  const colAmount = 28;
  const colRoute = contentW - colDate - colTruck - colAmount;
  const colXs = [mL, mL + colDate, mL + colDate + colRoute, mL + colDate + colRoute + colTruck, mR];
  const rowH = 6;

  const drawBorders = (topY, bottomY) => {
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);
    doc.rect(mL, topY, contentW, bottomY - topY);
    for (let i = 1; i < colXs.length - 1; i++) doc.line(colXs[i], topY, colXs[i], bottomY);
  };

  const drawHeader = (topY) => {
    doc.setFillColor(0, 0, 0);
    doc.rect(mL, topY, contentW, rowH, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('DATE', colXs[0] + 2, topY + 4);
    doc.text('Route', colXs[1] + 2, topY + 4);
    doc.text('Truck Type', colXs[2] + 2, topY + 4);
    doc.text('Amount', colXs[3] + 2, topY + 4);
    // underline headers underline already implied by filled band; keep simple
    return topY + rowH;
  };

  let firstHeader = true;
  let tableTop = y;
  let rowY = y;
  let rowsStarted = false;
  const bottomLimit = PAGE.h - PAGE.margin - 40;

  const startTableBlock = () => {
    tableTop = rowY;
    rowY = drawHeader(tableTop);
    rowsStarted = true;
  };

  startTableBlock();

  const drawTripRow = (trip) => {
    if (rowY + rowH > bottomLimit) {
      // close current grid and continue on next page
      drawBorders(tableTop, rowY);
      doc.addPage();
      y = PAGE.margin;
      rowY = y;
      startTableBlock();
    }
    // row background border row
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(formatDateDisplay(trip.delivery_date), colXs[0] + 2, rowY + 4);
    const route = `${trip.pickup_location || ''} -> ${trip.delivery_location || ''}`;
    const routeTxt = route.length > 58 ? route.slice(0, 56) + '…' : route;
    doc.text(routeTxt, colXs[1] + 2, rowY + 4);
    doc.text(trip.truck_type || '—', colXs[2] + 2, rowY + 4);
    doc.text(`P${formatAmount(trip.gross_rate || 0)}`, colXs[3] + 2, rowY + 4);
    doc.line(colXs[0], rowY, colXs[4], rowY);
    rowY += rowH;
  };

  trips.forEach(drawTripRow);

  // --- NOTHING FOLLOWS row ---
  if (rowY + rowH > bottomLimit) {
    drawBorders(tableTop, rowY);
    doc.addPage();
    rowY = PAGE.margin;
    tableTop = rowY;
    rowY = drawHeader(tableTop);
  }
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.text('NOTHING FOLLOWS', colXs[1] + 2, rowY + 4);
  doc.text('---', colXs[0] + 2, rowY + 4);
  doc.text('---', colXs[2] + 2, rowY + 4);
  doc.text('---', colXs[3] + 2, rowY + 4);
  doc.line(colXs[0], rowY, colXs[4], rowY);
  rowY += rowH;

  drawBorders(tableTop, rowY);
  y = rowY + 6;

  // --- 10. Totals grid (spanning right two columns) ---
  const totX = colXs[2];
  const totW = colXs[4] - totX;

  const totalRow = (label, value, bold = false, fill = false) => {
    if (y + 7 > PAGE.h - PAGE.margin - 25) { doc.addPage(); y = PAGE.margin; }
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.2);
    if (fill) { doc.setFillColor(0, 0, 0); doc.rect(totX, y, totW, 7, 'F'); }
    else { doc.rect(totX, y, totW, 7, 'S'); }
    doc.setTextColor(fill ? 255 : 0, fill ? 255 : 0, fill ? 255 : 0);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(9);
    if (!fill) doc.rect(totX, y, totW, 7, 'S');
    doc.text(label, totX + 2, y + 4.5);
    doc.text(value, colXs[4] - 2, y + 4.5, { align: 'right' });
    y += 7;
  };

  totalRow('Total Gross ex VAT', `P${formatAmount(totalGross)}`);
  totalRow('Total Due', `P${formatAmount(totalGross)}`);
  totalRow('2% Withholding Tax', `P${formatAmount(totalTax)}`);
  totalRow('AMOUNT DUE', `P${formatAmount(amountDue)}`, true, true);

  // --- 11. Signature section ---
  y += 14;
  const sigW = 70;
  const leftSig = mL;
  const rightSig = mR - sigW;
  const today = formatDateDisplay(new Date().toISOString().split('T')[0]);

  const sigBlock = (label, name, dateLabel, dateVal, sx) => {
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(label, sx, y);
    y += 6;
    doc.setLineDashPattern([0.5, 0.5], 0);
    doc.setLineWidth(0.2);
    doc.line(sx, y, sx + sigW, y);
    doc.setLineDashPattern([], 0);
    y += 4;
    doc.setFont('helvetica', 'bold');
    if (name) doc.text(name, sx, y);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    y += 0;
  };

  // Prepared By (left) - filled in
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('Prepared By:', leftSig, y);
  y += 6;
  doc.setLineDashPattern([0.5, 0.5], 0);
  doc.line(leftSig, y, leftSig + sigW, y);
  doc.setLineDashPattern([], 0);
  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.text(preparedBy || '', leftSig, y);
  y += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`Date Prepared: ${today}`, leftSig, y);

  // Received By (right) - blank
  y -= 15;
  doc.text('Received By:', rightSig, y);
  y += 6;
  doc.setLineDashPattern([0.5, 0.5], 0);
  doc.line(rightSig, y, rightSig + sigW, y);
  doc.setLineDashPattern([], 0);
  y += 9;
  doc.text('Date Received: ____________________', rightSig, y);

  doc.save(`${cycle?.cycle_name || 'billing-statement'}.pdf`);
}