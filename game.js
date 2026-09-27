const intro = document.getElementById('intro');
const introText = document.getElementById('intro-text');
const startButton = document.getElementById('start-button');
const scene = document.getElementById('scene');
const sceneImage = document.getElementById('scene-image');
const sceneOverlay = document.getElementById('scene-overlay');
const interactionHint = document.getElementById('interaction-hint');
const sceneMessage = document.getElementById('scene-message');

const doorHandle = document.getElementById('door-handle');
const fridgeHotspot = document.getElementById('fridge-hotspot');
const bathroomDoorHotspot = document.getElementById('bathroom-door-hotspot');
const freezerHotspot = document.getElementById('freezer-hotspot');
const bodyHotspot = document.getElementById('body-hotspot');

const actionBar = document.getElementById('action-bar');
const actionClose = document.getElementById('action-close');
const actionKitchen = document.getElementById('action-kitchen');
const backButton = document.getElementById('back-button');

const nightAudio = document.getElementById('night-audio');
const kitchenAudio = document.getElementById('kitchen-audio');
const fridgeHumAudio = document.getElementById('fridge-hum-audio');
const fliesAudio = document.getElementById('flies-audio');

const handleAudio = document.getElementById('handle-audio');
const metalOpenAudio = document.getElementById('metal-open-audio');
const woodOpenAudio = document.getElementById('wood-open-audio');
const woodCloseAudio = document.getElementById('wood-close-audio');
const fridgeOpenAudio = document.getElementById('fridge-open-audio');
const fridgeCloseAudio = document.getElementById('fridge-close-audio');
const freezerOpenAudio = document.getElementById('freezer-open-audio');
const freezerCloseAudio = document.getElementById('freezer-close-audio');

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
  audioUnlocked: false,
  transitioning: false,
  scene: 'entry',
  kitchenView: 'normal',
  bodyMessageShown: false
};

let typewriterContext = null;
let hintTarget = null;
let messageTimer = null;

const IMAGE = {
  entry: 'assets/scenes/scene-01.png',
  kitchen: 'assets/scenes/scene-02.png',
  fridgeOpen: 'assets/scenes/geladeiraportaaberta.png',
  freezerOpen: 'assets/scenes/geladeirafreezeraberto.png',
  fridgeClosed: 'assets/scenes/geladeirafechada.png',
  bathroomDoorOpen: 'assets/scenes/cozinhabanheiroaberto.png',
  bathroom: 'assets/scenes/banheiroazul.png'
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

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
    console.warn('Áudio da máquina de escrever indisponível.', err);
  }
}

function typeKeySound() {
  if (!typewriterContext) return;
  const ctx = typewriterContext;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();

  osc.type = 'square';
  osc.frequency.setValueAtTime(1180 + Math.random() * 380, now);
  filter.type = 'highpass';
  filter.frequency.setValueAtTime(560, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.038, now + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.034);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.038);
}

function playAudio(audio, volume = 1, restart = false) {
  if (!audio) return Promise.resolve();
  try {
    audio.volume = volume;
    if (restart) audio.currentTime = 0;
  } catch (_) {}

  const promise = audio.play();
  if (promise && typeof promise.catch === 'function') {
    promise.catch(err => console.warn('Não foi possível tocar:', audio.currentSrc || audio.src, err));
    return promise.catch(() => {});
  }
  return Promise.resolve();
}

function stopAudio(audio, reset = false) {
  if (!audio) return;
  audio.pause();
  if (reset) {
    try { audio.currentTime = 0; } catch (_) {}
  }
}

async function fadeVolume(audio, from, to, duration = 900) {
  if (!audio) return;
  const start = performance.now();
  audio.volume = from;
  while (performance.now() - start < duration) {
    const p = (performance.now() - start) / duration;
    audio.volume = Math.max(0, Math.min(1, from + (to - from) * p));
    await sleep(35);
  }
  audio.volume = to;
}

function unlockAmbientAudio() {
  if (state.audioUnlocked) return;
  state.audioUnlocked = true;
  nightAudio.loop = true;
  kitchenAudio.loop = true;
  fridgeHumAudio.loop = true;
  fliesAudio.loop = true;

  playAudio(nightAudio, 0.001);
  playAudio(kitchenAudio, 0.001);
  playAudio(fridgeHumAudio, 0);
  playAudio(fliesAudio, 0);
}

