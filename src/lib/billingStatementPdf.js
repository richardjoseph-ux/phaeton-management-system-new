import jsPDF from 'jspdf';
import { formatDateDisplay, formatAmount } from '@/lib/dateUtils';

export const LOGO_URL = 'https://media.base44.com/images/public/6a2682ee2374bcbebfc01176/777bec924_LOGOMAIN.png';

const COMPANY = {
  name: 'Phaeton Trucking Services',
  address: 'Block 3 Lot 1, Pacita 2-B, Cyan St., Brgy. San Lazaro, City of San Pedro, Laguna, Philippines',
  phone: '0931-974-6058',
  email: 'operations@phaetontrucking.com',
  birReg: 'NON-VAT',
  tin: '274-546-612-00000',
};

// Primary dark-navy derived from app token --primary (hsl 214 64% 24%) ≈ rgb(22, 56, 100)
const NAVY = { r: 22, g: 56, b: 100 };
const MUTED_BG = { r: 244, g: 246, b: 249 };   // light gray header row
const BOX_BG = { r: 248, g: 250, b: 252 };     // subtle statement info box
const RULE = { r: 214, g: 220, b: 228 };       // light horizontal rule
const LIGHT_BORDER = { r: 226, g: 232, b: 240 };
const TEXT = { r: 30, g: 41, b: 59 };

const PAGE = { w: 210, h: 297, margin: 15 };

const solidLine = (doc, y, x1, x2, color = RULE) => {
  doc.setDrawColor(color.r, color.g, color.b);
  doc.setLineWidth(0.2);
  doc.line(x1, y, x2, y);
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
  const r = 6;
  if (imgData) {
    doc.addImage(imgData, 'PNG', cx - r, y, r * 2, r * 2);
  } else {
    doc.setDrawColor(NAVY.r, NAVY.g, NAVY.b);
    doc.setLineWidth(0.8);
    doc.circle(cx, y + r, r, 'S');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
    doc.text('PT', cx, y + r + 1.8, { align: 'center' });
  }
};

