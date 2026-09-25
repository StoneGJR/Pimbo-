const intro = document.getElementById('intro');
const introText = document.getElementById('intro-text');
const startButton = document.getElementById('start-button');
const scene = document.getElementById('scene');

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

let audioContext;
let started = false;

function initAudio() {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
}

function typeKeySound() {
  if (!audioContext) return;
  if (audioContext.state === 'suspended') audioContext.resume();

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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

async function playIntro() {
  if (started) return;
  started = true;
  startButton.disabled = true;
  startButton.style.display = 'none';

  initAudio();

  for (let i = 0; i < story.length; i++) {
    await typeText(story[i].text);
    await sleep(story[i].pauseAfter);
    if (i !== story.length - 1) {
      introText.textContent += '\n\n';
    }
  }

  // Pequeno silêncio antes da imagem aparecer.
  await sleep(500);

  scene.classList.remove('hidden');
  requestAnimationFrame(() => scene.classList.add('visible'));

  await sleep(1000);
  intro.style.opacity = '0';
  await sleep(1600);
  intro.classList.add('hidden');
}

startButton.addEventListener('click', playIntro);
