const $ = (id) => document.getElementById(id);

const intro = $('intro');
const introText = $('intro-text');
const startButton = $('start-button');
const scene = $('scene');
const sceneImage = $('scene-image');
const sceneOverlay = $('scene-overlay');
const interactionHint = $('interaction-hint');
const sceneMessage = $('scene-message');

const doorHandle = $('door-handle');
const fridgeHotspot = $('fridge-hotspot');
const bathroomDoorHotspot = $('bathroom-door-hotspot');
const freezerHotspot = $('freezer-hotspot');
const bodyHotspot = $('body-hotspot');
const backButton = $('back-button');

const actionBar = $('action-bar');
const actionClose = $('action-close');
const actionKitchen = $('action-kitchen');

const nightAudio = $('night-audio');
const kitchenAudio = $('kitchen-audio');
const fliesAudio = $('flies-audio');
const fridgeHumAudio = $('fridge-hum-audio');
const handleAudio = $('handle-audio');
const metalOpenAudio = $('metal-open-audio');
const woodOpenAudio = $('wood-open-audio');
const woodCloseAudio = $('wood-close-audio');
const fridgeOpenAudio = $('fridge-open-audio');
const fridgeCloseAudio = $('fridge-close-audio');
const freezerOpenAudio = $('freezer-open-audio');
const freezerCloseAudio = $('freezer-close-audio');

const PATH = 'assets/scenes/';

const images = {
  first: `${PATH}scene-01.png`,
  kitchen: `${PATH}scene-02.png`,
  fridgeClosed: `${PATH}geladeirafechada.png`,
  fridgeOpen: `${PATH}geladeiraportaaberta.png`,
  freezerOpen: `${PATH}geladeirafreezeraberto.png`,
  bathroomOpen: `${PATH}cozinhabanheiroaberto.png`,
  bathroom: `${PATH}banheiroazul.png`
};

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
  scene: 'entry',
  fridge: 'closed',
  bathroomExamined: false,
  audioUnlocked: false
};

let typewriterContext = null;
let messageTimer = null;
let messageFadeTimer = null;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function waitForImage(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = resolve;
    img.onerror = resolve;
    img.src = src;
  });
}

function preloadImages() {
  return Promise.all(Object.values(images).map(waitForImage));
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
  } catch (error) {
    console.warn('Máquina de escrever indisponível:', error);
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
  osc.frequency.setValueAtTime(1180 + Math.random() * 360, now);
  filter.type = 'highpass';
  filter.frequency.setValueAtTime(540, now);

  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.045, now + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.04);
}

function setVolume(audio, value) {
  if (!audio) return;
  audio.volume = Math.max(0, Math.min(1, value));
}

function startLoop(audio, volume, restart = false) {
  if (!audio) return;
  audio.loop = true;
  setVolume(audio, volume);
  if (restart) {
    try { audio.currentTime = 0; } catch (_) {}
  }
  const promise = audio.play();
  if (promise && promise.catch) {
    promise.catch(error => console.warn('Falha ao iniciar loop:', audio.src, error));
  }
}

function stopAudio(audio, reset = false) {
  if (!audio) return;
  audio.pause();
  if (reset) {
    try { audio.currentTime = 0; } catch (_) {}
  }
}

function playOneShot(audio, volume = 0.9) {
  if (!audio) return Promise.resolve();

  try { audio.pause(); } catch (_) {}
  try { audio.currentTime = 0; } catch (_) {}
  setVolume(audio, volume);

  const promise = audio.play();
  if (promise && promise.catch) {
    promise.catch(error => console.warn('Falha ao tocar efeito:', audio.src, error));
  }
  return promise || Promise.resolve();
}

function fadeAudio(audio, target, duration = 900) {
  if (!audio) return Promise.resolve();
  const start = performance.now();
  const from = audio.volume;

  return new Promise(resolve => {
    function tick(now) {
      const p = duration <= 0 ? 1 : Math.min(1, (now - start) / duration);
      setVolume(audio, from + (target - from) * p);
      if (p < 1) requestAnimationFrame(tick);
      else resolve();
    }
    requestAnimationFrame(tick);
  });
}

function unlockLoopAudios() {
  if (state.audioUnlocked) return;
  state.audioUnlocked = true;

  // Todos os loops são iniciados dentro do clique inicial para evitar bloqueios
  // de autoplay mais tarde. Os que ainda não são usados ficam inaudíveis.
  startLoop(nightAudio, 0, true);
  startLoop(kitchenAudio, 0, true);
  startLoop(fliesAudio, 0, true);
  startLoop(fridgeHumAudio, 0, true);
}

