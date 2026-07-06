/* ============================================================================
   SENCE — анимация лендинга.
   Стек: GSAP 3 + ScrollTrigger. Вращение бутылки — ЖЁСТКОЙ сменой готовых
   PNG-кадров (флипбук, без кросс-фейда), а не CSS rotateY. Всё через
   transform/opacity для 60 FPS.

   Теперь 120 кадров вместо 13 — вращение стало плавным и бесшовным.
   Кадры создаются в JS (buildFrames), чтобы не держать 120 <img> в разметке.

   ВСЕ ВАЖНЫЕ ПАРАМЕТРЫ собраны в блоке CONFIG ниже — меняйте только их.
   ============================================================================ */

gsap.registerPlugin(ScrollTrigger);

/* ----------------------------- CONFIG --------------------------------------
   Здесь можно подстраивать поведение анимации, ничего не ища по всему файлу. */
const CONFIG = {
  FRAMES: 120,           // количество кадров вращения (файлы assets/bottle/Bottle_01..120.png)

  // HERO: бутылка крупная (видно горлышко) -> уменьшается до «высоты 1080px»
  HERO_SCALE_START: 1.5,   // стартовый масштаб (крышка на 50px от верха, видно начало широкой части)
  HERO_SCALE_END:   1.00,   // конечный масштаб (= базовая высота из CSS)
  HERO_Y_START:     24,   // стартовый сдвиг вниз, vh (крышка ровно под шапкой, ~50px)
  HERO_Y_END:       0,      // конечный сдвиг (бутылка по центру)

  // СКОРОСТЬ УМЕНЬШЕНИЯ БУТЫЛКИ — за сколько «экранов» прокрутки она уменьшается.
  // Меньше число = быстрее. 0.5 ≈ за половину прокрутки колеса.
  HERO_SCALE_DIST: 0.5,

  // СКОРОСТЬ ВРАЩЕНИЯ БУТЫЛКИ — за сколько «экранов» прокрутки проходит ПЕРВЫЙ
  // круг (вступление 1→24 + первый оборот 24→120). МЕНЬШЕ число = БЫСТРЕЕ вращение.
  ROTATION_SCREENS: 4.4,

  // Граница «вступление / вращение».
  // Кадры 1..24 — вступление (бутылка встаёт этикеткой к зрителю), играет ОДИН раз.
  // Кадры 24..120 — сам оборот вокруг оси. Кадр 24 и 120 ИДЕНТИЧНЫ, поэтому
  // вращение крутится «по кругу» в этом диапазоне — стык 120→24 незаметен (бесшовно).
  INTRO_END: 24,

  // Плавность прокрутки (scrub): чем больше — тем «тяжелее»/инертнее движение
  SCRUB_BOTTLE: 1,
  SCRUB_FADE:   1.0,

  // Растворение бутылки в конце
  DISSOLVE_FROM: 0,
  DISSOLVE_TO:   1,
  // СКОРОСТЬ РАСТВОРЕНИЯ — за сколько «экранов» прокрутки бутылка уходит в прозрачность.
  // Меньше число = быстрее. 0.5 ≈ полэкрана (~2 щелчка колеса). Уход плавный за счёт scrub.
  DISSOLVE_SCREENS: 0.5,

  // ТЕКСТ-ПОЗИЦИОНИРОВАНИЕ (фиксированный по центру блок «Вода для урбанистов…»)
  POS_START_VH: 750 / 1080, // где начинается появление (в «экранах»; ≈2000px при высоте окна 1080)
  POS_HOLD_VH:  0.3,        // сколько держится ЧЁТКИМ (без блюра), в «экранах». 0.1 ≈ 1-1.5 щелчка колеса (~240px). Было 1.25 (~2000px)
  POS_BLUR:     40,          // сила блюра на входе/выходе, px
  POS_STAGGER_VH: 0.15,      // насколько ПОЗЖЕ появляется/уходит левый блок (≈1–2 щелчка колеса; ~160px при 1080)
};

