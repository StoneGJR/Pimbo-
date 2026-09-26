const intro = document.getElementById('intro');
const introText = document.getElementById('intro-text');
const startButton = document.getElementById('start-button');
const scene = document.getElementById('scene');
const sceneImage = document.getElementById('scene-image');
const sceneOverlay = document.getElementById('scene-overlay');
const interactionHint = document.getElementById('interaction-hint');
const sceneMessage = document.getElementById('scene-message');
const doorHandle = document.getElementById('door-handle');
const backButton = document.getElementById('back-button');

const nightAudio = document.getElementById('night-audio');
const handleAudio = document.getElementById('handle-audio');
const openAudio = document.getElementById('open-audio');
const closeAudio = document.getElementById('close-audio');
const kitchenAudio = document.getElementById('kitchen-audio');

const story = [
  { text: '23:47', pauseAfter: 900 },
  { text: 'Eu não deveria ter vindo.', pauseAfter: 700 },
  { text: 'Recebi uma mensagem de um número que eu não conheço.', pauseAfter: 700 },
  { text: 'Por algum motivo, estava salvo como AP202.\nMas não me lembro de ter salvo esse número.', pauseAfter: 800 },
  { text: 'Era apenas um endereço.', pauseAfter: 600 },
  { text: 'Sem explicação.', pauseAfter: 650 },
  { text: 'Tentei ignorar e dormir, mas não consegui.', pauseAfter: 650 },
  { text: 'Não conseguia parar de pensar nisso.', pauseAfter: 650 },
  { text: 'O endereço me trouxe até aqui.', pauseAfter: 1800 }
];

const state = {
  started: false,
  transitioning: false,
  scene: 1,
  audioUnlocked: false
};

// -----------------------------------------------------------------------------
// Máquina de escrever: som gerado pelo navegador, sem depender de arquivo.
// -----------------------------------------------------------------------------
let typewriterContext = null;

function initTypewriterAudio() {
  if (typewriterContext) return;

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;

  try {
    typewriterContext = new AudioCtx();
    if (typewriterContext.state === 'suspended') {
      typewriterContext.resume().catch(() => {});
    }
  } catch (err) {
    console.warn('Não foi possível iniciar o som da máquina de escrever:', err);
    typewriterContext = null;
  }
}

