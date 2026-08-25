import * as XLSX from 'xlsx';
import { formatDateDisplay, formatAmount } from '@/lib/dateUtils';

const COMPANY = [
  ['Phaeton Trucking Services'],
  ['Block 3 Lot 1, Pacita 2-B, Cyan St., Brgy. San Lazaro, City of San Pedro, Laguna, Philippines'],
  ['0931-974-6058 | operations@phaetontrucking.com'],
  ['BIR Registration: NON-VAT', 'TIN: 274-546-612-00000'],
];

const safeName = (value) => String(value || 'Export').replace(/[\\/:*?"<>|]/g, '-');

function download(rows, filename, widths) {
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet['!cols'] = widths.map(w => ({ wch: w }));
  worksheet['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(widths.length - 1, 1) } }];
  Object.keys(worksheet).forEach(key => {
    if (!key.startsWith('!') && worksheet[key].v === 'Description of Services Rendered') {
      worksheet[key].s = { font: { bold: true } };
    }
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Statement');
  XLSX.writeFile(workbook, filename);
}

export function exportStatementExcel({ title, cycle, client, trips, soaDate, periodCovered, serviceLabel, includeDr }) {
  const totalGross = trips.reduce((sum, trip) => sum + (trip.gross_rate || 0), 0);
  const totalTax = totalGross * 0.02;
  const amountDue = totalGross - totalTax;
  const headers = includeDr ? ['Date', 'DR No.', 'Route', 'Truck Type', 'Amount'] : ['Date', 'Route', 'Truck Type', 'Amount'];
  const rows = [
    [title], ...COMPANY, [],
    ['Statement No.', cycle?.cycle_name || '—'],
    ['SOA / Billing Date', soaDate ? formatDateDisplay(soaDate) : '—'],
    ['Period Covered', periodCovered],
    ['Credit Terms', client?.credit_terms ? `${client.credit_terms} Days` : '—'], [],
    ['Bill To'], [client?.client_name || '—'], [client?.address || '—'], [`TIN: ${client?.tin || '—'}`], [`${serviceLabel}: ${[...new Set(trips.map(t => t.pickup_location).filter(Boolean))].join(', ') || '—'}`], [],
    ['Description of Services Rendered'], headers,
    ...trips.map(trip => includeDr
      ? [formatDateDisplay(trip.delivery_date), trip.dr_number || '—', `${trip.delivery_location || '—'} → ${trip.delivery_code || '—'}${trip.trip_route_code ? ` (${trip.trip_route_code})` : ''}`, trip.truck_type || '—', `P${formatAmount(trip.gross_rate || 0)}`]
      : [formatDateDisplay(trip.delivery_date), `${trip.delivery_location || '—'} → ${trip.delivery_code || '—'}${trip.trip_route_code ? ` (${trip.trip_route_code})` : ''}`, trip.truck_type || '—', `P${formatAmount(trip.gross_rate || 0)}`]
    ),
    ['NOTHING FOLLOWS'], [],
    ['Total Gross ex VAT', `P${formatAmount(totalGross)}`],
    ['Total Due', `P${formatAmount(totalGross)}`],
    ['2% Withholding Tax', `P${formatAmount(totalTax)}`],
    ['AMOUNT DUE', `P${formatAmount(amountDue)}`],
  ];
  download(rows, `${safeName(title.replace(/[()]/g, '').replace(/ /g, '_'))}_${safeName(cycle?.cycle_name)}_${new Date().toISOString().slice(0, 10)}.xlsx`, includeDr ? [22, 18, 48, 18, 18] : [22, 48, 18, 18]);
}

export function exportSummaryExcel({ cycles, trips, client, soaDate, periodCovered }) {
  const rows = [
    ['Top Sheet (Summary)'], ...COMPANY, [],
    ['Statements', cycles.map(c => c.cycle_name).join(', ')],
    ['SOA / Billing Date', soaDate], ['Period Covered', periodCovered],
    ['Bill To', client?.client_name || '—'], [client?.address || '—'], [],
    ['Description of Services Rendered'], ['Date', 'Billing Statement', 'DR No.', 'Route', 'Amount'],
    ...trips.map(trip => [formatDateDisplay(trip.delivery_date), trip._cycle_name, trip.dr_number || '—', trip.pickup_location || '—', `P${formatAmount(trip.gross_rate || 0)}`]),
    ['NOTHING FOLLOWS'], [],
    ...cycles.flatMap(cycle => {
      const total = trips.filter(trip => trip.billing_cycle_id === cycle.id).reduce((sum, trip) => sum + (trip.gross_rate || 0), 0);
      return [[cycle.cycle_name, `P${formatAmount(total)}`], ['2% Withholding Tax', `P${formatAmount(total * 0.02)}`], ['Total', `P${formatAmount(total * 0.98)}`], []];
    }),
    ['GRAND TOTAL', `P${formatAmount(trips.reduce((sum, trip) => sum + (trip.gross_rate || 0) * 0.98, 0))}`],
  ];
  download(rows, `TopSheet_Summary_${safeName(client?.client_name || 'Statements')}.xlsx`, [22, 28, 18, 48, 18]);
}

export function exportQuotationExcel(quote) {
  const items = quote.line_items || [];
  const total = items.reduce((sum, item) => sum + (Number(item.row_total) || 0), 0);
  const rows = [
    ['Quotation'], ...COMPANY, [],
    ['Quote No.', quote.quote_number || '—'], ['Quote Date', formatDateDisplay(quote.quote_date)], ['Validity', quote.validity || '—'],
    ['Quoted For', quote.quoted_for_name || '—'], ['Address', quote.quoted_for_address || '—'], [],
    ['Service Items'], ['Service / Route', 'Truck Type', 'Trip Type', 'Trips', 'Rate', 'Total'],
    ...items.map(item => [item.description || '—', item.truck_type || '—', item.trip_type || '—', item.num_trips || 0, `P${formatAmount(item.rate || 0)}`, `P${formatAmount(item.row_total || 0)}`]),
    [], ['GRAND TOTAL', `P${formatAmount(total)}`], [], ['Terms & Conditions'], [quote.terms_and_conditions || '—'], [], ['Prepared By', quote.prepared_by || '—'],
  ];
  download(rows, `Quotation_${safeName(quote.quote_number)}.xlsx`, [48, 18, 18, 12, 18, 18]);
}