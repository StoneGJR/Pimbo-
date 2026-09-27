const $ = (id) => document.getElementById(id);

const intro = $('intro');
const introText = $('intro-text');
const startButton = $('start-button');
const scene = $('scene');
const sceneImage = $('scene-image');
const sceneImageNext = $('scene-image-next');
const sceneOverlay = $('scene-overlay');
const interactionHint = $('interaction-hint');
const sceneMessage = $('scene-message');

const doorHandle = $('door-handle');
const fridgeHotspot = $('fridge-hotspot');
const freezerHotspot = $('freezer-hotspot');
const bathroomDoorHotspot = $('bathroom-door-hotspot');
const bedroomDoorHotspot = $('bedroom-door-hotspot');
const backHotspot = $('back-hotspot');
const dresserHotspot = $('dresser-hotspot');
const phoneHotspot = $('phone-hotspot');
const drawerHotspot = $('drawer-hotspot');
const keyHotspot = $('key-hotspot');
const bodyHotspot = $('body-hotspot');

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
const slowStepsAudio = $('slow-steps-audio');
const mediumStepsAudio = $('medium-steps-audio');
const fastStepsAudio = $('fast-steps-audio');
const veryFastStepsAudio = $('very-fast-steps-audio');
const keyCollectedAudio = $('key-collected-audio');
const drawerOpenAudio = $('drawer-open-audio');
const phoneCollectedAudio = $('phone-collected-audio');
const jumpscareAudio = $('jumpscare-audio');

const PATH = 'assets/scenes/';
const images = {
  first: `${PATH}scene-01.png`,
  kitchen: `${PATH}scene-02.png`,
  fridgeClosed: `${PATH}geladeirafechada.png`,
  fridgeOpen: `${PATH}geladeiraportaaberta.png`,
  freezerOpen: `${PATH}geladeirafreezeraberto.png`,
  bathroomOpen: `${PATH}cozinhabanheiroaberto.png`,
  bathroom: `${PATH}banheiroazul.png`,
  bedroom: `${PATH}quartoverde.png`,
  dresser: `${PATH}comodacomcelular.png`,
  dresserNoPhone: `${PATH}comodasemcelular.png`,
  drawerOpen: `${PATH}comodagavetaaberta.png`,
  drawerNoKey: `${PATH}comodagavetasemchave.png`,
  jumpscare: `${PATH}jumpscare1.png`
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
  audioUnlocked: false,
  hasKey: false,
  phoneTaken: false,
  gameLocked: false
};

let typewriterContext = null;
let messageTimer = null;
let messageFadeTimer = null;
let hintHotspot = null;
let currentStepAudio = null;
let stuckAudioTimer = null;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const decodedImages = new Map();

