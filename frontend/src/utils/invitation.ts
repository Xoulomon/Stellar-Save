/**
 * Invitation link utilities for group sharing.
 * Links are deterministic per group — no backend needed.
 */

const BASE_URL = typeof window !== 'undefined' ? window.location.origin : '';

/** Generate a shareable invitation URL for a group */
export function generateInviteLink(groupId: string): string {
  return `${BASE_URL}/groups/join/${groupId}`;
}

/** Track invitation usage in localStorage */
const STORAGE_KEY = 'stellar_invite_usage';

interface InviteUsage {
  [groupId: string]: number;
}

export function trackInviteShare(groupId: string): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const usage: InviteUsage = raw ? JSON.parse(raw) : {};
    usage[groupId] = (usage[groupId] ?? 0) + 1;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(usage));
  } catch {
    // ignore storage errors
  }
}

export function getInviteShareCount(groupId: string): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    const usage: InviteUsage = JSON.parse(raw);
    return usage[groupId] ?? 0;
  } catch {
    return 0;
  }
}

/** Build social sharing URLs */
export function buildShareUrls(inviteLink: string, groupName: string) {
  const text = encodeURIComponent(`Join my savings group "${groupName}" on Stellar Save!`);
  const url = encodeURIComponent(inviteLink);
  return {
    twitter: `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
    whatsapp: `https://wa.me/?text=${text}%20${url}`,
    telegram: `https://t.me/share/url?url=${url}&text=${text}`,
  };
}
