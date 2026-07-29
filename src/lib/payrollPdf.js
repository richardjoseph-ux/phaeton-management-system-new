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

const LOGO_URL = 'https://media.base44.com/images/public/6a2682ee2374bcbebfc01176/777bec924_LOGOMAIN.png';

// Light, modern palette
const NAVY = { r: 22, g: 56, b: 100 };
const NAVY_SOFT = { r: 240, g: 243, b: 249 };
const INK = { r: 38, g: 49, b: 66 };
const MUTED = { r: 120, g: 134, b: 156 };
const LIGHT = { r: 228, g: 234, b: 242 };
const HAIR = { r: 235, g: 239, b: 245 };
const ZEBRA = { r: 249, g: 251, b: 253 };
const WHITE = { r: 255, g: 255, b: 255 };

const PAGE = { w: 210, h: 297, margin: 16 };
// NO, DATE, DR NO, VEHICLE, FROM, TO, RATE, FUEL SUB — sums to content width (178)
const COLS = [8, 22, 26, 18, 28, 28, 26, 22];
const HEADERS = ['NO.', 'DATE', 'DR NO.', 'VEHICLE', 'RATE', 'FUEL SUB.'];
const FULL_COLS = [0, 1, 2, 3, 6, 7];
const ROW_H = 8.5;
const FILLER_ROWS = 12;

const num = (v, f = 0) => (typeof v === 'number' && isFinite(v) ? v : f);
// peso prefix as plain "P" (the ₱ glyph is not in jsPDF's default font)
const peso = (n) => `P${formatAmount(num(n))}`;

const loadImageDataUrl = (url) =>
  new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 300;
        canvas.height = img.naturalHeight || 300;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/png'));
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });

const setTxt = (doc, c) => doc.setTextColor(num(c.r), num(c.g), num(c.b));
const setFill = (doc, c) => doc.setFillColor(num(c.r), num(c.g), num(c.b));
const setDraw = (doc, c, w = 0.2) => {
  doc.setDrawColor(num(c.r), num(c.g), num(c.b));
  doc.setLineWidth(num(w, 0.2));
};

