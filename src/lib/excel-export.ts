import * as XLSX from 'xlsx';

export type ExportRow = {
  'Product ID': string; 'Quantity': number; 'Customer': string;
  'Phone': string; 'Adresse': string; 'City': string;
  'Price': number; 'Store': string; 'Note': string; 'Order': string;
};

export function exportOrdersToExcel(rows: ExportRow[], filename = 'orders.xlsx') {
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!cols'] = [
    { wch: 12 }, { wch: 10 }, { wch: 20 }, { wch: 15 },
    { wch: 30 }, { wch: 12 }, { wch: 10 }, { wch: 12 },
    { wch: 25 }, { wch: 12 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Orders');
  XLSX.writeFile(wb, filename);
}