# ReelsRemotion — data-driven вертикальные субтитры для Reels

Движок на **Remotion v4 + TypeScript**. Рендерит вертикальное видео **1080×1920** из
одного `timeline.json`: слова въезжают с разных сторон (slide-in + fade), у каждого свой
шрифт/размер/вес/цвет/позиция; опциональная видео-вставка со скруглением; опциональный
аудиотрек. **Код ничего не хардкодит под конкретный ролик** — всё из данных.

> Контракт схемы и системы координат заморожен в `claude-code-CONTRACT.md`.

## Команды

```bash
npm install

# Превью в Remotion Studio (с координатной сеткой)
npm run studio          # → npx remotion studio

# Рендер mp4 (дефолтная smoke-test фикстура)
npm run render          # → out/video.mp4

# Рендер из своего таймлайна через --props (см. «Свой таймлайн»)
npx remotion render Reels out/video.mp4 --props=./public/props.json
```

## Система координат

- Все `x, y` — **offset в пикселях от ЦЕНТРА кадра**. `(0,0)` = центр (абсолютно `540,960`).
- Точка слова/вставки = её **центр** (центрируется через `translate(-50%,-50%)`).
- Отрицательный `x` — влево, отрицательный `y` — вверх.
- В Studio поверх кадра — **сетка** (minor 50px, major 100px, красный крест в центре,
  подписи осей = offset от центра каждые 200px). Сетка — dev-aid: **в рендер mp4 не попадает**
  (скрывается через `getRemotionEnvironment().isRendering`), плюс ручной тогл `showGrid`.

## Время

Всё время — в **кадрах** (не секундах). `start` слова = кадр появления, `end` = кадр
исчезновения (после `end` слово не рендерится).

## Анимация — keyframes (CONTRACT §4)

Единственная система анимации — **keyframes**. Встроенного входа/выхода больше нет:
слово без `keyframes` жёстко появляется на `start`, статично держит свои поля и
исчезает на `end`. Любое движение (слайды, фейды, кинетика) — это keyframes;
редактор даёт **пресеты**, которые их генерируют. Кадры keyframes **отсчитываются
от слова** (0 = `word.start`), поэтому `sceneFrame = word.start + kf.frame` — ретайминг
клипа не двигает его keyframes, а copy/paste — это простое копирование массива.

Девять анимируемых свойств: `position` (2D-путь с пространственными касательными),
`size`, `weight`, `fontFamily` (шаговая), `letterSpacing`, `color` (RGB),
`opacity`, `rotation` (может превышать 360°), `blur`. Каждое свойство без трека
падает на статический фоллбэк. Сэмплинг — чистый, общий для рендера и редактора:
`src/keyframes.ts` (`sampleScalar` с cubic-bezier-изингом, `sampleColor`,
`sampleDiscrete`, `samplePosition` — 2D-Безье temporal×spatial). Пресеты и
миграция `enterFrom`→keyframes на импорте — `src/presets.ts`.

Node-проверки: `npm test` (sampling, IO round-trip, edit-ops, seam).

## Схема `timeline.json`

```jsonc
{
  "fps": 30,
  "width": 1080,
  "height": 1920,
  "background": "#1a1a1a",
  "audio": null,                       // путь к mp3 (относительно public/) или null
  "scenes": [
    {
      "id": "s1",
      "durationInFrames": 90,
      "video": {                       // или null
        "src": "placeholder",          // "placeholder" → рисуется прямоугольник; иначе путь к mp4 в public/
        "x": 0, "y": 30,               // offset центра вставки от центра кадра, px
        "width": 880, "height": 500,
        "borderRadius": 20,
        "startFrom": 0                 // с какого кадра играть исходник
      },
      "words": [
        {
          "text": "ОНА",
          "start": 6, "end": 90,       // кадры, относительно сцены
          "x": -150, "y": -360,        // offset центра слова от центра кадра, px
          "font": "condensedHeavy",    // ключ из FONT_MAP
          "size": 70, "weight": 800,
          "color": "#ffffff",
          "enterFrom": "left",         // left | right | top | bottom | none
          "case": "upper"              // upper | lower | none (опц.)
        }
      ]
    }
  ]
}
```

`durationInFrames` композиции = сумма `durationInFrames` всех сцен. `fps`, `width`,
`height` берутся из таймлайна (`calculateMetadata` в `src/Root.tsx`).

### Шрифты (`FONT_MAP`, `src/fonts.ts`)

| ключ JSON        | реальный family | заметка                       |
|------------------|-----------------|-------------------------------|
| `condensedHeavy` | **Oswald** (wght 200–700) | акценты-заголовки, кириллица |
| `cleanSans`      | **Inter** (wght 100–900)  | связки/мелкий текст, кириллица |

