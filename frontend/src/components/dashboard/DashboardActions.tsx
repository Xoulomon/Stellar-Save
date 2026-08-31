import React from 'react';
import { Box, Button, Paper, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import GroupWorkIcon from '@mui/icons-material/GroupWork';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import { useNavigate } from 'react-router-dom';

export const DashboardActions: React.FC = () => {
  const navigate = useNavigate();

  return (
    <Paper sx={{ p: 3, mb: 3 }} elevation={1}>
      <Typography variant="h6" fontWeight="bold" gutterBottom>
        Quick Dashboard Actions
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 2 }}>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => navigate('/groups/create')}
        >
          Create Savings Group
        </Button>
        <Button
          variant="outlined"
          color="primary"
          startIcon={<GroupWorkIcon />}
          onClick={() => navigate('/groups/browse')}
        >
          Browse Open Circles
        </Button>
        <Button
          variant="outlined"
          color="secondary"
          startIcon={<AccountBalanceWalletIcon />}
          onClick={() => navigate('/deposit')}
        >
          Deposit XLM
        </Button>
      </Box>
    </Paper>
  );
};
