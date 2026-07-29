import jsPDF from 'jspdf';
import { formatDateDisplay, formatAmount } from '@/lib/dateUtils';

const COMPANY = {
  name: 'Phaeton Trucking Services',
  addressLines: [
    'Block 3 Lot 1, Pacita 2-B, Cyan St.,',
    'Brgy. San Lorenzo Ruiz, City of San Pedro',
    'Laguna, Philippines',
  ],
  tin: '274-546-612-00000',
  phone: '0931-974-6058',
  email: 'Operations@phaetontrucking.com',
};

const BLACK = { r: 0, g: 0, b: 0 };
const LINK_BLUE = { r: 0, g: 0, b: 238 };

const LOGO_URL = 'https://media.base44.com/images/public/6a2682ee2374bcbebfc01176/777bec924_LOGOMAIN.png';
const NAVY = { r: 22, g: 56, b: 100 };
const MUTED_BG = { r: 244, g: 246, b: 249 };
const LIGHT_BORDER = { r: 226, g: 232, b: 240 };

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

const PAGE = { w: 210, h: 297, margin: 12 };
// Column widths (mm). Sum == content width (186).
const COLS = [8, 24, 22, 22, 30, 30, 26, 24];
const HEADERS = ['NO.', 'DATE', 'DR NO.', 'VEHICLE TYPE', 'RATE', 'FUEL SUBSIDY'];
const FULL_COLS = [0, 1, 2, 3, 6, 7];
const ROW_H = 6;
const TOTAL_ROWS = 20;
const TEXT_COLOR = { r: 30, g: 41, b: 59 };
const MUTED = { r: 100, g: 116, b: 139 };

const num = (v, fallback = 0) => (typeof v === 'number' && isFinite(v) ? v : fallback);
const line = (doc, x1, y, x2, color = LIGHT_BORDER, w = 0.2) => {
  const c = color && typeof color === 'object' ? color : LIGHT_BORDER;
  doc.setDrawColor(num(c.r, 226), num(c.g, 232), num(c.b, 240));
  doc.setLineWidth(num(w, 0.2));
  doc.line(num(x1), num(y), num(x2), num(y));
};

