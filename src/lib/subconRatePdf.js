import jsPDF from 'jspdf';

const peso = (amount) => `P${Number(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function generateSubconRatePDF({ clientName, pickupLocation, truckType, rows, filename }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const margin = 15;
  const right = 195;
  const columns = [15, 78, 103, 130, 162, 195];
  const headerHeight = 8;
  const rowHeight = 7;
  let y = 15;

  const drawTableHeader = () => {
    doc.setFillColor(22, 56, 100);
    doc.rect(margin, y, right - margin, headerHeight, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    ['DESTINATION', 'CODE', 'GROSS', 'ADMIN FEE', 'NET'].forEach((label, index) => {
      const align = index < 2 ? 'left' : 'right';
      doc.text(label, align === 'left' ? columns[index] + 2 : columns[index + 1] - 2, y + 5, { align });
    });
    y += headerHeight;
  };

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 56, 100);
  doc.setFontSize(15);
  doc.text('PHAETON TRUCKING SERVICES', margin, y);
  y += 7;
  doc.setFontSize(11);
  doc.text('SUBCON RATE', margin, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(8.5);
  doc.text(`Client: ${clientName || '—'}`, margin, y);
  doc.text(`Pickup: ${pickupLocation || '—'}`, 105, y);
  y += 5;
  doc.text(`Truck Type: ${truckType || '—'}`, margin, y);
  y += 7;
  drawTableHeader();

  rows.forEach((row) => {
    if (y + rowHeight > 280) {
      doc.addPage();
      y = 15;
      drawTableHeader();
    }
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.2);
    doc.line(margin, y + rowHeight, right, y + rowHeight);
    for (let index = 1; index < columns.length - 1; index += 1) doc.line(columns[index], y, columns[index], y + rowHeight);
    doc.setTextColor(30, 41, 59);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text(String(row.destination || '—'), columns[0] + 2, y + 4.5);
    doc.text(String(row.code || '—'), columns[1] + 2, y + 4.5);
    doc.text(peso(row.gross), columns[3] - 2, y + 4.5, { align: 'right' });
    doc.text(`-${peso(row.admin)}`, columns[4] - 2, y + 4.5, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.text(peso(row.net), columns[5] - 2, y + 4.5, { align: 'right' });
    y += rowHeight;
  });

  doc.setDrawColor(226, 232, 240);
  doc.rect(margin, y - rows.length * 0, right - margin, 0);
  doc.save(filename || 'subcon-rate.pdf');
}