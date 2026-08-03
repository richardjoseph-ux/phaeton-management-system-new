import jsPDF from 'jspdf';
import { formatDateDisplay, formatAmount } from '@/lib/dateUtils';

export const LOGO_URL = 'https://media.base44.com/images/public/6a2682ee2374bcbebfc01176/777bec924_LOGOMAIN.png';

// Independent company branding constants (no imports from billingStatementPdf.js)
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
const LIGHT_BORDER = { r: 226, g: 232, b: 240 };
const RULE = { r: 214, g: 220, b: 228 };
const TEXT = { r: 30, g: 41, b: 59 };
const MUTED = { r: 100, g: 116, b: 139 };

const PAGE = { w: 210, h: 297, margin: 15 };
const peso = (n) => `P${formatAmount(Number(n) || 0)}`;

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

const setDraw = (doc, c, w = 0.2) => {
  doc.setDrawColor(c.r, c.g, c.b);
  doc.setLineWidth(w);
};

export async function generateQuotationPDF(payload) {
  const {
    quote_number,
    quote_date,
    validity,
    quoted_for_name,
    quoted_for_address,
    line_items = [],
    terms_and_conditions = '',
    prepared_by,
    status = 'draft',
  } = payload || {};

  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  doc.setFont('helvetica');
  doc.setTextColor(TEXT.r, TEXT.g, TEXT.b);
  const mL = PAGE.margin, mR = PAGE.w - PAGE.margin;
  const contentW = mR - mL;
  const cx = PAGE.w / 2;
  let y = PAGE.margin;

  // ===== LETTERHEAD =====
  const logoData = await loadImageDataUrl(LOGO_URL);
  const logoSize = 14;
  if (logoData) {
    try { doc.addImage(logoData, 'PNG', mL, y, logoSize, logoSize); } catch { /* ignore */ }
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
  doc.text(COMPANY.name.toUpperCase(), mL + logoSize + 6, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.text(COMPANY.address, mL + logoSize + 6, y + 10);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
  doc.text(`BIR Registration: ${COMPANY.birReg}    •    TIN: ${COMPANY.tin}`, mL + logoSize + 6, y + 14.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.text(`Mobile: ${COMPANY.phone}    •    E-mail: ${COMPANY.email}`, mL + logoSize + 6, y + 19);

  y += logoSize + 10;
  setDraw(doc, NAVY, 0.6);
  doc.line(mL, y, mR, y);
  y += 9;

  // ===== TITLE =====
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(NAVY.r, NAVY.g, NAVY.b);
  doc.text('QUOTATION', cx, y, { align: 'center' });
  y += 5;
  setDraw(doc, RULE, 0.2);
  doc.line(mL, y, mR, y);
  y += 7;

  // ===== META + QUOTED FOR BOX =====
  const boxTop = y;
  const colW = contentW / 2;
  const leftX = mL + 3;
  const rightX = mL + colW + 3;

  const metaRows = [
    ['Quote No.', quote_number || '—', 'Validity', validity || '—'],
    ['Quote Date', formatDateDisplay(quote_date), 'Prepared By', prepared_by || '—'],
  ];

  let metaY = y + 5;
  metaRows.forEach(([lL, lV, rL, rV]) => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    doc.setFontSize(7.5);
    doc.text(lL, leftX, metaY);
    doc.text(rL, rightX, metaY);
    metaY += 4.5;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(TEXT.r, TEXT.g, TEXT.b);
    doc.setFontSize(9.5);
    doc.text(String(lV), leftX, metaY);
    doc.text(String(rV), rightX, metaY);
    metaY += 6.5;
  });

  // Quoted For (full width)
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
  doc.setFontSize(7.5);
  doc.text('QUOTED FOR', leftX, metaY);
  metaY += 4.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(TEXT.r, TEXT.g, TEXT.b);
  doc.text(quoted_for_name || '—', leftX, metaY);
  metaY += 5.5;
  if (quoted_for_address) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    const addrLines = doc.splitTextToSize(quoted_for_address, contentW - 8);
    addrLines.forEach((l) => { doc.text(l, leftX, metaY); metaY += 4.2; });
  }
  metaY += 2;

  const boxBottom = metaY + 2;
  setDraw(doc, LIGHT_BORDER, 0.2);
  doc.roundedRect(mL, boxTop, contentW, boxBottom - boxTop, 1.5, 1.5, 'S');
  y = boxBottom + 7;

  // ===== SERVICE TABLE =====
  const colTruck = 22, colTrip = 22, colTrips = 16, colRate = 22, colTotal = 24;
  const colDesc = contentW - colTruck - colTrip - colTrips - colRate - colTotal;
  const colXs = [
    mL,
    mL + colDesc,
    mL + colDesc + colTruck,
    mL + colDesc + colTruck + colTrip,
    mL + colDesc + colTruck + colTrip + colTrips,
    mL + colDesc + colTruck + colTrip + colTrips + colRate,
    mR,
  ];
  const rowH = 7;
  const bottomLimit = PAGE.h - PAGE.margin - 50;

  const drawHeader = (topY) => {
    doc.setFillColor(MUTED_BG.r, MUTED_BG.g, MUTED_BG.b);
    doc.rect(mL, topY, contentW, rowH, 'F');
    doc.setTextColor(TEXT.r, TEXT.g, TEXT.b);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('SERVICE / ROUTE', colXs[0] + 2, topY + 4.5);
    doc.text('TRUCK TYPE', colXs[1] + 2, topY + 4.5);
    doc.text('TRIP TYPE', colXs[2] + 2, topY + 4.5);
    doc.text('TRIPS', colXs[3] + 2, topY + 4.5);
    doc.text('RATE', colXs[5] - 2, topY + 4.5, { align: 'right' });
    doc.text('ROW TOTAL', colXs[6] - 2, topY + 4.5, { align: 'right' });
    setDraw(doc, LIGHT_BORDER, 0.2);
    doc.line(mL, topY + rowH, mR, topY + rowH);
    return topY + rowH;
  };

  const drawBorders = (topY, bottomY) => {
    setDraw(doc, LIGHT_BORDER, 0.2);
    doc.rect(mL, topY, contentW, bottomY - topY);
    for (let i = 1; i < colXs.length - 1; i++) doc.line(colXs[i], topY, colXs[i], bottomY);
  };

  let tableTop = y;
  let rowY = drawHeader(y);

  line_items.forEach((item) => {
    const descLines = doc.splitTextToSize(item.description || '', colDesc - 4);
    const thisH = Math.max(rowH, descLines.length * 4 + 3);
    if (rowY + thisH > bottomLimit) {
      drawBorders(tableTop, rowY);
      doc.addPage();
      y = PAGE.margin;
      tableTop = y;
      rowY = drawHeader(y);
    }
    doc.setTextColor(TEXT.r, TEXT.g, TEXT.b);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.8);
    const baseY = rowY + 4.5;
    doc.text(descLines, colXs[0] + 2, baseY);
    doc.text(String(item.truck_type || '—'), colXs[1] + 2, baseY);
    doc.text(String(item.trip_type || '—'), colXs[2] + 2, baseY);
    doc.text(String(item.num_trips || 0), colXs[3] + 2, baseY, { align: 'center' });
    doc.text(peso(item.rate || 0), colXs[5] - 2, baseY, { align: 'right' });
    doc.text(peso(item.row_total || 0), colXs[6] - 2, baseY, { align: 'right' });
    setDraw(doc, { r: 240, g: 240, b: 240 }, 0.1);
    doc.line(mL, rowY, mR, rowY);
    rowY += thisH;
  });

  drawBorders(tableTop, rowY);
  y = rowY + 6;

  // ===== GRAND TOTAL =====
  const grandTotal = line_items.reduce((s, it) => s + (Number(it.row_total) || 0), 0);
  const gtW = 82;
  const gtX = mR - gtW;
  const gtH = 9;
  if (y + gtH > PAGE.h - PAGE.margin - 30) { doc.addPage(); y = PAGE.margin; }
  doc.setFillColor(NAVY.r, NAVY.g, NAVY.b);
  doc.rect(gtX, y, gtW, gtH, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('GRAND TOTAL', gtX + 4, y + 6);
  doc.text(peso(grandTotal), gtX + gtW - 4, y + 6, { align: 'right' });
  y += gtH + 10;

  // ===== TERMS & CONDITIONS =====
  if (terms_and_conditions && terms_and_conditions.trim()) {
    if (y + 16 > PAGE.h - PAGE.margin - 35) { doc.addPage(); y = PAGE.margin; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(TEXT.r, TEXT.g, TEXT.b);
    doc.text('TERMS & CONDITIONS', mL, y);
    y += 5;
    setDraw(doc, RULE, 0.2);
    doc.line(mL, y, mR, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(MUTED.r, MUTED.g, MUTED.b);
    const tcLines = doc.splitTextToSize(terms_and_conditions, contentW - 4);
    tcLines.forEach((l) => {
      if (y > PAGE.h - PAGE.margin - 15) { doc.addPage(); y = PAGE.margin; }
      doc.text(l, mL, y);
      y += 4.2;
    });
    y += 8;
  }

  // ===== SIGNATURE BLOCK =====
  if (y + 30 > PAGE.h - PAGE.margin) { doc.addPage(); y = PAGE.margin; }
  const sigW = 78;
  const leftSig = mL;
  const rightSig = mR - sigW;

  const sigBlock = (label, nameLine, dateLabel, sx) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(TEXT.r, TEXT.g, TEXT.b);
    doc.text(label, sx, y);
    y += 7;
    setDraw(doc, TEXT, 0.2);
    doc.line(sx, y, sx + sigW, y);
    y += 4;
    if (nameLine) {
      doc.setFont('helvetica', 'bold');
      doc.text(nameLine, sx, y);
    }
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(dateLabel, sx, y);
  };

  const sigStartY = y;
  sigBlock('Prepared & Certified By:', prepared_by || '', '', leftSig);
  y = sigStartY;
  sigBlock('Confirmed By:', '', 'Date: ______________', rightSig);

  doc.save(`${quote_number || 'quotation'}.pdf`);
}