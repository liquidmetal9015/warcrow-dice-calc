/**
 * CombatCharts - Renders combat-specific charts (wounds and specials)
 */
import type { CombatResults, Distribution } from '../../../domain/dice';
import type { ChartService } from '../../../services/ChartService';

export class CombatCharts {
  private chartService: ChartService;

  constructor(chartService: ChartService) {
    this.chartService = chartService;
  }

  /**
   * Render all combat charts
   */
  render(results: CombatResults): void {
    this.renderWoundsCharts(results);
    this.renderSpecialsCharts(results);
  }

  /**
   * Render wounds charts
   */
  private renderWoundsCharts(results: CombatResults): void {
    // Attacker wounds chart
    const woundsA = this.buildSeries(results.woundsAttacker);
    const cumA = this.buildCumulativeSeries(results.woundsAttacker);

    this.chartService.ensureChart('combat-wounds-attacker', 'bar', 
      {
        labels: woundsA.labels,
        datasets: [
          {
            type: 'bar',
            label: 'Wounds (Attacker -> Defender) %',
            data: woundsA.data,
            backgroundColor: 'rgba(33, 128, 141, 0.35)',
            borderColor: 'rgba(33, 128, 141, 1)',
            borderWidth: 1
          },
          {
            type: 'line',
            label: 'Cumulative % (>= x)',
            data: cumA.data,
            borderColor: 'rgba(33, 128, 141, 1)',
            backgroundColor: 'rgba(33, 128, 141, 1)',
            yAxisID: 'y',
            tension: 0.2
          }
        ]
      },
      {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        scales: {
          x: { title: { display: true, text: 'Wounds' } },
          y: { beginAtZero: true, max: 100, title: { display: true, text: 'Probability %' } }
        }
      }
    );

    // Defender wounds chart
    const woundsD = this.buildSeries(results.woundsDefender);
    const cumD = this.buildCumulativeSeries(results.woundsDefender);

    this.chartService.ensureChart('combat-wounds-defender', 'bar',
      {
        labels: woundsD.labels,
        datasets: [
          {
            type: 'bar',
            label: 'Wounds (Defender -> Attacker) %',
            data: woundsD.data,
            backgroundColor: 'rgba(192, 21, 47, 0.25)',
            borderColor: 'rgba(192, 21, 47, 1)',
            borderWidth: 1
          },
          {
            type: 'line',
            label: 'Cumulative % (>= x)',
            data: cumD.data,
            borderColor: 'rgba(192, 21, 47, 1)',
            backgroundColor: 'rgba(192, 21, 47, 1)',
            yAxisID: 'y',
            tension: 0.2
          }
        ]
      },
      {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        scales: {
          x: { title: { display: true, text: 'Wounds' } },
          y: { beginAtZero: true, max: 100, title: { display: true, text: 'Probability %' } }
        }
      }
    );
  }

  /**
   * Render specials distribution charts
   */
  private renderSpecialsCharts(results: CombatResults): void {
    // Attacker specials
    const sA = this.buildSeries(results.attackerSpecialsDist);
    const cA = this.buildCumulativeSeries(results.attackerSpecialsDist);

    this.chartService.ensureChart('combat-specials-attacker', 'bar',
      {
        labels: sA.labels,
        datasets: [
          {
            type: 'bar',
            label: 'Attacker Specials %',
            data: sA.data,
            backgroundColor: 'rgba(234,179,8,0.35)',
            borderColor: 'rgba(234,179,8,1)',
            borderWidth: 1
          },
          {
            type: 'line',
            label: 'Cumulative % (>= x)',
            data: cA.data,
            borderColor: 'rgba(234,179,8,1)',
            backgroundColor: 'rgba(234,179,8,1)',
            yAxisID: 'y',
            tension: 0.2
          }
        ]
      },
      {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        scales: {
          x: { title: { display: true, text: 'Specials (Attacker)' } },
          y: { beginAtZero: true, max: 100, title: { display: true, text: 'Probability %' } }
        }
      }
    );

    // Defender specials
    const sD = this.buildSeries(results.defenderSpecialsDist);
    const cD = this.buildCumulativeSeries(results.defenderSpecialsDist);

    this.chartService.ensureChart('combat-specials-defender', 'bar',
      {
        labels: sD.labels,
        datasets: [
          {
            type: 'bar',
            label: 'Defender Specials %',
            data: sD.data,
            backgroundColor: 'rgba(41,150,161,0.25)',
            borderColor: 'rgba(41,150,161,1)',
            borderWidth: 1
          },
          {
            type: 'line',
            label: 'Cumulative % (>= x)',
            data: cD.data,
            borderColor: 'rgba(41,150,161,1)',
            backgroundColor: 'rgba(41,150,161,1)',
            yAxisID: 'y',
            tension: 0.2
          }
        ]
      },
      {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        scales: {
          x: { title: { display: true, text: 'Specials (Defender)' } },
          y: { beginAtZero: true, max: 100, title: { display: true, text: 'Probability %' } }
        }
      }
    );
  }

  /**
   * Build series from distribution
   */
  private buildSeries(dataMap: Distribution): { labels: string[]; data: number[] } {
    const keys = Object.keys(dataMap).map(k => parseInt(k, 10)).filter(n => !Number.isNaN(n));
    const max = Math.max(0, ...keys.filter(k => (dataMap[Number(k)] || 0) > 0));
    const labels = Array.from({ length: max + 1 }, (_, i) => String(i));
    const data = labels.map(l => dataMap[parseInt(l, 10)] || 0);
    return { labels, data };
  }

  /**
   * Build cumulative series (tail probability >= x)
   */
  private buildCumulativeSeries(dataMap: Distribution): { labels: string[]; data: number[] } {
    const { labels, data } = this.buildSeries(dataMap);
    const out: number[] = new Array(data.length);
    let run = 0;
    for (let i = data.length - 1; i >= 0; i--) {
      run += (data[i] ?? 0);
      out[i] = run;
    }
    return { labels, data: out };
  }
}

