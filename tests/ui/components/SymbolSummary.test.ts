import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SymbolSummary } from '../../../src/tabs/analysis/components/SymbolSummary';
import type { SharedServices } from '../../../src/core/types';
import type { MonteCarloResults } from '../../../src/domain/dice';
import { JSDOM } from 'jsdom';

// Mock services
const mockServices: SharedServices = {
  icons: {
    getIcon: vi.fn((key) => `[ICON:${key}]`),
    renderIcon: vi.fn((key) => `<i class="icon">${key}</i>`)
  } as any
} as any;

// Stub results
const mockResults: MonteCarloResults = {
  hits: { 0: 100 },
  blocks: { 0: 100 },
  specials: { 0: 100 },
  hollowHits: { 0: 100 },
  hollowBlocks: { 0: 100 },
  hollowSpecials: { 0: 100 },
  totalHits: { 0: 100 },
  totalBlocks: { 0: 100 },
  totalSpecials: { 0: 100 },
  jointHitsSpecialsFilled: { 0: { 0: 100 } },
  jointBlocksSpecialsFilled: { 0: { 0: 100 } },
  jointHitsSpecialsHollow: { 0: { 0: 100 } },
  jointBlocksSpecialsHollow: { 0: { 0: 100 } },
  jointHitsSpecialsTotal: { 0: { 0: 100 } },
  jointBlocksSpecialsTotal: { 0: { 0: 100 } },
  expected: {
    hits: 2.5,
    blocks: 1.0,
    specials: 0.5,
    hollowHits: 0.5,
    hollowBlocks: 0,
    hollowSpecials: 0
  },
  std: {
    hits: 0.1,
    blocks: 0.2,
    specials: 0.0
  },
  timestamp: '12:00:00'
};

describe('SymbolSummary', () => {
  let document: Document;
  let container: HTMLElement;
  let summary: SymbolSummary;

  beforeEach(() => {
    const dom = new JSDOM('<div id="summary"></div>');
    document = dom.window.document;
    container = document.getElementById('summary') as HTMLElement;
    
    summary = new SymbolSummary(container, mockServices.icons);
  });

  it('renders empty state initially', () => {
    summary.renderEmpty();
    expect(container.innerHTML).toBe('');
  });

  it('renders loading state', () => {
    summary.renderLoading();
    expect(container.querySelector('.loading-placeholder')).not.toBeNull();
  });

  it('renders statistics correctly', () => {
    summary.render(mockResults);
    
    // Check for expected values
    expect(container.innerHTML).toContain('2.50'); // Hits mean
    expect(container.innerHTML).toContain('0.10'); // Hits std
    
    // Check for symbol labels/icons (using our mock return)
    // The component might capitalize keys or use specific labels
    // Implementation detail: it likely iterates keys like 'hits', 'blocks'
    // and calls renderIcon or uses text.
    
    // Let's verify the structure generally contains the data
    const text = container.textContent || '';
    expect(text).toContain('2.50');
    expect(text).toContain('1.00');
    expect(text).toContain('0.50');
  });
});

