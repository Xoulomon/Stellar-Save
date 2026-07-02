import React from 'react';
import { AppLayout } from '../ui';
import { KycGate } from '../components/KycGate';
import { FiatRampScreen } from '../components/FiatRampScreen';

export default function WithdrawPage() {
  return (
    <AppLayout
      title="Sell Crypto"
      subtitle="Withdraw XLM or stablecoins to your bank account"
      footerText="Stellar Save — Built for transparent, on-chain savings"
    >
      <KycGate>
        <FiatRampScreen
          type="withdraw"
          title="Sell Crypto"
          description="Complete the hosted form to sell crypto and receive funds in your bank account."
          defaultAsset="USDC"
        />
      </KycGate>
    </AppLayout>
  );
}
