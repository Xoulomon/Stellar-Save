import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  TextField,
  Typography,
  Box,
  Alert,
  IconButton,
} from '@mui/material';
import { Button } from '../Button';
import type { TransactionTemplate, TransactionBuilderStep } from '../../types/transactionBuilder';
import { saveTemplate, generateShareCode } from '../../services/transactionBuilderService';

interface SaveTemplateModalProps {
  open: boolean;
  onClose: () => void;
  steps: TransactionBuilderStep[];
  template?: TransactionTemplate | null;
}

export function SaveTemplateModal({ open, onClose, steps, template }: SaveTemplateModalProps) {
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [saved, setSaved] = useState(false);
  const [shareCode, setShareCode] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setName(template?.name || '');
      setDescription(template?.description || '');
      setSaved(false);
      setShareCode('');
      setCopied(false);
    }
  }, [open, template]);

  const handleSave = () => {
    if (!name.trim()) return;

    const tpl: TransactionTemplate = {
      ...(template ? { id: template.id, createdAt: template.createdAt } : {}),
      name: name.trim(),
      description: description.trim(),
      steps,
      createdAt: template?.createdAt || Date.now(),
      updatedAt: Date.now(),
    } as TransactionTemplate;

    saveTemplate(tpl);
    setShareCode(generateShareCode(tpl));
    setSaved(true);
  };

  const handleCopyShareCode = async () => {
    try {
      await navigator.clipboard.writeText(shareCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const input = document.createElement('input');
      input.value = shareCode;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        <Typography variant="h6" fontWeight={700}>
          {template ? 'Update Template' : 'Save Transaction Template'}
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {!saved ? (
            <>
              <TextField
                label="Template Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                fullWidth
                required
                placeholder="e.g. Weekly Contribution"
              />
              <TextField
                label="Description (optional)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                fullWidth
                multiline
                rows={2}
                placeholder="What does this transaction do?"
              />
              <Typography variant="body2" color="text.secondary">
                {steps.filter(s => s.enabled).length} operation{steps.filter(s => s.enabled).length !== 1 ? 's' : ''} will be saved
              </Typography>
            </>
          ) : (
            <>
              <Alert severity="success" sx={{ fontSize: '0.85rem' }}>
                Template "{name}" saved successfully!
              </Alert>

              {shareCode && (
                <Stack spacing={1}>
                  <Typography variant="body2" fontWeight={600}>Share Code</Typography>
                  <Box
                    sx={{
                      bgcolor: 'grey.900',
                      color: 'limegreen',
                      fontFamily: 'monospace',
                      fontSize: '0.75rem',
                      p: 2,
                      borderRadius: 1,
                      wordBreak: 'break-all',
                    }}
                  >
                    {shareCode}
                  </Box>
                  <Box>
                    <Button variant="secondary" size="small" onClick={handleCopyShareCode}>
                      {copied ? 'Copied!' : 'Copy Share Code'}
                    </Button>
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    Anyone with this code can import your transaction template.
                  </Typography>
                </Stack>
              )}
            </>
          )}
        </Stack>
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 2 }}>
        {!saved ? (
          <>
            <Button variant="secondary" onClick={handleClose}>Cancel</Button>
            <Button variant="primary" onClick={handleSave} disabled={!name.trim()}>Save Template</Button>
          </>
        ) : (
          <Button variant="primary" onClick={handleClose}>Done</Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
