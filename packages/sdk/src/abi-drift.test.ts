/**
 * ABI Drift Test for packages/sdk
 * Asserts that SDK contract function definitions match the canonical contract ABI/spec.
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { CONTRACT_FUNCTIONS } from './contract';

describe('SDK ABI Drift Test', () => {
  it('SDK contract function names match the live contract ABI spec', () => {
    const abiPath = path.join(__dirname, 'contractAbi.json');
    expect(fs.existsSync(abiPath)).toBe(true);

    const abiContent = fs.readFileSync(abiPath, 'utf8');
    const abi = JSON.parse(abiContent);

    const abiMethods: string[] = abi.methods;
    const sdkMethods = Object.values(CONTRACT_FUNCTIONS);

    for (const method of sdkMethods) {
      expect(abiMethods).toContain(method);
    }
  });
});
