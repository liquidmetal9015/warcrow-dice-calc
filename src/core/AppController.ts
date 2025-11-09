/**
 * AppController - Main application controller
 * Manages tab routing and initialization
 */
import type { TabName, SharedServices } from './types';
import type { TabController } from '../tabs/base/TabController';
import { AnalysisTab } from '../tabs/analysis/AnalysisTab';
import { CombatTab } from '../tabs/combat/CombatTab';
import { ExplorerTab } from '../tabs/explorer/ExplorerTab';
import { FacesTab } from '../tabs/faces/FacesTab';
import { storageService } from '../services/StorageService';
import { chartService } from '../services/ChartService';
import { iconService } from '../services/IconService';
import { SimulationController } from '../controllers/simulationController';
import { diceData } from './DiceData';

export class AppController {
  private services: SharedServices;
  private tabs: Map<TabName, TabController> = new Map();
  private currentTab: TabName | null = null;

  constructor() {
    // Initialize shared services
    this.services = {
      storage: storageService,
      charts: chartService,
      icons: iconService,
      simulation: new SimulationController(),
      diceData: diceData
    };
  }

  /**
   * Initialize the application
   */
  async init(): Promise<void> {
    try {
      // Load dice data (required by all tabs)
      await this.services.diceData.load();

      // Initialize tabs
      this.initializeTabs();

      // Setup tab navigation
      this.setupTabNavigation();

      // Update static dice icons throughout the page
      this.updateStaticDiceIcons();

      // Show tab selector
      const tabSelector = document.querySelector('.tab-selector') as HTMLElement;
      if (tabSelector) {
        tabSelector.style.visibility = 'visible';
      }

      // Activate initial tab
      const activeBtn = document.querySelector('.tab-btn.active') as HTMLElement;
      const initialTab = (activeBtn?.dataset?.tab as TabName) || 'analysis';
      await this.switchTab(initialTab);

    } catch (e) {
      console.error('[AppController] Initialization failed:', e);
      alert('Failed to load dice data. Please refresh the page.');
    }
  }

  /**
   * Initialize all tab controllers
   */
  private initializeTabs(): void {
    const analysisContainer = document.getElementById('analysis-tab') as HTMLElement;
    const combatContainer = document.getElementById('combat-tab') as HTMLElement;
    const explorerContainer = document.getElementById('explorer-tab') as HTMLElement;
    const facesContainer = document.getElementById('faces-tab') as HTMLElement;

    if (analysisContainer) {
      this.tabs.set('analysis', new AnalysisTab(analysisContainer, this.services));
    }

    if (combatContainer) {
      this.tabs.set('combat', new CombatTab(combatContainer, this.services));
    }

    if (explorerContainer) {
      this.tabs.set('explorer', new ExplorerTab(explorerContainer, this.services));
    }

    if (facesContainer) {
      this.tabs.set('faces', new FacesTab(facesContainer, this.services));
    }
  }

  /**
   * Setup tab navigation buttons
   */
  private setupTabNavigation(): void {
    document.querySelectorAll<HTMLElement>('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tabName = btn.dataset?.tab as TabName;
        if (tabName) {
          this.switchTab(tabName);
        }
      });
    });
  }

  /**
   * Switch to a different tab
   */
  async switchTab(tabName: TabName): Promise<void> {
    if (tabName === this.currentTab) return;

    const newTab = this.tabs.get(tabName);
    if (!newTab) {
      console.warn(`[AppController] Tab not found: ${tabName}`);
      return;
    }

    // Deactivate current tab
    if (this.currentTab) {
      const currentTabController = this.tabs.get(this.currentTab);
      currentTabController?.deactivate();
    }

    // Initialize new tab if needed
    if (!newTab.isTabInitialized()) {
      await newTab.initialize();
    }

    // Activate new tab
    newTab.activate();
    this.currentTab = tabName;

    // Update tab buttons
    this.updateTabButtons(tabName);
  }

  /**
   * Update tab button states
   */
  private updateTabButtons(activeTab: TabName): void {
    document.querySelectorAll<HTMLElement>('.tab-btn').forEach(btn => {
      const isActive = btn.dataset?.tab === activeTab;
      btn.classList.toggle('active', isActive);
      btn.classList.toggle('btn--primary', isActive);
      btn.classList.toggle('btn--outline', !isActive);
    });
  }

  /**
   * Get a tab instance (for external access if needed)
   */
  getTab(tabName: TabName): TabController | undefined {
    return this.tabs.get(tabName);
  }

  /**
   * Update static dice icons throughout the page
   */
  private updateStaticDiceIcons(): void {
    document.querySelectorAll<HTMLElement>('.dice-type .dice-icon').forEach(div => {
      const parent = div.closest('.dice-type') as HTMLElement | null;
      const label = parent?.dataset.color;
      if (!label) return;

      const normalizedColor = label.toUpperCase();
      const key = `DIE_${normalizedColor}`;
      const iconHtml = this.services.icons.renderIcon(key as any);
      div.innerHTML = iconHtml;
    });
  }

  /**
   * Cleanup and dispose
   */
  dispose(): void {
    this.tabs.forEach(tab => tab.dispose());
    this.tabs.clear();
    this.services.charts.destroyAll();
  }
}

