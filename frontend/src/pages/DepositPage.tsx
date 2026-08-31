import React from 'react';

import { FiatRampScreen } from '../components/FiatRampScreen';
import { KycGate } from '../components/KycGate';
import { AppLayout } from '../ui';

export default function DepositPage() {
  return (
    <AppLayout
      title="Buy Crypto"
      subtitle="Purchase XLM or stablecoins directly from your bank account"
      footerText="Stellar Save — Built for transparent, on-chain savings"
    >
      <KycGate>
        <FiatRampScreen
          type="deposit"
          title="Buy Crypto"
          description="Complete the hosted form to purchase crypto and have it sent to your Stellar account."
          defaultAsset="USDC"
        />
      </KycGate>
    </AppLayout>
  );
}
