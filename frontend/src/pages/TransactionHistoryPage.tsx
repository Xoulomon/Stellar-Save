import React, { useState, useMemo } from 'react';
import type { Transaction, TransactionFilters as FilterType } from '../types/transaction';

import { useTransactions } from '../hooks/useTransactions';
import TransactionTable from '../components/TransactionTables';
import TransactionFilters from '../components/TransactionFilters';
import { SearchBar } from '../components/SearchBar';
import TransactionDetailModal from '../components/TransactionDetailModal';
import { TransactionExportButton } from '../components/TransactionExportButton';

const TransactionHistoryPage: React.FC = () => {
  const { transactions, isLoading } = useTransactions();

  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState<FilterType>({});
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  const filteredTxs = useMemo(() => {
    return transactions.filter((tx) => {
      const matchesSearch =
        !searchTerm ||
        tx.hash.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tx.from.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (tx.memo && tx.memo.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesType = !filters.type?.length || filters.type.includes(tx.type);
      const matchesStatus = !filters.status?.length || filters.status.includes(tx.status);

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [transactions, searchTerm, filters]);

  return (
    <div className="min-h-screen bg-gray-950 p-6 md:p-10">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white">Transaction History</h1>
            <p className="text-gray-400 mt-1">
              All your Stellar activity • {filteredTxs.length} results
            </p>
          </div>
          <TransactionExportButton transactions={filteredTxs} />
        </div>

        <div className="flex flex-col lg:flex-row gap-4 mb-8">
          <SearchBar
            onSearch={setSearchTerm}
            placeholder="Search by hash, address or memo..."
            defaultValue={searchTerm}
          />
          <TransactionFilters filters={filters} onChange={setFilters} />
        </div>

        <TransactionTable
          transactions={filteredTxs}
          isLoading={isLoading}
          onRowClick={setSelectedTx}
        />

        <TransactionDetailModal
          transaction={selectedTx}
          isOpen={!!selectedTx}
          onClose={() => setSelectedTx(null)}
        />
      </div>
    </div>
  );
};

export default TransactionHistoryPage;