/* ----------------------- Состояние бутылки ---------------------------------
   Один объект-«пульт». ScrollTrigger'ы пишут сюда значения, render() их рисует. */
const B = {
  scale:    CONFIG.HERO_SCALE_START,
  y:        CONFIG.HERO_Y_START,
  frame:    1,            // «спин»: 1..24 — вступление (раз), 24..216 — два оборота 24..120
  glass:    1,            // прозрачность «линзы» за бутылкой (1 = видно на первом экране)
  dissolve: 0,            // 0 — видна, 1 — растворилась
  lastIdx:  0,            // последний показанный кадр (для оптимизации рендера)
};

/* ----------------------- DOM-ссылки ---------------------------------------- */
const stage = document.getElementById('bottleStage');
const glass = document.getElementById('glass');
const framesHost = document.getElementById('bottleFrames');

/* Создаём 120 кадров и наслаиваем их в сцене (поверх «стекла»).
   Имена файлов: assets/bottle/Bottle_01.png ... Bottle_120.png */
function buildFrames(host, count) {
  const arr = [];
  for (let i = 1; i <= count; i++) {
    const img = document.createElement('img');
    img.className = 'bottle-frame';
    img.alt = '';
    img.src = 'assets/bottle/Bottle_' + String(i).padStart(2, '0') + '.png';
    host.appendChild(img);
    arr.push(img);
  }
  return arr;
}
const frames = buildFrames(framesHost, CONFIG.FRAMES);

/* --------------------------- РЕНДЕР ---------------------------------------- */
function render() {
  // масштаб + вертикальный сдвиг всей сцены (translate3d -> GPU).
  // B.y задан в «экранных vh», но привязываем его к ШИРИНЕ (как весь макет через --u),
  // а не к реальной высоте окна. Так «крышка ровно под шапкой» выглядит одинаково
  // на любых пропорциях. На 16:9 значение совпадает с обычным vh — на референсе без изменений.
  const yPx = (B.y / 100) * (window.innerWidth * 1080 / 1920);   // 1 «экран» = ширина·1080/1920
  stage.style.transform = `translate3d(0, ${yPx}px, 0) scale(${B.scale})`;
  // общая видимость бутылки (растворение)
  const vis = 1 - B.dissolve;
  stage.style.opacity = vis;
  glass.style.opacity = B.glass * vis;

  // ЖЁСТКАЯ СМЕНА кадра: на экране всегда ровно ОДИН кадр.
  // Переключаем только изменившийся кадр (а не все 120) — это держит 60 FPS.
  //
  // B.frame — сквозной «спин». Кадры делятся на два участка:
  //   • 1..24  — ВСТУПЛЕНИЕ, проигрывается один раз (бутылка встаёт этикеткой к нам).
  //   • 24..120 — САМ ОБОРОТ. Кадр 24 и 120 идентичны, поэтому крутим «по кругу»
  //     в диапазоне 24..119: после 119 сразу идёт 24 (= 120) — стык бесшовный.
  const loopLen = CONFIG.FRAMES - CONFIG.INTRO_END;         // 96 кадров в одном обороте
  const maxRaw  = CONFIG.INTRO_END + loopLen * 2;           // вступление + 2 оборота = 216
  const raw = Math.round(Math.min(Math.max(B.frame, 1), maxRaw));
  const idx = raw <= CONFIG.INTRO_END
      ? raw                                                  // вступление 1..24 (один раз)
      : CONFIG.INTRO_END + ((raw - CONFIG.INTRO_END) % loopLen); // вращение 24..119 «по кругу»
  if (idx !== B.lastIdx) {
    if (B.lastIdx) frames[B.lastIdx - 1].style.opacity = 0;
    frames[idx - 1].style.opacity = 1;
    B.lastIdx = idx;
  }
}