async function waitForImage(src) {
  if (decodedImages.has(src)) return decodedImages.get(src);

  const img = new Image();
  img.decoding = 'async';
  const promise = new Promise(resolve => {
    img.onload = async () => {
      try {
        if (img.decode) await img.decode();
      } catch (_) {}
      resolve(img);
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
  decodedImages.set(src, promise);
  return promise;
}

async function preloadImages() {
  await Promise.all(Object.values(images).map(waitForImage));
}

function initTypewriterAudio() {
  if (typewriterContext) return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return;
  try {
    typewriterContext = new AudioCtx();
    if (typewriterContext.state === 'suspended') typewriterContext.resume().catch(() => {});
  } catch (error) {
    console.warn('Áudio procedural indisponível:', error);
  }
}

function typeKeySound() {
  if (!typewriterContext || state.gameLocked) return;
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
  if (!audio || state.gameLocked) return Promise.resolve();
  audio.loop = true;
  setVolume(audio, volume);
  if (restart) {
    try { audio.currentTime = 0; } catch (_) {}
  }
  const promise = audio.play();
  return promise && promise.catch ? promise.catch(() => {}) : Promise.resolve();
}

function stopAudio(audio, reset = false) {
  if (!audio) return;
  audio.pause();
  if (reset) {
    try { audio.currentTime = 0; } catch (_) {}
  }
}

function playOneShot(audio, volume = 0.9) {
  if (!audio || state.gameLocked) return Promise.resolve();
  try { audio.pause(); } catch (_) {}
  try { audio.currentTime = 0; } catch (_) {}
  audio.loop = false;
  setVolume(audio, volume);
  const promise = audio.play();
  return promise && promise.catch ? promise.catch(() => {}) : Promise.resolve();
}

function playOneShotAndWait(audio, volume = 0.9, maxWaitMs = 5000) {
  if (!audio || state.gameLocked) return Promise.resolve();
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
    if (promise && promise.catch) promise.catch(finish);
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
  [nightAudio, kitchenAudio, fliesAudio, fridgeHumAudio].forEach(audio => startLoop(audio, 0, true));
}

function setScene(src, alt) {
  sceneImage.src = src;
  sceneImage.alt = alt;
  if (sceneImageNext) sceneImageNext.alt = '';
}

async function transitionScene(src, alt, fadeMs = 950) {
  // A troca é feita entre duas imagens pré-carregadas. A camada preta fecha
  // completamente a cena atual; a nova imagem só aparece depois de estar
  // pronta, eliminando o flash da cena anterior.
  if (!sceneOverlay || !sceneImageNext) {
    await waitForImage(src);
    setScene(src, alt);
    return;
  }

  state.transitioning = true;
  hideAllHotspots();

  // Garante que a próxima imagem já está decodificada antes de começar.
  await waitForImage(src);

  // Prepara a próxima camada invisível sem mexer na que está na tela.
  sceneImageNext.src = src;
  sceneImageNext.alt = '';
  sceneImageNext.style.transition = 'none';
  sceneImageNext.style.opacity = '0';

  // Cobre a cena atual com preto.
  sceneOverlay.style.transition = `opacity ${fadeMs}ms ease-in-out`;
  sceneOverlay.style.opacity = '1';
  await sleep(fadeMs + 30);

  // Só agora a nova imagem passa a ser a camada visível.
  sceneImageNext.style.opacity = '1';
  sceneImage.style.opacity = '0';
  sceneImage.alt = '';

  // Mantém preto por alguns frames para o navegador estabilizar a troca.
  await new Promise(requestAnimationFrame);
  await new Promise(requestAnimationFrame);

  // Transforma a camada nova em "principal" e prepara a antiga para a próxima vez.
  const oldSrc = sceneImage.src;
  sceneImage.src = src;
  sceneImage.alt = alt;
  sceneImage.style.transition = 'none';
  sceneImage.style.opacity = '1';
  sceneImageNext.style.opacity = '0';
  sceneImageNext.style.transition = 'none';
  sceneImageNext.src = oldSrc;

  // Revela a nova cena com o fade-in do preto.
  sceneOverlay.style.transition = `opacity ${fadeMs}ms ease-in-out`;
  await new Promise(requestAnimationFrame);
  sceneOverlay.style.opacity = '0';
  await sleep(fadeMs + 30);
  sceneOverlay.style.transition = '';
  sceneImage.style.transition = '';
  sceneImageNext.style.transition = '';
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
  const game = $('game');
  if (!game || !interactionHint || !hintHotspot) return;
  const rect = game.getBoundingClientRect();
  const x = Math.min(rect.width - 8, Math.max(8, event.clientX - rect.left + 14));
  const y = Math.min(rect.height - 8, Math.max(8, event.clientY - rect.top + 14));
  interactionHint.style.left = `${x}px`;
  interactionHint.style.top = `${y}px`;
  interactionHint.style.transform = y < 35 ? 'translate(0, 0)' : 'translate(0, -100%)';
}

function setHint(show, text = 'Abrir', hotspot = null, event = null) {
  hintHotspot = show ? hotspot : null;
  interactionHint.textContent = text;
  interactionHint.classList.toggle('hidden', !show);
  interactionHint.classList.toggle('show', show);
  if (show && event) moveHintToPointer(event);
}

function hideAllHotspots() {
  [doorHandle, fridgeHotspot, freezerHotspot, bathroomDoorHotspot, bedroomDoorHotspot,
   backHotspot, dresserHotspot, phoneHotspot, drawerHotspot, keyHotspot, bodyHotspot]
    .forEach(h => h && h.classList.add('hidden'));
  setHint(false);
}

function applyBounds(hotspot, left, top, width, height) {
  if (!hotspot) return;
  hotspot.style.left = left;
  hotspot.style.top = top;
  hotspot.style.width = width;
  hotspot.style.height = height;
}

function positionBackHotspot(context) {
  // O retorno fica em uma faixa pequena e exclusiva no canto inferior esquerdo
  // da cozinha. Nunca usamos uma área vertical enorme que possa capturar o
  // mouse por cima de outros objetos.
  if (context === 'kitchen') {
    applyBounds(backHotspot, '1%', '88%', '18%', '11%');
  } else {
    applyBounds(backHotspot, '1%', '18%', '12%', '64%');
  }
}

function showEntryControls() {
  hideAllHotspots();
  doorHandle.classList.remove('hidden');
}

function showKitchenControls() {
  hideAllHotspots();
  positionBackHotspot('kitchen');
  fridgeHotspot.classList.remove('hidden');
  bathroomDoorHotspot.classList.remove('hidden');
  bedroomDoorHotspot.classList.remove('hidden');
  backHotspot.classList.remove('hidden');
}

function setFridgeHotspotBounds(mode) {
  if (mode === 'kitchen') applyBounds(fridgeHotspot, '74%', '48%', '25%', '39%');
  if (mode === 'closed') applyBounds(fridgeHotspot, '55%', '48%', '31%', '42%');
  if (mode === 'open') applyBounds(fridgeHotspot, '74%', '45%', '24%', '44%');
}

function setFreezerHotspotBounds(mode) {
  if (mode === 'closed') applyBounds(freezerHotspot, '55%', '28%', '31%', '20%');
  if (mode === 'open') applyBounds(freezerHotspot, '76%', '24%', '23%', '24%');
}

function showFridgeClosedControls() {
  hideAllHotspots();
  setFridgeHotspotBounds('closed');
  setFreezerHotspotBounds('closed');
  fridgeHotspot.classList.remove('hidden');
  freezerHotspot.classList.remove('hidden');
  positionBackHotspot('fridge');
  backHotspot.classList.remove('hidden');
}

function showFridgeOpenControls() {
  hideAllHotspots();
  setFridgeHotspotBounds('open');
  fridgeHotspot.classList.remove('hidden');
  positionBackHotspot('fridge');
  backHotspot.classList.remove('hidden');
}

function showFreezerControls() {
  hideAllHotspots();
  setFreezerHotspotBounds('open');
  freezerHotspot.classList.remove('hidden');
  positionBackHotspot('fridge');
  backHotspot.classList.remove('hidden');
}

function showBathroomControls() {
  hideAllHotspots();
  bodyHotspot.classList.remove('hidden');
  positionBackHotspot('bathroom');
  backHotspot.classList.remove('hidden');
}

function showBedroomControls() {
  hideAllHotspots();
  dresserHotspot.classList.remove('hidden');
  positionBackHotspot('bedroom');
  backHotspot.classList.remove('hidden');
}

function showDresserControls() {
  hideAllHotspots();
  phoneHotspot.classList.remove('hidden');
  drawerHotspot.classList.remove('hidden');
  positionBackHotspot('dresser');
  backHotspot.classList.remove('hidden');
}

function showDrawerControls() {
  hideAllHotspots();
  keyHotspot.classList.remove('hidden');
  drawerHotspot.classList.remove('hidden');
  positionBackHotspot('dresser');
  backHotspot.classList.remove('hidden');
}

function showDrawerNoKeyControls() {
  hideAllHotspots();
  phoneHotspot.classList.remove('hidden');
  drawerHotspot.classList.remove('hidden');
  positionBackHotspot('dresser');
  backHotspot.classList.remove('hidden');
}

function prepareAudioEvents() {
  [nightAudio, kitchenAudio, fliesAudio, fridgeHumAudio, handleAudio, metalOpenAudio,
   woodOpenAudio, woodCloseAudio, fridgeOpenAudio, fridgeCloseAudio, freezerOpenAudio,
   freezerCloseAudio, slowStepsAudio, mediumStepsAudio, fastStepsAudio, veryFastStepsAudio,
   keyCollectedAudio, drawerOpenAudio, phoneCollectedAudio, jumpscareAudio].forEach(audio => {
    if (!audio) return;
    audio.preload = 'auto';
    audio.addEventListener('error', () => console.warn('Áudio não encontrado:', audio.currentSrc || audio.src));
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
  if (state.transitioning || state.scene !== 'entry' || state.gameLocked) return;
  state.transitioning = true;
  hideAllHotspots();
  clearMessage();

  playOneShot(handleAudio, 0.86);
  await sleep(900);
  playOneShot(metalOpenAudio, 0.92);

  // A imagem só muda depois de a cena anterior estar totalmente preta.
  await transitionScene(images.kitchen, 'Uma cozinha escura', 1050);

  fadeAudio(nightAudio, 0, 800);
  startLoop(kitchenAudio, 0.42, false);
  fadeAudio(kitchenAudio, 0.42, 800);

  state.scene = 'kitchen';
  showKitchenControls();
  showSceneMessage('Não sinto uma sensação boa.', 4200);
  state.transitioning = false;
}

async function returnToEntry() {
  if (state.transitioning || state.scene !== 'kitchen' || state.gameLocked) return;
  state.transitioning = true;
  hideAllHotspots();
  clearMessage();

  await transitionScene(images.first, 'Uma porta metálica escura', 1050);
  fadeAudio(kitchenAudio, 0, 850);
  fadeAudio(nightAudio, 0.03, 850);

  state.scene = 'entry';
  showEntryControls();
  state.transitioning = false;
}

async function approachFridge() {
  if (state.transitioning || state.scene !== 'kitchen' || state.gameLocked) return;
  state.transitioning = true;
  hideAllHotspots();
  clearMessage();
  await transitionScene(images.fridgeClosed, 'Geladeira fechada', 900);
  await sleep(120);
  state.scene = 'fridgeClosed';
  showFridgeClosedControls();
  state.transitioning = false;
}

async function openFridge() {
  if (state.transitioning || state.scene !== 'fridgeClosed' || state.gameLocked) return;
  state.transitioning = true;
  hideAllHotspots();
  playOneShot(fridgeOpenAudio, 0.9);
  await transitionScene(images.fridgeOpen, 'Geladeira aberta', 850);
  startLoop(fridgeHumAudio, 0.08, true);
  await sleep(120);
  state.scene = 'fridge';
  showFridgeOpenControls();
  state.transitioning = false;
}

async function closeFridge() {
  if (state.transitioning || state.scene !== 'fridge' || state.gameLocked) return;
  state.transitioning = true;
  hideAllHotspots();
  playOneShot(fridgeCloseAudio, 0.92);
  fadeAudio(fridgeHumAudio, 0, 400);
  stopAudio(fridgeHumAudio, true);
  await transitionScene(images.fridgeClosed, 'Geladeira fechada', 850);
  await sleep(120);
  state.scene = 'fridgeClosed';
  showFridgeClosedControls();
  state.transitioning = false;
}

async function openFreezer() {
  if (state.transitioning || state.scene !== 'fridgeClosed' || state.gameLocked) return;
  state.transitioning = true;
  hideAllHotspots();
  playOneShot(freezerOpenAudio, 0.9);
  await transitionScene(images.freezerOpen, 'Freezer aberto', 850);
  await sleep(120);
  state.scene = 'freezer';
  showFreezerControls();
  state.transitioning = false;
}

async function closeFreezer() {
  if (state.transitioning || state.scene !== 'freezer' || state.gameLocked) return;
  state.transitioning = true;
  hideAllHotspots();
  playOneShot(freezerCloseAudio, 0.92);
  await transitionScene(images.fridgeClosed, 'Geladeira fechada', 850);
  await sleep(120);
  state.scene = 'fridgeClosed';
  showFridgeClosedControls();
  state.transitioning = false;
}

async function kitchenFromFridge() {
  if (state.transitioning || state.gameLocked) return;
  if (!['fridgeClosed', 'fridge', 'freezer'].includes(state.scene)) return;
  state.transitioning = true;
  hideAllHotspots();
  if (state.scene === 'fridge') {
    playOneShot(fridgeCloseAudio, 0.86);
    await fadeAudio(fridgeHumAudio, 0, 350);
    stopAudio(fridgeHumAudio, true);
  }
  if (state.scene === 'freezer') playOneShot(freezerCloseAudio, 0.86);
  await transitionScene(images.kitchen, 'Uma cozinha escura', 950);
  state.scene = 'kitchen';
  showKitchenControls();
  state.transitioning = false;
}

async function enterBathroom() {
  if (state.transitioning || state.scene !== 'kitchen' || state.gameLocked) return;
  state.transitioning = true;
  hideAllHotspots();
  clearMessage();

  playOneShot(handleAudio, 0.82);
  await sleep(850);
  playOneShot(woodOpenAudio, 0.88);

  // Primeiro revela a porta aberta; só depois faz a entrada no banheiro.
  await transitionScene(images.bathroomOpen, 'Porta do banheiro aberta', 1000);
  await sleep(1400);
  await transitionScene(images.bathroom, 'Banheiro escuro', 1050);

  fadeAudio(kitchenAudio, 0, 750);
  startLoop(fliesAudio, 0.14, true);

  state.scene = 'bathroom';
  showBathroomControls();
  state.transitioning = false;
}

async function leaveBathroom() {
  if (state.transitioning || state.scene !== 'bathroom' || state.gameLocked) return;
  state.transitioning = true;
  hideAllHotspots();
  clearMessage();
  playOneShot(woodCloseAudio, 0.88);

  await transitionScene(images.kitchen, 'Uma cozinha escura', 1050);
  fadeAudio(fliesAudio, 0, 700);
  stopAudio(fliesAudio, true);
  startLoop(kitchenAudio, 0.42, false);
  fadeAudio(kitchenAudio, 0.42, 850);

  state.scene = 'kitchen';
  showKitchenControls();
  state.transitioning = false;
}

async function enterBedroom() {
  if (state.transitioning || state.scene !== 'kitchen' || state.gameLocked) return;
  state.transitioning = true;
  hideAllHotspots();
  clearMessage();

  playOneShot(handleAudio, 0.8);
  await sleep(850);
  playOneShot(woodOpenAudio, 0.84);
  await transitionScene(images.bedroom, 'Um quarto escuro', 1050);
  fadeAudio(kitchenAudio, 0, 750);

  state.scene = 'bedroom';
  showBedroomControls();
  state.transitioning = false;
}

async function leaveBedroom() {
  if (state.transitioning || state.scene === 'kitchen' || state.gameLocked) return;
  state.transitioning = true;
  hideAllHotspots();
  clearMessage();
  playOneShot(woodCloseAudio, 0.76);

  await transitionScene(images.kitchen, 'Uma cozinha escura', 1050);
  startLoop(kitchenAudio, 0.42, false);
  fadeAudio(kitchenAudio, 0.42, 850);

  state.scene = 'kitchen';
  showKitchenControls();
  state.transitioning = false;
}

async function openDresser() {
  if (state.transitioning || state.scene !== 'bedroom' || state.gameLocked) return;
  state.transitioning = true;
  hideAllHotspots();
  await transitionScene(images.dresser, 'Uma cômoda com um celular', 800);
  state.scene = 'dresser';
  showDresserControls();
  state.transitioning = false;
}

async function closeDresser() {
  if (state.transitioning || !['dresser', 'drawerOpen', 'drawerNoKey'].includes(state.scene) || state.gameLocked) return;
  state.transitioning = true;
  hideAllHotspots();
  await transitionScene(images.bedroom, 'Um quarto escuro', 800);
  state.scene = 'bedroom';
  showBedroomControls();
  state.transitioning = false;
}

async function openDrawer() {
  if (state.transitioning || state.scene !== 'dresser' || state.gameLocked) return;
  state.transitioning = true;
  hideAllHotspots();
  playOneShot(drawerOpenAudio, 0.82);
  await transitionScene(images.drawerOpen, 'Cômoda com a gaveta aberta', 700);
  state.scene = 'drawerOpen';
  showDrawerControls();
  state.transitioning = false;
}

async function collectKey() {
  if (state.transitioning || state.scene !== 'drawerOpen' || state.gameLocked || state.hasKey) return;
  state.transitioning = true;
  hideAllHotspots();
  state.hasKey = true;
  playOneShot(keyCollectedAudio, 0.88);
  await transitionScene(images.drawerNoKey, 'Cômoda sem a chave', 700);
  state.scene = 'drawerNoKey';
  showDrawerNoKeyControls();
  state.transitioning = false;
}

function showDrawerNoKeyControls() {
  hideAllHotspots();
  // O telefone continua visível depois que a chave foi retirada,
  // enquanto a gaveta continua aberta.
  phoneHotspot.classList.remove('hidden');
  drawerHotspot.classList.remove('hidden');
  positionBackHotspot('dresser');
  backHotspot.classList.remove('hidden');
}

async function collectPhone() {
  if (state.transitioning || !['dresser', 'drawerNoKey'].includes(state.scene) || state.gameLocked || state.phoneTaken) return;
  state.transitioning = true;
  hideAllHotspots();
  state.phoneTaken = true;

  // O som do celular não bloqueia a troca da imagem.
  playOneShot(phoneCollectedAudio, 0.92);
  await transitionScene(images.dresserNoPhone, 'A cômoda sem o celular', 850);
  await sleep(900);
  await runFootstepSequence();
  await sleep(650);
  await triggerJumpscareLock();
}

async function runFootstepSequence() {
  const sequence = [
    { audio: slowStepsAudio, volume: 0.12, wait: 5100 },
    { audio: mediumStepsAudio, volume: 0.24, wait: 5100 },
    { audio: fastStepsAudio, volume: 0.42, wait: 3100 },
    { audio: veryFastStepsAudio, volume: 0.72, wait: 4100 }
  ];

  for (const step of sequence) {
    if (state.gameLocked) return;
    currentStepAudio = step.audio;
    await playOneShotAndWait(step.audio, step.volume, step.wait + 500);
    if (currentStepAudio === step.audio) currentStepAudio = null;
    await sleep(120);
  }
}

function stopAllGameAudio() {
  [nightAudio, kitchenAudio, fliesAudio, fridgeHumAudio, handleAudio, metalOpenAudio,
   woodOpenAudio, woodCloseAudio, fridgeOpenAudio, fridgeCloseAudio, freezerOpenAudio,
   freezerCloseAudio, slowStepsAudio, mediumStepsAudio, fastStepsAudio, veryFastStepsAudio,
   keyCollectedAudio, drawerOpenAudio, phoneCollectedAudio, jumpscareAudio].forEach(a => stopAudio(a, true));
  currentStepAudio = null;
}

function playProceduralJumpscareAndStuck() {
  if (!typewriterContext) initTypewriterAudio();
  if (!typewriterContext) return;
  const ctx = typewriterContext;
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  const now = ctx.currentTime;

  // Som de travamento simples e contínuo, sem ataque extra/"glitch".
  const bufferSeconds = 0.085;
  const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * bufferSeconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / ctx.sampleRate;
    const fundamental = Math.sin(2 * Math.PI * 102 * t) * 0.36;
    const harmonic = Math.sin(2 * Math.PI * 204 * t) * 0.13;
    const rough = (Math.random() * 2 - 1) * 0.035;
    data[i] = fundamental + harmonic + rough;
  }

  const source = ctx.createBufferSource();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  source.buffer = buffer;
  source.loop = true;
  filter.type = 'lowpass';
  filter.frequency.value = 1250;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.14, now + 0.035);
  gain.gain.setValueAtTime(0.14, now + 4.6);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 5.0);
  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  source.start(now);
  source.stop(now + 5.05);
}

function playJumpscareAudioAndWait(audio, volume = 1.0, maxWaitMs = 6000) {
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
    if (promise && promise.catch) promise.catch(error => {
      console.warn('Não foi possível reproduzir o jumpscare:', error);
      finish();
    });
  });
}

