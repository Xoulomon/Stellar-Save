/**
 * Centralized error handler for Stellar Save frontend
 * Parses contract/network/wallet errors into user-friendly messages.
 */

export interface ParsedError {
  message: string;
  code?: string;
  isUserAction?: boolean; // User-cancelled/re-rejectable
  isNetworkError?: boolean;
  isWalletError?: boolean;
  action?: string; // Suggested action e.g. "switch network"
}

// Known Stellar/Freighter error patterns
const KNOWN_ERRORS = {
  USER_REJECT: [
    /user rejected/i,
    /cancelled by user/i,
    /user denied/i,
    'Request rejected by user'
  ],
  INSUFFICIENT_FUNDS: [
    /insufficient balance/i,
    /insufficient funds/i
  ],
  NETWORK_ERROR: [
    /network error/i,
    /timeout/i,
    /failed to fetch/i,
    /ENOTFOUND/i,
    'ECONNRESET'
  ],
  INVALID_ADDRESS: [
    /invalid address/i,
    /invalid account/i
  ],
  CONTRACT_ERROR: [
    /contract execution/i,
    /revert/i // Generic, though Stellar uses different
  ],
  FREIGHTER_ERROR: [
    /freighter/i,
    'Freighter not installed'
  ]
} as const;

export function errorHandler(error: unknown): ParsedError {
  if (!error || typeof error !== 'object') {
    return {
      message: 'An unexpected error occurred. Please try again.'
    };
  }

  const errObj = error as Error & { code?: string; data?: any };

  // Check known patterns
  for (const [type, patterns] of Object.entries(KNOWN_ERRORS)) {
for (const pattern of patterns.filter(p => p instanceof RegExp) as RegExp[]) {
      if (pattern.test(errObj.message || '')) {
        return getUserFriendlyError(type, errObj);
      }
    }
  }

  // Specific Stellar SDK checks
  if (typeof errObj.code === 'string') {
    return handleStellarCode(errObj);
  }

  // Freighter specific
  if (errObj.message?.includes('Freighter')) {
    return {
      message: 'Freighter wallet required. Please install and connect Freighter.',
      code: 'FREIGHTER_MISSING',
      action: 'Install Freighter'
    };
  }

  // Generic fallback
  return {
    message: errObj.message || 'Something went wrong. Please try again.',
    isNetworkError: true,
    action: 'Check connection'
  };
}

export function formatErrorMessage(error: unknown): string {
  return errorHandler(error).message;
}

// Helpers
function getUserFriendlyError(type: string, err: Error): ParsedError {
  const messages: Record<string, ParsedError> = {
    USER_REJECT: {
      message: 'Transaction cancelled. This is safe.',
      code: 'USER_REJECTED',
      isUserAction: true
    },
    INSUFFICIENT_FUNDS: {
      message: 'Insufficient balance. Please add more XLM.',
      code: 'INSUFFICIENT_FUNDS',
      action: 'Fund wallet'
    },
    NETWORK_ERROR: {
      message: 'Network connection failed. Check your internet.',
      code: 'NETWORK_ERROR',
      isNetworkError: true,
      action: 'Retry'
    },
    INVALID_ADDRESS: {
      message: 'Invalid wallet address. Please check and try again.',
      code: 'INVALID_ADDRESS'
    },
    CONTRACT_ERROR: {
      message: 'Smart contract error occurred. Please try again.',
      code: 'CONTRACT_ERROR'
    },
    FREIGHTER_ERROR: {
      message: 'Freighter wallet error. Please check wallet settings.',
      code: 'FREIGHTER_ERROR',
      isWalletError: true
    }
  };

  return {
    ...messages[type],
    ...extractTechnicalDetails(err)
  };
}

function handleStellarCode(err: Error & { code?: string; data?: any }): ParsedError {
  if (!err.code) {
    return {
      message: 'Unknown Stellar SDK error. Please try again.',
      isNetworkError: true
    };
  }
  const stellarCodes: Record<string, string> = {
    'not_found': 'Account or resource not found.',
    'transaction_failed': 'Transaction failed. Check details.',
    'invalid_account': 'Invalid Stellar account.'
  };

  if (stellarCodes[err.code]) {
    return {
      message: stellarCodes[err.code],
      code: err.code
    };
  }

  return {
    message: `Stellar error (${err.code}). Please check network or try again.`,
    code: err.code,
    isNetworkError: true
  };
}

function extractTechnicalDetails(err: Error): Partial<ParsedError> {
  return {
    code: (err as any).code || undefined
  };
}

// Common usage example
/*
try {
  // wallet operation
} catch (error) {
  const parsed = errorHandler(error);
  toast.error(parsed.message);
}
*/

