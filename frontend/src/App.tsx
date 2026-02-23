import {
  Alert,
  Box,
  Chip,
  Divider,
  Stack,
  Typography,
} from "@mui/material";
import { useWallet } from "./hooks/useWallet";
import {
  AppButton,
  AppCard,
  AppLayout,
  AppSelectField,
  type LayoutNavItem,
  type SelectOption,
} from "./ui";
import { Tabs, type Tab } from "./components";

function App() {
  const {
    wallets,
    selectedWalletId,
    status,
    activeAddress,
    network,
    connectedAccounts,
    error,
    refreshWallets,
    connect,
    disconnect,
    switchWallet,
    switchAccount,
  } = useWallet();

  const selectedWallet = wallets.find((wallet) => wallet.id === selectedWalletId);
  const canConnect = Boolean(selectedWallet?.installed) && status !== "connecting";
  const walletOptions: SelectOption[] = wallets.map((wallet) => ({
    value: wallet.id,
    label: `${wallet.name} ${wallet.installed ? "(Installed)" : "(Not Installed)"}`,
  }));
  const connectedAccountOptions: SelectOption[] =
    connectedAccounts.length === 0
      ? [{ value: "", label: "No accounts connected" }]
      : connectedAccounts.map((address) => ({ value: address, label: address }));
  const navItems: LayoutNavItem[] = [
    { key: "dashboard", label: "Dashboard" },
    { key: "wallets", label: "Wallets" },
    { key: "activity", label: "Activity" },
  ];
  
  const demoTabs: Tab[] = [
    {
      id: "overview",
      label: "Overview",
      icon: "📊",
      content: (
        <Box>
          <Typography variant="h6" gutterBottom>
            Wallet Overview
          </Typography>
          <Typography color="text.secondary">
            View your wallet connection status and manage your accounts.
          </Typography>
        </Box>
      ),
    },
    {
      id: "transactions",
      label: "Transactions",
      icon: "💸",
      content: (
        <Box>
          <Typography variant="h6" gutterBottom>
            Transaction History
          </Typography>
          <Typography color="text.secondary">
            Your recent transactions will appear here once connected.
          </Typography>
        </Box>
      ),
    },
    {
      id: "settings",
      label: "Settings",
      icon: "⚙️",
      content: (
        <Box>
          <Typography variant="h6" gutterBottom>
            Wallet Settings
          </Typography>
          <Typography color="text.secondary">
            Configure your wallet preferences and security options.
          </Typography>
        </Box>
      ),
    },
  ];
  
  const sidebar = (
    <AppCard>
      <Stack spacing={1.5}>
        <Typography variant="subtitle2" color="text.secondary">
          Wallet Summary
        </Typography>
        <Divider />
        <Typography variant="body2">
          Selected wallet: {selectedWallet?.name ?? "None"}
        </Typography>
        <Typography variant="body2">Connected accounts: {connectedAccounts.length}</Typography>
        <Typography variant="body2">Network: {network ?? "Not connected"}</Typography>
      </Stack>
    </AppCard>
  );

  return (
    <AppLayout
      title="Stellar Save"
      subtitle="Secure savings powered by Stellar wallets"
      navItems={navItems}
      sidebar={sidebar}
      footerText="Stellar Save - Built for transparent, on-chain savings"
    >
      <AppCard>
        <Stack spacing={2}>
          <Box>
            <Typography
              sx={{
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "primary.main",
                fontSize: "0.75rem",
                fontWeight: 700,
              }}
            >
              Stellar Save
            </Typography>
            <Typography variant="h1" sx={{ mt: 0.5 }}>
              Wallet Integration
            </Typography>
            <Typography color="text.secondary" sx={{ mt: 0.75 }}>
              UI now uses a centralized MUI theme with reusable wrapper components.
            </Typography>
          </Box>

          <AppSelectField
            id="wallet-select"
            label="Wallet"
            value={selectedWalletId}
            options={walletOptions}
            onChange={(event) => void switchWallet(event.target.value as string)}
          />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <AppButton onClick={() => void refreshWallets()}>
              Detect Wallets
            </AppButton>
            <AppButton onClick={() => void connect()} disabled={!canConnect}>
              {status === "connecting" ? "Connecting..." : "Connect Wallet"}
            </AppButton>
            <AppButton
              onClick={disconnect}
              disabled={status !== "connected"}
              color="secondary"
            >
              Disconnect
            </AppButton>
          </Stack>

          <AppSelectField
            id="account-select"
            label="Connected Accounts"
            value={activeAddress ?? ""}
            options={connectedAccountOptions}
            onChange={(event) => switchAccount(event.target.value as string)}
            disabled={connectedAccounts.length === 0}
          />

          <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
            <Chip label={`Status: ${status}`} color="primary" variant="outlined" />
            <Chip label={`Network: ${network ?? "Not connected"}`} />
          </Stack>

          <Box>
            <Typography variant="subtitle2" color="text.secondary">
              Active Address
            </Typography>
            <Typography sx={{ wordBreak: "break-all" }}>
              {activeAddress ?? "Not connected"}
            </Typography>
          </Box>

          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </AppCard>

      <AppCard>
        <Stack spacing={2}>
          <Box>
            <Typography variant="h2">Tabs Component Demo</Typography>
            <Typography color="text.secondary" sx={{ mt: 0.75 }}>
              Accessible tabs with keyboard navigation and multiple variants.
            </Typography>
          </Box>

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Default Variant
            </Typography>
            <Tabs tabs={demoTabs} />
          </Box>

          <Divider />

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Pills Variant
            </Typography>
            <Tabs tabs={demoTabs} variant="pills" />
          </Box>

          <Divider />

          <Box>
            <Typography variant="subtitle2" gutterBottom>
              Underline Variant
            </Typography>
            <Tabs tabs={demoTabs} variant="underline" />
          </Box>
        </Stack>
      </AppCard>
    </AppLayout>
  );
}
}

export default App;