async function triggerJumpscareLock() {
  if (state.gameLocked) return;

  // Primeiro corta tudo o que estava tocando, mas NÃO bloqueia o áudio do jumpscare.
  state.gameLocked = true;
  state.transitioning = false;
  hideAllHotspots();
  clearMessage();
  stopAllGameAudio();

  // JUMPSCARE: corte totalmente seco. Sem fade, sem flash, sem som de transição.
  scene.classList.add('game-locked');
  sceneOverlay.classList.remove('fade-in', 'fade-out', 'jumpscare-flash', 'locked-overlay');
  sceneOverlay.style.opacity = '0';
  setScene(images.jumpscare, '');

  // Deixa o frame do jumpscare renderizar antes de iniciar o áudio.
  await new Promise(requestAnimationFrame);
  await playJumpscareAudioAndWait(jumpscareAudio, 1.0, 6000);

  if (!state.gameLocked) return;
  playProceduralJumpscareAndStuck();
  await sleep(1800);
  sceneOverlay.classList.add('locked-overlay');
}

function handleBack() {
  if (state.gameLocked || state.transitioning) return;
  switch (state.scene) {
    case 'kitchen': returnToEntry(); break;
    case 'fridgeClosed': case 'fridge': case 'freezer': kitchenFromFridge(); break;
    case 'bathroom': leaveBathroom(); break;
    case 'bedroom': leaveBedroom(); break;
    case 'dresser': case 'drawerOpen': case 'drawerNoKey': closeDresser(); break;
  }
}

