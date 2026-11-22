import { useEffect, useRef } from 'react'
import * as echarts from 'echarts/core'
import { BarChart, GraphChart, LineChart, RadarChart, ScatterChart, CustomChart } from 'echarts/charts'
import {
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  MarkAreaComponent,
  MarkLineComponent,
  MarkPointComponent,
  RadarComponent,
  TooltipComponent,
  VisualMapComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([
  BarChart, GraphChart, LineChart, RadarChart, ScatterChart, CustomChart,
  DataZoomComponent, GridComponent, LegendComponent, MarkAreaComponent, MarkLineComponent, MarkPointComponent,
  RadarComponent, TooltipComponent, VisualMapComponent, CanvasRenderer,
])

import type { ChartOption } from './chartTheme'

export function Chart({ option, height = 320, className, onClick, ariaLabel }: {
  option: ChartOption
  height?: number | string
  className?: string
  onClick?: (p: { name?: string; data?: unknown; seriesName?: string }) => void
  ariaLabel: string
}) {
  const el = useRef<HTMLDivElement>(null)
  const inst = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    const chart = echarts.init(el.current!, undefined, { renderer: 'canvas' })
    inst.current = chart
    const ro = new ResizeObserver(() => chart.resize())
    ro.observe(el.current!)
    return () => {
      ro.disconnect()
      chart.dispose()
      inst.current = null
    }
  }, [])

  useEffect(() => {
    inst.current?.setOption({ backgroundColor: 'transparent', textStyle: { fontFamily: 'inherit' }, ...option }, true)
  }, [option])

  useEffect(() => {
    const c = inst.current
    if (!c || !onClick) return
    c.on('click', onClick as never)
    return () => {
      c.off('click')
    }
  }, [onClick])

  return <div ref={el} role="img" aria-label={ariaLabel} className={className} style={{ height, width: '100%' }} />
}
