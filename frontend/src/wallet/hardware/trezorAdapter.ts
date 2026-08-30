import { scanForDevices, connectToDevice, fetchAccounts, signWithHardwareWallet } from './hardwareService';

import type { HardwareDeviceInfo, HardwareAccount, TxApprovalRequest } from './types';

export class TrezorAdapter {
  readonly type = 'trezor' as const;

  async scan(): Promise<HardwareDeviceInfo[]> {
    return scanForDevices('trezor');
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
}

export const trezorAdapter = new TrezorAdapter();
