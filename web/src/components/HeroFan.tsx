import { useEffect, useRef } from 'react'
import { normal, rng } from '../lib/finance/stats'

/** Leque de trajetórias de Monte Carlo desenhado progressivamente (fundo do hero) */
export function HeroFan({ paths = 140, steps = 120 }: { paths?: number; steps?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = ref.current!
    const ctx = cv.getContext('2d')!
    const z = normal(rng(7))
    const data: number[][] = []
    for (let i = 0; i < paths; i++) {
      let v = 0
      const p = [0]
      for (let s = 1; s <= steps; s++) {
        v += 0.006 + 0.045 * z()
        p.push(v)
      }
      data.push(p)
    }
    const finals = data.map((p) => p[steps]).sort((a, b) => a - b)
    const rank = (x: number) => finals.indexOf(x) / (paths - 1)
    const colors = data.map((p) => {
      const r = rank(p[steps])
      const hue = 0 + r * 230 // vermelho → azul
      return `hsla(${hue}, 85%, 60%, 0.35)`
    })
    const median = Array.from({ length: steps + 1 }, (_, s) => {
      const col = data.map((p) => p[s]).sort((a, b) => a - b)
      return col[Math.floor(col.length / 2)]
    })
    const lo = finals[0]
    const hi = finals[paths - 1]
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let frame = 0
    let raf = 0
    const draw = () => {
      const dpr = window.devicePixelRatio || 1
      const w = cv.clientWidth
      const h = cv.clientHeight
      if (cv.width !== w * dpr) {
        cv.width = w * dpr
        cv.height = h * dpr
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)
      const upto = reduce ? steps : Math.min(steps, frame)
      const x = (s: number) => (s / steps) * w
      const y = (v: number) => h * 0.92 - ((v - lo) / (hi - lo)) * h * 0.84
      ctx.lineWidth = 1
      for (let i = 0; i < paths; i++) {
        ctx.strokeStyle = colors[i]
        ctx.beginPath()
        ctx.moveTo(x(0), y(0))
        for (let s = 1; s <= upto; s++) ctx.lineTo(x(s), y(data[i][s]))
        ctx.stroke()
      }
      // mediana
      ctx.strokeStyle = 'rgba(255,255,255,.9)'
      ctx.lineWidth = 2
      ctx.beginPath()
      for (let s = 0; s <= upto; s++) {
        const m = median[s]
        if (s === 0) ctx.moveTo(x(s), y(m))
        else ctx.lineTo(x(s), y(m))
      }
      ctx.stroke()
      if (frame < steps) {
        frame += 1
        raf = requestAnimationFrame(draw)
      }
    }
    raf = requestAnimationFrame(draw)
    const onResize = () => {
      frame = steps
      draw()
    }
    window.addEventListener('resize', onResize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
    }
  }, [paths, steps])

  return <canvas ref={ref} aria-hidden className="absolute inset-0 h-full w-full opacity-60" />
}
