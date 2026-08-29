import CloseIcon from '@mui/icons-material/Close';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  List,
  ListItemButton,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Typography,
  IconButton,
} from '@mui/material';

import { useWallet } from '../hooks/useWallet';

const WALLET_ICONS: Record<string, string> = {
  freighter: 'https://stellar.creit.tech/wallet-icons/freighter.png',
  albedo: 'https://stellar.creit.tech/wallet-icons/albedo.png',
  lobstr: 'https://stellar.creit.tech/wallet-icons/lobstr.png',
};

interface WalletSelectModalProps {
  open: boolean;
  onClose: () => void;
}

export function WalletSelectModal({ open, onClose }: WalletSelectModalProps) {
  const { wallets, switchWallet } = useWallet();

  const handleSelect = async (walletId: string) => {
    await switchWallet(walletId);
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        Connect Wallet
        <IconButton onClick={onClose} size="small" aria-label="Close dialog" edge="end">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ p: 0 }}>
        <List>
          {wallets.map((wallet) => (
            <ListItemButton
              key={wallet.id}
              onClick={() => handleSelect(wallet.id)}
              aria-label={`Connect with ${wallet.name}${wallet.installed ? '' : ' (not installed)'}`}
            >
              <ListItemAvatar>
                <Avatar
                  src={WALLET_ICONS[wallet.id]}
                  alt={wallet.name}
                  sx={{ width: 32, height: 32 }}
                />
              </ListItemAvatar>
              <ListItemText
                primary={wallet.name}
                secondary={wallet.installed ? 'Detected' : 'Not installed'}
              />
              {!wallet.installed && (
                <Typography variant="caption" color="text.secondary">
                  Install
                </Typography>
              )}
            </ListItemButton>
          ))}
        </List>
      </DialogContent>
    </Dialog>
  );
}
