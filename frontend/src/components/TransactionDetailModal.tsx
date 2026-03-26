import React from 'react';
import type { Transaction } from '../types/transaction';
import { Button } from './Button';
import { Badge } from './Badge';
import Modal from './Modal';

interface Props {
  transaction: Transaction | null;
  isOpen: boolean;
  onClose: () => void;
}

const TransactionDetailModal: React.FC<Props> = ({
  transaction,
  isOpen,
  onClose,
}) => {
  if (!isOpen || !transaction) return null;

  return (
    <Modal>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex justify-between items-center border-b border-gray-700 pb-4">
          <h2 className="text-2xl font-semibold">Transaction Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-3xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-gray-400 text-sm">Hash</p>
            <p className="font-mono text-sm break-all mt-1">{transaction.hash}</p>
          </div>
          <div>
            <p className="text-gray-400 text-sm">Date</p>
            <p className="mt-1">{new Date(transaction.createdAt).toLocaleString()}</p>
          </div>
        </div>

        <div className="flex justify-between items-center py-4">
          <div>
            <p className="text-gray-400 text-sm">Amount</p>
            <p
              className={`text-3xl font-bold ${
                parseFloat(transaction.amount) > 0 ? 'text-green-400' : 'text-red-400'
              }`}
            >
              {transaction.amount} {transaction.assetCode}
            </p>
          </div>

          {/* FIXED: Using 'danger' which exists in your Badge.tsx */}
          <Badge
            variant={transaction.status === 'success' ? 'success' : 'danger'}
          >
            {transaction.status.toUpperCase()}
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-6 text-sm">
          <div>
            <p className="text-gray-400">From</p>
            <p className="font-mono mt-1">{transaction.from}</p>
          </div>
          {transaction.to && (
            <div>
              <p className="text-gray-400">To</p>
              <p className="font-mono mt-1">{transaction.to}</p>
            </div>
          )}
        </div>

        {transaction.memo && (
          <div>
            <p className="text-gray-400">Memo</p>
            <p className="bg-gray-800 p-3 rounded-lg mt-1">{transaction.memo}</p>
          </div>
        )}

        <div className="flex gap-3 pt-6 border-t border-gray-700">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            Close
          </Button>
          <Button
            onClick={() =>
              window.open(
                `https://stellar.expert/explorer/testnet/tx/${transaction.hash}`,
                '_blank'
              )
            }
            className="flex-1"
          >
            View on Stellar Expert
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default TransactionDetailModal;