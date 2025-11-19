/**
 * ChartService - Manages Chart.js and Plotly chart instances
 * Handles creation, updating, and cleanup of charts
 */

declare const Chart: any;
declare const Plotly: any;

export interface ChartDataset {
  labels: string[];
  datasets: any[];
}

export interface ChartOptions {
  responsive?: boolean;
  maintainAspectRatio?: boolean;
  animation?: boolean | { duration: number };
  scales?: any;
  plugins?: any;
}

export class ChartService {
  private charts: Map<string, any> = new Map();
  private plotlyCharts: Set<string> = new Set();

  /**
   * Create or update a Chart.js chart
   */
  ensureChart(
    canvasId: string,
    type: string,
    data: ChartDataset,
    options: ChartOptions = {}
  ): void {
    const existingChart = this.charts.get(canvasId);

    if (existingChart) {
      // Update existing chart
      existingChart.data.labels = data.labels;
      existingChart.data.datasets = data.datasets;
      existingChart.update();
      return;
    }

    // Create new chart
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null;
    if (!canvas) {
      console.warn(`[ChartService] Canvas not found: ${canvasId}`);
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      console.warn(`[ChartService] Could not get 2D context for: ${canvasId}`);
      return;
    }

    const defaultOptions: ChartOptions = {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      ...options
    };

    const chart = new Chart(ctx, {
      type,
      data: {
        labels: data.labels,
        datasets: data.datasets
      },
      options: defaultOptions
    });

    this.charts.set(canvasId, chart);
  }

  /**
   * Create or update a Plotly heatmap
   */
  ensurePlotlyHeatmap(
    divId: string,
    jointMap: Record<number, Record<number, number>>,
    xLabel: string,
    yLabel: string
  ): void {
    const el = document.getElementById(divId);
    if (!el) {
      console.warn(`[ChartService] Plotly div not found: ${divId}`);
      return;
    }

    // Build grid from joint distribution
    const xKeys = Object.keys(jointMap).map(k => parseInt(k, 10)).filter(n => !Number.isNaN(n));
    const maxX = Math.max(0, ...(xKeys.length ? xKeys : [0]));
    
    let maxY = 0;
    for (const x of xKeys) {
      const yKeys = Object.keys(jointMap[x] || {}).map(k => parseInt(k, 10)).filter(n => !Number.isNaN(n));
      if (yKeys.length) maxY = Math.max(maxY, Math.max(...yKeys));
    }

    const width = maxX + 1;
    const height = maxY + 1;

    // Build probability matrix
    const z: number[][] = Array.from({ length: height }, () => 
      Array.from({ length: width }, () => 0)
    );
    
    for (let x = 0; x <= maxX; x++) {
      const row = jointMap[x] || {};
      for (let y = 0; y <= maxY; y++) {
        z[y]![x] = row[y] || 0;
      }
    }

    // Build cumulative probability matrix (for hover)
    const cum: number[][] = Array.from({ length: height }, () => 
      Array.from({ length: width }, () => 0)
    );
    
    for (let y = height - 1; y >= 0; y--) {
      for (let x = width - 1; x >= 0; x--) {
        const self = z[y]![x] || 0;
        const right = x + 1 < width ? (cum[y]![x + 1] || 0) : 0;
        const down = y + 1 < height ? (cum[y + 1]![x] || 0) : 0;
        const diag = (x + 1 < width && y + 1 < height) ? (cum[y + 1]![x + 1] || 0) : 0;
        cum[y]![x] = self + right + down - diag;
      }
    }

    // Color scheme
    const colorscale = [
      [0, 'rgb(19,52,59)'],
      [0.25, 'rgb(41,150,161)'],
      [0.5, 'rgb(33,128,141)'],
      [0.75, 'rgb(45,166,178)'],
      [1, 'rgb(50,184,198)']
    ];

    // Get CSS variables for styling
    const rs = getComputedStyle(document.documentElement);
    const textColor = (rs.getPropertyValue('--color-text') || '#333').trim();
    const borderColor = (rs.getPropertyValue('--color-border') || 'rgba(0,0,0,0.2)').trim();

    const hoverTemplate = 
      `${xLabel}=%{x}<br>` +
      `${yLabel}=%{y}<br>` +
      `P=%{z:.2f}%<br>` +
      `Cum P(>= %{x}, >= %{y})=%{customdata:.2f}%<extra></extra>`;

    const trace = {
      type: 'heatmap',
      x: Array.from({ length: width }, (_, i) => i),
      y: Array.from({ length: height }, (_, i) => i),
      z,
      customdata: cum,
      hovertemplate: hoverTemplate,
      colorscale,
      colorbar: {
        title: { text: 'Probability %', side: 'right' },
        tickcolor: textColor,
        tickfont: { color: textColor },
        titlefont: { color: textColor },
        thickness: 12
      },
      zmin: 0,
      zauto: true
    };

    const layout = {
      autosize: true,
      height: Math.max(200, height * 40 + 80),
      margin: { l: 44, r: 12, t: 8, b: 44 },
      xaxis: {
        title: { text: xLabel, font: { color: textColor } },
        dtick: 1,
        rangemode: 'tozero',
        tickfont: { color: textColor },
        gridcolor: borderColor,
        zerolinecolor: borderColor
      },
      yaxis: {
        title: { text: yLabel, font: { color: textColor } },
        dtick: 1,
        rangemode: 'tozero',
        tickfont: { color: textColor },
        gridcolor: borderColor,
        zerolinecolor: borderColor
      },
      font: { color: textColor },
      paper_bgcolor: 'rgba(0,0,0,0)',
      plot_bgcolor: 'rgba(0,0,0,0)',
      dragmode: false
    };

    const config = {
      displayModeBar: false,
      responsive: true,
      staticPlot: false,
      scrollZoom: false,
      doubleClick: false
    };

    // Create or update plot
    if ((el as any).data) {
      Plotly.react(el, [trace], layout, config);
    } else {
      Plotly.newPlot(el, [trace], layout, config);
      this.plotlyCharts.add(divId);
    }
  }

  /**
   * Destroy a specific chart
   */
  destroyChart(id: string): void {
    const chart = this.charts.get(id);
    if (chart) {
      chart.destroy();
      this.charts.delete(id);
    }

    if (this.plotlyCharts.has(id)) {
      const el = document.getElementById(id);
      if (el && (window as any).Plotly) {
        (window as any).Plotly.purge(el);
      }
      this.plotlyCharts.delete(id);
    }
  }

  /**
   * Destroy all charts
   */
  destroyAll(): void {
    // Destroy Chart.js instances
    this.charts.forEach(chart => chart.destroy());
    this.charts.clear();

    // Purge Plotly instances
    if ((window as any).Plotly) {
      this.plotlyCharts.forEach(id => {
        const el = document.getElementById(id);
        if (el) (window as any).Plotly.purge(el);
      });
    }
    this.plotlyCharts.clear();
  }

  /**
   * Get chart instance (for advanced use cases)
   */
  getChart(id: string): any | null {
    return this.charts.get(id) || null;
  }

  /**
   * Check if chart exists
   */
  hasChart(id: string): boolean {
    return this.charts.has(id) || this.plotlyCharts.has(id);
  }
}

// Singleton instance
export const chartService = new ChartService();

