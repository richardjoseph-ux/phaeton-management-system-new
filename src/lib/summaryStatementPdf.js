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

const NAVY = { r: 22, g: 56, b: 100 };
const MUTED_BG = { r: 244, g: 246, b: 249 };
const RULE = { r: 214, g: 220, b: 228 };
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
  const r = 7;
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

export async function generateSummaryStatementPDF({ groups = [], client, preparedBy }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  doc.setFont('helvetica');
  doc.setTextColor(TEXT.r, TEXT.g, TEXT.b);
  const mL = PAGE.margin, mR = PAGE.w - PAGE.margin;
  const contentW = mR - mL;
  const cx = PAGE.w / 2;
  let y = PAGE.margin;

  // Consolidated trip list sorted by delivery_date ascending, tagged with cycle_name
  const allTrips = groups
    .flatMap(g => (g.trips || []).map(t => ({ ...t, _cycle_name: g.cycle?.cycle_name || '—' })))
    .sort((a, b) => (a.delivery_date || '').localeCompare(b.delivery_date || ''));

  const dates = allTrips.map(t => t.delivery_date).filter(Boolean).sort();
  const periodCovered = dates.length
    ? `${formatDateDisplay(dates[0])} - ${formatDateDisplay(dates[dates.length - 1])}`
    : '—';
  const warehouses = [...new Set(allTrips.map(t => t.pickup_location).filter(Boolean))];
  const warehouse = warehouses.join(', ') || '—';
  const soaDates = groups.map(g => g.cycle?.billing_received_date).filter(Boolean);
  const soaDate = soaDates.length ? soaDates.join(', ') : '—';

  // ===== HEADER =====
  const logoData = await loadImageDataUrl(LOGO_URL);
  drawLogo(doc, cx, y, logoData);
  y += 18;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text(COMPANY.name.toUpperCase(), cx, y, { align: 'center' });
  y += 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(COMPANY.address, cx, y, { align: 'center' });
  y += 4;
  doc.text(`${COMPANY.phone} | ${COMPANY.email}`, cx, y, { align: 'center' });
  y += 5;
  solidLine(doc, y, mL, mR);

  y += 5;
  doc.setFontSize(8);
  doc.setTextColor(TEXT.r, TEXT.g, TEXT.b);
  doc.text(`BIR Registration: ${COMPANY.birReg}`, mL, y);
  doc.text(`TIN: ${COMPANY.tin}`, mR, y, { align: 'right' });
  y += 5;
  solidLine(doc, y, mL, mR);
  y += 7;

  // ===== TITLE =====
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(TEXT.r, TEXT.g, TEXT.b);
  doc.text('BILLING STATEMENT / STATEMENT OF ACCOUNT — SUMMARY', cx, y, { align: 'center' });
  y += 4;
  solidLine(doc, y, mL, mR);
  y += 6;

  // ===== INFO BOX =====
  const boxTop = y;
  let metaY = y + 5;
  const leftX = mL + 3;
  const rightX = mL + contentW / 2 + 3;

  const drawField = (label, value, xi) => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.setFontSize(7.5);
    doc.text(label, xi, metaY);
    metaY += 4.5;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(TEXT.r, TEXT.g, TEXT.b);
    doc.setFontSize(9.5);
    doc.text(String(value || '—'), xi, metaY);
    metaY += 6;
  };

  const startY = metaY;
  drawField('Statement No.', groups.map(g => g.cycle?.cycle_name).filter(Boolean).join(', ') || '—', leftX);
  const afterLeft = metaY;
  metaY = startY;
  drawField('SOA / Billing Date', soaDate, rightX);
  const afterRight = metaY;
  metaY = Math.max(afterLeft, afterRight);
  drawField('Period Covered', periodCovered, leftX);
  drawField('Credit Terms', client?.credit_terms ? `${client.credit_terms} Days` : '—', rightX);

  // Bill To
  metaY += 2;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.setFontSize(7.5);
  doc.text('BILL TO', leftX, metaY);
  metaY += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(TEXT.r, TEXT.g, TEXT.b);
  doc.text(client?.client_name || '—', leftX, metaY);
  metaY += 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  if (client?.address) { doc.text(client.address, leftX, metaY); metaY += 4.4; }
  if (client?.tin) { doc.text(`TIN: ${client.tin}`, leftX, metaY); metaY += 4.4; }
  doc.text(`Warehouse: ${warehouse}`, leftX, metaY);
  metaY += 4.4;

  const boxBottom = metaY + 2;
  doc.setDrawColor(LIGHT_BORDER.r, LIGHT_BORDER.g, LIGHT_BORDER.b);
  doc.setLineWidth(0.2);
  doc.roundedRect(mL, boxTop, contentW, boxBottom - boxTop, 1.5, 1.5, 'S');
  y = boxBottom + 6;

  // ===== TABLE =====
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(TEXT.r, TEXT.g, TEXT.b);
  doc.text('DESCRIPTION OF SERVICES RENDERED', cx, y, { align: 'center' });
  y += 4;
  solidLine(doc, y, mL, mR);
  y += 5;

  const colDate = 25;
  const colBS = 35;
  const colDR = 25;
  const colAmount = 28;
  const colRoute = contentW - colDate - colBS - colDR - colAmount;
  const colXs = [mL, mL + colDate, mL + colDate + colBS, mL + colDate + colBS + colDR, mL + colDate + colBS + colDR + colRoute, mR];
  const rowH = 6;
  const bottomLimit = PAGE.h - PAGE.margin - 40;
  const routeMaxW = colRoute - 4;
  const bsMaxW = colBS - 4;

  const drawHeader = (topY) => {
    doc.setFillColor(MUTED_BG.r, MUTED_BG.g, MUTED_BG.b);
    doc.rect(mL, topY, contentW, rowH, 'F');
    doc.setTextColor(TEXT.r, TEXT.g, TEXT.b);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('DATE', colXs[0] + 2, topY + 4);
    doc.text('BILLING STATEMENT', colXs[1] + 2, topY + 4);
    doc.text('DR NO.', colXs[2] + 2, topY + 4);
    doc.text('ROUTE', colXs[3] + 2, topY + 4);
    doc.text('AMOUNT', colXs[4] + 2, topY + 4);
    doc.setDrawColor(LIGHT_BORDER.r, LIGHT_BORDER.g, LIGHT_BORDER.b);
    doc.setLineWidth(0.2);
    doc.line(colXs[0], topY + rowH, colXs[5], topY + rowH);
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
    const route = trip.delivery_code || '—';
    const routeLines = doc.splitTextToSize(route, routeMaxW);
    const bsLines = doc.splitTextToSize(trip._cycle_name, bsMaxW);
    const thisH = Math.max(rowH, routeLines.length * 4 + 2.5, bsLines.length * 4 + 2.5);
    if (rowY + thisH > bottomLimit) {
      drawBorders(tableTop, rowY);
      doc.addPage();
      y = PAGE.margin;
      tableTop = y;
      rowY = drawHeader(tableTop);
    }
    doc.setTextColor(TEXT.r, TEXT.g, TEXT.b);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    const baseY = rowY + 4;
    doc.text(doc.splitTextToSize(formatDateDisplay(trip.delivery_date), colDate - 4), colXs[0] + 2, baseY);
    doc.text(bsLines, colXs[1] + 2, baseY);
    doc.text(doc.splitTextToSize(trip.dr_number || '—', colDR - 4), colXs[2] + 2, baseY);
    doc.text(routeLines, colXs[3] + 2, baseY);
    doc.text(`P${formatAmount(trip.gross_rate || 0)}`, colXs[4] + 2, baseY);
    doc.setDrawColor(240, 240, 240);
    doc.setLineWidth(0.1);
    doc.line(colXs[0], rowY, colXs[5], rowY);
    rowY += thisH;
  };

  allTrips.forEach(drawTripRow);

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
  doc.text('NOTHING FOLLOWS', colXs[3] + 2, rowY + 4);
  doc.text('---', colXs[0] + 2, rowY + 4);
  doc.text('---', colXs[1] + 2, rowY + 4);
  doc.text('---', colXs[2] + 2, rowY + 4);
  doc.text('---', colXs[4] + 2, rowY + 4);
  doc.setDrawColor(240, 240, 240);
  doc.setLineWidth(0.1);
  doc.line(colXs[0], rowY, colXs[5], rowY);
  rowY += rowH;

  drawBorders(tableTop, rowY);
  y = rowY + 8;

  // ===== PER-STATEMENT TOTALS =====
  const totX = mR - 80;
  const totW = 80;
  const totH = 5;

  const totalLine = (label, value, bold = false) => {
    if (y + totH > PAGE.h - PAGE.margin - 30) { doc.addPage(); y = PAGE.margin; }
    doc.setDrawColor(LIGHT_BORDER.r, LIGHT_BORDER.g, LIGHT_BORDER.b);
    doc.setLineWidth(0.2);
    doc.rect(totX, y, totW, totH, 'S');
    doc.setTextColor(TEXT.r, TEXT.g, TEXT.b);
    doc.setFont('helvetica', bold ? 'bold' : 'normal');
    doc.setFontSize(8.5);
    doc.text(label, totX + 4, y + 3.7);
    doc.text(`P${formatAmount(value)}`, colXs[5] - 4, y + 3.7, { align: 'right' });
    y += totH;
  };

  groups.forEach((g) => {
    const totalGross = (g.trips || []).reduce((s, t) => s + (t.gross_rate || 0), 0);
    const totalTax = totalGross * 0.02;
    const amountDue = totalGross - totalTax;
    y += 2;
    totalLine((g.cycle?.cycle_name || '—').toUpperCase(), totalGross, true);
    totalLine('2% WITH HOLDING TAX (IF APPLICABLE)', totalTax);
    totalLine('TOTAL (VAT INC, IF APPLICABLE)', amountDue, true);
    y += 3;
  });

  // ===== SIGNATURE BLOCK =====
  if (y + 28 > PAGE.h - PAGE.margin) { doc.addPage(); y = PAGE.margin; }
  y += 8;

  const sigW = 75;
  const leftSig = mL;
  const rightSig = mR - sigW;
  const today = formatDateDisplay(new Date().toISOString().split('T')[0]);

  const sigBlock = (label, name, dateLabel, sx) => {
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
  sigBlock('Prepared By:', preparedBy || '', `Date Prepared: ${today}`, leftSig);
  y = sigStartY;
  sigBlock('Received By:', '', 'Date Received: ______________', rightSig);

  doc.save(`summary-${groups.map(g => g.cycle?.cycle_name).filter(Boolean).join('_') || 'billing'}.pdf`);
}