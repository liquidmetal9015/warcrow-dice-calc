/**
 * DistributionCharts - Renders distribution charts for hits, blocks, and specials
 */
import type { MonteCarloResults, Distribution } from '../../../domain/dice';
import type { ChartService } from '../../../services/ChartService';

export type ChartMode = 'filled' | 'hollow' | 'both';

export class DistributionCharts {
  private chartService: ChartService;

  constructor(chartService: ChartService) {
    this.chartService = chartService;
  }

  /**
   * Render all distribution charts
   */
  render(results: MonteCarloResults, modes: {
    hits: ChartMode;
    blocks: ChartMode;
    specials: ChartMode;
  }): void {
    this.renderHitsChart(results, modes.hits);
    this.renderBlocksChart(results, modes.blocks);
    this.renderSpecialsChart(results, modes.specials);
  }

  /**
   * Render hits distribution chart
   */
  private renderHitsChart(results: MonteCarloResults, mode: ChartMode): void {
    const colors = {
      filled: { bg: 'rgba(220,38,38,0.35)', border: 'rgba(220,38,38,1)' },
      hollow: { bg: 'rgba(220,38,38,0.15)', border: 'rgba(220,38,38,0.7)' }
    };

    const data = this.makeDatasets(
      results.hits,
      results.hollowHits,
      results.totalHits,
      colors,
      'Hits',
      mode
    );

    this.chartService.ensureChart('chart-hits', 'bar', data, {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: {
        x: { title: { display: true, text: 'Count' } },
        y: { beginAtZero: true, max: 100, title: { display: true, text: 'Probability %' } }
      }
    });
  }

  /**
   * Render blocks distribution chart
   */
  private renderBlocksChart(results: MonteCarloResults, mode: ChartMode): void {
    const colors = {
      filled: { bg: 'rgba(37,99,235,0.35)', border: 'rgba(37,99,235,1)' },
      hollow: { bg: 'rgba(37,99,235,0.15)', border: 'rgba(37,99,235,0.7)' }
    };

    const data = this.makeDatasets(
      results.blocks,
      results.hollowBlocks,
      results.totalBlocks,
      colors,
      'Blocks',
      mode
    );

    this.chartService.ensureChart('chart-blocks', 'bar', data, {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: {
        x: { title: { display: true, text: 'Count' } },
        y: { beginAtZero: true, max: 100, title: { display: true, text: 'Probability %' } }
      }
    });
  }

  /**
   * Render specials distribution chart
   */
  private renderSpecialsChart(results: MonteCarloResults, mode: ChartMode): void {
    const colors = {
      filled: { bg: 'rgba(234,179,8,0.35)', border: 'rgba(234,179,8,1)' },
      hollow: { bg: 'rgba(234,179,8,0.15)', border: 'rgba(234,179,8,0.7)' }
    };

    const data = this.makeDatasets(
      results.specials,
      results.hollowSpecials,
      results.totalSpecials,
      colors,
      'Specials',
      mode
    );

    this.chartService.ensureChart('chart-specials', 'bar', data, {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      scales: {
        x: { title: { display: true, text: 'Count' } },
        y: { beginAtZero: true, max: 100, title: { display: true, text: 'Probability %' } }
      }
    });
  }

  /**
   * Create datasets for a chart based on mode
   */
  private makeDatasets(
    filledMap: Distribution,
    hollowMap: Distribution,
    combinedMap: Distribution,
    colorSet: any,
    title: string,
    mode: ChartMode
  ): { labels: string[]; datasets: any[] } {
    const keysFilled = Object.keys(filledMap).map(k => parseInt(k, 10)).filter(n => !Number.isNaN(n) && (filledMap[n] || 0) > 0);
    const keysHollow = Object.keys(hollowMap).map(k => parseInt(k, 10)).filter(n => !Number.isNaN(n) && (hollowMap[n] || 0) > 0);
    const keysCombined = Object.keys(combinedMap || {}).map(k => parseInt(k, 10)).filter(n => !Number.isNaN(n) && ((combinedMap || {})[n] || 0) > 0);
    const maxKey = Math.max(0, ...keysFilled, ...keysHollow, ...keysCombined);
    const labels = Array.from({ length: maxKey + 1 }, (_, i) => String(i));

    const buildAligned = (map: Distribution, labels: string[]) => 
      labels.map((l: string) => map[parseInt(l, 10)] || 0);
    
    const tailCumulativeFrom = (arr: number[]) => {
      const out: number[] = new Array(arr.length);
      let run = 0;
      for (let i = arr.length - 1; i >= 0; i--) {
        run += (arr[i] ?? 0);
        out[i] = run;
      }
      return out;
    };

    const datasets: any[] = [];

    if (mode === 'filled') {
      const data = buildAligned(filledMap, labels);
      const tail = tailCumulativeFrom([...data]);
      datasets.push(
        { type: 'bar', label: `${title} (filled) %`, data, backgroundColor: colorSet.filled.bg, borderColor: colorSet.filled.border, borderWidth: 1 },
        { type: 'line', label: `${title} (filled) cumulative % (>= x)`, data: tail, borderColor: colorSet.filled.border, backgroundColor: colorSet.filled.border, yAxisID: 'y', tension: 0.2 }
      );
    } else if (mode === 'hollow') {
      const dataH = buildAligned(hollowMap, labels);
      const tailH = tailCumulativeFrom([...dataH]);
      datasets.push(
        { type: 'bar', label: `${title} (hollow) %`, data: dataH, backgroundColor: colorSet.hollow.bg, borderColor: colorSet.hollow.border, borderWidth: 1 },
        { type: 'line', label: `${title} (hollow) cumulative % (>= x)`, data: tailH, borderColor: colorSet.hollow.border, backgroundColor: colorSet.hollow.border, yAxisID: 'y', tension: 0.2 }
      );
    } else {
      const summed = buildAligned(combinedMap || {}, labels);
      const tailSum = tailCumulativeFrom([...summed]);
      datasets.push(
        { type: 'bar', label: `${title} (filled + hollow) %`, data: summed, backgroundColor: colorSet.filled.bg, borderColor: colorSet.filled.border, borderWidth: 1 },
        { type: 'line', label: `${title} (filled + hollow) cumulative % (>= x)`, data: tailSum, borderColor: colorSet.filled.border, backgroundColor: colorSet.filled.border, yAxisID: 'y', tension: 0.2 }
      );
    }

    return { labels, datasets };
  }
}