Грузятся как **вариативные** шрифты (ось `wght`) через css2-эндпоинт Google
(`Inter:wght@100..900`, `Oswald:wght@200..700`, с кириллическим сабсетом), чтобы
keyframe-трек `weight` интерполировался **непрерывно** (напр. 543), а не прыгал по
100. `delayRender` держит рендер до готовности файлов; `waitForReelsFonts()`
дожидается их в редакторе. **Фоллбэк** (документировано): если fetch css2 не удался
(оффлайн-рендер), семейства падают на системный `sans-serif` — текст рендерится, но
`weight` теряет плавность; для оффлайна можно положить woff2 в `public/` и заменить
`cssUrl` локальным `@font-face`. Bebas/Anton/Druk — **без кириллицы**, не используются.

### Видео-вставка

`<OffthreadVideo>` в контейнере с `overflow:hidden` + `borderRadius`, статична.
`src === "placeholder"` → рисуется прямоугольник-заглушка (`VIDEO {w}×{h}`), поэтому
**рендер не падает без клипа**. Любая другая строка → грузится `staticFile(src)` из `public/`.

### Аудио

`timeline.audio` = путь к mp3 в `public/` (или `null`). Играет один трек на весь ролик.

## Свой таймлайн (Фаза 2)

`inputProps` композиции — это `{ timeline, showGrid }` (грид отдельно от таймлайна).
Чтобы отрендерить свой таймлайн через `--props`, оберни его в этот объект — см.
`public/props.json` (там `showGrid: false`):

```jsonc
{ "showGrid": false, "timeline": { /* ...твой Timeline... */ } }
```

```bash
npx remotion render Reels out/myreel.mp4 --props=./public/props.json
```

`public/timeline.json` — голый `Timeline` по контракту (референс для авторинга).
Дефолтная фикстура для Studio лежит в `src/smoke-test.ts`.

## Структура

```
src/
  index.ts        registerRoot
  Root.tsx        <Composition>, метаданные из таймлайна, defaultProps = { timeline: SMOKE_TEST, showGrid: true }
  Video.tsx       сцены → <Sequence>, <Audio>, <Grid> поверх
  Scene.tsx       фон + <VideoInset> + <Word>[]
  Word.tsx        сэмплит 9 keyframe-свойств (или статический фоллбэк); без встроенного входа
  keyframes.ts    чистый сэмплинг: sampleScalar/Color/Discrete/Position (+ cubic-bezier)
  presets.ts      пресеты-генераторы keyframes + миграция enterFrom→keyframes
  VideoInset.tsx  OffthreadVideo или placeholder-прямоугольник
  Grid.tsx        dev-aid сетка (скрыта в рендере)
  fonts.ts        FONT_MAP + загрузка кириллических шрифтов
  types.ts        Timeline / Scene / VideoInset / Word / ReelsProps
  smoke-test.ts   одноразовая проверочная фикстура
public/
  timeline.json   голый Timeline (контракт, авторинг)
  props.json      render-ready { timeline, showGrid } для --props
```

## Скоуп v1

**Есть:** сцены/слова из JSON, slide-in 4 стороны + fade, разные шрифты/цвета/позиции,
фразы-блоки, placeholder/реальная видео-вставка, аудиотрек, grid-оверлей, рендер mp4 1080×1920.

**Нет (v2):** GUI-редактор, ASR/авто-тайминги, переходы сцен, анимация вставки, spring-зоопарк
easing, точный Druk, музыка/sfx/дакинг, batch-CLI. Спорное помечено `// TODO v2`.

## v2.0 — однооконный WYSIWYG-редактор + переходы + аудио

`editor/` — однооконный редактор (Vite+React+TS) поверх движка: `@remotion/player`
показывает **ту же** композицию, что и рендер (WYSIWYG), даёт транспорт (play/pause/
scrub/±кадр/±1с со звуком), глобальный таймлайн (клип на слово — ретайминг драгом),
переходы между сценами, drag слов/вставки на канвасе и панели свойств. См.
`editor/README.md`.

```bash
npm install
cd editor && npm run dev        # → http://localhost:5173
```

Что добавилось в движок и контракт (`claude-code-CONTRACT.md` §4/§4.1):

- **Переходы** (`scene.transitionToNext`): `fade | slide | wipe | none` через
  `@remotion/transitions`. Длительность = **overlap**; общая длительность композиции =
  `Σ(сцены) − Σ(переходы)` (`src/compose.ts`). Движок перешёл с `<Sequence>` на
  `<TransitionSeries>` (`src/Video.tsx`); внутренности `Scene` не тронуты.
- **Аудио-модель**: `timeline.audio` теперь `AudioTrack | null` (`src`, `volume`,
  `fadeInFrames`, `fadeOutFrames`, `ducking`). Музыка даккается под речь:
  `video.speechRegions` (от ASR, **заморожены**) → огибающая громкости
  (`src/compose.ts: musicVolumeAt`). У вставки появились `volume` / `muted`.
  Старый `audio: string` всё ещё принимается (трактуется как `{ src, volume: 1 }`).

Фикстуры: `public/timeline2.json` (переход), `public/timeline_audio.json`
(аудио+дакинг+speechRegions). Гейт круговорота (`click-tool/roundtrip.test.cjs`)
проверяет сохранность `transitionToNext`, `speechRegions`, `volume/muted`, `AudioTrack`
и `start/end`/`case` — `node click-tool/roundtrip.test.cjs`.