function setAmbientForScene(name) {
  if (!state.audioUnlocked) return;
  if (name === 'entry') {
    nightAudio.volume = 0.035;
    kitchenAudio.volume = 0;
    fridgeHumAudio.volume = 0;
    fliesAudio.volume = 0;
  } else if (name === 'kitchen') {
    nightAudio.volume = 0;
    kitchenAudio.volume = 0.035;
    fridgeHumAudio.volume = 0;
    fliesAudio.volume = 0;
  } else if (name === 'fridgeOpen' || name === 'freezerOpen') {
    nightAudio.volume = 0;
    kitchenAudio.volume = 0.022;
    fridgeHumAudio.volume = 0.045;
    fliesAudio.volume = 0;
  } else if (name === 'bathroom') {
    nightAudio.volume = 0;
    kitchenAudio.volume = 0;
    fridgeHumAudio.volume = 0;
    fliesAudio.volume = 0.075;
  }
}

function playOneShot(audio, volume = 1) {
  playAudio(audio, volume, true);
}

function showInteractionHint(label, target) {
  hintTarget = target || null;
  interactionHint.textContent = label || 'Abrir';
  interactionHint.classList.toggle('hidden', !label);
  interactionHint.classList.toggle('show', !!label);
  if (!label || !target) return;

  const rect = target.getBoundingClientRect();
  const gameRect = document.getElementById('game').getBoundingClientRect();
  const leftPct = ((rect.left - gameRect.left) / gameRect.width) * 100;
  const topPct = ((rect.top - gameRect.top) / gameRect.height) * 100;
  interactionHint.style.left = `${Math.min(88, Math.max(2, leftPct + 2))}%`;
  interactionHint.style.top = `${Math.min(92, Math.max(2, topPct + 2))}%`;
}

function hideInteractionHint() {
  hintTarget = null;
  interactionHint.classList.add('hidden');
  interactionHint.classList.remove('show');
}

function showMessage(text, duration = 4300) {
  if (messageTimer) clearTimeout(messageTimer);
  sceneMessage.textContent = text;
  sceneMessage.classList.remove('hidden');
  requestAnimationFrame(() => sceneMessage.classList.add('visible'));
  messageTimer = window.setTimeout(() => {
    sceneMessage.classList.remove('visible');
    window.setTimeout(() => sceneMessage.classList.add('hidden'), 700);
  }, duration);
}

function hideMessage() {
  if (messageTimer) clearTimeout(messageTimer);
  sceneMessage.classList.remove('visible');
  setTimeout(() => sceneMessage.classList.add('hidden'), 650);
}

function setImage(src, alt) {
  sceneImage.src = src;
  sceneImage.alt = alt;
}

function hideAllHotspots() {
  [doorHandle, fridgeHotspot, bathroomDoorHotspot, freezerHotspot, bodyHotspot].forEach(btn => btn.classList.add('hidden'));
}

function showKitchenControls() {
  hideAllHotspots();
  fridgeHotspot.classList.remove('hidden');
  bathroomDoorHotspot.classList.remove('hidden');
  backButton.classList.remove('hidden');
  actionBar.classList.add('hidden');
}

function showFridgeControls() {
  hideAllHotspots();
  freezerHotspot.classList.remove('hidden');
  backButton.classList.add('hidden');
  actionBar.classList.remove('hidden');
  actionClose.textContent = 'FECHAR GELADEIRA';
  actionKitchen.textContent = '← COZINHA';
}

function showFreezerControls() {
  hideAllHotspots();
  backButton.classList.add('hidden');
  actionBar.classList.remove('hidden');
  actionClose.textContent = 'FECHAR FREEZER';
  actionKitchen.textContent = '← COZINHA';
}

function showBathroomControls() {
  hideAllHotspots();
  bodyHotspot.classList.remove('hidden');
  backButton.classList.remove('hidden');
  actionBar.classList.add('hidden');
}

function showEntryControls() {
  hideAllHotspots();
  doorHandle.classList.remove('hidden');
  backButton.classList.add('hidden');
  actionBar.classList.add('hidden');
}