/* ----------------------- ПРЕЛОАД КАДРОВ ------------------------------------ */
function preload() {
  const bar = document.getElementById('preloaderBar');
  const all = frames.map(f => f.src);
  let done = 0;
  return Promise.all(all.map(src => new Promise(res => {
    const img = new Image();
    img.onload = img.onerror = () => {
      done++;
      bar.style.width = (done / all.length * 100) + '%';
      res();
    };
    img.src = src;
  })));
}

/* ----------------------- ИНИЦИАЛИЗАЦИЯ ------------------------------------- */
function init() {
  render(); // первый кадр сразу

  /* 1. HERO — бутылка уменьшается и встаёт по центру.
        Параллельно (см. анимацию 2) уже идёт смена кадров — бутылка
        одновременно уменьшается и вращается, как в ТЗ. */
  gsap.fromTo(B,
    { scale: CONFIG.HERO_SCALE_START, y: CONFIG.HERO_Y_START },
    {
      scale: CONFIG.HERO_SCALE_END, y: CONFIG.HERO_Y_END,
      ease: 'none', onUpdate: render,
      scrollTrigger: {
        trigger: '.hero', start: 'top top',
        end: () => '+=' + window.innerHeight * CONFIG.HERO_SCALE_DIST,
        scrub: CONFIG.SCRUB_BOTTLE,
      },
    }
  );

  /* 1b. HERO-фон (фото + тексты + wordmark) синхронно растворяется:
         opacity 1->0, blur 0->60px, scale 1->0.72. Это «фоновое фото за бутылкой»,
         НЕ путать со статичным градиентом страницы. */
  gsap.fromTo('#heroBg',
    { opacity: 1, filter: 'blur(0px)', scale: 1 },
    {
      opacity: 0, filter: 'blur(60px)', scale: 0.72,
      ease: 'none', transformOrigin: '50% 45%',
      scrollTrigger: {
        trigger: '.hero', start: 'top top', end: '72% bottom',
        scrub: CONFIG.SCRUB_FADE,
      },
    }
  );

  /* 2. ВРАЩЕНИЕ.

        ВСТУПЛЕНИЕ: кадр 1 → 24. Скорость прежняя (как раньше в hero — не трогаем).
        Бутылка встаёт этикеткой к зрителю (кадр 24) и на этом ОСТАНАВЛИВАЕТСЯ:
        твин доходит до 24 и держит это значение, пока не стартует следующий твин.
        Так получается «заморозка» на кадре 24 на время показа слогана. */
  gsap.fromTo(B, { frame: 1 }, {
    frame: CONFIG.INTRO_END, ease: 'none', onUpdate: render,
    scrollTrigger: {
      trigger: '.hero', start: 'top top',
      // конец вступления = там же, где кадр 24 достигался раньше (скорость hero не меняется)
      end: () => '+=' + window.innerHeight * CONFIG.ROTATION_SCREENS
                 * (CONFIG.INTRO_END - 1) / (CONFIG.FRAMES - 1),
      scrub: CONFIG.SCRUB_BOTTLE,
    },
  });

  /* ВРАЩЕНИЕ (2 оборота, 24→120 дважды): СТАРТУЕТ, когда строчка 1 «Вода для
        урбанистов…» полностью ушла в прозрачность, а строчка 2 «Зная, что всегда…»
        почти исчезла (см. posSloganResumePoint). До этого бутылка стоит на кадре 24
        (заморозка). Начинаем с кадра 24 → стык бесшовный. Финиш — низ блока
        преимуществ, где бутылка замирает этикеткой к зрителю. Дальше без изменений:
        растворение, форма, футер.
        immediateRender: false — чтобы этот твин не сбивал заморозку/вступление раньше времени. */
  gsap.fromTo(B, { frame: CONFIG.INTRO_END }, {
    frame: CONFIG.FRAMES * 2 - CONFIG.INTRO_END,   // 24 → 216 (два оборота 24..120 подряд)
    ease: 'none', onUpdate: render, immediateRender: false,
    scrollTrigger: {
      start: () => posSloganResumePoint(),         // строчка 1 полностью ушла, строчка 2 почти исчезла
      endTrigger: '.benefits', end: 'bottom bottom',
      scrub: CONFIG.SCRUB_BOTTLE,
    },
  });

  /* 2b. Стекло за бутылкой видно на ПЕРВОМ экране (блюрит логотип sence сзади),
         затем гаснет вместе с hero-фоном — чтобы не размывать слоган в зоне вращения. */
  gsap.fromTo(B, { glass: 1 }, {
    glass: 0, ease: 'none', onUpdate: render,
    scrollTrigger: {
      trigger: '.hero', start: 'top top', end: '72% bottom',
      scrub: CONFIG.SCRUB_FADE,
    },
  });

  /* 3. Текст-позиционирование: ЗАФИКСИРОВАН по центру. Появляется ≈2000px,
        держится ~1.25 экрана, уходит. Скорость входа/выхода = как у растворения
        hero (логотип+фото). См. buildPosText ниже. */
  buildPosText();

  /* 4. Центральный слоган: появление -> фиксация ~1 экран -> исчезновение */
  fadeInHoldOut('#sloganMid', '.slogan', 'top top', 'bottom bottom');

  /* 5. Растворение бутылки перед финалом (кадр уже 120 — этикеткой к зрителю).
        Старт РОВНО там, где бутылка закончила 2-й оборот и остановилась
        (тот же момент, что финиш вращения — низ блока преимуществ у низа экрана).
        Финиш — через DISSOLVE_SCREENS экранов: короткий и плавный уход (scrub сглаживает). */
  gsap.fromTo(B, { dissolve: CONFIG.DISSOLVE_FROM }, {
    dissolve: CONFIG.DISSOLVE_TO, ease: 'none', onUpdate: render, immediateRender: false,
    scrollTrigger: {
      trigger: '.benefits', start: 'bottom bottom',
      end: () => '+=' + window.innerHeight * CONFIG.DISSOLVE_SCREENS,
      scrub: CONFIG.SCRUB_BOTTLE,
    },
  });

  /* 6. Лёгкое кинематографичное проявление блоков преимуществ (без сдвига вёрстки) */
  gsap.utils.toArray('.benefit').forEach(card => {
    gsap.from(card.querySelectorAll('.benefit-photo, .benefit-caption'), {
      opacity: 0, y: () => 40 * (window.innerWidth / 1920),
      duration: 1, ease: 'power2.out', stagger: 0.08,
      scrollTrigger: { trigger: card, start: 'top 75%' },
    });
  });

  /* 7. Финальный слоган и форма — мягкое появление */
  gsap.from('.finale-slogan .row', {
    opacity: 0, y: () => 30 * (window.innerWidth / 1920),
    duration: 1, ease: 'power2.out', stagger: 0.12,
    scrollTrigger: { trigger: '.finale-slogan', start: 'top 80%' },
  });

  // На всякий случай пересчитать триггеры после полной загрузки/шрифтов
  ScrollTrigger.refresh();
}

