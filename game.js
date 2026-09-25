const intro = document.getElementById('intro');
const introText = document.getElementById('intro-text');
const startButton = document.getElementById('start-button');
const scene = document.getElementById('scene');
const sceneImage = document.getElementById('scene-image');
const sceneOverlay = document.getElementById('scene-overlay');
const interactionHint = document.getElementById('interaction-hint');
const sceneMessage = document.getElementById('scene-message');
const doorHandle = document.getElementById('door-handle');

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

const AUDIO_FILES = {
  handle: 'assets/sounds/door-handle.wav',
  open: 'assets/sounds/door-open.wav',
  close: 'assets/sounds/door-close.wav',
  kitchen: 'assets/sounds/kitchen-ambient.wav'
};

const state = {
  audioContext: null,
  started: false,
  transitioning: false,
  audioBuffers: {},
  kitchenSource: null,
  kitchenGain: null,
  nightNoiseSource: null,
  nightNoiseGain: null,
  nightNoiseFilter: null,
  ambientTimers: [],
  doorUnlocked: false
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function initAudio() {
  if (state.audioContext) return;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  state.audioContext = new AudioContextClass();
}

async function resumeAudio() {
  initAudio();
  if (!state.audioContext) return;
  if (state.audioContext.state !== 'running') {
    try { await state.audioContext.resume(); } catch (_) {}
  }
  state.doorUnlocked = state.audioContext.state === 'running';
}

async function loadAudioFile(key, path) {
  if (!state.audioContext || state.audioBuffers[key]) return;

  try {
    const response = await fetch(path, { cache: 'force-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const arrayBuffer = await response.arrayBuffer();
    state.audioBuffers[key] = await state.audioContext.decodeAudioData(arrayBuffer);
  } catch (error) {
    console.warn(`Não foi possível carregar ${path}`, error);
  }
}

async function preloadAudio() {
  await Promise.all([
    loadAudioFile('handle', AUDIO_FILES.handle),
    loadAudioFile('open', AUDIO_FILES.open),
    loadAudioFile('close', AUDIO_FILES.close),
    loadAudioFile('kitchen', AUDIO_FILES.kitchen)
  ]);
}

function playBuffer(key, volume = 1, loop = false) {
  const audioContext = state.audioContext;
  const buffer = state.audioBuffers[key];
  if (!audioContext || !buffer || audioContext.state !== 'running') return null;

  const source = audioContext.createBufferSource();
  const gain = audioContext.createGain();
  source.buffer = buffer;
  source.loop = loop;
  gain.gain.value = volume;
  source.connect(gain);
  gain.connect(audioContext.destination);
  source.start();
  return { source, gain };
}

function typeKeySound() {
  const audioContext = state.audioContext;
  if (!audioContext || audioContext.state !== 'running') return;

  const now = audioContext.currentTime;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const filter = audioContext.createBiquadFilter();

  osc.type = 'square';
  osc.frequency.setValueAtTime(120 + Math.random() * 35, now);
  osc.frequency.exponentialRampToValueAtTime(72, now + 0.025);
  filter.type = 'highpass';
  filter.frequency.value = 500;

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.055, now + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(audioContext.destination);
  osc.start(now);
  osc.stop(now + 0.04);
}

function makeNoiseBuffer() {
  const audioContext = state.audioContext;
  const sampleRate = audioContext.sampleRate;
  const length = Math.floor(sampleRate * 2);
  const buffer = audioContext.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  return buffer;
}

function startNightAmbience() {
  const audioContext = state.audioContext;
  if (!audioContext || state.nightNoiseSource || audioContext.state !== 'running') return;

  state.nightNoiseFilter = audioContext.createBiquadFilter();
  state.nightNoiseFilter.type = 'lowpass';
  state.nightNoiseFilter.frequency.value = 1600;

  state.nightNoiseGain = audioContext.createGain();
  state.nightNoiseGain.gain.value = 0.012;

  state.nightNoiseSource = audioContext.createBufferSource();
  state.nightNoiseSource.buffer = makeNoiseBuffer();
  state.nightNoiseSource.loop = true;
  state.nightNoiseSource.connect(state.nightNoiseFilter);
  state.nightNoiseFilter.connect(state.nightNoiseGain);
  state.nightNoiseGain.connect(audioContext.destination);
  state.nightNoiseSource.start();

  scheduleNightSounds();
}

function stopNightAmbience() {
  if (state.nightNoiseSource) {
    try { state.nightNoiseSource.stop(); } catch (_) {}
    state.nightNoiseSource = null;
  }
  state.ambientTimers.forEach(timer => clearTimeout(timer));
  state.ambientTimers = [];
}

function scheduleNightSounds() {
  state.ambientTimers.push(setTimeout(() => {
    playOwlCall();
    scheduleNightSounds();
  }, 12000 + Math.random() * 18000));

  state.ambientTimers.push(setTimeout(() => {
    playInsectChirp();
  }, 2500 + Math.random() * 6500));
}

function playOwlCall() {
  const audioContext = state.audioContext;
  if (!audioContext || audioContext.state !== 'running') return;

  const now = audioContext.currentTime;
  const duration = 1.15;
  const osc = audioContext.createOscillator();
  const osc2 = audioContext.createOscillator();
  const filter = audioContext.createBiquadFilter();
  const gain = audioContext.createGain();

  osc.type = 'sine';
  osc2.type = 'triangle';

  const base = 190 + Math.random() * 35;
  osc.frequency.setValueAtTime(base, now);
  osc.frequency.exponentialRampToValueAtTime(base * 0.68, now + 0.72);
  osc.frequency.exponentialRampToValueAtTime(base * 0.82, now + duration);

  osc2.frequency.setValueAtTime(base * 2.01, now);
  osc2.frequency.exponentialRampToValueAtTime(base * 1.35, now + 0.72);
  osc2.frequency.exponentialRampToValueAtTime(base * 1.62, now + duration);

  filter.type = 'lowpass';
  filter.frequency.value = 1100;
  filter.Q.value = 1.5;

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.028, now + 0.06);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(filter);
  osc2.connect(filter);
  filter.connect(gain);

  if (audioContext.createStereoPanner) {
    const pan = audioContext.createStereoPanner();
    pan.pan.value = (Math.random() * 1.4) - 0.7;
    gain.connect(pan);
    pan.connect(audioContext.destination);
  } else {
    gain.connect(audioContext.destination);
  }

  osc.start(now);
  osc2.start(now);
  osc.stop(now + duration + 0.05);
  osc2.stop(now + duration + 0.05);
}

function playInsectChirp() {
  const audioContext = state.audioContext;
  if (!audioContext || audioContext.state !== 'running') return;

  const now = audioContext.currentTime;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();
  osc.type = 'sine';

  const frequency = 3200 + Math.random() * 1300;
  osc.frequency.setValueAtTime(frequency, now);
  osc.frequency.exponentialRampToValueAtTime(frequency * 1.08, now + 0.045);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.008, now + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

  osc.connect(gain);
  gain.connect(audioContext.destination);
  osc.start(now);
  osc.stop(now + 0.09);
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

function prepareSceneTwo() {
  // Decodificar a imagem antes de precisar dela evita a travadinha no momento da troca.
  const img = new Image();
  img.src = 'assets/scenes/scene-02.png';
}

async function enterKitchen() {
  if (state.transitioning) return;
  state.transitioning = true;

  // Remove imediatamente tudo que pertence à primeira cena.
  showInteractionHint(false);
  doorHandle.disabled = true;
  doorHandle.style.display = 'none';

  // O áudio já foi desbloqueado no clique. Agora os sons usam o Web Audio já liberado.
  playBuffer('handle', 0.72);
  await sleep(430);

  playBuffer('open', 0.88);
  await sleep(180);

  // Tela preta em 2 segundos. A imagem fica totalmente parada durante a transição.
  sceneOverlay.classList.add('fade-out');
  await sleep(2000);

  stopNightAmbience();
  sceneImage.src = 'assets/scenes/scene-02.png';
  sceneImage.alt = 'Uma cozinha escura';

  // Porta fechando enquanto a segunda cena ainda está no escuro.
  playBuffer('close', 0.88);

  // Fade in em 2 segundos.
  sceneOverlay.classList.remove('fade-out');
  sceneOverlay.classList.add('fade-in');
  await sleep(2000);
  sceneOverlay.classList.remove('fade-in');

  startKitchenAmbience();
  await sleep(350);
  showSceneMessage('Não sinto uma sensação boa.', 4300);

  state.transitioning = false;
}

function startKitchenAmbience() {
  if (state.kitchenSource || !state.audioContext || state.audioContext.state !== 'running') return;

  const result = playBuffer('kitchen', 0.42, true);
  if (!result) return;
  state.kitchenSource = result.source;
  state.kitchenGain = result.gain;
}

async function playIntro() {
  if (state.started) return;
  state.started = true;
  startButton.disabled = true;
  startButton.style.display = 'none';

  initAudio();
  await resumeAudio();

  // Começamos o carregamento dos arquivos de som cedo, enquanto a introdução acontece.
  preloadAudio();
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
  requestAnimationFrame(() => scene.classList.add('visible'));

  startNightAmbience();

  await sleep(1000);
  intro.style.opacity = '0';
  await sleep(1600);
  intro.classList.add('hidden');
}

startButton.addEventListener('click', playIntro);

doorHandle.addEventListener('pointerenter', () => showInteractionHint(true));
doorHandle.addEventListener('pointerleave', () => showInteractionHint(false));
doorHandle.addEventListener('focus', () => showInteractionHint(true));
doorHandle.addEventListener('blur', () => showInteractionHint(false));
doorHandle.addEventListener('click', async () => {
  // Importante: o contexto de áudio já foi criado durante o botão inicial.
  // Reassumimos aqui também antes de iniciar a sequência.
  await resumeAudio();
  enterKitchen();
});
