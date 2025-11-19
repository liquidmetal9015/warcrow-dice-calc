import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalysisUI } from '../../src/tabs/analysis/AnalysisUI';
import type { SharedServices } from '../../src/core/types';
import { JSDOM } from 'jsdom';

// Mock services
const mockServices: SharedServices = {
  storage: {
    save: vi.fn(),
    load: vi.fn(),
    remove: vi.fn(),
    clear: vi.fn()
  } as any,
  charts: {
    createDistributionChart: vi.fn(),
    createBivariateChart: vi.fn(),
    destroyChart: vi.fn(),
    updateChart: vi.fn()
  } as any,
  icons: {
    getIcon: vi.fn().mockReturnValue('X'),
    renderIcon: vi.fn().mockReturnValue('<span>X</span>')
  } as any,
  diceData: {
    getFaces: vi.fn(),
    load: vi.fn()
  } as any,
  simulation: {
    runAnalysisWithPipeline: vi.fn(),
    runCombatWithPipeline: vi.fn()
  } as any
};

describe('AnalysisUI', () => {
  let document: Document;
  let container: HTMLElement;
  let ui: AnalysisUI;

  beforeEach(() => {
    const dom = new JSDOM(`
      <div id="analysis-tab">
        <div id="symbol-summary"></div>
        <div class="dice-selector">
          <div class="dice-type">
            <span class="dice-label">Red</span>
            <button class="dice-btn-minus">-</button>
            <span class="dice-count">0</span>
            <button class="dice-btn-plus">+</button>
          </div>
        </div>
        <button id="reset-pool">Reset</button>
        <input type="checkbox" id="analysis-disarmed">
        <input type="checkbox" id="analysis-vulnerable">
        <div class="chart-section"></div>
        <span id="results-timestamp"></span>
        
        <!-- Chart modes -->
        <input type="radio" name="analysis-mode-hits" value="filled" checked>
        <input type="radio" name="analysis-mode-blocks" value="filled" checked>
        <input type="radio" name="analysis-mode-specials" value="filled" checked>
        <input type="radio" name="analysis-mode-hs" value="filled" checked>
        <input type="radio" name="analysis-mode-bs" value="filled" checked>
      </div>
    `);
    document = dom.window.document;
    container = document.getElementById('analysis-tab') as HTMLElement;
    
    // We need to mock global document if the code uses it, but AnalysisUI uses container.
    // However, SymbolSummary might use document.createElement. 
    // Ideally code should use container.ownerDocument or pass in document.
    // For now, let's proceed. If code uses global document, we might need `vi.stubGlobal`.
    
    ui = new AnalysisUI(container, mockServices);
  });

  it('instantiates without error', () => {
    expect(ui).toBeDefined();
  });

  it('updateDiceCount updates the text content', () => {
    ui.updateDiceCount('Red', 5);
    const count = container.querySelector('.dice-count');
    expect(count?.textContent).toBe('5');
  });

  it('resetUI resets counts and checkboxes', () => {
    // Setup dirty state
    const count = container.querySelector('.dice-count') as HTMLElement;
    count.textContent = '5';
    const disarmed = container.querySelector('#analysis-disarmed') as HTMLInputElement;
    disarmed.checked = true;

    ui.resetUI();

    expect(count.textContent).toBe('0');
    expect(disarmed.checked).toBe(false);
  });

  it('bindDiceAdjust calls handler on click', () => {
    const handler = vi.fn();
    ui.bindDiceAdjust(handler);

    const plusBtn = container.querySelector('.dice-btn-plus') as HTMLElement;
    plusBtn.click();

    expect(handler).toHaveBeenCalledWith('Red', true);

    const minusBtn = container.querySelector('.dice-btn-minus') as HTMLElement;
    minusBtn.click();

    expect(handler).toHaveBeenCalledWith('Red', false);
  });

  it('bindStateChange calls handler on change', () => {
    const handler = vi.fn();
    ui.bindStateChange(handler);

    const disarmed = container.querySelector('#analysis-disarmed') as HTMLInputElement;
    disarmed.checked = true;
    disarmed.dispatchEvent(new document.defaultView!.Event('change'));

    expect(handler).toHaveBeenCalledWith('disarmed', true);
  });
});