export async function generatePayrollPDF(payload) {
  const {
    trips = [],
    ownerLabel, plateLabel, cycleNames = [],
    periodStart, periodEnd, billingDate, clientName,
    totalGross, totalAdmin, totalCharge,
    totalReimburse, totalFuelSubsidy, grandTotal, notes, fileName,
  } = payload;

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const mL = PAGE.margin, mR = PAGE.w - PAGE.margin;
  const contentW = mR - mL;
  let y = PAGE.margin;

  const logoData = await loadImageDataUrl(LOGO_URL);

  // ===== HEADER =====
  const logoSize = 16;
  if (logoData) {
    try { doc.addImage(logoData, 'PNG', mL, y, logoSize, logoSize); } catch { /* ignore */ }
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  setTxt(doc, NAVY);
  doc.text(COMPANY.name.toUpperCase(), mL + logoSize + 7, y + 7);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  setTxt(doc, MUTED);
  doc.text(COMPANY.addressLines.join('  •  '), mL + logoSize + 7, y + 11);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.8);
  setTxt(doc, NAVY);
  doc.text(`TIN: ${COMPANY.tin}    •    Mobile: ${COMPANY.phone}    •    E-mail: ${COMPANY.email}`, mL + logoSize + 7, y + 16);

  y += logoSize + 6;
  setDraw(doc, NAVY, 0.6);
  doc.line(mL, y, mR, y);
  y += 8;

  // ===== INFO GRID =====
  const infoPairs = [
    ['Owner', ownerLabel || '—'],
    ['Plate No.', plateLabel || '—'],
    ['Company', clientName || '—'],
    ['BS / SOA No.', cycleNames.length ? cycleNames.join(', ') : '—'],
    ['Payroll Period', periodStart ? `${formatDateDisplay(periodStart)} – ${formatDateDisplay(periodEnd)}` : '—'],
    ['Pay Date', formatDateDisplay(billingDate)],
  ];

  const colW = contentW / 3;
  const cellH = 13;
  setDraw(doc, HAIR, 0.3);
  doc.roundedRect(mL, y, contentW, cellH * 2, 1.5, 1.5, 'S');
  infoPairs.forEach((pair, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = mL + col * colW;
    const cy = y + row * cellH;
    if (col > 0) doc.line(x, cy, x, cy + cellH - 0.5);
    if (row > 0) doc.line(mL, cy, mR, cy);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    setTxt(doc, MUTED);
    doc.text(pair[0].toUpperCase(), x + 5, cy + 4.5);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    setTxt(doc, INK);
    doc.text(doc.splitTextToSize(String(pair[1]), colW - 10), x + 5, cy + 9.5);
  });
  y += cellH * 2 + 8;

  // ===== EARNINGS TABLE =====
  const colX = [mL];
  COLS.forEach((w, i) => colX.push(colX[i] + w));

  const drawHeader = (topY) => {
    const r1H = 5, r2H = 4, totalH = r1H + r2H;
    setFill(doc, NAVY_SOFT);
    doc.rect(mL, topY, contentW, totalH, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    setTxt(doc, NAVY);

    FULL_COLS.forEach((ci, i) => {
      const x = colX[ci], w = COLS[ci];
      doc.text(HEADERS[i], x + w / 2, topY + totalH / 2 + 1, { align: 'center' });
    });

    const destX = colX[4], destW = COLS[4] + COLS[5];
    doc.text('DESTINATION', destX + destW / 2, topY + r1H / 2 + 1.2, { align: 'center' });
    doc.setFontSize(6.3);
    doc.text('FROM', colX[4] + COLS[4] / 2, topY + r1H + r2H / 2 + 1, { align: 'center' });
    doc.text('TO', colX[5] + COLS[5] / 2, topY + r1H + r2H / 2 + 1, { align: 'center' });

    setDraw(doc, NAVY, 0.4);
    doc.line(mL, topY + totalH, mR, topY + totalH);
    // light vertical separators
    setDraw(doc, HAIR, 0.2);
    for (let i = 1; i < colX.length - 1; i++) doc.line(colX[i], topY, colX[i], topY + totalH);
    return topY + totalH;
  };

  const drawRow = (topY, vals, zebra) => {
    if (zebra) {
      setFill(doc, ZEBRA);
      doc.rect(mL, topY, contentW, ROW_H, 'F');
    }
    setDraw(doc, HAIR, 0.15);
    for (let i = 1; i < colX.length - 1; i++) doc.line(colX[i], topY, colX[i], topY + ROW_H);

    const by = topY + ROW_H / 2 + 1.4;
    COLS.forEach((w, ci) => {
      const x = colX[ci];
      const v = vals[ci] != null ? String(vals[ci]) : '';
      if (!v) return;
      if (ci === 0) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.5);
        setTxt(doc, INK);
        doc.text(v, x + w / 2, by, { align: 'center' });
      } else if (ci === 6 || ci === 7) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        setTxt(doc, INK);
        doc.text(v, x + w - 2, by, { align: 'right' });
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7.2);
        setTxt(doc, INK);
        doc.text(doc.splitTextToSize(v, w - 3), x + w / 2, by, { align: 'center' });
      }
    });
  };

  const bottomLimit = PAGE.h - 96;
  let rowY = drawHeader(y);

  trips.forEach((trip, i) => {
    if (rowY + ROW_H > bottomLimit) {
      doc.addPage();
      rowY = drawHeader(PAGE.margin);
    }
    drawRow(rowY, [
      i + 1,
      formatDateDisplay(trip.delivery_date),
      trip.dr_number || '—',
      trip.truck_type || '—',
      trip.pickup_location || '—',
      trip.delivery_location || '—',
      peso((trip.gross_rate || 0) - (trip.tax_deduction || 0) - (trip.hidden_fee || 0)),
      trip._fuelSubsidy > 0 ? peso(trip._fuelSubsidy) : '—',
    ], i % 2 === 1);
    rowY += ROW_H;
  });

  // light filler rows
  const dataCount = trips.length;
  for (let i = dataCount; i < FILLER_ROWS; i++) {
    if (rowY + ROW_H > bottomLimit) break;
    drawRow(rowY, [], i % 2 === 1);
    rowY += ROW_H;
  }

  setDraw(doc, NAVY, 0.4);
  doc.line(mL, rowY, mR, rowY);
  y = rowY + 10;

  // ===== SUMMARY =====
  const netCardW = 78;
  const netCardX = mR - netCardW;
  const notesW = netCardX - mL - 8;

  // ---- notes card (readable, line-by-line) ----
  const notesText = notes && notes.trim() ? notes : 'No additional charges or reimbursements.';
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  const notesLines = doc.splitTextToSize(notesText, notesW - 12);
  const lineGap = 4.4;
  const notesH = Math.max(48, 14 + notesLines.length * lineGap + 6);

  setFill(doc, NAVY_SOFT);
  setDraw(doc, LIGHT, 0.3);
  doc.roundedRect(mL, y, notesW, notesH, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.8);
  setTxt(doc, NAVY);
  doc.text('NOTES / BREAKDOWN', mL + 5, y + 6.5);
  setDraw(doc, LIGHT, 0.3);
  doc.line(mL + 5, y + 9, mL + notesW - 5, y + 9);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  setTxt(doc, INK);
  let ny = y + 14;
  notesLines.forEach((l) => {
    doc.text(l, mL + 5, ny);
    ny += lineGap;
  });

  // ---- net pay card (aligned rows) ----
  setFill(doc, WHITE);
  setDraw(doc, LIGHT, 0.3);
  doc.roundedRect(netCardX, y, netCardW, notesH, 2, 2, 'FD');

  const rows = [
    ['Total Rate', peso(totalGross)],
    ['6% Admin Fee', `-${peso(totalAdmin)}`],
    ['Charge / Penalty', `-${peso(totalCharge)}`],
    ['Reimburse', `+${peso(totalReimburse)}`],
    ['Fuel Subsidy', `+${peso(totalFuelSubsidy)}`],
  ];
  const lblX = netCardX + 6;
  const valX = netCardX + netCardW - 6;
  let ry = y + 7;
  doc.setFontSize(7.8);
  rows.forEach(([label, val]) => {
    doc.setFont('helvetica', 'normal');
    setTxt(doc, MUTED);
    doc.text(label, lblX, ry);
    doc.setFont('helvetica', 'bold');
    setTxt(doc, INK);
    doc.text(val, valX, ry, { align: 'right' });
    ry += 6;
  });

  // separator before NET PAY
  setDraw(doc, LIGHT, 0.3);
  doc.line(netCardX + 5, ry + 1, netCardX + netCardW - 5, ry + 1);

  // net pay band
  const bandH = 13;
  const bandY = ry + 3;
  if (bandY + bandH > y + notesH) {
    // ensure band fits; if not, extend card is not possible post-draw, so clamp
  }
  setFill(doc, NAVY);
  doc.rect(netCardX, bandY, netCardW, bandH, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  setTxt(doc, WHITE);
  doc.text('NET PAY', netCardX + 6, bandY + 8.5);
  doc.setFontSize(11);
  doc.text(peso(grandTotal), netCardX + netCardW - 6, bandY + 9, { align: 'right' });

  y = bandY + bandH + 14;

  // ===== SIGNATURE =====
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  setTxt(doc, INK);
  doc.text('Received by:', mL, y);

  const sl = 38, gap = 8;
  const labels = ['Name', 'Signature', 'Date'];
  let sx = mL + 26;
  labels.forEach((lb) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    setTxt(doc, MUTED);
    doc.text(`${lb}:`, sx, y - 1);
    setDraw(doc, INK, 0.3);
    doc.line(sx, y + 1.5, sx + sl, y + 1.5);
    sx += sl + gap + 6;
  });

  // ===== PAGE NUMBERS =====
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    setTxt(doc, MUTED);
    doc.text(`Page ${p} of ${pageCount}`, mR, PAGE.h - 6, { align: 'right' });
  }

  doc.save(fileName || 'Payroll.pdf');
}