async function closeDrawer() {
  if (state.transitioning || !['drawerOpen', 'drawerNoKey'].includes(state.scene) || state.gameLocked) return;
  state.transitioning = true;
  hideAllHotspots();
  await transitionScene(images.dresser, 'Uma cômoda com um celular', 700);
  state.scene = 'dresser';
  showDresserControls();
  state.transitioning = false;
}

function routeDrawerAction() {
  if (state.scene === 'dresser') openDrawer();
  else if (state.scene === 'drawerOpen') closeDrawer();
  else if (state.scene === 'drawerNoKey') closeDrawer();
}

function routeHotspotInteraction(hotspot) {
  if (state.gameLocked) return;
  if (hotspot === bedroomDoorHotspot && state.scene === 'kitchen') enterBedroom();
  else if (hotspot === bathroomDoorHotspot && state.scene === 'kitchen') enterBathroom();
  else if (hotspot === fridgeHotspot) {
    if (state.scene === 'kitchen') approachFridge();
    else if (state.scene === 'fridgeClosed') openFridge();
    else if (state.scene === 'fridge') closeFridge();
  } else if (hotspot === freezerHotspot) {
    if (state.scene === 'fridgeClosed') openFreezer();
    else if (state.scene === 'freezer') closeFreezer();
  } else if (hotspot === dresserHotspot && state.scene === 'bedroom') openDresser();
  else if (hotspot === phoneHotspot && state.scene === 'dresser') collectPhone();
  else if (hotspot === drawerHotspot && ['dresser','drawerOpen','drawerNoKey'].includes(state.scene)) routeDrawerAction();
  else if (hotspot === keyHotspot && state.scene === 'drawerOpen') collectKey();
  else if (hotspot === bodyHotspot && state.scene === 'bathroom') showSceneMessage('O cheiro tá horrível.', 4500);
  else if (hotspot === backHotspot) handleBack();
  else if (hotspot === doorHandle && state.scene === 'entry') enterKitchen();
}

