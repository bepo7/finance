import type * as echarts from 'echarts/core'

export type ChartOption = echarts.EChartsCoreOption

export const AXIS = {
  axisLine: { lineStyle: { color: '#2a2e3d' } },
  axisLabel: { color: '#8b90a5', fontSize: 11 },
  splitLine: { lineStyle: { color: '#1a1d29' } },
}

export const TOOLTIP = {
  backgroundColor: '#10121b',
  borderColor: '#2a2e3d',
  textStyle: { color: '#e9ebf3', fontSize: 12 },
}

/** Paleta: espectro do Monte Carlo do vídeo (frio → quente) */
export const SPECTRUM = ['#ff4d5e', '#ff8a3d', '#ffc23d', '#c8e04a', '#4fd18b', '#2bc6c6', '#3d8bff', '#7a5cff']
export const SEG_COLOR: Record<string, string> = { semis: '#f6c744', ai: '#3d8bff', software: '#2bd99f' }
