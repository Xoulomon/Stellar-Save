import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InviteModal } from '../components/InviteModal';

// Mock useClipboard
vi.mock('../hooks/useClipboard', () => ({
  useClipboard: () => ({ copy: vi.fn(), copied: false, error: null }),
}));

// Mock invitation utils
vi.mock('../utils/invitation', () => ({
  generateInviteLink: (id: string) => `https://example.com/groups/join/${id}`,
  buildShareUrls: () => ({
    twitter: 'https://twitter.com/intent/tweet?text=test',
    whatsapp: 'https://wa.me/?text=test',
    telegram: 'https://t.me/share/url?url=test',
  }),
  trackInviteShare: vi.fn(),
  getInviteShareCount: vi.fn(() => 0),
}));

// Mock QRCode to avoid canvas issues in jsdom
vi.mock('../components/QRCode', () => ({
  QRCode: ({ 'aria-label': ariaLabel }: { 'aria-label': string }) => (
    <div role="img" aria-label={ariaLabel}>
      QR
    </div>
  ),
}));

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  groupId: 'group-1',
  groupName: 'Test Group',
};

describe('InviteModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders when open', () => {
    render(<InviteModal {...defaultProps} />);
    expect(screen.getByText('Invite Members')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(<InviteModal {...defaultProps} open={false} />);
    expect(screen.queryByText('Invite Members')).not.toBeInTheDocument();
  });

  it('shows the invite link', () => {
    render(<InviteModal {...defaultProps} />);
    const input = screen.getByLabelText('Invitation link') as HTMLInputElement;
    expect(input.value).toBe('https://example.com/groups/join/group-1');
  });

  it('renders QR code with correct aria-label', () => {
    render(<InviteModal {...defaultProps} />);
    expect(
      screen.getByRole('img', { name: /QR code for joining Test Group/i })
    ).toBeInTheDocument();
  });

  it('renders social share buttons', () => {
    render(<InviteModal {...defaultProps} />);
    expect(screen.getByRole('button', { name: /whatsapp/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /twitter/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /telegram/i })).toBeInTheDocument();
  });

  it('calls onClose when Close button is clicked', () => {
    const onClose = vi.fn();
    render(<InviteModal {...defaultProps} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('opens social share URL in new tab', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    render(<InviteModal {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /whatsapp/i }));
    expect(openSpy).toHaveBeenCalledWith(
      expect.stringContaining('wa.me'),
      '_blank',
      'noopener,noreferrer'
    );
  });

  it('shows share count when > 0', async () => {
    const { getInviteShareCount } = await import('../utils/invitation');
    vi.mocked(getInviteShareCount).mockReturnValue(3);
    render(<InviteModal {...defaultProps} />);
    expect(screen.getByText(/shared 3 times/i)).toBeInTheDocument();
  });

  it('copy button has correct aria-label', () => {
    render(<InviteModal {...defaultProps} />);
    expect(screen.getByRole('button', { name: /copy invitation link/i })).toBeInTheDocument();
  });

  it('calls copy and trackInviteShare when copy button clicked', async () => {
    const { trackInviteShare } = await import('../utils/invitation');

    render(<InviteModal {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /copy invitation link/i }));

    await waitFor(() => {
      expect(trackInviteShare).toHaveBeenCalledWith('group-1');
    });
  });
});