function bindHoverHint(hotspot, textOrGetter) {
  if (!hotspot) return;
  const getText = () => typeof textOrGetter === 'function' ? textOrGetter() : textOrGetter;
  // O clique continua preso ao próprio hotspot.
  hotspot.addEventListener('click', () => routeHotspotInteraction(hotspot));
  // Para teclado/acessibilidade, o foco ainda pode mostrar a dica.
  hotspot.addEventListener('focus', () => setHint(true, getText(), hotspot));
  hotspot.addEventListener('blur', () => { if (hintHotspot === hotspot) setHint(false); });
}

const boundHotspots = [
  doorHandle, fridgeHotspot, freezerHotspot, bathroomDoorHotspot, bedroomDoorHotspot,
  backHotspot, dresserHotspot, phoneHotspot, drawerHotspot, keyHotspot, bodyHotspot
].filter(Boolean);

function pointInsideElement(element, clientX, clientY) {
  if (!element || element.classList.contains('hidden')) return false;
  const rect = element.getBoundingClientRect();
  return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
}

function getPointerHotspot(event) {
  const elements = document.elementsFromPoint(event.clientX, event.clientY);
  for (const element of elements) {
    if (!boundHotspots.includes(element)) continue;
    if (element.classList.contains('hidden')) continue;

    // Regra explícita: a área de Voltar da cozinha jamais pode competir com
    // a geladeira. Mesmo que algum CSS futuro cause sobreposição, a geladeira ganha.
    if (element === backHotspot && pointInsideElement(fridgeHotspot, event.clientX, event.clientY)) {
      continue;
    }
    return element;
  }
  return null;
}