async function transitionToScene(src, alt, fadeMs = 900) {
  sceneOverlay.classList.add('fade-out');
  await sleep(fadeMs);
  setImage(src, alt);
  sceneOverlay.classList.remove('fade-out');
  sceneOverlay.classList.add('fade-in');
  await sleep(fadeMs);
  sceneOverlay.classList.remove('fade-in');
}

async function enterKitchen() {
  if (state.transitioning || state.scene !== 'entry') return;
  state.transitioning = true;
  hideInteractionHint();
  doorHandle.disabled = true;

  playOneShot(handleAudio, 0.8);
  await sleep(360);
  playOneShot(metalOpenAudio, 0.92);

  await transitionToScene(IMAGE.kitchen, 'Uma cozinha escura', 900);
  state.scene = 'kitchen';
  state.kitchenView = 'normal';
  setAmbientForScene('kitchen');
  showKitchenControls();
  showMessage('Não sinto uma sensação boa.', 4300);

  doorHandle.disabled = false;
  state.transitioning = false;
}

async function openFridge() {
  if (state.transitioning || state.scene !== 'kitchen' || state.kitchenView !== 'normal') return;
  state.transitioning = true;
  hideInteractionHint();
  playOneShot(fridgeOpenAudio, 0.88);
  await transitionToScene(IMAGE.fridgeOpen, 'Geladeira aberta', 650);
  state.scene = 'fridgeOpen';
  setAmbientForScene('fridgeOpen');
  showFridgeControls();
  state.transitioning = false;
}

async function closeFridge() {
  if (state.transitioning || state.scene !== 'fridgeOpen') return;
  state.transitioning = true;
  hideInteractionHint();
  playOneShot(fridgeCloseAudio, 0.84);
  await transitionToScene(IMAGE.fridgeClosed, 'Geladeira fechada', 520);
  state.scene = 'kitchen';
  state.kitchenView = 'normal';
  setAmbientForScene('kitchen');
  showKitchenControls();
  state.transitioning = false;
}

async function openFreezer() {
  if (state.transitioning || state.scene !== 'fridgeOpen') return;
  state.transitioning = true;
  hideInteractionHint();
  playOneShot(freezerOpenAudio, 0.86);
  await transitionToScene(IMAGE.freezerOpen, 'Freezer aberto', 520);
  state.scene = 'freezerOpen';
  setAmbientForScene('freezerOpen');
  showFreezerControls();
  state.transitioning = false;
}

async function closeFreezer() {
  if (state.transitioning || state.scene !== 'freezerOpen') return;
  state.transitioning = true;
  playOneShot(freezerCloseAudio, 0.84);
  await transitionToScene(IMAGE.fridgeOpen, 'Geladeira aberta', 520);
  state.scene = 'fridgeOpen';
  setAmbientForScene('fridgeOpen');
  showFridgeControls();
  state.transitioning = false;
}

async function leaveFridgeToKitchen() {
  if (state.transitioning || !['fridgeOpen', 'freezerOpen'].includes(state.scene)) return;
  state.transitioning = true;
  hideInteractionHint();

  if (state.scene === 'fridgeOpen') playOneShot(fridgeCloseAudio, 0.78);
  if (state.scene === 'freezerOpen') {
    playOneShot(freezerCloseAudio, 0.72);
    await sleep(220);
    playOneShot(fridgeCloseAudio, 0.78);
  }

  await transitionToScene(IMAGE.kitchen, 'Uma cozinha escura', 700);
  state.scene = 'kitchen';
  state.kitchenView = 'normal';
  setAmbientForScene('kitchen');
  showKitchenControls();
  state.transitioning = false;
}

async function enterBathroom() {
  if (state.transitioning || state.scene !== 'kitchen') return;
  state.transitioning = true;
  hideInteractionHint();

  playOneShot(handleAudio, 0.74);
  await sleep(380);
  playOneShot(woodOpenAudio, 0.86);

  await transitionToScene(IMAGE.bathroomDoorOpen, 'A porta do banheiro aberta', 500);
  await sleep(700);
  await transitionToScene(IMAGE.bathroom, 'Um banheiro escuro', 800);

  state.scene = 'bathroom';
  setAmbientForScene('bathroom');
  showBathroomControls();
  state.transitioning = false;
}

