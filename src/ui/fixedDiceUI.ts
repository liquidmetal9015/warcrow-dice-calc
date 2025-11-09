import type { FixedDie, FixedDiceConfig } from '../dice.js';
import { saveFixedDice, loadFixedDice, clearFixedDice } from '../utils/fixedDiceStorage.js';

/**
 * Fixed Dice UI Controller
 * Manages the modal interface for selecting and managing fixed dice
 */

// Type for dice colors (matches the keys in warcrow_dice_faces.json)
type DiceColor = 'Red' | 'Orange' | 'Yellow' | 'Green' | 'Blue' | 'Black';

// Type for scopes
type Scope = 'analysis' | 'attacker' | 'defender';

// Cache DOM elements
let modal: HTMLElement | null = null;
let modalTitle: HTMLElement | null = null;
let faceSelector: HTMLElement | null = null;
let fixedDiceList: HTMLElement | null = null;
let clearAllBtn: HTMLElement | null = null;
let doneBtn: HTMLElement | null = null;
let closeBtn: HTMLElement | null = null;

// Current state
let currentColor: DiceColor | null = null;
let currentScope: Scope | null = null;

// Callback for when fixed dice config changes
type OnChangeCallback = (scope: Scope, config: FixedDiceConfig) => void;
let onChangeCallback: OnChangeCallback | null = null;

/**
 * Initialize the fixed dice UI system
 */
export function initFixedDiceUI(onChange: OnChangeCallback): void {
  onChangeCallback = onChange;

  // Cache DOM elements
  modal = document.getElementById('fixed-dice-modal');
  modalTitle = document.querySelector('#fixed-dice-modal .modal__title');
  faceSelector = document.getElementById('fixed-dice-face-selector');
  fixedDiceList = document.getElementById('fixed-dice-list');
  clearAllBtn = document.getElementById('clear-all-fixed-dice');
  doneBtn = document.getElementById('done-fixed-dice');
  closeBtn = document.querySelector('#fixed-dice-modal .modal__close');

  if (!modal || !modalTitle || !faceSelector || !fixedDiceList || !clearAllBtn || !doneBtn || !closeBtn) {
    console.error('Fixed dice UI elements not found');
    return;
  }

  // Set up event listeners
  closeBtn.addEventListener('click', closeModal);
  doneBtn.addEventListener('click', closeModal);
  clearAllBtn.addEventListener('click', handleClearAll);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  // Set up fix button listeners for all dice controls
  document.querySelectorAll('.btn--fix').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget as HTMLElement;
      const color = target.dataset.color as DiceColor;
      const scope = determineScope(target);
      if (color && scope) {
        openFixedDiceModal(color, scope);
      }
    });
  });

  // Initialize indicators
  updateAllIndicators();
}

/**
 * Determine the scope (analysis/attacker/defender) based on element location
 */
function determineScope(element: HTMLElement): Scope | null {
  // Check if element is in analysis tab
  if (element.closest('#analysis-tab')) {
    return 'analysis';
  }
  
  // Check if element is in combat tab
  const combatTab = element.closest('#combat-tab');
  if (combatTab) {
    // Check if in attacker or defender section
    if (element.closest('.pool-controls[data-role="attacker"]')) {
      return 'attacker';
    }
    if (element.closest('.pool-controls[data-role="defender"]')) {
      return 'defender';
    }
  }
  
  return null;
}

/**
 * Type guard for Scope
 */
function isScope(value: string): value is Scope {
  return value === 'analysis' || value === 'attacker' || value === 'defender';
}

/**
 * Type guard for DiceColor
 */
function isDiceColor(value: string): value is DiceColor {
  return value === 'Red' || value === 'Orange' || value === 'Yellow' || 
         value === 'Green' || value === 'Blue' || value === 'Black';
}

/**
 * Open the modal for a specific die color and scope
 */
export function openFixedDiceModal(color: DiceColor, scope: Scope): void {
  if (!modal || !modalTitle || !faceSelector || !fixedDiceList) return;

  currentColor = color;
  currentScope = scope;

  // Update modal title
  modalTitle.textContent = `Fix ${color} Dice`;

  // Render face selector grid
  renderFaceGrid(color);

  // Render current fixed dice list
  renderFixedDiceList(scope);

  // Show modal
  modal.classList.add('modal--open');
}

/**
 * Close the modal
 */
function closeModal(): void {
  if (!modal) return;
  modal.classList.remove('modal--open');
  currentColor = null;
  currentScope = null;
}

/**
 * Render the grid of available faces for selection
 */
function renderFaceGrid(color: DiceColor): void {
  if (!faceSelector) return;

  // Get dice faces from global data
  const diceFaces = (window as any).WARCROW_DICE_FACES;
  if (!diceFaces) {
    faceSelector.innerHTML = '<p class="text-error">Dice face data not loaded</p>';
    return;
  }

  const colorFaces = diceFaces[color];
  if (!colorFaces || !Array.isArray(colorFaces)) {
    faceSelector.innerHTML = '<p class="text-error">No faces found for this color</p>';
    return;
  }

  // Build face grid HTML
  const faceGrid = document.createElement('div');
  faceGrid.className = 'face-grid';

  colorFaces.forEach((face: any, index: number) => {
    const faceOption = document.createElement('button');
    faceOption.className = 'face-option';
    faceOption.dataset.faceIndex = String(index);
    faceOption.type = 'button';

    // Render symbols using icon map
    const icons = renderSymbols(face);
    
    faceOption.innerHTML = `
      <div class="face-option__icon">${icons}</div>
      <div class="face-option__label">Face ${index + 1}</div>
    `;

    faceOption.addEventListener('click', () => handleFaceSelection(index));

    faceGrid.appendChild(faceOption);
  });

  faceSelector.innerHTML = '<h4 class="face-selector__title">Select a Face</h4>';
  faceSelector.appendChild(faceGrid);
}

