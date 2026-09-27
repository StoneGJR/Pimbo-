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
  audioUnlocked: false
};

let typewriterContext = null;
let messageTimer = null;
let messageFadeTimer = null;
let hintHotspot = null;

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
  if (!audio) return Promise.resolve();
  audio.loop = true;
  setVolume(audio, volume);
  if (restart) {
    try { audio.currentTime = 0; } catch (_) {}
  }
  const promise = audio.play();
  return promise && promise.catch ? promise.catch(error => {
    console.warn('Falha ao iniciar loop:', audio.src, error);
  }) : Promise.resolve();
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
  audio.loop = false;
  setVolume(audio, volume);

  const promise = audio.play();
  return promise && promise.catch ? promise.catch(error => {
    console.warn('Falha ao tocar efeito:', audio.src, error);
  }) : Promise.resolve();
}

function playOneShotAndWait(audio, volume = 0.9, maxWaitMs = 5000) {
  if (!audio) return Promise.resolve();

  try { audio.pause(); } catch (_) {}
  try { audio.currentTime = 0; } catch (_) {}
  audio.loop = false;
  setVolume(audio, volume);

  return new Promise(resolve => {
    let finished = false;
    let timer = null;

    const finish = () => {
      if (finished) return;
      finished = true;
      if (timer) clearTimeout(timer);
      audio.removeEventListener('ended', finish);
      resolve();
    };

    audio.addEventListener('ended', finish, { once: true });
    timer = setTimeout(finish, maxWaitMs);

    const promise = audio.play();
    if (promise && promise.catch) {
      promise.catch(error => {
        console.warn('Falha ao tocar efeito:', audio.src, error);
        finish();
      });
    }
  });
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

function moveHintToPointer(event) {
  const game = document.getElementById('game');
  if (!game || !interactionHint || !hintHotspot) return;

  const rect = game.getBoundingClientRect();
  const offsetX = 12;
  const offsetY = 16;
  const x = Math.min(rect.width - 8, Math.max(8, event.clientX - rect.left + offsetX));
  const y = Math.min(rect.height - 8, Math.max(8, event.clientY - rect.top - offsetY));

  interactionHint.style.left = `${x}px`;
  interactionHint.style.top = `${y}px`;
  interactionHint.style.transform = 'translate(0, -100%)';
}

function setHint(show, text = 'Abrir', hotspot = null, event = null) {
  hintHotspot = show ? hotspot : null;
  interactionHint.textContent = text;
  interactionHint.classList.toggle('hidden', !show);
  interactionHint.classList.toggle('show', show);

  if (show && event) moveHintToPointer(event);
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

function showFridgeClosedControls() {
  hideAllHotspots();
  fridgeHotspot.classList.remove('hidden');
  actionBar.classList.remove('hidden');
  actionClose.textContent = 'ABRIR GELADEIRA';
  actionKitchen.textContent = '← COZINHA';
}

function showFridgeOpenControls() {
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
  clearMessage();

  // Maçaneta termina antes da porta metálica começar: sem sobreposição indesejada.
  await playOneShotAndWait(handleAudio, 0.86, 2200);
  playOneShot(metalOpenAudio, 0.92);

  sceneOverlay.classList.add('fade-out');
  await sleep(1550);

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

async function approachFridge() {
  if (state.transitioning || state.scene !== 'kitchen') return;
  state.transitioning = true;
  hideAllHotspots();
  clearMessage();

  setScene(images.fridgeClosed, 'Geladeira fechada');
  await sleep(180);

  state.scene = 'fridgeClosed';
  showFridgeClosedControls();
  state.transitioning = false;
}

async function openFridge() {
  if (state.transitioning || state.scene !== 'fridgeClosed') return;
  state.transitioning = true;
  hideAllHotspots();

  playOneShot(fridgeOpenAudio, 0.9);
  setScene(images.fridgeOpen, 'Geladeira aberta');
  await startLoop(fridgeHumAudio, 0.08, true);
  await sleep(180);

  state.scene = 'fridge';
  showFridgeOpenControls();
  state.transitioning = false;
}

async function closeFridge() {
  if (state.transitioning || state.scene !== 'fridge') return;
  state.transitioning = true;
  hideAllHotspots();

  playOneShot(fridgeCloseAudio, 0.92);
  await fadeAudio(fridgeHumAudio, 0, 420);
  stopAudio(fridgeHumAudio, true);
  setScene(images.fridgeClosed, 'Geladeira fechada');
  await sleep(220);

  state.scene = 'fridgeClosed';
  showFridgeClosedControls();
  state.transitioning = false;
}

async function openFreezer() {
  if (state.transitioning || state.scene !== 'fridge') return;
  state.transitioning = true;
  hideAllHotspots();

  playOneShot(freezerOpenAudio, 0.9);
  setScene(images.freezerOpen, 'Freezer aberto');
  await sleep(180);

  state.scene = 'freezer';
  showFreezerControls();
  state.transitioning = false;
}

async function closeFreezer() {
  if (state.transitioning || state.scene !== 'freezer') return;
  state.transitioning = true;
  hideAllHotspots();

  playOneShot(freezerCloseAudio, 0.92);
  setScene(images.fridgeOpen, 'Geladeira aberta');
  await sleep(180);

  state.scene = 'fridge';
  showFridgeOpenControls();
  state.transitioning = false;
}

async function kitchenFromFridge() {
  if (state.transitioning) return;

  if (state.scene === 'fridgeClosed') {
    state.transitioning = true;
    hideAllHotspots();
    setScene(images.kitchen, 'Uma cozinha escura');
    await sleep(250);
    state.scene = 'kitchen';
    showKitchenControls();
    state.transitioning = false;
    return;
  }

  if (state.scene === 'fridge') {
    state.transitioning = true;
    hideAllHotspots();
    playOneShot(fridgeCloseAudio, 0.9);
    await fadeAudio(fridgeHumAudio, 0, 400);
    stopAudio(fridgeHumAudio, true);
    setScene(images.kitchen, 'Uma cozinha escura');
    state.scene = 'kitchen';
    await sleep(500);
    showKitchenControls();
    state.transitioning = false;
    return;
  }

  if (state.scene === 'freezer') {
    state.transitioning = true;
    hideAllHotspots();
    playOneShot(freezerCloseAudio, 0.9);
    await sleep(140);
    playOneShot(fridgeCloseAudio, 0.9);
    await fadeAudio(fridgeHumAudio, 0, 400);
    stopAudio(fridgeHumAudio, true);
    setScene(images.kitchen, 'Uma cozinha escura');
    state.scene = 'kitchen';
    await sleep(500);
    showKitchenControls();
    state.transitioning = false;
  }
}

async function enterBathroom() {
  if (state.transitioning || state.scene !== 'kitchen') return;
  state.transitioning = true;
  hideAllHotspots();
  clearMessage();

  // Também aqui a maçaneta acontece primeiro, depois a madeira.
  await playOneShotAndWait(handleAudio, 0.82, 2200);
  playOneShot(woodOpenAudio, 0.88);

  setScene(images.bathroomOpen, 'Porta do banheiro aberta');
  sceneOverlay.classList.add('fade-in');
  await sleep(250);
  sceneOverlay.classList.remove('fade-in');

  // A cena intermediária fica visível por alguns segundos sem prender o jogo.
  await sleep(3000);
  stopAudio(woodOpenAudio, false);

  sceneOverlay.classList.add('fade-out');
  await sleep(900);
  setScene(images.bathroom, 'Banheiro escuro');
  sceneOverlay.classList.remove('fade-out');
  sceneOverlay.classList.add('fade-in');

  await fadeAudio(kitchenAudio, 0, 850);
  await startLoop(fliesAudio, 0.14, true);
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
  // O jogador pode examinar novamente sempre que clicar.
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

function bindHoverHint(hotspot, text) {
  hotspot.addEventListener('pointerenter', event => setHint(true, text, hotspot, event));
  hotspot.addEventListener('pointermove', event => {
    if (hintHotspot === hotspot) moveHintToPointer(event);
  });
  hotspot.addEventListener('pointerleave', () => {
    if (hintHotspot === hotspot) setHint(false);
  });
  hotspot.addEventListener('focus', () => setHint(true, text, hotspot));
  hotspot.addEventListener('blur', () => {
    if (hintHotspot === hotspot) setHint(false);
  });
}

startButton.addEventListener('click', playIntro);

bindHoverHint(doorHandle, 'Abrir');
doorHandle.addEventListener('click', enterKitchen);

bindHoverHint(fridgeHotspot, 'Abrir');
fridgeHotspot.addEventListener('click', () => {
  if (state.scene === 'kitchen') approachFridge();
  else if (state.scene === 'fridgeClosed') openFridge();
});

bindHoverHint(freezerHotspot, 'Abrir freezer');
freezerHotspot.addEventListener('click', openFreezer);

bindHoverHint(bathroomDoorHotspot, 'Entrar');
bathroomDoorHotspot.addEventListener('click', enterBathroom);

bindHoverHint(bodyHotspot, 'Examinar');
bodyHotspot.addEventListener('click', examineBody);

backButton.addEventListener('click', () => {
  if (state.scene === 'kitchen') returnToEntry();
});

actionClose.addEventListener('click', () => {
  if (state.scene === 'fridgeClosed') openFridge();
  else if (state.scene === 'fridge') closeFridge();
  else if (state.scene === 'freezer') closeFreezer();
  else if (state.scene === 'bathroom') leaveBathroom();
});

actionKitchen.addEventListener('click', () => {
  if (state.scene === 'fridgeClosed' || state.scene === 'fridge' || state.scene === 'freezer') {
    kitchenFromFridge();
  } else if (state.scene === 'bathroom') {
    leaveBathroom();
  }
});

document.addEventListener('pointerdown', () => {
  if (!state.started || !state.audioUnlocked) return;

  if (state.scene === 'entry' && nightAudio.paused) startLoop(nightAudio, 0.03);
  if ((state.scene === 'kitchen' || state.scene === 'fridgeClosed') && kitchenAudio.paused) {
    startLoop(kitchenAudio, 0.42);
  }
  if (state.scene === 'bathroom' && fliesAudio.paused) startLoop(fliesAudio, 0.14);
  if ((state.scene === 'fridge' || state.scene === 'freezer') && fridgeHumAudio.paused) {
    startLoop(fridgeHumAudio, 0.08);
  }
});

prepareAudioEvents();
