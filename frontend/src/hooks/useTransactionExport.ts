import { useCallback } from 'react';
import type { Transaction } from '../types/transaction';

export interface ExportOptions {
  format: 'csv' | 'pdf';
  dateFrom?: Date;
  dateTo?: Date;
}

const CSV_HEADERS = ['Date', 'Type', 'Amount', 'Asset', 'From', 'To', 'Memo', 'Status', 'Fee', 'Hash'];

function escapeCSV(value: string | undefined): string {
  const s = value ?? '';
  // Wrap in quotes if contains comma, quote, or newline
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function filterByDateRange(
  transactions: Transaction[],
  dateFrom?: Date,
  dateTo?: Date,
): Transaction[] {
  return transactions.filter((tx) => {
    const d = new Date(tx.createdAt);
    if (dateFrom && d < dateFrom) return false;
    if (dateTo) {
      // Include the full dateTo day
      const end = new Date(dateTo);
      end.setHours(23, 59, 59, 999);
      if (d > end) return false;
    }
    return true;
  });
}

export function buildCSV(transactions: Transaction[]): string {
  const rows = transactions.map((tx) =>
    [
      escapeCSV(new Date(tx.createdAt).toISOString()),
      escapeCSV(tx.type),
      escapeCSV(tx.amount),
      escapeCSV(tx.assetCode),
      escapeCSV(tx.from),
      escapeCSV(tx.to),
      escapeCSV(tx.memo),
      escapeCSV(tx.status),
      escapeCSV(tx.fee),
      escapeCSV(tx.hash),
    ].join(','),
  );
  return [CSV_HEADERS.join(','), ...rows].join('\n');
}

export function buildFilename(format: 'csv' | 'pdf', dateFrom?: Date, dateTo?: Date): string {
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const suffix =
    dateFrom && dateTo
      ? `_${fmt(dateFrom)}_to_${fmt(dateTo)}`
      : dateFrom
      ? `_from_${fmt(dateFrom)}`
      : dateTo
      ? `_to_${fmt(dateTo)}`
      : `_${fmt(new Date())}`;
  return `stellar-save-transactions${suffix}.${format}`;
}

function triggerDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildPDFHtml(transactions: Transaction[]): string {
  const rows = transactions
    .map(
      (tx) => `
    <tr>
      <td>${new Date(tx.createdAt).toLocaleDateString()}</td>
      <td>${tx.type}</td>
      <td>${tx.amount} ${tx.assetCode}</td>
      <td>${tx.from}</td>
      <td>${tx.to ?? '—'}</td>
      <td>${tx.memo ?? '—'}</td>
      <td>${tx.status}</td>
      <td>${tx.fee}</td>
    </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Stellar Save — Transaction History</title>
<style>
  body { font-family: sans-serif; font-size: 11px; margin: 20px; }
  h1 { font-size: 16px; margin-bottom: 8px; }
  table { width: 100%; border-collapse: collapse; }
  th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; }
  th { background: #f0f0f0; font-weight: bold; }
  tr:nth-child(even) { background: #fafafa; }
</style>
</head>
<body>
<h1>Stellar Save — Transaction History (${transactions.length} records)</h1>
<table>
  <thead>
    <tr><th>Date</th><th>Type</th><th>Amount</th><th>From</th><th>To</th><th>Memo</th><th>Status</th><th>Fee</th></tr>
  </thead>
  <tbody>${rows}</tbody>
</table>
</body>
</html>`;
}

export function useTransactionExport(transactions: Transaction[]) {
  const exportTransactions = useCallback(
    ({ format, dateFrom, dateTo }: ExportOptions) => {
      const filtered = filterByDateRange(transactions, dateFrom, dateTo);
      const filename = buildFilename(format, dateFrom, dateTo);

      if (format === 'csv') {
        triggerDownload(buildCSV(filtered), filename, 'text/csv;charset=utf-8;');
        return;
      }

      // PDF: open a print-ready HTML page in a new window
      const win = window.open('', '_blank');
      if (!win) return;
      win.document.write(buildPDFHtml(filtered));
      win.document.close();
      win.focus();
      win.print();
    },
    [transactions],
  );

  return { exportTransactions };
}
