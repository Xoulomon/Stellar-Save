import * as freighterApi from "@stellar/freighter-api";
import type { WalletAdapter, WalletConnection } from "./types";

type FreighterFunction<T extends (...args: unknown[]) => unknown> =
  | T
  | undefined;

const freighter = freighterApi as unknown as Record<string, unknown>;

function getFunction<T extends (...args: unknown[]) => unknown>(
  name: string,
): FreighterFunction<T> {
  const fn = freighter[name];
  if (typeof fn === "function") {
    return fn as T;
  }
  return undefined;
}

function getError(result: unknown): string | null {
  if (!result || typeof result !== "object") {
    return null;
  }

  const error = (result as { error?: unknown }).error;
  return typeof error === "string" && error.length > 0 ? error : null;
}

function getResultData<T>(result: unknown): T {
  if (!result || typeof result !== "object" || !("data" in result)) {
    return result as T;
  }
  return (result as { data: T }).data;
}

async function callFreighter<T>(name: string): Promise<T> {
  const fn = getFunction<() => Promise<unknown>>(name);
  if (!fn) {
    throw new Error(`${name} is not available on this Freighter API version.`);
  }

  const result = await fn();
  const error = getError(result);
  if (error) {
    throw new Error(error);
  }
  return getResultData<T>(result);
}

function normalizeWatcherReturn(result: unknown): () => void {
  if (typeof result === "function") {
    return result;
  }

  if (result && typeof result === "object") {
    const watcher = result as Record<string, unknown>;

    if (
      "unsubscribe" in watcher &&
      typeof watcher.unsubscribe === "function"
    ) {
      return () => (watcher.unsubscribe as () => void)();
    }

    if ("stop" in watcher && typeof watcher.stop === "function") {
      return () => (watcher.stop as () => void)();
    }

    if (
      "removeListener" in watcher &&
      typeof watcher.removeListener === "function"
    ) {
      return () => (watcher.removeListener as () => void)();
    }
  }

  return () => undefined;
}

async function canUseFreighter(): Promise<boolean> {
  const isConnected = getFunction<() => Promise<unknown>>("isConnected");
  if (!isConnected) {
    return false;
  }

  const result = await isConnected();
  const error = getError(result);
  if (error) {
    return false;
  }

  return Boolean(getResultData<boolean>(result));
}

export const freighterAdapter: WalletAdapter = {
  id: "freighter",
  name: "Freighter",

  async isInstalled() {
    return canUseFreighter();
  },

  async connect(): Promise<WalletConnection> {
    const installed = await canUseFreighter();
    if (!installed) {
      throw new Error("Freighter wallet is not installed.");
    }

    const isAllowed = await callFreighter<boolean>("isAllowed");
    if (!isAllowed) {
      await callFreighter("setAllowed");
    }

    const address = await callFreighter<string>("getAddress");
    const network = await callFreighter<string>("getNetwork");
    return { address, network };
  },

  async getAddress(): Promise<string> {
    return callFreighter<string>("getAddress");
  },

  async getNetwork(): Promise<string> {
    return callFreighter<string>("getNetwork");
  },

  watch(onChange: () => void): () => void {
    const watchWalletChanges = getFunction<(...args: unknown[]) => unknown>(
      "WatchWalletChanges",
    );

    if (!watchWalletChanges) {
      return () => undefined;
    }

    let watcherResult: unknown;
    try {
      watcherResult = watchWalletChanges(1500, onChange);
    } catch {
      watcherResult = watchWalletChanges(onChange, 1500);
    }
    return normalizeWatcherReturn(watcherResult);
  },
};
