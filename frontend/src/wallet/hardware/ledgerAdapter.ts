import type { HardwareDeviceInfo, HardwareAccount, TxApprovalRequest } from './types';
import { scanForDevices, connectToDevice, fetchAccounts, signWithHardwareWallet } from './hardwareService';

export class LedgerAdapter {
  readonly type = 'ledger' as const;

  async scan(): Promise<HardwareDeviceInfo[]> {
    return scanForDevices('ledger');
  }

  async connect(device: HardwareDeviceInfo): Promise<boolean> {
    return connectToDevice(device);
  }

  async getAccounts(device: HardwareDeviceInfo): Promise<HardwareAccount[]> {
    return fetchAccounts(device);
  }

  async signTransaction(
    request: TxApprovalRequest,
    device: HardwareDeviceInfo,
    onStatusChange?: (status: string) => void,
  ): Promise<string> {
    return signWithHardwareWallet(request, device, onStatusChange);
  }

  getStellarAppDescriptor() {
    return {
      name: 'Stellar',
      cla: 0xE0,
      apduPrefix: 'E0',
      requiredVersion: '4.0.0',
    };
  }
}

export const ledgerAdapter = new LedgerAdapter();