async function leaveBathroom() {
  if (state.transitioning || state.scene !== 'bathroom') return;
  state.transitioning = true;
  hideInteractionHint();

  playOneShot(woodCloseAudio, 0.7);
  await sleep(250);
  await transitionToScene(IMAGE.kitchen, 'Uma cozinha escura', 750);
  state.scene = 'kitchen';
  setAmbientForScene('kitchen');
  showKitchenControls();
  state.transitioning = false;
}

function inspectBody() {
  if (state.transitioning || state.scene !== 'bathroom') return;
  if (!state.bodyMessageShown) {
    state.bodyMessageShown = true;
    showMessage('O cheiro tá horrível.', 5200);
  } else {
    showMessage('O cheiro tá horrível.', 3400);
  }
}

async function returnFromKitchenToEntry() {
  if (state.transitioning || state.scene !== 'kitchen') return;
  state.transitioning = true;
  hideInteractionHint();
  hideMessage();
  playOneShot(metalOpenAudio, 0.46);
  await transitionToScene(IMAGE.entry, 'Uma porta metálica escura', 900);
  state.scene = 'entry';
  setAmbientForScene('entry');
  showEntryControls();
  state.transitioning = false;
}

async function playIntro() {
  if (state.started) return;
  state.started = true;
  startButton.disabled = true;
  startButton.style.display = 'none';

  unlockAmbientAudio();
  initTypewriterAudio();

  const preloadList = Object.values(IMAGE).map(src => {
    const img = new Image();
    img.src = src;
    return img;
  });
  void preloadList;

  for (let i = 0; i < story.length; i++) {
    await typeText(story[i].text);
    await sleep(story[i].pauseAfter);
    if (i !== story.length - 1) introText.textContent += '\n\n';
  }

  scene.classList.remove('hidden');
  showEntryControls();
  setAmbientForScene('entry');
  requestAnimationFrame(() => scene.classList.add('visible'));

  await sleep(800);
  intro.style.opacity = '0';
  await sleep(1600);
  intro.classList.add('hidden');
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

startButton.addEventListener('click', playIntro);
doorHandle.addEventListener('click', enterKitchen);
fridgeHotspot.addEventListener('click', openFridge);
bathroomDoorHotspot.addEventListener('click', enterBathroom);
freezerHotspot.addEventListener('click', openFreezer);
bodyHotspot.addEventListener('click', inspectBody);

actionClose.addEventListener('click', () => {
  if (state.scene === 'fridgeOpen') closeFridge();
  else if (state.scene === 'freezerOpen') closeFreezer();
});
actionKitchen.addEventListener('click', leaveFridgeToKitchen);
backButton.addEventListener('click', () => {
  if (state.scene === 'kitchen') returnFromKitchenToEntry();
  else if (state.scene === 'bathroom') leaveBathroom();
});

function wireHint(button, label) {
  button.addEventListener('pointerenter', () => showInteractionHint(label, button));
  button.addEventListener('pointerleave', hideInteractionHint);
  button.addEventListener('focus', () => showInteractionHint(label, button));
  button.addEventListener('blur', hideInteractionHint);
}

wireHint(doorHandle, 'Abrir');
wireHint(fridgeHotspot, 'Abrir');
wireHint(bathroomDoorHotspot, 'Entrar');
wireHint(freezerHotspot, 'Abrir');
wireHint(bodyHotspot, 'Examinar');

// Garante que um clique do usuário possa reativar um ambiente que o navegador suspendeu.
document.addEventListener('pointerdown', () => {
  if (!state.started || !state.audioUnlocked || state.transitioning) return;
  [nightAudio, kitchenAudio, fridgeHumAudio, fliesAudio].forEach(audio => {
    if (audio.paused && audio.volume > 0) playAudio(audio, audio.volume);
  });
  if (typewriterContext?.state === 'suspended') typewriterContext.resume().catch(() => {});
});

// Caso o usuário volte para uma aba que ficou em segundo plano.
document.addEventListener('visibilitychange', () => {
  if (document.hidden || !state.started || state.transitioning) return;
  setAmbientForScene(state.scene === 'entry' ? 'entry' : state.scene);
});
