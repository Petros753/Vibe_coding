# Spline Hero

React + Vite приложение с полноэкранным Hero-блоком и интерактивной 3D-сценой
[Spline](https://spline.design/).

## Стек

- [React 18](https://react.dev/)
- [Vite 5](https://vite.dev/)
- [@splinetool/react-spline](https://www.npmjs.com/package/@splinetool/react-spline)

## Запуск

```bash
npm install
npm run dev
```

Затем откройте адрес, который выведет Vite (по умолчанию http://localhost:5173).

## Сборка

```bash
npm run build
npm run preview
```

## Структура

- `src/components/Hero.jsx` — Hero с полноэкранной 3D-сценой Spline.
- `src/components/Hero.css` — адаптивные стили (мобильные, safe-area, dvh).

## О 3D-сцене

Сцена встроена через `<iframe>` с опубликованной ссылкой Spline:

```
https://my.spline.design/boxeshover-d5AlXrSCAGbXavQUxEQZjy7b/
```

Публичная ссылка вида `my.spline.design/.../` — это готовый viewer, который
рассчитан именно на встраивание через `iframe`. Пакет
`@splinetool/react-spline` установлен и подходит для рендера `.splinecode`
сцен напрямую в React — при желании можно заменить `iframe` на компонент
`<Spline scene="...scene.splinecode" />`.

## Адаптивность

- Высота задаётся через `100dvh` (с фолбэком `100vh`) — корректно работает
  с адресной строкой мобильных браузеров.
- Учитываются safe-area зоны iPhone (`env(safe-area-inset-*)`).
- Типографика масштабируется через `clamp()`.
- На узких экранах (`max-width: 640px`) контент центрируется.
- Уважается `prefers-reduced-motion`.
