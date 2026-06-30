import { useState } from 'react';
import { Box, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Typography, Fab } from '@mui/material';

const CATEGORIES = [
  { value: 'bug', label: '🐛 Bug report' },
  { value: 'feature', label: '✨ Feature request' },
  { value: 'general', label: '💬 General feedback' },
  { value: 'other', label: '📌 Other' },
];

export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState('general');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const reset = () => { setCategory('general'); setMessage(''); setStatus('idle'); };
  const handleClose = () => { setOpen(false); setTimeout(reset, 300); };

  const submit = async () => {
    if (!message.trim()) return;
    setStatus('sending');
    try {
      const res = await fetch('/api/v1/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, message, page: window.location.pathname }),
      });
      setStatus(res.ok ? 'sent' : 'error');
    } catch {
      setStatus('error');
    }
  };

  return (
    <>
      <Box
        component="button"
        onClick={() => setOpen(true)}
        aria-label="Send feedback"
        sx={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 1300,
          bgcolor: 'primary.main', color: '#fff', border: 'none', borderRadius: 2,
          px: 2, py: 1, cursor: 'pointer', fontWeight: 600, fontSize: 14,
          boxShadow: 3,
        }}
      >
        Feedback
      </Box>

      <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
        <DialogTitle>Send feedback</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '8px !important' }}>
          {status === 'sent' ? (
            <Typography>Thanks! We'll review your feedback shortly.</Typography>
          ) : (
            <>
              <TextField select label="Category" value={category} onChange={(e) => setCategory(e.target.value)} size="small">
                {CATEGORIES.map((c) => <MenuItem key={c.value} value={c.value}>{c.label}</MenuItem>)}
              </TextField>
              <TextField
                label="Your feedback" multiline rows={4} value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tell us what you think…" inputProps={{ maxLength: 1000 }}
              />
              {status === 'error' && <Typography color="error" variant="caption">Failed to send. Please try again.</Typography>}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Close</Button>
          {status !== 'sent' && (
            <Button variant="contained" onClick={submit} disabled={status === 'sending' || !message.trim()}>
              {status === 'sending' ? 'Sending…' : 'Send'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </>
  );
}
