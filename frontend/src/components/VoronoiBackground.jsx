import React, { useEffect, useRef } from 'react'
import { useTheme } from '../context/ThemeContext'

export default function VoronoiBackground(){
  const canvasRef = useRef(null)
  const { isDark } = useTheme()

  useEffect(()=>{
    const canvas = canvasRef.current
    if(!canvas) return
    const ctx = canvas.getContext('2d')
    let raf = 0
    let w = 0, h = 0, dpr = 1

    const N = 28
    // store relative positions so zoom (change in innerWidth) scales proportionally
    const points = []
    const initPoints = ()=>{
      points.length = 0
      for(let i=0;i<N;i++){
        points.push({
          rx: Math.random(),
          ry: Math.random(),
          ox: Math.random()*1000,
          oy: Math.random()*1000,
          vx: (Math.random()-0.5)*0.14,
          vy: (Math.random()-0.5)*0.14,
        })
      }
    }
    initPoints()

    const resize = ()=>{
      // w/h in CSS pixels, dpr handles zoom (zoom changes devicePixelRatio and innerWidth)
      w = window.innerWidth
      // use document height to cover full page, not just viewport, so voronoi scales with content
      h = Math.max(window.innerHeight, document.documentElement.scrollHeight)
      dpr = window.devicePixelRatio || 1
      // also consider visualViewport scale (pinch zoom on mobile)
      const vvScale = window.visualViewport ? window.visualViewport.scale : 1
      // Adjust for zoom: effective dpr already includes zoom, but we also want pattern to scale with zoom
      // By using rx*w, pattern automatically scales as w shrinks on zoom-in (denser)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr,0,0,dpr,0,0)
    }

    const draw = (now)=>{
      const t = now * 0.00038
      // update h if page grew (e.g., content load)
      const curH = Math.max(window.innerHeight, document.documentElement.scrollHeight)
      if(Math.abs(curH - h) > 40) resize()

      ctx.clearRect(0,0,w,h)

      // compute absolute positions with subtle drift, scaled by w/h
      const abs = points.map(p=>{
        // drift amplitude scales with viewport so zoom keeps proportion
        const driftX = Math.sin(t + p.ox) * (w * 0.012)
        const driftY = Math.cos(t*0.9 + p.oy) * (h * 0.012)
        const jitterX = p.vx * 12
        const jitterY = p.vy * 12
        let x = p.rx * w + driftX + jitterX
        let y = p.ry * h + driftY + jitterY
        // wrap
        if(x < -80) x += w + 160
        if(x > w + 80) x -= w + 160
        if(y < -80) y += h + 160
        if(y > h + 80) y -= h + 160
        return { x, y, ox:p.ox }
      })

      // blobs - density matched to dark mode (light slightly stronger for equal perception)
      for(const p of abs){
        const r = 150 * (w/1400 + 0.5) + Math.sin(t*0.5 + p.ox)*18
        const g = ctx.createRadialGradient(p.x,p.y,0, p.x,p.y, r)
        if(isDark){
          g.addColorStop(0, 'rgba(255,255,255,0.085)')
          g.addColorStop(0.45, 'rgba(255,255,255,0.030)')
          g.addColorStop(1, 'rgba(255,255,255,0)')
        } else {
          // match dark density - same visual weight, no background change
          g.addColorStop(0, 'rgba(0,0,0,0.105)')
          g.addColorStop(0.45, 'rgba(0,0,0,0.036)')
          g.addColorStop(1, 'rgba(0,0,0,0)')
        }
        ctx.fillStyle = g
        ctx.beginPath()
        ctx.arc(p.x,p.y,r,0,Math.PI*2)
        ctx.fill()
      }

      // cell borders - density matched (light slightly thicker/darker for equal perception)
      const thresh = 210 * Math.max(0.85, w/1200)
      ctx.lineWidth = isDark ? 0.85 : 0.95
      ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.11)' : 'rgba(0,0,0,0.15)'
      for(let i=0;i<N;i++){
        for(let j=i+1;j<N;j++){
          const a = abs[i], b = abs[j]
          const d = Math.hypot(a.x-b.x, a.y-b.y)
          if(d < thresh){
            const alpha = 1 - d/thresh
            ctx.globalAlpha = alpha * 0.92
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.stroke()
          }
        }
      }
      ctx.globalAlpha = 1
      for(const p of abs){
        ctx.fillStyle = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.14)'
        ctx.beginPath()
        ctx.arc(p.x,p.y,1.6,0,Math.PI*2)
        ctx.fill()
      }

      raf = requestAnimationFrame(draw)
    }

    resize()
    raf = requestAnimationFrame(draw)

    const onResize = ()=> resize()
    window.addEventListener('resize', onResize)
    // visualViewport for pinch-zoom on mobile, scales with zoom
    if(window.visualViewport){
      window.visualViewport.addEventListener('resize', onResize)
      window.visualViewport.addEventListener('scroll', onResize)
    }
    // devicePixelRatio change (browser zoom) fires via media query
    const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
    const onDpr = ()=> resize()
    if(mq.addEventListener) mq.addEventListener('change', onDpr)
    else if(mq.addListener) mq.addListener(onDpr)

    return ()=>{
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', onResize)
      if(window.visualViewport){
        window.visualViewport.removeEventListener('resize', onResize)
        window.visualViewport.removeEventListener('scroll', onResize)
      }
      if(mq.removeEventListener) mq.removeEventListener('change', onDpr)
      else if(mq.removeListener) mq.removeListener(onDpr)
    }
  },[isDark])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      style={{
        position:'fixed',
        inset:0,
        width:'100vw',
        height:'100vh',
        zIndex:0,
        pointerEvents:'none',
        opacity: 1,
      }}
    />
  )
}