/* Момент (в пикселях прокрутки), когда бутылка ВОЗОБНОВЛЯЕТ вращение.
   Строчка 1 (правый блок «Вода для урбанистов…») тает в последнем сегменте
   (opacity 1→0). Стартуем вращение, когда она ушла в прозрачность НЕ полностью,
   а примерно на 50% (середина растворения) — как на референсе.
   Считается по тем же параметрам, что и слоган в buildPosText, — всегда синхронно.
   FADE_OUT_FRACTION: 0 = только начала таять, 0.5 = ~50% прозрачности, 1 = исчезла. */
function posSloganResumePoint() {
  const FADE_OUT_FRACTION = 0.5;                                   // ← на сколько растаяла строчка 1 (0..1)
  const fade = heroFadeDist() * 0.42;                             // длительность входа/выхода (как в buildPosText)
  const hold = CONFIG.POS_HOLD_VH * window.innerHeight;           // удержание чётким
  const totalDur = fade * 2 + hold;                              // вся длительность сценария блока
  const span = heroFadeDist() * 2 + CONFIG.POS_HOLD_VH * window.innerHeight; // прокрутка сценария
  // прогресс до нужной точки: вход + удержание + часть выхода
  const progress = (fade + hold + fade * FADE_OUT_FRACTION) / totalDur;
  // правый блок стартует без задержки (POS_START_VH):
  return CONFIG.POS_START_VH * window.innerHeight + progress * span;
}

