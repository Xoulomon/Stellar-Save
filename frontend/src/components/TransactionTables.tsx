import React from 'react';
import type { Transaction } from '../types/transaction';
import { Badge } from './Badge';
import { Button } from './Button';

interface Props {
  transactions: Transaction[];
  isLoading: boolean;
  onRowClick: (tx: Transaction) => void;
}

const TransactionTable: React.FC<Props> = ({
  transactions,
  isLoading,
  onRowClick,
}) => {
  if (isLoading) {
    return (
      <div className="flex justify-center py-12 text-gray-400">
        Loading transactions...
      </div>
    );
  }

  if (transactions.length === 0) {
    return (
      <div className="bg-gray-900 rounded-2xl border border-gray-800 p-12 text-center">
        <p className="text-gray-400">No transactions found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto bg-gray-900 rounded-2xl border border-gray-800">
      <table className="w-full min-w-[800px]">
        <thead>
          <tr className="border-b border-gray-800 text-left text-gray-400 text-sm">
            <th className="p-6">Date</th>
            <th className="p-6">Type</th>
            <th className="p-6">Amount</th>
            <th className="p-6">Asset</th>
            <th className="p-6">From / To</th>
            <th className="p-6">Status</th>
            <th className="p-6"></th>
          </tr>
        </thead>
        <tbody>
          {transactions.map((tx) => (
            <tr
              key={tx.id}
              onClick={() => onRowClick(tx)}
              className="border-b border-gray-800 hover:bg-gray-800 cursor-pointer transition-colors"
            >
              <td className="p-6 text-sm text-gray-300">
                {new Date(tx.createdAt).toLocaleDateString()}
              </td>
              <td className="p-6 capitalize">{tx.type}</td>
              <td
                className={`p-6 font-medium ${
                  parseFloat(tx.amount) > 0 ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {tx.amount} {tx.assetCode}
              </td>
              <td className="p-6 font-medium">{tx.assetCode}</td>
              <td className="p-6 text-sm text-gray-400 truncate max-w-[180px]">
                {tx.from}
              </td>
              <td className="p-6">
                <Badge
                  variant={tx.status === 'success' ? 'success' : 'danger'}
                >
                  {tx.status}
                </Badge>
              </td>
              <td className="p-6">
                <Button variant="secondary" size="sm">
                  Details
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TransactionTable;