function typeKeySound() {
  if (!typewriterContext) return;

  if (typewriterContext.state === 'suspended') {
    typewriterContext.resume().catch(() => {});
  }

  const ctx = typewriterContext;
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = 'square';
  osc.frequency.setValueAtTime(1250 + Math.random() * 320, now);

  filter.type = 'highpass';
  filter.frequency.setValueAtTime(550, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.045, now + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + 0.04);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// -----------------------------------------------------------------------------
// Áudio real.
// Importante: não usamos audio.load() no clique inicial. Em alguns navegadores,
// chamar load() e play() imediatamente pode interromper o play e fazer com que
// todos os áudios fiquem pausados. Em vez disso, deixamos o navegador carregar
// os elementos normalmente e apenas iniciamos os ambientes durante o gesto.
// -----------------------------------------------------------------------------
function playAudio(audio, volume = 1, restart = false) {
  if (!audio) return Promise.reject(new Error('Elemento de áudio não encontrado.'));

  try {
    audio.volume = volume;
    if (restart) {
      audio.currentTime = 0;
    }
  } catch (_) {}

  let result;
  try {
    result = audio.play();
  } catch (err) {
    console.warn('Erro ao tocar áudio:', audio.currentSrc || audio.src, err);
    return Promise.reject(err);
  }

  if (result && typeof result.catch === 'function') {
    result.catch(err => {
      console.warn('Áudio bloqueado ou indisponível:', audio.currentSrc || audio.src, err);
    });
  }

  return result || Promise.resolve();
}

function prepareAudioFromUserGesture() {
  if (state.audioUnlocked) return;
  state.audioUnlocked = true;

  nightAudio.loop = true;
  kitchenAudio.loop = true;

  // Os dois ambientes começam silenciosos, mas já em reprodução.
  // Isso acontece dentro do clique em "CLIQUE PARA COMEÇAR".
  playAudio(nightAudio, 0);
  playAudio(kitchenAudio, 0);
}

function setNightVolume(value) {
  nightAudio.volume = value;
}

function setKitchenVolume(value) {
  kitchenAudio.volume = value;
}

function playDoorSound(audio, volume = 1) {
  // O clique na maçaneta é outro gesto do jogador, então o próprio elemento
  // pode tocar o efeito diretamente sem depender do autoplay.
  playAudio(audio, volume, true);
}

function playDoorHandle() {
  playDoorSound(handleAudio, 0.85);
}

function playDoorOpen() {
  playDoorSound(openAudio, 0.9);
}

function playDoorClose() {
  playDoorSound(closeAudio, 0.9);
}

async function typeText(text, speed = 42) {
  for (const char of text) {
    introText.textContent += char;

    if (char !== ' ' && char !== '\n') {
      typeKeySound();
      await sleep(speed + Math.random() * 28);
    } else if (char === '\n') {
      await sleep(180);
    } else {
      await sleep(speed * 0.7);
    }
  }
}

function showInteractionHint(show) {
  interactionHint.classList.toggle('hidden', !show);
  interactionHint.classList.toggle('show', show);
}

function showSceneMessage(text, duration = 4300) {
  sceneMessage.textContent = text;
  sceneMessage.classList.remove('hidden');
  requestAnimationFrame(() => sceneMessage.classList.add('visible'));

  window.setTimeout(() => {
    sceneMessage.classList.remove('visible');
    window.setTimeout(() => sceneMessage.classList.add('hidden'), 700);
  }, duration);
}

function showFirstSceneControls() {
  doorHandle.style.display = 'block';
  backButton.classList.add('hidden');
  showInteractionHint(false);
}

function showKitchenControls() {
  doorHandle.style.display = 'none';
  showInteractionHint(false);
  backButton.classList.remove('hidden');
}

function prepareSceneTwo() {
  const img = new Image();
  img.src = 'assets/scenes/scene-02.png';
}

async function enterKitchen() {
  if (state.transitioning || state.scene !== 1) return;
  state.transitioning = true;

  showInteractionHint(false);
  doorHandle.disabled = true;
  doorHandle.style.display = 'none';

  playDoorHandle();
  await sleep(420);
  playDoorOpen();

  sceneOverlay.classList.add('fade-out');
  await sleep(2000);

  sceneImage.src = 'assets/scenes/scene-02.png';
  sceneImage.alt = 'Uma cozinha escura';

  playDoorClose();

  sceneOverlay.classList.remove('fade-out');
  sceneOverlay.classList.add('fade-in');

  // O ambiente da cozinha já foi iniciado no clique inicial, então aqui basta
  // aumentar o volume. Isso evita um novo problema de autoplay no meio da cena.
  const kitchenFadeStart = performance.now();
  while (performance.now() - kitchenFadeStart < 2000) {
    const p = (performance.now() - kitchenFadeStart) / 2000;
    setKitchenVolume(Math.min(0.46, 0.46 * p));
    setNightVolume(Math.max(0, 0.03 * (1 - p)));
    await sleep(60);
  }

  setKitchenVolume(0.46);
  setNightVolume(0);

  await sleep(300);
  sceneOverlay.classList.remove('fade-in');

  state.scene = 2;
  showKitchenControls();
  showSceneMessage('Não sinto uma sensação boa.', 4300);

  state.transitioning = false;
}

async function returnToFirstScene() {
  if (state.transitioning || state.scene !== 2) return;
  state.transitioning = true;

  backButton.disabled = true;
  sceneMessage.classList.remove('visible');
  sceneOverlay.classList.add('fade-out');

  await sleep(2000);

  sceneImage.src = 'assets/scenes/scene-01.png';
  sceneImage.alt = 'Uma porta metálica escura';

  // Os ambientes continuam desbloqueados/reproduzindo. Só mudamos o volume.
  const nightFadeStart = performance.now();
  while (performance.now() - nightFadeStart < 2000) {
    const p = (performance.now() - nightFadeStart) / 2000;
    setKitchenVolume(Math.max(0, 0.46 * (1 - p)));
    setNightVolume(Math.min(0.03, 0.03 * p));
    await sleep(60);
  }

  setKitchenVolume(0);
  setNightVolume(0.03);

  sceneOverlay.classList.remove('fade-out');
  sceneOverlay.classList.add('fade-in');

  await sleep(2000);
  sceneOverlay.classList.remove('fade-in');

  state.scene = 1;
  doorHandle.disabled = false;
  backButton.disabled = false;
  showFirstSceneControls();

  state.transitioning = false;
}

async function playIntro() {
  if (state.started) return;

  state.started = true;
  startButton.disabled = true;
  startButton.style.display = 'none';

  // Tudo que depende de autoplay começa aqui, dentro do clique do jogador.
  prepareAudioFromUserGesture();
  initTypewriterAudio();
  prepareSceneTwo();

  for (let i = 0; i < story.length; i++) {
    await typeText(story[i].text);
    await sleep(story[i].pauseAfter);

    if (i !== story.length - 1) {
      introText.textContent += '\n\n';
    }
  }

  await sleep(500);

  scene.classList.remove('hidden');
  showFirstSceneControls();

  const fadeStart = performance.now();
  while (performance.now() - fadeStart < 1300) {
    const p = (performance.now() - fadeStart) / 1300;
    setNightVolume(0.03 * p);
    await sleep(60);
  }
  setNightVolume(0.03);
  setKitchenVolume(0);

  requestAnimationFrame(() => scene.classList.add('visible'));

  await sleep(900);
  intro.style.opacity = '0';
  await sleep(1600);
  intro.classList.add('hidden');
}

startButton.addEventListener('click', playIntro);

doorHandle.addEventListener('pointerenter', () => showInteractionHint(true));
doorHandle.addEventListener('pointerleave', () => showInteractionHint(false));
doorHandle.addEventListener('focus', () => showInteractionHint(true));
doorHandle.addEventListener('blur', () => showInteractionHint(false));
doorHandle.addEventListener('click', enterKitchen);

backButton.addEventListener('click', returnToFirstScene);

// Recupera o áudio caso o navegador suspenda a reprodução depois de algum tempo.
document.addEventListener('pointerdown', () => {
  if (!state.started || !state.audioUnlocked || state.transitioning) return;

  if (state.scene === 1 && nightAudio.paused) {
    playAudio(nightAudio, 0.03);
  }

  if (state.scene === 2 && kitchenAudio.paused) {
    playAudio(kitchenAudio, 0.46);
  }
});
