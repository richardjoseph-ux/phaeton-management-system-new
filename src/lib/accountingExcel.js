import * as XLSX from 'xlsx';
import { formatDateDisplay } from '@/lib/dateUtils';

const COMPANY = [
  'PHAETON TRUCKING SERVICES',
  'Block 3 Lot 1, Pacita 2-B, Cyan St., Brgy. San Lazaro, City of San Pedro, Laguna, Philippines',
  '0931-974-6058 | operations@phaetontrucking.com',
  'BIR Registration: NON-VAT',
  'TIN: 274-546-612-00000',
];

const safeName = (value) => String(value || 'Export').replace(/[\\/:*?"<>|]/g, '-');
const money = (value) => Number(value || 0);

function makeSheet(rows, columns, widths, merges, filename) {
  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet['!cols'] = widths.map(wch => ({ wch }));
  sheet['!merges'] = merges;
  sheet['!rows'] = rows.map((_, index) => ({ hpt: [18, 16, 16, 16, 10].includes(index) ? 21 : 16 }));
  Object.keys(sheet).forEach(address => {
    if (address[0] !== '!' && sheet[address].t === 'n') sheet[address].z = '#,##0.00';
  });
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Statement');
  XLSX.writeFile(workbook, filename);
}

function companyHeader(columns, documentTitle) {
  return [
    [COMPANY[0]], [COMPANY[1]], [COMPANY[2]], [COMPANY[3], ...Array(columns - 2), COMPANY[4]], [],
    [documentTitle], [],
  ];
}

function headerMerges(columns) {
  const end = columns - 1;
  return [
    { s: { r: 0, c: 0 }, e: { r: 0, c: end } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: end } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: end } },
    { s: { r: 5, c: 0 }, e: { r: 5, c: end } },
  ];
}

function statementRows({ cycle, client, trips, soaDate, periodCovered, serviceLabel, includeDr }) {
  const columns = includeDr ? 5 : 4;
  const rows = companyHeader(columns, 'BILLING STATEMENT / STATEMENT OF ACCOUNT');
  const infoRows = includeDr
    ? [
      ['Statement No.', cycle?.cycle_name || '—', '', 'SOA / Billing Date', soaDate ? formatDateDisplay(soaDate) : '—'],
      ['Period Covered', periodCovered || '—', '', 'Credit Terms', client?.credit_terms ? `${client.credit_terms} Days` : '—'],
    ]
    : [
      ['Statement No.', cycle?.cycle_name || '—', 'SOA / Billing Date', soaDate ? formatDateDisplay(soaDate) : '—'],
      ['Period Covered', periodCovered || '—', 'Credit Terms', client?.credit_terms ? `${client.credit_terms} Days` : '—'],
    ];
  rows.push(
    ...infoRows,
    [], ['BILL TO'], [client?.client_name || '—'], [client?.address || '—'], [`TIN: ${client?.tin || '—'}`],
    [`${serviceLabel}: ${[...new Set(trips.map(t => t.pickup_location).filter(Boolean))].join(', ') || '—'}`], [],
    ['DESCRIPTION OF SERVICES RENDERED'],
    includeDr ? ['Date', 'DR No.', 'Route', 'Truck Type', 'Amount'] : ['Date', 'Route', 'Truck Type', 'Amount'],
  );
  trips.forEach(trip => {
    const route = `${trip.delivery_location || '—'} → ${trip.delivery_code || '—'}${trip.trip_route_code ? ` (${trip.trip_route_code})` : ''}`;
    rows.push(includeDr
      ? [formatDateDisplay(trip.delivery_date), trip.dr_number || '—', route, trip.truck_type || '—', money(trip.gross_rate)]
      : [formatDateDisplay(trip.delivery_date), route, trip.truck_type || '—', money(trip.gross_rate)]
    );
  });
  const gross = trips.reduce((sum, trip) => sum + money(trip.gross_rate), 0);
  const tax = gross * 0.02;
  rows.push(['NOTHING FOLLOWS'], [], [], ['TOTAL GROSS EX VAT', gross], ['TOTAL DUE', gross], ['2% WITHHOLDING TAX', tax], ['AMOUNT DUE', gross - tax], [], ['Prepared By:', '', '', 'Received By:'], ['____________________________', '', '', '____________________________'], ['Date Prepared:', formatDateDisplay(new Date().toISOString().slice(0, 10)), '', 'Date Received: ______________']);
  return rows;
}