/**
 * Render symbols for a die face using the icon map
 */
function renderSymbols(face: Record<string, number>): string {
  const iconMap = (window as any).WARCROW_ICON_MAP;
  if (!iconMap) return '?';

  const symbols: string[] = [];
  
  for (const [symbol, count] of Object.entries(face)) {
    if (count > 0) {
      const icon = iconMap[symbol] || '?';
      // Repeat icon for count
      for (let i = 0; i < count; i++) {
        symbols.push(icon);
      }
    }
  }

  return symbols.join(' ') || '∅';
}

/**
 * Handle face selection - add to fixed dice config
 */
function handleFaceSelection(faceIndex: number): void {
  if (!currentColor || !currentScope) return;

  // Load current config
  const config = loadFixedDice(currentScope);

  // Add new fixed die
  config.push({
    color: currentColor,
    faceIndex,
  });

  // Save updated config
  saveFixedDice(currentScope, config);

  // Update UI
  renderFixedDiceList(currentScope);
  updateIndicator(currentColor, currentScope);

  // Notify change
  if (onChangeCallback) {
    onChangeCallback(currentScope, config);
  }
}

/**
 * Render the list of currently fixed dice
 */
function renderFixedDiceList(scope: Scope): void {
  if (!fixedDiceList) return;

  const config = loadFixedDice(scope);

  if (config.length === 0) {
    fixedDiceList.innerHTML = `
      <h4 class="fixed-dice-list__title">Fixed Dice</h4>
      <div class="fixed-dice-list__empty">No dice fixed yet. Select a face above to fix a die.</div>
    `;
    return;
  }

  const listHtml = document.createElement('div');
  listHtml.innerHTML = '<h4 class="fixed-dice-list__title">Fixed Dice</h4>';

  const diceFaces = (window as any).WARCROW_DICE_FACES;

  config.forEach((fixedDie, index) => {
    const face = diceFaces?.[fixedDie.color]?.[fixedDie.faceIndex];
    const icons = face ? renderSymbols(face) : '?';

    const item = document.createElement('div');
    item.className = 'fixed-dice-item';
    item.innerHTML = `
      <div class="fixed-dice-item__info">
        <div class="fixed-dice-item__icon">${icons}</div>
        <div class="fixed-dice-item__details">
          <div class="fixed-dice-item__color">${fixedDie.color}</div>
          <div class="fixed-dice-item__face">Face ${fixedDie.faceIndex + 1}</div>
        </div>
      </div>
      <button class="fixed-dice-item__remove" data-index="${index}" type="button" title="Remove">×</button>
    `;

    const removeBtn = item.querySelector('.fixed-dice-item__remove');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => handleRemoveFixedDie(scope, index));
    }

    listHtml.appendChild(item);
  });

  fixedDiceList.innerHTML = '';
  fixedDiceList.appendChild(listHtml);
}

/**
 * Handle removing a fixed die from the config
 */
function handleRemoveFixedDie(scope: Scope, index: number): void {
  const config = loadFixedDice(scope);
  const removedDie = config[index];
  
  config.splice(index, 1);
  saveFixedDice(scope, config);

  renderFixedDiceList(scope);
  
  if (removedDie && isDiceColor(removedDie.color)) {
    updateIndicator(removedDie.color, scope);
  }

  if (onChangeCallback) {
    onChangeCallback(scope, config);
  }
}

/**
 * Handle clearing all fixed dice for current scope
 */
function handleClearAll(): void {
  if (!currentScope) return;

  clearFixedDice(currentScope);
  renderFixedDiceList(currentScope);
  updateAllIndicators();

  if (onChangeCallback) {
    onChangeCallback(currentScope, []);
  }
}

/**
 * Update indicator for a specific color and scope
 */
function updateIndicator(color: DiceColor, scope: Scope): void {
  const config = loadFixedDice(scope);
  const count = config.filter(d => d.color === color).length;

  // Find all indicators for this color in this scope
  const scopeElement = getScopeElement(scope);
  if (!scopeElement) return;

  const indicator = scopeElement.querySelector(`.fixed-dice-indicator[data-color="${color}"]`) as HTMLElement;
  if (!indicator) return;

  const countSpan = indicator.querySelector('.fixed-count');
  
  if (count > 0) {
    indicator.style.display = 'inline-flex';
    if (countSpan) countSpan.textContent = String(count);
  } else {
    indicator.style.display = 'none';
  }
}

/**
 * Update all indicators across all scopes
 */
function updateAllIndicators(): void {
  const scopes: Scope[] = ['analysis', 'attacker', 'defender'];
  const colors: DiceColor[] = ['Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Black'];

  for (const scope of scopes) {
    for (const color of colors) {
      updateIndicator(color, scope);
    }
  }
}

/**
 * Get the DOM element for a scope
 */
function getScopeElement(scope: Scope): HTMLElement | null {
  switch (scope) {
    case 'analysis':
      return document.getElementById('analysis-tab');
    case 'attacker':
      return document.querySelector('.pool-controls[data-role="attacker"]');
    case 'defender':
      return document.querySelector('.pool-controls[data-role="defender"]');
    default:
      return null;
  }
}

/**
 * Get current fixed dice config for a scope
 */
export function getFixedDiceConfig(scope: Scope): FixedDiceConfig {
  return loadFixedDice(scope);
}