export async function generateBillingStatementPDF({ cycle, client, trips = [], soaDate, creditTerms, preparedBy }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  doc.setFont('helvetica');
  doc.setTextColor(TEXT.r, TEXT.g, TEXT.b);
  const mL = PAGE.margin, mR = PAGE.w - PAGE.margin;
  const contentW = mR - mL;
  const cx = PAGE.w / 2;
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

  // ===== HEADER =====
  const logoData = await loadImageDataUrl(LOGO_URL);
  drawLogo(doc, cx, y, logoData);
  y += 14;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(COMPANY.name, cx, y, { align: 'center' });
  y += 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(COMPANY.address, cx, y, { align: 'center' });
  y += 4;
  doc.text(`${COMPANY.phone} | ${COMPANY.email}`, cx, y, { align: 'center' });
  y += 5;
  solidLine(doc, y, mL, mR);

  // BIR / TIN row
  y += 5;
  doc.setFontSize(8);
  doc.setTextColor(TEXT.r, TEXT.g, TEXT.b);
  doc.text(`BIR Registration: ${COMPANY.birReg}`, mL, y);
  doc.text(`TIN: ${COMPANY.tin}`, mR, y, { align: 'right' });
  y += 5;
  solidLine(doc, y, mL, mR);
  y += 7;

  // ===== STATEMENT INFO + BILL TO BOX =====
  const boxTop = y - 2;
  doc.setFillColor(BOX_BG.r, BOX_BG.g, BOX_BG.b);
  doc.setDrawColor(LIGHT_BORDER.r, LIGHT_BORDER.g, LIGHT_BORDER.b);
  doc.setLineWidth(0.2);

  const colW = contentW / 2;
  const metaH = 6;
  let metaY = y;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('STATEMENT OF ACCOUNT', cx, metaY, { align: 'center' });
  metaY += 5;
  solidLine(doc, metaY, mL + contentW * 0.25, mL + contentW * 0.75);
  metaY += 6;

  doc.setFontSize(8.5);
  const metaRow = (label, value, xi) => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(label, xi, metaY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(TEXT.r, TEXT.g, TEXT.b);
    doc.text(String(value || '—'), xi + doc.getTextWidth(label, { fontSize: 8.5 }) + 1.5, metaY);
  };

  metaRow('Statement No.:', cycle?.cycle_name || '', mL + 2);
  metaRow('SOA / Billing Date:', formatDateDisplay(soaDate), mL + colW + 2);
  metaY += metaH;
  metaRow('Period Covered:', periodCovered, mL + 2);
  metaRow('Credit Terms:', creditTerms ? `${creditTerms} Days` : '—', mL + colW + 2);
  metaY += metaH + 2;

  // Bill To column
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(7.5);
  doc.text('BILL TO', mL + 2, metaY);
  metaY += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(TEXT.r, TEXT.g, TEXT.b);
  doc.text(client?.client_name || '—', mL + 2, metaY);
  metaY += 5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  if (client?.address) { doc.text(client.address, mL + 2, metaY); metaY += 4.2; }
  if (client?.tin) { doc.text(`TIN: ${client.tin}`, mL + 2, metaY); metaY += 4.2; }
  doc.text(`Warehouse: ${warehouse}`, mL + 2, metaY);
  metaY += 4.2;

  const boxBottom = metaY + 2;
  doc.setDrawColor(LIGHT_BORDER.r, LIGHT_BORDER.g, LIGHT_BORDER.b);
  doc.setLineWidth(0.2);
  doc.roundedRect(mL, boxTop, contentW, boxBottom - boxTop, 1.5, 1.5, 'S');
  y = boxBottom + 6;

  // ===== TABLE =====
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(TEXT.r, TEXT.g, TEXT.b);
  doc.text('Description of Services Rendered', cx, y, { align: 'center' });
  y += 4;
  solidLine(doc, y, mL, mR);
  y += 5;

  const colDate = 25;
  const colTruck = 25;
  const colAmount = 28;
  const colRoute = contentW - colDate - colTruck - colAmount;
  const colXs = [mL, mL + colDate, mL + colDate + colRoute, mL + colDate + colRoute + colTruck, mR];
  const rowH = 6;
  const bottomLimit = PAGE.h - PAGE.margin - 40;

  const drawHeader = (topY) => {
    doc.setFillColor(MUTED_BG.r, MUTED_BG.g, MUTED_BG.b);
    doc.rect(mL, topY, contentW, rowH, 'F');
    doc.setTextColor(TEXT.r, TEXT.g, TEXT.b);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('DATE', colXs[0] + 2, topY + 4);
    doc.text('Route', colXs[1] + 2, topY + 4);
    doc.text('Truck Type', colXs[2] + 2, topY + 4);
    doc.text('Amount', colXs[3] + 2, topY + 4);
    doc.setDrawColor(LIGHT_BORDER.r, LIGHT_BORDER.g, LIGHT_BORDER.b);
    doc.setLineWidth(0.2);
    doc.line(colXs[0], topY + rowH, colXs[4], topY + rowH);
    return topY + rowH;
  };

  const drawBorders = (topY, bottomY) => {
    doc.setDrawColor(LIGHT_BORDER.r, LIGHT_BORDER.g, LIGHT_BORDER.b);
    doc.setLineWidth(0.2);
    doc.rect(mL, topY, contentW, bottomY - topY);
    for (let i = 1; i < colXs.length - 1; i++) doc.line(colXs[i], topY, colXs[i], bottomY);
  };

  let tableTop = y;
  let rowY = drawHeader(tableTop);

  const drawTripRow = (trip) => {
    if (rowY + rowH > bottomLimit) {
      drawBorders(tableTop, rowY);
      doc.addPage();
      y = PAGE.margin;
      tableTop = y;
      rowY = drawHeader(tableTop);
    }
    doc.setTextColor(TEXT.r, TEXT.g, TEXT.b);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(formatDateDisplay(trip.delivery_date), colXs[0] + 2, rowY + 4);
    const route = `${trip.pickup_location || ''} -> (${trip.delivery_location || ''}) ${trip.delivery_code || ''}`;
    const routeTxt = route.length > 70 ? route.slice(0, 68) + '…' : route;
    doc.text(routeTxt, colXs[1] + 2, rowY + 4);
    doc.text(trip.truck_type || '—', colXs[2] + 2, rowY + 4);
    doc.text(`P${formatAmount(trip.gross_rate || 0)}`, colXs[3] + 2, rowY + 4);
    doc.setDrawColor(240, 240, 240);
    doc.setLineWidth(0.1);
    doc.line(colXs[0], rowY, colXs[4], rowY);
    rowY += rowH;
  };

  trips.forEach(drawTripRow);

  // NOTHING FOLLOWS
  if (rowY + rowH > bottomLimit) {
    drawBorders(tableTop, rowY);
    doc.addPage();
    rowY = PAGE.margin;
    tableTop = rowY;
    rowY = drawHeader(tableTop);
  }
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('NOTHING FOLLOWS', colXs[1] + 2, rowY + 4);
  doc.text('---', colXs[0] + 2, rowY + 4);
  doc.text('---', colXs[2] + 2, rowY + 4);
  doc.text('---', colXs[3] + 2, rowY + 4);
  doc.setDrawColor(240, 240, 240);
  doc.setLineWidth(0.1);
  doc.line(colXs[0], rowY, colXs[4], rowY);
  rowY += rowH;

  drawBorders(tableTop, rowY);
  y = rowY + 8;

  // ===== TOTALS =====
  const totX = colXs[2];
  const totW = colXs[4] - totX;

  const totalRow = (label, value, highlight = false) => {
    if (y + 8 > PAGE.h - PAGE.margin - 40) { doc.addPage(); y = PAGE.margin; }
    doc.setDrawColor(LIGHT_BORDER.r, LIGHT_BORDER.g, LIGHT_BORDER.b);
    doc.setLineWidth(0.2);
    if (highlight) {
      doc.setFillColor(NAVY.r, NAVY.g, NAVY.b);
      doc.rect(totX, y, totW, 8, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
    } else {
      doc.rect(totX, y, totW, 8, 'S');
      doc.setTextColor(TEXT.r, TEXT.g, TEXT.b);
      doc.setFont('helvetica', 'normal');
    }
    doc.setFontSize(9);
    doc.text(label, totX + 2, y + 5);
    doc.text(`P${formatAmount(value)}`, colXs[4] - 2, y + 5, { align: 'right' });
    y += 8;
  };

  totalRow('Total Gross ex VAT', totalGross);
  totalRow('Total Due', totalGross);
  totalRow('2% Withholding Tax', totalTax);
  totalRow('AMOUNT DUE', amountDue, true);

  // ===== SIGNATURE BLOCK =====
  if (y + 28 > PAGE.h - PAGE.margin) { doc.addPage(); y = PAGE.margin; }
  if (y < PAGE.h - PAGE.margin - 32) y = PAGE.h - PAGE.margin - 30;
  else y += 14;

  const sigW = 75;
  const leftSig = mL;
  const rightSig = mR - sigW;
  const today = formatDateDisplay(new Date().toISOString().split('T')[0]);

  const sigBlock = (label, name, dateLabel, dateVal, sx) => {
    doc.setTextColor(TEXT.r, TEXT.g, TEXT.b);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.text(label, sx, y);
    y += 6;
    doc.setDrawColor(TEXT.r, TEXT.g, TEXT.b);
    doc.setLineWidth(0.2);
    doc.line(sx, y, sx + sigW, y);
    y += 4;
    doc.setFont('helvetica', 'bold');
    if (name) doc.text(name, sx, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(dateLabel, sx, y);
  };

  const sigStartY = y;
  sigBlock('Prepared By:', preparedBy || '', `Date Prepared: ${today}`, '', leftSig);
  y = sigStartY;
  sigBlock('Received By:', '', 'Date Received: ______________', '', rightSig);

  doc.save(`${cycle?.cycle_name || 'billing-statement'}.pdf`);
}