function hintTextForHotspot(hotspot) {
  if (hotspot === fridgeHotspot) {
    if (state.scene === 'fridge') return 'Fechar';
    if (state.scene === 'fridgeClosed') return 'Abrir';
    return 'Aproximar';
  }
  if (hotspot === freezerHotspot) return state.scene === 'freezer' ? 'Fechar' : 'Abrir';
  if (hotspot === bathroomDoorHotspot || hotspot === bedroomDoorHotspot) return 'Entrar';
  if (hotspot === backHotspot) return 'Voltar';
  if (hotspot === dresserHotspot) return 'Examinar';
  if (hotspot === phoneHotspot || hotspot === keyHotspot) return 'Pegar';
  if (hotspot === drawerHotspot) return state.scene === 'drawerNoKey' ? 'Fechar' : 'Abrir';
  if (hotspot === bodyHotspot) return 'Examinar';
  if (hotspot === doorHandle) return 'Abrir';
  return 'Interagir';
}

scene.addEventListener('pointermove', event => {
  if (state.gameLocked || scene.classList.contains('hidden')) {
    setHint(false);
    return;
  }
  const hotspot = getPointerHotspot(event);
  if (!hotspot) {
    setHint(false);
    return;
  }
  setHint(true, hintTextForHotspot(hotspot), hotspot, event);
});

