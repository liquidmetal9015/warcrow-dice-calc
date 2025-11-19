/**
 * BivariateCharts - Renders 2D heatmap charts for joint distributions
 */
import type { MonteCarloResults, JointDistribution } from '../../../domain/dice';
import type { ChartService } from '../../../services/ChartService';
import type { ChartMode } from './DistributionCharts';

export class BivariateCharts {
  private chartService: ChartService;

  constructor(chartService: ChartService) {
    this.chartService = chartService;
  }

  /**
   * Render bivariate charts
   */
  render(results: MonteCarloResults, modes: {
    hitsSpecials: ChartMode;
    blocksSpecials: ChartMode;
  }): void {
    this.renderHitsVsSpecials(results, modes.hitsSpecials);
    this.renderBlocksVsSpecials(results, modes.blocksSpecials);
  }

  /**
   * Render hits vs specials heatmap
   */
  private renderHitsVsSpecials(results: MonteCarloResults, mode: ChartMode): void {
    const jointMap = this.selectJointMap(
      results.jointHitsSpecialsFilled,
      results.jointHitsSpecialsHollow,
      results.jointHitsSpecialsTotal,
      mode
    );

    this.chartService.ensurePlotlyHeatmap(
      'chart-hits-vs-specials',
      jointMap,
      'Hits',
      'Specials'
    );
  }

  /**
   * Render blocks vs specials heatmap
   */
  private renderBlocksVsSpecials(results: MonteCarloResults, mode: ChartMode): void {
    const jointMap = this.selectJointMap(
      results.jointBlocksSpecialsFilled,
      results.jointBlocksSpecialsHollow,
      results.jointBlocksSpecialsTotal,
      mode
    );

    this.chartService.ensurePlotlyHeatmap(
      'chart-blocks-vs-specials',
      jointMap,
      'Blocks',
      'Specials'
    );
  }

  /**
   * Select appropriate joint distribution based on mode
   */
  private selectJointMap(
    filledMap: JointDistribution,
    hollowMap: JointDistribution,
    combinedMap: JointDistribution,
    mode: ChartMode
  ): JointDistribution {
    if (mode === 'hollow') return hollowMap;
    if (mode === 'both') return combinedMap;
    return filledMap;
  }
}