export async function generatePayrollPDF(payload) {
  const {
    trips = [],
    ownerLabel, plateLabel, cycleNames = [],
    periodStart, periodEnd, billingDate, clientName,
    totalGross, totalTax, totalAdmin, totalCharge,
    totalReimburse, totalFuelSubsidy, grandTotal, notes, fileName,
  } = payload;

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const mL = PAGE.margin, mR = PAGE.w - PAGE.margin;
  const contentW = mR - mL;
  let y = PAGE.margin;

  const logoData = await loadImageDataUrl(LOGO_URL);

  // ===== HEADER: logo (top-left) + info grid =====
  const logoSize = 14;
  if (logoData) {
    try { doc.addImage(logoData, 'PNG', mL, y, logoSize, logoSize); } catch { /* ignore */ }
  }
  // company name (right of logo, blue)
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(LINK_BLUE.r, LINK_BLUE.g, LINK_BLUE.b);
  doc.text(COMPANY.name.toUpperCase(), mL + logoSize + 3, y + logoSize / 2 + 1.5);
  y += logoSize + 2;

  const colCW = 92;            // company contact column
  const colLW = 36;            // labels column
  const colVW = contentW - colCW - colLW;
  const xC = mL + colCW;
  const xL = xC + colLW;
  const gridTop = y;
  const rowH = 7.5;

  const contactRows = [
    { text: COMPANY.addressLines[0] },
    { text: COMPANY.addressLines[1] },
    { text: COMPANY.addressLines[2] },
    { label: 'TIN: ', value: COMPANY.tin },
    { label: 'Mobile #: ', value: COMPANY.phone },
    { label: 'E-mail: ', value: COMPANY.email, link: true },
  ];
  const infoPairs = [
    ['Owner Name', ownerLabel || '—'],
    ['Plate #', plateLabel || '—'],
    ['BS/SOA#', cycleNames.length ? cycleNames.join(' ') : '—'],
    ['Payroll Period', periodStart ? `${formatDateDisplay(periodStart)} - ${formatDateDisplay(periodEnd)}` : '—'],
    ['Date', formatDateDisplay(billingDate)],
    ['Company', clientName || '—'],
  ];

  doc.setFontSize(8);
  for (let i = 0; i < contactRows.length; i++) {
    const ry = gridTop + i * rowH;
    const midY = ry + rowH / 2 + 1.2;

    // contact (left column)
    const c = contactRows[i];
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(BLACK.r, BLACK.g, BLACK.b);
    if (c.text) {
      doc.text(c.text, mL + 2, midY);
    } else {
      doc.setFont('helvetica', 'bold');
      doc.text(c.label, mL + 2, midY);
      const lw = doc.getTextDimensions(c.label).w;
      doc.setFont('helvetica', 'normal');
      if (c.link) {
        doc.setTextColor(LINK_BLUE.r, LINK_BLUE.g, LINK_BLUE.b);
        const ex = mL + 2 + lw;
        doc.text(c.value, ex, midY);
        const vw = doc.getTextDimensions(c.value).w;
        doc.setDrawColor(LINK_BLUE.r, LINK_BLUE.g, LINK_BLUE.b);
        doc.setLineWidth(0.15);
        doc.line(ex, midY + 0.5, ex + vw, midY + 0.5);
      } else {
        doc.text(c.value, mL + 2 + lw, midY);
      }
    }

    // label (right-aligned)
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(BLACK.r, BLACK.g, BLACK.b);
    doc.text(infoPairs[i][0] + ':', xL - 2, midY, { align: 'right' });

    // value
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(TEXT_COLOR.r, TEXT_COLOR.g, TEXT_COLOR.b);
    doc.text(doc.splitTextToSize(String(infoPairs[i][1]), colVW - 4), xL + 2, midY);
  }

  const gridBottom = gridTop + contactRows.length * rowH;

  y = gridBottom + 3;
  y += 4;

  // ===== TABLE =====
  const colX = [mL];
  COLS.forEach((w, i) => colX.push(colX[i] + w));

  const drawHeader = (topY) => {
    const r1H = 4, r2H = 4, totalH = r1H + r2H;
    doc.setFillColor(MUTED_BG.r, MUTED_BG.g, MUTED_BG.b);
    doc.rect(mL, topY, contentW, totalH, 'F');

    doc.setTextColor(TEXT_COLOR.r, TEXT_COLOR.g, TEXT_COLOR.b);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);

    FULL_COLS.forEach((ci, i) => {
      const x = colX[ci], w = COLS[ci];
      doc.text(HEADERS[i], x + w / 2, topY + totalH / 2 + 1, { align: 'center' });
    });

    const destX = colX[4], destW = COLS[4] + COLS[5];
    doc.text('DESTINATION', destX + destW / 2, topY + r1H / 2 + 1, { align: 'center' });
    doc.text('FROM', colX[4] + COLS[4] / 2, topY + r1H + r2H / 2 + 1, { align: 'center' });
    doc.text('TO', colX[5] + COLS[5] / 2, topY + r1H + r2H / 2 + 1, { align: 'center' });

    const bottomY = topY + totalH;
    line(doc, mL, topY, mR);
    line(doc, mL, bottomY, mR);
    line(doc, colX[4], topY + r1H, colX[6], topY + r1H);
    for (let i = 0; i < colX.length; i++) {
      line(doc, colX[i], topY, colX[i], bottomY);
    }
    line(doc, mR, topY, mR, bottomY);
    return bottomY;
  };

  const drawRow = (topY, vals, opts = {}) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(TEXT_COLOR.r, TEXT_COLOR.g, TEXT_COLOR.b);
    COLS.forEach((w, ci) => {
      const x = colX[ci];
      const v = vals[ci] != null ? String(vals[ci]) : '';
      const baseY = topY + 4;
      if (ci === 0) doc.text(v, x + w / 2, baseY, { align: 'center' });
      else if (ci === 6 || ci === 7) doc.text(v, x + w - 2, baseY, { align: 'right' });
      else doc.text(doc.splitTextToSize(v, w - 4), x + 2, baseY);
    });
  };

  const bottomLimit = PAGE.h - 55;
  let tableTop = y;
  let rowY = drawHeader(tableTop);

  trips.forEach((trip, i) => {
    if (rowY + ROW_H > bottomLimit) {
      doc.addPage();
      tableTop = PAGE.margin;
      rowY = drawHeader(tableTop);
    }
    drawRow(rowY, [
      i + 1,
      formatDateDisplay(trip.delivery_date),
      trip.dr_number || '—',
      trip.truck_type || '—',
      trip.pickup_location || '—',
      trip.delivery_location || '—',
      `P${formatAmount(trip.gross_rate || 0)}`,
      trip._fuelSubsidy > 0 ? `P${formatAmount(trip._fuelSubsidy)}` : '—',
    ]);
    rowY += ROW_H;
  });

  // Filler rows up to TOTAL_ROWS
  const dataCount = trips.length;
  if (dataCount < TOTAL_ROWS) {
    for (let i = dataCount; i < TOTAL_ROWS; i++) {
      drawRow(rowY, []);
      rowY += ROW_H;
    }
  }

  // Separator row with dashes
  line(doc, mL, rowY, mR);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.text('---', mL + 2, rowY + 4);
  doc.text('---', mR - 2, rowY + 4, { align: 'right' });
  rowY += ROW_H;
  line(doc, mL, rowY, mR);

  y = rowY + 4;

  // ===== NOTES / BREAKDOWN CELL =====
  const notesText = notes && notes.trim() ? notes : 'No additional charges or reimbursements.';
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  const notesLines = doc.splitTextToSize(notesText, contentW - 6);
  const notesH = Math.max(12, notesLines.length * 3.4 + 6);
  doc.setDrawColor(LIGHT_BORDER.r, LIGHT_BORDER.g, LIGHT_BORDER.b);
  doc.setLineWidth(0.2);
  doc.rect(mL, y, contentW, notesH);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.text('NOTES / BREAKDOWN:', mL + 3, y + 4.5);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(TEXT_COLOR.r, TEXT_COLOR.g, TEXT_COLOR.b);
  doc.text(notesLines, mL + 3, y + 8);
  y += notesH + 4;

  // ===== TOTALS BLOCK (right-aligned 2-col) =====
  const totW = 70;
  const totX = mR - totW;
  const totH = 6.5;
  const rows = [
    ['TOTAL RATE', `P${formatAmount(totalGross)}`, false],
    ['2% WITHHOLDING TAX', `-P${formatAmount(totalTax)}`, false],
    ['6% ADMIN FEE', `-P${formatAmount(totalAdmin)}`, false],
    ['CHARGE/PENALTY', `-P${formatAmount(totalCharge)}`, false],
    ['REIMBURSE', `+P${formatAmount(totalReimburse)}`, false],
    ['FUEL SUBSIDY', `+P${formatAmount(totalFuelSubsidy)}`, false],
    ['GRAND TOTAL', `P${formatAmount(grandTotal)}`, true],
  ];

  rows.forEach(([label, val, highlight]) => {
    doc.setDrawColor(LIGHT_BORDER.r, LIGHT_BORDER.g, LIGHT_BORDER.b);
    doc.setLineWidth(0.2);
    if (highlight) {
      doc.setFillColor(NAVY.r, NAVY.g, NAVY.b);
      doc.rect(totX, y, totW, totH, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
    } else {
      doc.rect(totX, y, totW, totH, 'S');
      doc.setTextColor(TEXT_COLOR.r, TEXT_COLOR.g, TEXT_COLOR.b);
      doc.setFont('helvetica', 'normal');
    }
    doc.setFontSize(8.5);
    doc.text(label, totX + 3, y + 4.5);
    doc.text(val, totX + totW - 3, y + 4.5, { align: 'right' });
    y += totH;
  });

  // ===== SIGNATURE BLOCK =====
  y += 12;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(TEXT_COLOR.r, TEXT_COLOR.g, TEXT_COLOR.b);
  doc.text('Received by:', mL, y);

  const sl = 32, gap = 8;
  const labels = ['Name', 'Sign', 'Date'];
  let sx = mL + 26;
  labels.forEach((lb) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(`${lb}:`, sx, y);
    line(doc, sx + 9, y + 0.5, sx + 9 + sl, TEXT_COLOR, 0.3);
    sx += 9 + sl + gap;
  });

  // ===== PAGE NUMBERS =====
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    doc.text(`Page ${p} of ${pageCount}`, mR, PAGE.h - 4, { align: 'right' });
  }

  doc.save(fileName || 'Payroll.pdf');
}