scene.addEventListener('pointerleave', () => setHint(false));

startButton.addEventListener('click', playIntro);

bindHoverHint(doorHandle, 'Abrir');
bindHoverHint(fridgeHotspot, () => {
  if (state.scene === 'fridge') return 'Fechar';
  if (state.scene === 'fridgeClosed') return 'Abrir';
  return 'Aproximar';
});
bindHoverHint(freezerHotspot, () => state.scene === 'freezer' ? 'Fechar' : 'Abrir');
bindHoverHint(bathroomDoorHotspot, 'Entrar');
bindHoverHint(bedroomDoorHotspot, 'Entrar');
bindHoverHint(backHotspot, 'Voltar');
bindHoverHint(dresserHotspot, 'Examinar');
bindHoverHint(phoneHotspot, 'Pegar');
bindHoverHint(drawerHotspot, () => state.scene === 'drawerNoKey' ? 'Fechar' : 'Abrir');
bindHoverHint(keyHotspot, 'Pegar');
bindHoverHint(bodyHotspot, 'Examinar');

// Garante áudio contínuo após a primeira interação, caso algum navegador tenha bloqueado o play inicial.
document.addEventListener('pointerdown', () => {
  if (!state.started || state.gameLocked || !state.audioUnlocked) return;
  if (state.scene === 'entry' && nightAudio.paused) startLoop(nightAudio, 0.03);
  if ((state.scene === 'kitchen' || state.scene === 'fridgeClosed') && kitchenAudio.paused) startLoop(kitchenAudio, 0.42);
  if (state.scene === 'bathroom' && fliesAudio.paused) startLoop(fliesAudio, 0.14);
  if (state.scene === 'fridge' && fridgeHumAudio.paused) startLoop(fridgeHumAudio, 0.08);
}, { passive: true });

async function playIntro() {
  if (state.started) return;
  state.started = true;
  startButton.disabled = true;
  startButton.style.display = 'none';
  unlockLoopAudios();
  initTypewriterAudio();
  prepareAudioEvents();
  await preloadImages();

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

prepareAudioEvents();