export function exportStatementExcel({ title, cycle, client, trips, soaDate, periodCovered, serviceLabel, includeDr }) {
  const columns = includeDr ? 5 : 4;
  const rows = statementRows({ cycle, client, trips, soaDate, periodCovered, serviceLabel, includeDr });
  const infoStart = 7;
  const billToStart = 10;
  const tableTitle = 16;
  const totalsStart = tableTitle + 3 + trips.length;
  const infoMerges = includeDr
    ? [{ s: { r: infoStart, c: 1 }, e: { r: infoStart, c: 2 } }, { s: { r: infoStart + 1, c: 1 }, e: { r: infoStart + 1, c: 2 } }]
    : [];
  const merges = [
    ...headerMerges(columns),
    ...infoMerges,
    { s: { r: billToStart, c: 0 }, e: { r: billToStart, c: columns - 1 } },
    { s: { r: billToStart + 1, c: 0 }, e: { r: billToStart + 1, c: columns - 1 } },
    { s: { r: billToStart + 2, c: 0 }, e: { r: billToStart + 2, c: columns - 1 } },
    { s: { r: billToStart + 3, c: 0 }, e: { r: billToStart + 3, c: columns - 1 } },
    { s: { r: billToStart + 4, c: 0 }, e: { r: billToStart + 4, c: columns - 1 } },
    { s: { r: tableTitle, c: 0 }, e: { r: tableTitle, c: columns - 1 } },
    { s: { r: totalsStart, c: 0 }, e: { r: totalsStart, c: columns - 2 } },
    { s: { r: totalsStart + 1, c: 0 }, e: { r: totalsStart + 1, c: columns - 2 } },
    { s: { r: totalsStart + 2, c: 0 }, e: { r: totalsStart + 2, c: columns - 2 } },
    { s: { r: totalsStart + 3, c: 0 }, e: { r: totalsStart + 3, c: columns - 2 } },
  ];
  makeSheet(rows, columns, includeDr ? [22, 18, 48, 18, 18] : [22, 52, 18, 18], merges, `${title.includes('Delivery') ? 'TopSheet_Delivery' : 'TopSheet_Shuttle'}_${safeName(cycle?.cycle_name)}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function exportSummaryExcel({ cycles, trips, client, soaDate, periodCovered }) {
  const columns = 5;
  const rows = companyHeader(columns, 'BILLING STATEMENT / STATEMENT OF ACCOUNT');
  rows.push(['Statements', cycles.map(c => c.cycle_name).join(', '), '', 'SOA / Billing Date', soaDate || '—'], ['Period Covered', periodCovered || '—'], [], ['BILL TO'], [client?.client_name || '—'], [client?.address || '—'], [`TIN: ${client?.tin || '—'}`], [], ['DESCRIPTION OF SERVICES RENDERED'], ['Date', 'Billing Statement', 'DR No.', 'Route', 'Amount']);
  trips.forEach(trip => rows.push([formatDateDisplay(trip.delivery_date), trip._cycle_name || '—', trip.dr_number || '—', trip.pickup_location || '—', money(trip.gross_rate)]));
  rows.push(['NOTHING FOLLOWS'], []);
  cycles.forEach(cycle => {
    const gross = trips.filter(trip => trip.billing_cycle_id === cycle.id).reduce((sum, trip) => sum + money(trip.gross_rate), 0);
    rows.push([cycle.cycle_name, gross], ['2% WITHHOLDING TAX', gross * 0.02], ['TOTAL', gross - gross * 0.02], []);
  });
  const grandTotal = trips.reduce((sum, trip) => sum + money(trip.gross_rate) * 0.98, 0);
  rows.push(['GRAND TOTAL', grandTotal], [], ['Prepared By:', '', '', 'Received By:'], ['____________________________', '', '', '____________________________'], ['Date Prepared:', formatDateDisplay(new Date().toISOString().slice(0, 10)), '', 'Date Received: ______________']);
  const tableTitle = 15;
  const totalStart = tableTitle + 3 + trips.length;
  const merges = [...headerMerges(columns), { s: { r: 7, c: 1 }, e: { r: 7, c: 2 } }, { s: { r: 8, c: 1 }, e: { r: 8, c: 4 } }, ...[10, 11, 12, 13].map(r => ({ s: { r, c: 0 }, e: { r, c: 4 } })), { s: { r: tableTitle, c: 0 }, e: { r: tableTitle, c: 4 } }, { s: { r: totalStart, c: 0 }, e: { r: totalStart, c: 3 } }];
  for (let row = totalStart + 1; row < totalStart + cycles.length * 4; row += 4) merges.push({ s: { r: row, c: 0 }, e: { r: row, c: 3 } }, { s: { r: row + 1, c: 0 }, e: { r: row + 1, c: 3 } }, { s: { r: row + 2, c: 0 }, e: { r: row + 2, c: 3 } });
  makeSheet(rows, columns, [22, 30, 18, 48, 18], merges, `TopSheet_Summary_${safeName(client?.client_name || 'Statements')}.xlsx`);
}

export function exportQuotationExcel(quote) {
  const columns = 6;
  const items = quote.line_items || [];
  const rows = companyHeader(columns, 'QUOTATION');
  rows.push(['Quote No.', quote.quote_number || '—', '', 'Quote Date', formatDateDisplay(quote.quote_date)], ['Validity', quote.validity || '—'], [], ['QUOTED FOR'], [quote.quoted_for_name || '—'], [quote.quoted_for_address || '—'], [], ['SERVICE ITEMS'], ['Service / Route', 'Truck Type', 'Trip Type', 'Trips', 'Rate', 'Total']);
  items.forEach(item => rows.push([item.description || '—', item.truck_type || '—', item.trip_type || '—', money(item.num_trips), money(item.rate), money(item.row_total)]));
  const totalRow = 16 + items.length;
  rows.push([], ['GRAND TOTAL', '', '', '', '', items.reduce((sum, item) => sum + money(item.row_total), 0)], [], ['TERMS & CONDITIONS'], [quote.terms_and_conditions || '—'], [], ['Prepared & Certified By:', quote.prepared_by || '—', '', 'Confirmed By:'], ['____________________________', '', '', '____________________________'], ['Date:', '', '', 'Date: ______________']);
  const merges = [...headerMerges(columns), { s: { r: 7, c: 1 }, e: { r: 7, c: 2 } }, { s: { r: 8, c: 1 }, e: { r: 8, c: 5 } }, ...[10, 11, 12].map(r => ({ s: { r, c: 0 }, e: { r, c: 5 } })), { s: { r: 14, c: 0 }, e: { r: 14, c: 5 } }, { s: { r: totalRow + 1, c: 0 }, e: { r: totalRow + 1, c: 4 } }, { s: { r: totalRow + 3, c: 0 }, e: { r: totalRow + 3, c: 5 } }, { s: { r: totalRow + 4, c: 0 }, e: { r: totalRow + 4, c: 5 } }];
  makeSheet(rows, columns, [48, 18, 18, 12, 18, 18], merges, `Quotation_${safeName(quote.quote_number)}.xlsx`);
}