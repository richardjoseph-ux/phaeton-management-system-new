import jsPDF from 'jspdf';
import { formatDateDisplay, formatAmount } from '@/lib/dateUtils';

const COMPANY = {
  name: 'PHAETON TRUCKING SERVICES',
  address: 'Block 3 Lot 1, Pacita 2-B, Cyan St., Brgy. San Lazaro, City of San Pedro, Laguna, Philippines',
  phone: '0931-974-6058',
  email: 'operations@phaetontrucking.com',
  birReg: 'NON-VAT',
  tin: '274-546-612-00000',
};

export function generateBillingStatementPDF({ cycle, client, trips, soaDate, preparedBy }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 15;
  let y = 15;

  // ---------- Header ----------
  doc.setFillColor(20, 50, 90);
  doc.roundedRect(margin, y, 12, 12, 1.5, 1.5, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text('PT', margin + 6, y + 7.6, { align: 'center' });

  doc.setTextColor(20, 50, 90);
  doc.setFontSize(15);
  doc.text(COMPANY.name, margin + 16, y + 5);
  doc.setTextColor(95, 95, 95);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Transport & Logistics Solutions', margin + 16, y + 10);

  const rightX = pageW - margin;
  doc.setTextColor(95, 95, 95);
  doc.setFontSize(7);
  doc.text(COMPANY.address, rightX, y + 4, { align: 'right' });
  doc.text(`Tel: ${COMPANY.phone}  |  Email: ${COMPANY.email}`, rightX, y + 8, { align: 'right' });
  doc.text(`BIR Registration: ${COMPANY.birReg}  |  TIN: ${COMPANY.tin}`, rightX, y + 12, { align: 'right' });

  y += 16;
  doc.setDrawColor(20, 50, 90);
  doc.setLineWidth(0.6);
  doc.line(margin, y, pageW - margin, y);
  y += 8;

  // ---------- Title ----------
  doc.setTextColor(20, 50, 90);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('BILLING STATEMENT', pageW / 2, y, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text('Statement of Account', pageW / 2, y + 5, { align: 'center' });
  y += 11;

  // ---------- Statement meta ----------
  const colLeft = margin;
  const colRight = margin + 95;
  const lineH = 5.5;

  const metaRow = (label, value, x) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);
    doc.text(label, x, y);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 30, 30);
    doc.text(value || '—', x + 28, y);
  };

  metaRow('Statement No.', cycle?.cycle_name || '', colLeft);
  metaRow('Period Covered:', formatDateDisplay(cycle?.billing_received_date), colRight);
  y += lineH;
  metaRow('SOA / Billing Date:', formatDateDisplay(soaDate), colLeft);
  metaRow('Credit Terms:', '30 Days', colRight);
  y += lineH;
  metaRow('Date Prepared:', formatDateDisplay(new Date().toISOString().split('T')[0]), colLeft);
  y += 6;

  // ---------- Bill To ----------
  doc.setFillColor(244, 246, 250);
  doc.rect(margin, y, pageW - margin * 2, 20, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(20, 50, 90);
  doc.text('BILL TO:', margin + 3, y + 6);
  y += 12;

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(client?.client_name || '—', margin + 3, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(95, 95, 95);
  let billY = y;
  let lineOff = 5;
  if (client?.address) { doc.text(client.address, margin + 3, billY + lineOff); lineOff += 5; }
  if (client?.tin) { doc.text(`TIN: ${client.tin}`, margin + 3, billY + lineOff); lineOff += 5; }
  const subs = client?.sub_accounts || [];
  if (subs.length) {
    const subText = subs.map(s => s.sub_account_name).join(', ');
    doc.text(`Sub-Account(s): ${subText}`, margin + 3, billY + lineOff);
  }
  y += 20;

  // ---------- Trip table ----------
  const tableTop = y + 2;
  const tableW = pageW - margin * 2;
  const colWidths = [30, 95, 35, 0];
  colWidths[3] = tableW - colWidths[0] - colWidths[1] - colWidths[2];

  doc.setFillColor(20, 50, 90);
  doc.rect(margin, tableTop, tableW, 8, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  let cx = margin + 2;
  ['Date', 'Route', 'Truck Type', 'Amount'].forEach((h, i) => {
    if (i === 3) doc.text(h, margin + tableW - 2, tableTop + 5.5, { align: 'right' });
    else { doc.text(h, cx, tableTop + 5.5); cx += colWidths[i]; }
  });

  y = tableTop + 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(30, 30, 30);

  const rowH = 6;
  const maxRows = Math.floor((250 - y) / rowH);
  const rowsToShow = trips.slice(0, Math.max(maxRows, 0));

  rowsToShow.forEach((trip, idx) => {
    if (idx % 2 === 0) {
      doc.setFillColor(249, 250, 252);
      doc.rect(margin, y, tableW, rowH, 'F');
    }
    let x = margin + 2;
    doc.text(formatDateDisplay(trip.delivery_date), x, y + 4);
    x += colWidths[0];
    const route = `${trip.pickup_location || ''} → ${trip.delivery_location || ''}`;
    doc.text(route.length > 48 ? route.slice(0, 46) + '…' : route, x, y + 4);
    x += colWidths[1];
    doc.text(trip.truck_type || '—', x, y + 4);
    doc.setTextColor(20, 50, 90);
    doc.setFont('helvetica', 'bold');
    doc.text(`₱${formatAmount(trip.gross_rate || 0)}`, margin + tableW - 2, y + 4, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(30, 30, 30);
    y += rowH;
  });

  // NOTHING FOLLOWS row
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y, tableW, rowH, 'F');
  doc.setTextColor(120, 120, 120);
  doc.setFont('helvetica', 'italic');
  doc.text('NOTHING FOLLOWS', margin + 2, y + 4);
  y += rowH;
  doc.setDrawColor(210, 210, 210);
  doc.setLineWidth(0.2);
  doc.rect(margin, tableTop, tableW, y - tableTop);

  // ---------- Totals ----------
  y += 3;
  const boxX = margin + (tableW - 80);

  const totalRow = (label, value, bold, color = [30, 30, 30]) => {
    if (bold) { doc.setFont('helvetica', 'bold'); } else { doc.setFont('helvetica', 'normal'); }
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(label, boxX, y + 4);
    doc.setTextColor(color[0], color[1], color[2]);
    doc.text(`₱${formatAmount(value)}`, margin + tableW, y + 4, { align: 'right' });
    y += 7;
  };

  const totalGross = trips.reduce((s, t) => s + (t.gross_rate || 0), 0);
  const totalTax = totalGross * 0.02;
  const amountDue = totalGross - totalTax;

  totalRow('Total Gross ex VAT:', totalGross, false);
  totalRow('Total Due:', totalGross, false);
  totalRow('2% Withholding Tax:', totalTax, false, [200, 60, 60]);
  doc.setDrawColor(20, 50, 90);
  doc.setLineWidth(0.4);
  doc.line(boxX, y, margin + tableW, y);
  y += 3;
  doc.setFillColor(20, 50, 90);
  doc.rect(boxX, y - 4, (margin + tableW) - boxX, 9, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('AMOUNT DUE:', boxX, y + 1.5);
  doc.text(`₱${formatAmount(amountDue)}`, margin + tableW, y + 1.5, { align: 'right' });
  y += 12;

  // ---------- Footer: Prepared By ----------
  y = Math.max(y + 6, 250);
  doc.setTextColor(95, 95, 95);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('___________________________', margin + 5, y);
  doc.text('Prepared By', margin + 5, y + 5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 30);
  doc.text(preparedBy || '—', margin + 5, y + 10);

  doc.setTextColor(95, 95, 95);
  doc.setFont('helvetica', 'normal');
  doc.text('___________________________', pageW - margin - 60, y);
  doc.text('Date Prepared', pageW - margin - 60, y + 5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(30, 30, 30);
  doc.text(formatDateDisplay(new Date().toISOString().split('T')[0]), pageW - margin - 60, y + 10);

  doc.setDrawColor(210, 210, 210);
  doc.setLineWidth(0.3);
  doc.line(margin, 282, pageW - margin, 282);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(140, 140, 140);
  doc.text('This billing statement is system-generated. Please settle within the stated credit terms.', pageW / 2, 287, { align: 'center' });

  doc.save(`${cycle?.cycle_name || 'billing-statement'}.pdf`);
}