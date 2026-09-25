const intro = document.getElementById('intro');
const introText = document.getElementById('intro-text');
const startButton = document.getElementById('start-button');
const scene = document.getElementById('scene');
const sceneImage = document.getElementById('scene-image');
const sceneOverlay = document.getElementById('scene-overlay');
const interactionHint = document.getElementById('interaction-hint');
const sceneMessage = document.getElementById('scene-message');

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
  audioContext: null,
  started: false,
  currentScene: 1,
  transitioning: false,
  kitchenAmbient: null,
  kitchenAmbientStarted: false
};

function initAudio() {
  if (state.audioContext) return;
  state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
}

async function resumeAudio() {
  if (!state.audioContext) initAudio();
  if (state.audioContext.state === 'suspended') {
    await state.audioContext.resume();
  }
}

function typeKeySound() {
  const audioContext = state.audioContext;
  if (!audioContext) return;

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

function playAudioFile(path, volume = 1) {
  const audio = new Audio(path);
  audio.volume = volume;
  audio.play().catch(() => {});
  return audio;
}

function stopAudio(audio) {
  if (!audio) return;
  try {
    audio.pause();
    audio.currentTime = 0;
  } catch (_) {}
}

function makeNoiseBuffer() {
  const audioContext = state.audioContext;
  const sampleRate = audioContext.sampleRate;
  const length = sampleRate * 2;
  const buffer = audioContext.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < length; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  return buffer;
}

let nightNoiseSource = null;
let nightNoiseGain = null;
let nightNoiseFilter = null;
let ambientTimers = [];

function startNightAmbience() {
  const audioContext = state.audioContext;
  if (!audioContext || nightNoiseSource) return;

  nightNoiseFilter = audioContext.createBiquadFilter();
  nightNoiseFilter.type = 'lowpass';
  nightNoiseFilter.frequency.value = 1700;

  nightNoiseGain = audioContext.createGain();
  nightNoiseGain.gain.value = 0.014;

  nightNoiseSource = audioContext.createBufferSource();
  nightNoiseSource.buffer = makeNoiseBuffer();
  nightNoiseSource.loop = true;
  nightNoiseSource.connect(nightNoiseFilter);
  nightNoiseFilter.connect(nightNoiseGain);
  nightNoiseGain.connect(audioContext.destination);
  nightNoiseSource.start();

  scheduleNightSounds();
}

function scheduleNightSounds() {
  ambientTimers.push(setTimeout(() => {
    playOwlCall();
    scheduleNightSounds();
  }, 12000 + Math.random() * 18000));

  ambientTimers.push(setTimeout(() => {
    playInsectChirp();
  }, 2200 + Math.random() * 6500));
}

function playOwlCall() {
  const audioContext = state.audioContext;
  if (!audioContext) return;

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
  gain.gain.exponentialRampToValueAtTime(0.03, now + 0.06);
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
  if (!audioContext) return;

  const now = audioContext.currentTime;
  const osc = audioContext.createOscillator();
  const gain = audioContext.createGain();

  osc.type = 'sine';
  const f = 3200 + Math.random() * 1300;
  osc.frequency.setValueAtTime(f, now);
  osc.frequency.exponentialRampToValueAtTime(f * 1.08, now + 0.045);
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function showInteractionHint(show) {
  interactionHint.classList.toggle('hidden', !show);
}

function showSceneMessage(text, duration = 4200) {
  sceneMessage.textContent = text;
  sceneMessage.classList.remove('hidden');
  requestAnimationFrame(() => sceneMessage.classList.add('visible'));

  setTimeout(() => {
    sceneMessage.classList.remove('visible');
    setTimeout(() => sceneMessage.classList.add('hidden'), 700);
  }, duration);
}

async function enterKitchen() {
  if (state.transitioning) return;
  state.transitioning = true;
  showInteractionHint(false);

  // Primeiro: clique na maçaneta.
  playAudioFile('assets/sounds/door-handle.wav', 0.72);
  await sleep(450);

  // Depois: som e sensação de abertura antes do corte.
  playAudioFile('assets/sounds/door-open.wav', 0.9);
  sceneImage.classList.add('door-opening');
  await sleep(350);

  // Fade out com 2 segundos.
  sceneOverlay.classList.add('fade-to-black');
  await sleep(2000);

  state.currentScene = 2;
  stopNightAmbience();
  sceneImage.src = 'assets/scenes/scene-02.png';
  sceneImage.classList.remove('door-opening');

  // Som de porta fechando enquanto a nova sala aparece.
  playAudioFile('assets/sounds/door-close.wav', 0.9);

  sceneOverlay.classList.remove('fade-to-black');
  sceneOverlay.classList.add('fade-from-black');
  await sleep(80);
  sceneOverlay.classList.remove('fade-from-black');
  await sleep(1920);

  startKitchenAmbience();
  await sleep(450);
  showSceneMessage('Não sinto uma sensação boa.', 4300);
  state.transitioning = false;
}

function stopNightAmbience() {
  if (nightNoiseSource) {
    try { nightNoiseSource.stop(); } catch (_) {}
    nightNoiseSource = null;
  }
  ambientTimers.forEach(t => clearTimeout(t));
  ambientTimers = [];
}

function startKitchenAmbience() {
  if (state.kitchenAmbientStarted) return;
  state.kitchenAmbientStarted = true;
  state.kitchenAmbient = playAudioFile('assets/sounds/kitchen-ambient.wav', 0.42);
  state.kitchenAmbient.loop = true;
}

async function playIntro() {
  if (state.started) return;
  state.started = true;
  startButton.disabled = true;
  startButton.style.display = 'none';

  initAudio();
  await resumeAudio();

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
  showInteractionHint(true);
}

startButton.addEventListener('click', playIntro);

// Área interativa da maçaneta da primeira cena.
const doorHandle = document.getElementById('door-handle');
doorHandle.addEventListener('pointerenter', () => showInteractionHint(true));
doorHandle.addEventListener('pointerleave', () => showInteractionHint(false));
doorHandle.addEventListener('click', async () => {
  await resumeAudio();
  enterKitchen();
});
