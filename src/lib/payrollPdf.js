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

// Modern payslip palette
const NAVY = { r: 22, g: 56, b: 100 };
const NAVY_SOFT = { r: 237, g: 241, b: 248 };
const INK = { r: 30, g: 41, b: 59 };
const MUTED = { r: 100, g: 116, b: 139 };
const LIGHT = { r: 226, g: 232, b: 240 };
const ZEBRA = { r: 248, g: 250, b: 252 };
const WHITE = { r: 255, g: 255, b: 255 };
const GREEN = { r: 22, g: 120, b: 90 };

const PAGE = { w: 210, h: 297, margin: 14 };
// Earnings columns (mm). Sum == content width.
const COLS = [8, 24, 26, 22, 30, 30, 23, 23];
const HEADERS = ['NO.', 'DATE', 'DR NO.', 'VEHICLE TYPE', 'RATE', 'FUEL SUBSIDY'];
const FULL_COLS = [0, 1, 2, 3, 6, 7];
const ROW_H = 7;
const TOTAL_ROWS = 18;

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

const set = (doc, c) => doc.setTextColor(num(c.r), num(c.g), num(c.b));
const fill = (doc, c) => doc.setFillColor(num(c.r), num(c.g), num(c.b));
const draw = (doc, c, w = 0.2) => {
  doc.setDrawColor(num(c.r), num(c.g), num(c.b));
  doc.setLineWidth(num(w, 0.2));
};
const baseY = (topY) => topY + ROW_H / 2 + 1.4;

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

  // ===== HEADER BAND =====
  const bandH = 26;
  fill(doc, NAVY);
  doc.rect(mL, y, contentW, bandH, 'F');

  // logo
  const logoSize = 16;
  if (logoData) {
    try { doc.addImage(logoData, 'PNG', mL + 4, y + (bandH - logoSize) / 2, logoSize, logoSize); } catch { /* ignore */ }
  }
  // company name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  set(doc, WHITE);
  doc.text(COMPANY.name.toUpperCase(), mL + logoSize + 8, y + bandH / 2 - 1);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  set(doc, { r: 200, g: 210, b: 225 });
  doc.text(COMPANY.addressLines.join('  •  '), mL + logoSize + 8, y + bandH / 2 + 4);

  // payslip tag (right)
  const tagW = 34, tagH = 11;
  const tagX = mR - tagW - 4, tagY = y + (bandH - tagH) / 2;
  fill(doc, { r: 255, g: 255, b: 255 });
  draw(doc, WHITE, 0);
  doc.roundedRect(tagX, tagY, tagW, tagH, 1.5, 1.5, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  set(doc, NAVY);
  doc.text('PAYSLIP', tagX + tagW / 2, tagY + tagH / 2 + 1.6, { align: 'center' });

  y += bandH + 6;

  // ===== INFO CARD =====
  const cardH = 30;
  fill(doc, WHITE);
  draw(doc, LIGHT, 0.3);
  doc.roundedRect(mL, y, contentW, cardH, 2, 2, 'FD');

  const infoPairs = [
    ['Owner Name', ownerLabel || '—'],
    ['Plate #', plateLabel || '—'],
    ['Company', clientName || '—'],
    ['BS / SOA #', cycleNames.length ? cycleNames.join(', ') : '—'],
    ['Payroll Period', periodStart ? `${formatDateDisplay(periodStart)} – ${formatDateDisplay(periodEnd)}` : '—'],
    ['Pay Date', formatDateDisplay(billingDate)],
  ];

  const colW = contentW / 3;
  const cellH = cardH / 2;
  infoPairs.forEach((pair, i) => {
    const col = i % 3, row = Math.floor(i / 3);
    const x = mL + col * colW + 4;
    const cy = y + row * cellH;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.8);
    set(doc, MUTED);
    doc.text(pair[0].toUpperCase(), x, cy + 6);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    set(doc, INK);
    doc.text(doc.splitTextToSize(String(pair[1]), colW - 8), x, cy + 11);
  });

  y += cardH + 6;

  // ===== EARNINGS TABLE =====
  const colX = [mL];
  COLS.forEach((w, i) => colX.push(colX[i] + w));

  const drawHeader = (topY) => {
    const r1H = 5, r2H = 4, totalH = r1H + r2H;
    fill(doc, NAVY);
    doc.rect(mL, topY, contentW, totalH, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.2);
    set(doc, WHITE);

    FULL_COLS.forEach((ci, i) => {
      const x = colX[ci], w = COLS[ci];
      doc.text(HEADERS[i], x + w / 2, topY + totalH / 2 + 1, { align: 'center' });
    });

    const destX = colX[4], destW = COLS[4] + COLS[5];
    doc.text('DESTINATION', destX + destW / 2, topY + r1H / 2 + 1.2, { align: 'center' });
    doc.setFontSize(6.6);
    doc.text('FROM', colX[4] + COLS[4] / 2, topY + r1H + r2H / 2 + 1, { align: 'center' });
    doc.text('TO', colX[5] + COLS[5] / 2, topY + r1H + r2H / 2 + 1, { align: 'center' });
    return topY + totalH;
  };

  const drawRow = (topY, vals, zebra) => {
    if (zebra) {
      fill(doc, ZEBRA);
      doc.rect(mL, topY, contentW, ROW_H, 'F');
    }
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    set(doc, INK);
    COLS.forEach((w, ci) => {
      const x = colX[ci];
      const v = vals[ci] != null ? String(vals[ci]) : '';
      const by = baseY(topY);
      if (ci === 0) doc.text(v, x + w / 2, by, { align: 'center' });
      else if (ci === 6 || ci === 7) {
        doc.setFont('helvetica', 'bold');
        doc.text(v, x + w - 2, by, { align: 'right' });
        doc.setFont('helvetica', 'normal');
      } else doc.text(doc.splitTextToSize(v, w - 4), x + 2, by);
    });
  };

  const bottomLimit = PAGE.h - 70;
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

  // filler rows
  const dataCount = trips.length;
  if (dataCount < TOTAL_ROWS) {
    for (let i = dataCount; i < TOTAL_ROWS; i++) {
      drawRow(rowY, [], i % 2 === 1);
      rowY += ROW_H;
    }
  }

  // bottom rule
  draw(doc, NAVY, 0.5);
  doc.line(mL, rowY, mR, rowY);
  rowY += 4;

  y = rowY;

  // ===== SUMMARY ROW: notes (left) + net pay card (right) =====
  const netCardW = 78;
  const netCardX = mR - netCardW;
  const notesW = netCardX - mL - 6;

  // notes block
  const notesText = notes && notes.trim() ? notes : 'No additional charges or reimbursements.';
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.8);
  const notesLines = doc.splitTextToSize(notesText, notesW - 8);
  const notesH = Math.max(34, notesLines.length * 3.6 + 12);

  fill(doc, NAVY_SOFT);
  draw(doc, LIGHT, 0.3);
  doc.roundedRect(mL, y, notesW, notesH, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  set(doc, NAVY);
  doc.text('NOTES / BREAKDOWN', mL + 4, y + 5.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.2);
  set(doc, INK);
  doc.text(notesLines, mL + 4, y + 10);

  // net pay card
  fill(doc, NAVY);
  doc.roundedRect(netCardX, y, netCardW, notesH, 2, 2, 'F');

  const rows = [
    ['TOTAL RATE', `₱${formatAmount(totalGross)}`, false],
    ['6% ADMIN FEE', `–₱${formatAmount(totalAdmin)}`, false],
    ['CHARGE / PENALTY', `–₱${formatAmount(totalCharge)}`, false],
    ['REIMBURSE', `+₱${formatAmount(totalReimburse)}`, false],
    ['FUEL SUBSIDY', `+₱${formatAmount(totalFuelSubsidy)}`, false],
  ];
  const lineH = (notesH - 16 - 12) / rows.length;
  let ry = y + 7;
  rows.forEach(([label, val]) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    set(doc, { r: 210, g: 220, b: 234 });
    doc.text(label, netCardX + 4, ry);
    doc.setFont('helvetica', 'bold');
    set(doc, WHITE);
    doc.text(val, netCardX + netCardW - 4, ry, { align: 'right' });
    ry += lineH;
  });

  // net pay
  draw(doc, WHITE, 0.3);
  doc.line(netCardX + 4, ry - 1, netCardX + netCardW - 4, ry - 1);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  set(doc, WHITE);
  doc.text('NET PAY', netCardX + 4, ry + 5);
  doc.setFontSize(11);
  doc.text(`₱${formatAmount(grandTotal)}`, netCardX + netCardW - 4, ry + 5, { align: 'right' });

  y += notesH + 12;

  // ===== SIGNATURE BLOCK =====
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  set(doc, INK);
  doc.text('Received by:', mL, y);

  const sl = 34, gap = 8;
  const labels = ['Name', 'Signature', 'Date'];
  let sx = mL + 28;
  labels.forEach((lb) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    set(doc, MUTED);
    doc.text(`${lb}:`, sx, y - 1);
    draw(doc, INK, 0.3);
    doc.line(sx, y + 1, sx + sl, y + 1);
    sx += sl + gap + 4;
  });

  // ===== PAGE NUMBERS =====
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    set(doc, MUTED);
    doc.text(`Page ${p} of ${pageCount}`, mR, PAGE.h - 5, { align: 'right' });
  }

  doc.save(fileName || 'Payroll.pdf');
}