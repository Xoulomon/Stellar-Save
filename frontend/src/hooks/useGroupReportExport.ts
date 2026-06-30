import { useCallback } from 'react';
import { buildFilename } from './useTransactionExport';
import type { DetailedGroup } from '../utils/groupApi';

// Re-use the low-level download helper from the existing export service.
function triggerDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeCSV(value: string | number | undefined): string {
  const s = String(value ?? '');
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/** Build a CSV containing every contribution record for the group. */
export function buildGroupContributionsCSV(group: DetailedGroup): string {
  const headers = ['Date', 'Member', 'Member ID', 'Amount (XLM)', 'TX Hash', 'Status'];
  const rows = group.contributions.map((c) =>
    [
      escapeCSV(new Date(c.timestamp).toISOString()),
      escapeCSV(c.memberName ?? c.memberId),
      escapeCSV(c.memberId),
      escapeCSV(c.amount),
      escapeCSV(c.transactionHash),
      escapeCSV(c.status),
    ].join(','),
  );
  return [headers.join(','), ...rows].join('\n');
}

/** Build a print-ready HTML document that summarises the group financials. */
export function buildGroupReportPDFHtml(group: DetailedGroup): string {
  const poolTotal = group.contributionAmount * group.totalMembers;
  const progress =
    group.targetAmount > 0
      ? ((group.currentAmount / group.targetAmount) * 100).toFixed(1)
      : '0.0';

  const cycleRows = group.cycles
    .map(
      (c) => `
    <tr>
      <td>Cycle ${c.cycleNumber}</td>
      <td>${new Date(c.startDate).toLocaleDateString()} – ${new Date(c.endDate).toLocaleDateString()}</td>
      <td>${c.currentAmount} XLM</td>
      <td>${c.targetAmount} XLM</td>
      <td>${c.status}</td>
    </tr>`,
    )
    .join('');

  const memberRows = group.members
    .map(
      (m) => `
    <tr>
      <td>${m.name ?? 'Anonymous'}</td>
      <td style="font-family:monospace;font-size:10px">${m.address}</td>
      <td>${m.totalContributions} XLM</td>
      <td>${m.isActive ? 'Active' : 'Inactive'}</td>
    </tr>`,
    )
    .join('');

  const contributionRows = group.contributions
    .map(
      (c) => `
    <tr>
      <td>${new Date(c.timestamp).toLocaleDateString()}</td>
      <td>${c.memberName ?? c.memberId}</td>
      <td>${c.amount} XLM</td>
      <td>${c.transactionHash}</td>
      <td>${c.status}</td>
    </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Stellar Save — Group Financial Report: ${group.name}</title>
<style>
  body { font-family: sans-serif; font-size: 11px; margin: 20px; color: #111; }
  h1 { font-size: 18px; margin-bottom: 4px; }
  h2 { font-size: 13px; margin: 20px 0 6px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
  .meta { color: #555; margin-bottom: 16px; }
  .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 8px; }
  .summary-card { border: 1px solid #ccc; border-radius: 4px; padding: 8px 12px; }
  .summary-card .label { font-size: 10px; color: #777; margin-bottom: 2px; }
  .summary-card .value { font-size: 15px; font-weight: bold; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; }
  th, td { border: 1px solid #ccc; padding: 4px 6px; text-align: left; }
  th { background: #f0f0f0; font-weight: bold; }
  tr:nth-child(even) { background: #fafafa; }
  .status-completed { color: #15803d; font-weight: 600; }
  .status-active { color: #1d4ed8; font-weight: 600; }
  .status-pending { color: #b45309; font-weight: 600; }
  @media print { body { margin: 10mm; } }
</style>
</head>
<body>
<h1>Stellar Save — Group Financial Report</h1>
<div class="meta">
  <strong>${group.name}</strong> &nbsp;|&nbsp; ID: ${group.id} &nbsp;|&nbsp;
  Status: <span class="status-${group.status}">${group.status}</span> &nbsp;|&nbsp;
  Generated: ${new Date().toLocaleString()}
</div>

<h2>Pool Summary</h2>
<div class="summary-grid">
  <div class="summary-card">
    <div class="label">Current Pool</div>
    <div class="value">${group.currentAmount} XLM</div>
  </div>
  <div class="summary-card">
    <div class="label">Target Amount</div>
    <div class="value">${group.targetAmount} XLM</div>
  </div>
  <div class="summary-card">
    <div class="label">Progress</div>
    <div class="value">${progress}%</div>
  </div>
  <div class="summary-card">
    <div class="label">Contribution / Cycle</div>
    <div class="value">${group.contributionAmount} XLM</div>
  </div>
  <div class="summary-card">
    <div class="label">Pool per Payout</div>
    <div class="value">${poolTotal} XLM</div>
  </div>
  <div class="summary-card">
    <div class="label">Total Members</div>
    <div class="value">${group.totalMembers}</div>
  </div>
</div>

<h2>Cycle History</h2>
<table>
  <thead>
    <tr><th>Cycle</th><th>Period</th><th>Collected</th><th>Target</th><th>Status</th></tr>
  </thead>
  <tbody>${cycleRows}</tbody>
</table>

<h2>Member Status</h2>
<table>
  <thead>
    <tr><th>Name</th><th>Address</th><th>Total Contributed</th><th>Status</th></tr>
  </thead>
  <tbody>${memberRows}</tbody>
</table>

<h2>Contribution History</h2>
<table>
  <thead>
    <tr><th>Date</th><th>Member</th><th>Amount</th><th>TX Hash</th><th>Status</th></tr>
  </thead>
  <tbody>${contributionRows}</tbody>
</table>
</body>
</html>`;
}

export interface GroupReportExportOptions {
  format: 'csv' | 'pdf';
}

export function useGroupReportExport(group: DetailedGroup) {
  const exportReport = useCallback(
    ({ format }: GroupReportExportOptions) => {
      // Derive a dated filename reusing the shared helper.
      const filename = buildFilename(format).replace(
        'stellar-save-transactions',
        `stellar-save-group-${group.id}-report`,
      );

      if (format === 'csv') {
        triggerDownload(buildGroupContributionsCSV(group), filename, 'text/csv;charset=utf-8;');
        return;
      }

      // PDF: open a print-ready HTML page in a new window.
      const win = window.open('', '_blank');
      if (!win) return;
      win.document.write(buildGroupReportPDFHtml(group));
      win.document.close();
      win.focus();
      win.print();
    },
    [group],
  );

  return { exportReport };
}
