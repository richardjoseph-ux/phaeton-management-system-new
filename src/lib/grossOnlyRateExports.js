import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

const peso = (amount) => `P${Number(amount || 0).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function exportGrossOnlyExcel({ clientName, pickupLocation, truckType, rows, filename }) {
  const worksheet = XLSX.utils.json_to_sheet(rows.map((row) => ({
    'Pickup Address': row.pickupAddress || '',
    Destination: row.destination,
    Code: row.code,
    'Gross (P)': row.gross,
  })));
  worksheet['!cols'] = [{ wch: 42 }, { wch: 42 }, { wch: 18 }, { wch: 18 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, `${truckType} Gross`);
  XLSX.writeFile(workbook, filename);
}

export function exportGrossOnlyPdf({ clientName, pickupLocation, truckType, rows, filename }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const margin = 15;
  const right = 195;
  const columns = [15, 78, 126, 158, 195];
  const rowHeight = 7;
  let y = 15;

  const header = () => {
    doc.setFillColor(22, 56, 100);
    doc.rect(margin, y, right - margin, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    ['PICKUP ADDRESS', 'DESTINATION', 'CODE', 'GROSS'].forEach((label, index) => {
      doc.text(label, index < 3 ? columns[index] + 2 : columns[index + 1] - 2, y + 5, { align: index < 3 ? 'left' : 'right' });
    });
    y += 8;
  };

  doc.setFont('helvetica', 'bold');
  doc.setTextColor(22, 56, 100);
  doc.setFontSize(15);
  doc.text('PHAETON TRUCKING SERVICES', margin, y);
  y += 7;
  doc.setFontSize(11);
  doc.text('GROSS RATE', margin, y);
  y += 7;
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.setFontSize(8.5);
  doc.text(`Client: ${clientName || '—'}`, margin, y);
  doc.text(`Pickup: ${pickupLocation || '—'}`, 105, y);
  y += 5;
  doc.text(`Truck Type: ${truckType || '—'}`, margin, y);
  y += 7;
  header();

  rows.forEach((row) => {
    if (y + rowHeight > 280) {
      doc.addPage();
      y = 15;
      header();
    }
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y + rowHeight, right, y + rowHeight);
    doc.line(columns[1], y, columns[1], y + rowHeight);
    doc.line(columns[2], y, columns[2], y + rowHeight);
    doc.line(columns[3], y, columns[3], y + rowHeight);
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(7);
    doc.text(String(row.pickupAddress || '—'), columns[0] + 2, y + 4.5);
    doc.text(String(row.destination || '—'), columns[1] + 2, y + 4.5);
    doc.text(String(row.code || '—'), columns[2] + 2, y + 4.5);
    doc.setFont('helvetica', 'bold');
    doc.text(peso(row.gross), columns[4] - 2, y + 4.5, { align: 'right' });
    y += rowHeight;
  });
  doc.save(filename);
}