import { useState } from 'react'
import './Hero.css'

const SPLINE_SRC =
  'https://my.spline.design/boxeshover-d5AlXrSCAGbXavQUxEQZjy7b/'

export default function Hero() {
  const [loaded, setLoaded] = useState(false)

  return (
    <section className="hero">
      {/* Полноэкранная 3D-сцена Spline */}
      <div className="hero__scene">
        {!loaded && <div className="hero__loader" aria-hidden="true" />}
        <iframe
          className="hero__iframe"
          src={SPLINE_SRC}
          title="Spline 3D scene"
          frameBorder="0"
          loading="lazy"
          allow="autoplay; fullscreen; xr-spatial-tracking"
          onLoad={() => setLoaded(true)}
        />
      </div>

      {/* Контент поверх сцены */}
      <div className="hero__overlay">
        <h1 className="hero__title">Boxes Hover</h1>
        <p className="hero__subtitle">
          Интерактивная 3D-сцена на React + Vite и Spline
        </p>
        <a className="hero__cta" href="#start">
          Начать
        </a>
      </div>
    </section>
  )
}