/* Дистанция «растворения» hero (логотип+фото). Ровно её используем для входа/выхода
   текста, чтобы скорость появления/исчезновения СОВПАДАЛА с hero. */
function heroFadeDist() {
  // .hero = 260vh, конец растворения '72% bottom' → дистанция = (0.72*2.6 - 1) экрана
  return (0.72 * 2.6 - 1) * window.innerHeight;
}

/* Текст-позиционирование: фиксирован по центру, появляется из блюра/прозрачности,
   держится ~1.25 экрана чётким, затем ТАК ЖЕ плавно уходит. Старт ≈2000px.
   Длительности сегментов = пиксельным дистанциям → ровно 1:1 со скроллом,
   поэтому скорость входа = скорости выхода = скорости растворения hero. */
function buildPosText() {
  const fade = heroFadeDist() * 0.42;                         // вход = выход = скорость hero
  const hold = CONFIG.POS_HOLD_VH * window.innerHeight; // держим чётким
  const blur = CONFIG.POS_BLUR;

  // Один и тот же сценарий (вход → держим → выход) для одного блока.
  // delayPx() сдвигает ВЕСЬ сценарий блока позже по скроллу — так получается
  // очередь: правый блок без задержки, левый — на POS_STAGGER_VH позже.
  // Принцип/скорость/блюр/удержание у обоих ОДИНАКОВЫ — меняется только момент старта.
  function buildBlock(target, delayPx) {
    gsap.timeline({
      scrollTrigger: {
        start: () => CONFIG.POS_START_VH * window.innerHeight + delayPx(),
        end:   () => CONFIG.POS_START_VH * window.innerHeight + delayPx()
                     + heroFadeDist() * 2 + CONFIG.POS_HOLD_VH * window.innerHeight,
        scrub: CONFIG.SCRUB_FADE,
      },
    })
    .fromTo(target,
        { opacity: 0, filter: `blur(${blur}px)` },
        { opacity: 1, filter: 'blur(0px)', duration: fade, ease: 'none' })  // плавно проявляется
    .to(target, { opacity: 1, duration: hold, ease: 'none' })               // держится чётким
    .to(target,
        { opacity: 0, filter: `blur(${blur}px)`, duration: fade, ease: 'none' }); // так же плавно уходит
  }

  // Правый — первым (без задержки), левый — следом (на POS_STAGGER_VH позже).
  // Появляется первым правый и уходит первым тоже правый — очередь сохраняется и на входе, и на выходе.
  buildBlock('#posTextA .pt--right', () => 0);
  buildBlock('#posTextA .pt--left',  () => CONFIG.POS_STAGGER_VH * window.innerHeight);
}

/* Хелпер: «появился из блюра -> подержался -> исчез в блюр» по прогрессу скролла */
function fadeInHoldOut(target, trigger, start, end) {
  const tl = gsap.timeline({
    scrollTrigger: { trigger, start, end, scrub: CONFIG.SCRUB_FADE },
  });
  tl.fromTo(target,
      { opacity: 0, filter: 'blur(14px)' },
      { opacity: 1, filter: 'blur(0px)', duration: 0.35, ease: 'power1.out' })
    .to(target, { opacity: 1, duration: 0.30 })                 // удержание
    .to(target, { opacity: 0, filter: 'blur(14px)', duration: 0.35, ease: 'power1.in' });
}

/* ----------------------- СТАРТ + РЕСАЙЗ ------------------------------------ */
window.addEventListener('load', () => {
  preload().then(() => {
    const pre = document.getElementById('preloader');
    pre.classList.add('hidden');
    init();
  });
});

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => ScrollTrigger.refresh(), 200);
});