function setScene(src, alt) {
  sceneImage.src = src;
  sceneImage.alt = alt;
}

function clearMessage() {
  if (messageTimer) clearTimeout(messageTimer);
  if (messageFadeTimer) clearTimeout(messageFadeTimer);
  sceneMessage.classList.remove('visible');
  messageFadeTimer = setTimeout(() => sceneMessage.classList.add('hidden'), 700);
}

function showSceneMessage(text, duration = 4200) {
  clearMessage();
  sceneMessage.textContent = text;
  sceneMessage.classList.remove('hidden');
  requestAnimationFrame(() => sceneMessage.classList.add('visible'));

  messageTimer = setTimeout(() => {
    sceneMessage.classList.remove('visible');
    messageFadeTimer = setTimeout(() => sceneMessage.classList.add('hidden'), 700);
  }, duration);
}

function setHint(show, text = 'Abrir', hotspot = null) {
  interactionHint.textContent = text;
  interactionHint.classList.toggle('hidden', !show);
  interactionHint.classList.toggle('show', show);

  if (show && hotspot) {
    const rect = hotspot.getBoundingClientRect();
    const gameRect = document.getElementById('game').getBoundingClientRect();
    const x = ((rect.left + rect.width * 0.5 - gameRect.left) / gameRect.width) * 100;
    const y = ((rect.top + rect.height * 0.5 - gameRect.top) / gameRect.height) * 100;
    interactionHint.style.left = `${x}%`;
    interactionHint.style.top = `${Math.max(4, y - 4)}%`;
    interactionHint.style.transform = 'translate(-50%, -50%)';
  }
}

function hideAllHotspots() {
  [doorHandle, fridgeHotspot, bathroomDoorHotspot, freezerHotspot, bodyHotspot]
    .forEach(h => h.classList.add('hidden'));
  actionBar.classList.add('hidden');
  backButton.classList.add('hidden');
  setHint(false);
}

function showEntryControls() {
  hideAllHotspots();
  doorHandle.classList.remove('hidden');
}

function showKitchenControls() {
  hideAllHotspots();
  fridgeHotspot.classList.remove('hidden');
  bathroomDoorHotspot.classList.remove('hidden');
  backButton.classList.remove('hidden');
}

function showFridgeControls() {
  hideAllHotspots();
  freezerHotspot.classList.remove('hidden');
  actionBar.classList.remove('hidden');
  actionClose.textContent = 'FECHAR GELADEIRA';
  actionKitchen.textContent = '← COZINHA';
}

function showFreezerControls() {
  hideAllHotspots();
  actionBar.classList.remove('hidden');
  actionClose.textContent = 'FECHAR FREEZER';
  actionKitchen.textContent = '← COZINHA';
}

function showBathroomControls() {
  hideAllHotspots();
  bodyHotspot.classList.remove('hidden');
  actionBar.classList.remove('hidden');
  actionClose.textContent = '← COZINHA';
  actionKitchen.textContent = '';
  actionKitchen.classList.add('empty-action');
}

function restoreKitchenActionButtons() {
  actionKitchen.classList.remove('empty-action');
}

