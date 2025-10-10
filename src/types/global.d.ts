// Minimal typings for global Chart.js and Plotly usage in the app
interface ChartDataConfig { labels: string[]; datasets: any[] }
interface ChartInstance { data: ChartDataConfig; update(): void; destroy(): void }
interface ChartConfiguration { type: string; data: ChartDataConfig; options?: any }
interface ChartConstructor { new (ctx: CanvasRenderingContext2D, config: ChartConfiguration): ChartInstance }

interface PlotlyStatic { newPlot(el: any, data: any[], layout: any, config: any): any; react(el: any, data: any[], layout: any, config: any): any }

declare global {
  const Chart: ChartConstructor;
  const Plotly: PlotlyStatic;
  interface Window { WARCROW_ICON_MAP?: Record<string, string> }
}

export {};


