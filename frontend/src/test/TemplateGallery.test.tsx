import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { TemplateCard } from '../components/templates/TemplateCard';
import { GROUP_TEMPLATES } from '../types/template';
import type { GroupTemplate } from '../types/template';

const template: GroupTemplate = GROUP_TEMPLATES[0]; // Weekly Saver

function renderCard(overrides?: Partial<{ onUse: (t: GroupTemplate) => void; onPreview: (t: GroupTemplate) => void }>) {
  const onUse = overrides?.onUse ?? vi.fn();
  const onPreview = overrides?.onPreview ?? vi.fn();
  return { onUse, onPreview, ...render(<TemplateCard template={template} onUse={onUse} onPreview={onPreview} />) };
}

describe('TemplateCard', () => {
  it('renders template name', () => {
    renderCard();
    expect(screen.getByText('Weekly Saver')).toBeInTheDocument();
  });

  it('renders cycle duration', () => {
    renderCard();
    expect(screen.getByText('7d')).toBeInTheDocument();
  });

  it('renders max members', () => {
    renderCard();
    expect(screen.getByText('up to 10')).toBeInTheDocument();
  });

  it('renders total duration', () => {
    renderCard();
    expect(screen.getByText('~10 weeks')).toBeInTheDocument();
  });

  it('calls onPreview when Preview is clicked', () => {
    const { onPreview } = renderCard();
    fireEvent.click(screen.getByRole('button', { name: /preview/i }));
    expect(onPreview).toHaveBeenCalledWith(template);
  });

  it('calls onUse when Use Template is clicked', () => {
    const { onUse } = renderCard();
    fireEvent.click(screen.getByRole('button', { name: /use template/i }));
    expect(onUse).toHaveBeenCalledWith(template);
  });
});

describe('GROUP_TEMPLATES', () => {
  it('has 5 templates', () => {
    expect(GROUP_TEMPLATES).toHaveLength(5);
  });

  it('all templates have required fields', () => {
    for (const t of GROUP_TEMPLATES) {
      expect(t.id).toBeGreaterThan(0);
      expect(t.name).toBeTruthy();
      expect(t.cycleDuration).toBeGreaterThan(0);
      expect(t.maxMembers).toBeGreaterThan(0);
      expect(['short', 'medium', 'long']).toContain(t.category);
    }
  });

  it('template ids are unique', () => {
    const ids = GROUP_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ─── TemplateGalleryPage smoke test ──────────────────────────────────────────
import TemplateGalleryPage from '../pages/TemplateGalleryPage';

// Minimal AppLayout mock
vi.mock('../ui', () => ({
  AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('TemplateGalleryPage', () => {
  function renderPage() {
    return render(
      <MemoryRouter>
        <TemplateGalleryPage />
      </MemoryRouter>
    );
  }

  it('renders all 5 templates by default', () => {
    renderPage();
    expect(screen.getAllByRole('button', { name: /use template/i })).toHaveLength(5);
  });

  it('filters to short templates', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /^short$/i }));
    // Weekly Saver + Biweekly Saver = 2 short templates
    expect(screen.getAllByRole('button', { name: /use template/i })).toHaveLength(2);
  });

  it('filters to long templates', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: /^long$/i }));
    expect(screen.getAllByRole('button', { name: /use template/i })).toHaveLength(1);
  });

  it('opens preview modal when Preview is clicked', () => {
    renderPage();
    fireEvent.click(screen.getAllByRole('button', { name: /preview/i })[0]);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
