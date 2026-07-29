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
const ZEBRA = { r: 248, g: 250, b: 252 };
const WHITE = { r: 255, g: 255, b: 255 };

const PAGE = { w: 210, h: 297, margin: 16 };
// NO, DATE, DR NO, VEHICLE, FROM, TO, RATE, FUEL SUB — sums to content width (178)
const COLS = [9, 24, 26, 21, 30, 30, 22, 16];
const HEADERS = ['NO.', 'DATE', 'DR NO.', 'VEHICLE', 'RATE', 'FUEL SUB.'];
const FULL_COLS = [0, 1, 2, 3, 6, 7];
const ROW_H = 8;
const FILLER_ROWS = 14;

const num = (v, f = 0) => (typeof v === 'number' && isFinite(v) ? v : f);

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

  // ===== HEADER (light) =====
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
  doc.text(COMPANY.addressLines.join('  •  '), mL + logoSize + 7, y + 12);

  // PAYSLIP label (right) — outline style
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  setTxt(doc, NAVY);
  const tagText = 'PAYSLIP';
  const tagW = doc.getTextDimensions(tagText).w + 8;
  setDraw(doc, NAVY, 0.3);
  doc.roundedRect(mR - tagW, y + 2, tagW, 7, 1.5, 1.5, 'S');
  doc.text(tagText, mR - tagW / 2, y + 2 + 4.4, { align: 'center' });

  y += logoSize + 5;
  // navy accent rule
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
  const cellH = 12;
  infoPairs.forEach((pair, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = mL + col * colW;
    const cy = y + row * cellH;
    if (col > 0) {
      setDraw(doc, HAIR, 0.2);
      doc.line(x, cy, x, cy + cellH - 1);
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    setTxt(doc, MUTED);
    doc.text(pair[0].toUpperCase(), x + 5, cy + 4);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    setTxt(doc, INK);
    doc.text(doc.splitTextToSize(String(pair[1]), colW - 10), x + 5, cy + 9);
  });
  y += cellH * 2 + 2;
  setDraw(doc, HAIR, 0.3);
  doc.line(mL, y, mR, y);
  y += 8;

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
    return topY + totalH;
  };

  const drawRow = (topY, vals, zebra) => {
    if (zebra) {
      setFill(doc, ZEBRA);
      doc.rect(mL, topY, contentW, ROW_H, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    setTxt(doc, INK);
    const by = topY + ROW_H / 2 + 1.4;
    COLS.forEach((w, ci) => {
      const x = colX[ci];
      const v = vals[ci] != null ? String(vals[ci]) : '';
      if (ci === 0) doc.text(v, x + w / 2, by, { align: 'center' });
      else if (ci === 6 || ci === 7) {
        doc.setFont('helvetica', 'bold');
        doc.text(v, x + w - 1.5, by, { align: 'right' });
        doc.setFont('helvetica', 'normal');
      } else doc.text(doc.splitTextToSize(v, w - 3), x + 1.5, by);
    });
  };

  const bottomLimit = PAGE.h - 92;
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
      `₱${formatAmount((trip.gross_rate || 0) - (trip.tax_deduction || 0) - (trip.hidden_fee || 0))}`,
      trip._fuelSubsidy > 0 ? `₱${formatAmount(trip._fuelSubsidy)}` : '—',
    ], i % 2 === 1);
    rowY += ROW_H;
  });

  // light filler rows
  const dataCount = trips.length;
  const target = Math.max(dataCount, FILLER_ROWS);
  for (let i = dataCount; i < target; i++) {
    if (rowY + ROW_H > bottomLimit) break;
    drawRow(rowY, [], i % 2 === 1);
    rowY += ROW_H;
  }

  setDraw(doc, NAVY, 0.4);
  doc.line(mL, rowY, mR, rowY);
  y = rowY + 10;

  // ===== SUMMARY =====
  const netCardW = 76;
  const netCardX = mR - netCardW;
  const notesW = netCardX - mL - 8;

  // notes card (soft bg, readable)
  const notesText = notes && notes.trim() ? notes : 'No additional charges or reimbursements.';
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  const notesLines = doc.splitTextToSize(notesText, notesW - 12);
  const lineGap = 4.2;
  const notesH = Math.max(40, notesLines.length * lineGap + 16);

  setFill(doc, NAVY_SOFT);
  setDraw(doc, LIGHT, 0.3);
  doc.roundedRect(mL, y, notesW, notesH, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  setTxt(doc, NAVY);
  doc.text('NOTES / BREAKDOWN', mL + 5, y + 6);
  setDraw(doc, LIGHT, 0.3);
  doc.line(mL + 5, y + 8, mL + notesW - 5, y + 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.8);
  setTxt(doc, INK);
  doc.text(notesLines, mL + 5, y + 13, { lineHeightFactor: lineGap / 7.8 });

  // net pay card (light, navy text)
  setFill(doc, WHITE);
  setDraw(doc, LIGHT, 0.3);
  doc.roundedRect(netCardX, y, netCardW, notesH, 2, 2, 'FD');

  const rows = [
    ['Total Rate', `₱${formatAmount(totalGross)}`],
    ['6% Admin Fee', `–₱${formatAmount(totalAdmin)}`],
    ['Charge / Penalty', `–₱${formatAmount(totalCharge)}`],
    ['Reimburse', `+₱${formatAmount(totalReimburse)}`],
    ['Fuel Subsidy', `+₱${formatAmount(totalFuelSubsidy)}`],
  ];
  const blockTop = y + 6;
  const blockBottom = y + notesH - 16;
  const lineH = (blockBottom - blockTop) / rows.length;
  let ry = blockTop + lineH / 2 + 1;
  rows.forEach(([label, val]) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    setTxt(doc, MUTED);
    doc.text(label, netCardX + 5, ry);
    doc.setFont('helvetica', 'bold');
    setTxt(doc, INK);
    doc.text(val, netCardX + netCardW - 5, ry, { align: 'right' });
    ry += lineH;
  });

  // net pay band
  const netBandY = y + notesH - 14;
  setFill(doc, NAVY);
  doc.rect(netCardX, netBandY, netCardW, 14, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  setTxt(doc, WHITE);
  doc.text('NET PAY', netCardX + 5, netBandY + 9);
  doc.setFontSize(11);
  doc.text(`₱${formatAmount(grandTotal)}`, netCardX + netCardW - 5, netBandY + 9.5, { align: 'right' });

  y += notesH + 14;

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