import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Upload, Download } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function ExcelImportExport({ entityName, columns, getExportData, onImportComplete }) {
  const fileInputRef = useRef(null);

  const handleExport = async () => {
    try {
      const data = await getExportData();
      const worksheet = XLSX.utils.json_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, entityName);
      XLSX.writeFile(workbook, `${entityName}_export.xlsx`);
    } catch (error) {
      alert('Export failed: ' + error.message);
    }
  };

  const handleImport = async (event) => {
    try {
      const file = event.target.files[0];
      if (!file) return;

      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(worksheet);

      if (jsonData.length === 0) {
        alert('Excel file is empty');
        return;
      }

      await onImportComplete(jsonData);
      alert(`Successfully imported ${jsonData.length} records`);
    } catch (error) {
      alert('Import failed: ' + error.message);
    }

    event.target.value = '';
  };

  return (
    <div className="flex gap-2">
      <Button onClick={handleExport} size="sm" variant="outline">
        <Download className="w-4 h-4 mr-1.5" /> Export Excel
      </Button>
      <Button onClick={() => fileInputRef.current?.click()} size="sm" variant="outline">
        <Upload className="w-4 h-4 mr-1.5" /> Import Excel
      </Button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handleImport}
        className="hidden"
      />
    </div>
  );
}