function prepareAudioEvents() {
  [nightAudio, kitchenAudio, fliesAudio, fridgeHumAudio, handleAudio,
   metalOpenAudio, woodOpenAudio, woodCloseAudio, fridgeOpenAudio,
   fridgeCloseAudio, freezerOpenAudio, freezerCloseAudio]
    .forEach(audio => {
      if (!audio) return;
      audio.preload = 'auto';
      audio.addEventListener('error', () => {
        console.warn('Arquivo de áudio não encontrado:', audio.currentSrc || audio.src);
      });
    });
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

async function enterKitchen() {
  if (state.transitioning || state.scene !== 'entry') return;
  state.transitioning = true;
  hideAllHotspots();

  await playOneShot(handleAudio, 0.86);
  await sleep(280);
  playOneShot(metalOpenAudio, 0.92);

  // A troca começa antes do fim do efeito de 4 s, deixando o som atravessar
  // a transição em vez de fazer o jogador esperar todo o áudio.
  sceneOverlay.classList.add('fade-out');
  await sleep(1650);

  setScene(images.kitchen, 'Uma cozinha escura');
  sceneOverlay.classList.remove('fade-out');
  sceneOverlay.classList.add('fade-in');

  await fadeAudio(nightAudio, 0, 1200);
  await fadeAudio(kitchenAudio, 0.42, 1200);
  await sleep(350);
  sceneOverlay.classList.remove('fade-in');

  state.scene = 'kitchen';
  showKitchenControls();
  showSceneMessage('Não sinto uma sensação boa.', 4200);
  state.transitioning = false;
}

async function returnToEntry() {
  if (state.transitioning || state.scene !== 'kitchen') return;
  state.transitioning = true;
  hideAllHotspots();
  clearMessage();
  sceneOverlay.classList.add('fade-out');

  await sleep(1500);
  setScene(images.first, 'Uma porta metálica escura');
  sceneOverlay.classList.remove('fade-out');
  sceneOverlay.classList.add('fade-in');

  await fadeAudio(kitchenAudio, 0, 1000);
  await fadeAudio(nightAudio, 0.03, 1000);
  await sleep(350);
  sceneOverlay.classList.remove('fade-in');

  state.scene = 'entry';
  showEntryControls();
  state.transitioning = false;
}

async function openFridge() {
  if (state.transitioning || state.scene !== 'kitchen') return;
  state.transitioning = true;
  hideAllHotspots();

  playOneShot(fridgeOpenAudio, 0.9);
  setScene(images.fridgeOpen, 'Geladeira aberta');
  state.fridge = 'open';
  startLoop(fridgeHumAudio, 0.08, true);
  await sleep(180);
  showFridgeControls();
  state.transitioning = false;
}

async function closeFridge() {
  if (state.transitioning || state.scene !== 'fridge') return;
  state.transitioning = true;
  hideAllHotspots();

  playOneShot(fridgeCloseAudio, 0.92);
  await sleep(100);
  await fadeAudio(fridgeHumAudio, 0, 420);
  stopAudio(fridgeHumAudio, true);
  setScene(images.fridgeClosed, 'Geladeira fechada');
  await sleep(220);

  state.fridge = 'closed';
  state.scene = 'kitchen';
  showKitchenControls();
  state.transitioning = false;
}

async function openFreezer() {
  if (state.transitioning || state.scene !== 'fridge') return;
  state.transitioning = true;
  hideAllHotspots();

  playOneShot(freezerOpenAudio, 0.9);
  setScene(images.freezerOpen, 'Freezer aberto');
  state.fridge = 'freezer';
  await sleep(180);
  showFreezerControls();
  state.transitioning = false;
}

async function closeFreezer() {
  if (state.transitioning || state.scene !== 'freezer') return;
  state.transitioning = true;
  hideAllHotspots();

  playOneShot(freezerCloseAudio, 0.92);
  setScene(images.fridgeOpen, 'Geladeira aberta');
  state.fridge = 'open';
  await sleep(180);
  showFridgeControls();
  state.transitioning = false;
}

async function kitchenFromFridge() {
  if (state.transitioning) return;
  if (state.scene === 'fridge') return closeFridge();
  if (state.scene === 'freezer') {
    state.transitioning = true;
    hideAllHotspots();
    playOneShot(freezerCloseAudio, 0.9);
    await fadeAudio(fridgeHumAudio, 0, 400);
    stopAudio(fridgeHumAudio, true);
    playOneShot(fridgeCloseAudio, 0.9);
    setScene(images.kitchen, 'Uma cozinha escura');
    state.fridge = 'closed';
    state.scene = 'kitchen';
    await sleep(550);
    showKitchenControls();
    state.transitioning = false;
  }
}

async function enterBathroom() {
  if (state.transitioning || state.scene !== 'kitchen') return;
  state.transitioning = true;
  hideAllHotspots();
  clearMessage();

  await playOneShot(handleAudio, 0.82);
  await sleep(250);

  // A foto da cozinha com a porta aberta aparece junto do som da porta.
  playOneShot(woodOpenAudio, 0.88);
  setScene(images.bathroomOpen, 'Porta do banheiro aberta');
  sceneOverlay.classList.add('fade-in');
  await sleep(250);
  sceneOverlay.classList.remove('fade-in');

  // Não obriga o jogador a ouvir um efeito muito comprido. A porta de madeira
  // tem no máximo ~3,6 s de janela audível nesta sequência.
  await sleep(3200);
  stopAudio(woodOpenAudio, false);

  sceneOverlay.classList.add('fade-out');
  await sleep(900);
  setScene(images.bathroom, 'Banheiro escuro');
  sceneOverlay.classList.remove('fade-out');
  sceneOverlay.classList.add('fade-in');

  await fadeAudio(kitchenAudio, 0, 850);
  startLoop(fliesAudio, 0.14, true);
  await sleep(350);
  sceneOverlay.classList.remove('fade-in');

  state.scene = 'bathroom';
  showBathroomControls();
  state.transitioning = false;
}

async function leaveBathroom() {
  if (state.transitioning || state.scene !== 'bathroom') return;
  state.transitioning = true;
  hideAllHotspots();
  clearMessage();

  playOneShot(woodCloseAudio, 0.88);
  sceneOverlay.classList.add('fade-out');
  await sleep(850);

  setScene(images.kitchen, 'Uma cozinha escura');
  sceneOverlay.classList.remove('fade-out');
  sceneOverlay.classList.add('fade-in');

  await fadeAudio(fliesAudio, 0, 700);
  stopAudio(fliesAudio, true);
  await fadeAudio(kitchenAudio, 0.42, 950);
  await sleep(350);
  sceneOverlay.classList.remove('fade-in');

  state.scene = 'kitchen';
  restoreKitchenActionButtons();
  showKitchenControls();
  state.transitioning = false;
}

function examineBody() {
  if (state.transitioning || state.scene !== 'bathroom') return;
  if (state.bathroomExamined) return;
  state.bathroomExamined = true;
  showSceneMessage('O cheiro tá horrível.', 4500);
}

async function playIntro() {
  if (state.started) return;
  state.started = true;
  startButton.disabled = true;
  startButton.style.display = 'none';

  unlockLoopAudios();
  initTypewriterAudio();
  prepareAudioEvents();
  preloadImages();

  for (let i = 0; i < story.length; i++) {
    await typeText(story[i].text);
    await sleep(story[i].pauseAfter);
    if (i !== story.length - 1) introText.textContent += '\n\n';
  }

  await sleep(500);
  scene.classList.remove('hidden');
  showEntryControls();

  await fadeAudio(nightAudio, 0.03, 1300);
  await sleep(250);
  scene.classList.add('visible');

  await sleep(900);
  intro.style.opacity = '0';
  await sleep(1600);
  intro.classList.add('hidden');
}

// --------------------------- Eventos ---------------------------------------
startButton.addEventListener('click', playIntro);

doorHandle.addEventListener('pointerenter', () => setHint(true, 'Abrir', doorHandle));
doorHandle.addEventListener('pointerleave', () => setHint(false));
doorHandle.addEventListener('focus', () => setHint(true, 'Abrir', doorHandle));
doorHandle.addEventListener('blur', () => setHint(false));
doorHandle.addEventListener('click', enterKitchen);

fridgeHotspot.addEventListener('pointerenter', () => setHint(true, 'Abrir', fridgeHotspot));
fridgeHotspot.addEventListener('pointerleave', () => setHint(false));
fridgeHotspot.addEventListener('click', openFridge);

freezerHotspot.addEventListener('pointerenter', () => setHint(true, 'Abrir', freezerHotspot));
freezerHotspot.addEventListener('pointerleave', () => setHint(false));
freezerHotspot.addEventListener('click', openFreezer);

bathroomDoorHotspot.addEventListener('pointerenter', () => setHint(true, 'Entrar', bathroomDoorHotspot));
bathroomDoorHotspot.addEventListener('pointerleave', () => setHint(false));
bathroomDoorHotspot.addEventListener('click', enterBathroom);

bodyHotspot.addEventListener('pointerenter', () => setHint(true, 'Examinar', bodyHotspot));
bodyHotspot.addEventListener('pointerleave', () => setHint(false));
bodyHotspot.addEventListener('click', examineBody);

backButton.addEventListener('click', () => {
  if (state.scene === 'kitchen') returnToEntry();
});

actionClose.addEventListener('click', () => {
  if (state.scene === 'fridge') closeFridge();
  else if (state.scene === 'freezer') closeFreezer();
  else if (state.scene === 'bathroom') leaveBathroom();
});

actionKitchen.addEventListener('click', () => {
  if (state.scene === 'fridge' || state.scene === 'freezer') kitchenFromFridge();
  else if (state.scene === 'bathroom') leaveBathroom();
});

// Se o navegador suspender o áudio, qualquer interação do jogador pode
// recuperá-lo sem alterar a cena atual.
document.addEventListener('pointerdown', () => {
  if (!state.started || !state.audioUnlocked) return;

  if (state.scene === 'entry' && nightAudio.paused) startLoop(nightAudio, 0.03);
  if (state.scene === 'kitchen' && kitchenAudio.paused) startLoop(kitchenAudio, 0.42);
  if (state.scene === 'bathroom' && fliesAudio.paused) startLoop(fliesAudio, 0.14);
  if ((state.scene === 'fridge' || state.scene === 'freezer') && fridgeHumAudio.paused) {
    startLoop(fridgeHumAudio, 0.08);
  }
});

prepareAudioEvents();
