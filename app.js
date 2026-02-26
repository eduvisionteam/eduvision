'use strict';

let generating = false;
let currentImgUrl = null;

/* ===============================
   DOM ELEMENTS
================================ */

const $prompt      = document.getElementById('prompt');
const $sizeSelect  = document.getElementById('sizeSelect');
const $stepsSelect = document.getElementById('stepsSelect');
const $subjectSelect = document.getElementById('subjectSelect');
const $outputTypeSelect = document.getElementById('outputTypeSelect');

const $genBtn      = document.getElementById('generateBtn');
const $voiceBtn    = document.getElementById("voiceBtn");

const $statusBar   = document.getElementById('statusBar');
const $statusDot   = document.getElementById('statusDot');
const $statusText  = document.getElementById('statusText');
const $errorBox    = document.getElementById('errorBox');
const $errorText   = document.getElementById('errorText');

const $imageCard   = document.getElementById('imageCard');
const $imageWrap   = document.getElementById('imageWrap');
const $skeleton    = document.getElementById('skeleton');
const $promptPrev  = document.querySelector('#promptPreview span');
const $downloadBtn = document.getElementById('downloadBtn');
const $charCounter = document.getElementById('charCounter');

const $explanationBox  = document.getElementById("explanationBox");
const $explanationText = document.getElementById("explanationText");
const $speakBtn        = document.getElementById("speakBtn");

/* ===============================
   CHARACTER COUNTER
================================ */

$prompt.addEventListener('input', () => {
  const n = $prompt.value.length;
  $charCounter.textContent = n + ' / 1000';
  $charCounter.classList.toggle('warn', n > 900);
});

/* ===============================
   ENTER TO GENERATE
================================ */

$prompt.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    triggerGenerate();
  }
});

$genBtn.addEventListener('click', triggerGenerate);

/* ===============================
   DOWNLOAD BUTTON
================================ */

$downloadBtn.addEventListener('click', () => {
  if (!currentImgUrl) return;

  const a = document.createElement('a');
  a.href = currentImgUrl;
  a.download = 'eduvision-image.png';
  a.target = '_blank';

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
});

/* ===============================
   UI HELPERS
================================ */

function setStatus(msg, type = 'loading') {
  $statusBar.classList.remove('hidden');
  $statusText.textContent = msg;
  $statusDot.className = 'status-dot ' + ({
    loading: 'pulsing',
    success: 'success',
    error: 'error'
  }[type] || 'pulsing');
}

function showError(msg) {
  $errorBox.classList.remove('hidden');
  $errorText.textContent = msg;
  setStatus('Generation failed.', 'error');
}

function clearError() {
  $errorBox.classList.add('hidden');
}

function setGenerating(v) {
  generating = v;
  $genBtn.disabled = v;
  $genBtn.textContent = v ? "Generating..." : "Generate";
}

function resetImageCard() {
  const img = $imageWrap.querySelector('img');
  if (img) img.remove();
  $skeleton.style.display = 'block';
  $imageCard.classList.add('hidden');
  currentImgUrl = null;

  if ($explanationBox) {
    $explanationBox.style.display = "none";
    $explanationText.textContent = "";
  }
}

/* ===============================
   SHOW IMAGE
================================ */

function showImage(url, promptText) {
  $skeleton.style.display = 'none';
  currentImgUrl = url;

  const img = document.createElement('img');
  img.alt = promptText;
  img.src = url;
  img.style.opacity = '0';
  img.style.transition = 'opacity .5s ease';

  img.onload = () => img.style.opacity = '1';

  img.addEventListener('click', () => {
    window.open(url, '_blank');
  });

  $imageWrap.appendChild(img);
  $promptPrev.textContent = promptText;
  $imageCard.classList.remove('hidden');

  setStatus('Image ready', 'success');
}

/* ===============================
   GENERATE FUNCTION
================================ */

async function triggerGenerate() {
  if (generating) return;

  const promptText = $prompt.value.trim();
  if (!promptText) {
    showError('Please describe the image you want to create.');
    return;
  }

  /* 🔥 SUBJECT + OUTPUT INJECTION */

  let enhancedPrompt = promptText;

  const subject = $subjectSelect?.value || "general";

  if (subject === "biology") {
    enhancedPrompt = "Educational biology textbook labeled diagram of " + promptText;
  }
  else if (subject === "physics") {
    enhancedPrompt = "Educational physics schematic diagram with labeled forces and arrows of " + promptText;
  }
  else if (subject === "chemistry") {
    enhancedPrompt = "Educational chemistry structural diagram with clear molecular representation of " + promptText;
  }
  else if (subject === "mathematics") {
    enhancedPrompt = "Mathematical illustration with step-by-step representation of " + promptText;
  }
  else if (subject === "geography") {
    enhancedPrompt = "Geography textbook style labeled map or diagram of " + promptText;
  }

  const outputType = $outputTypeSelect?.value || "diagram";

  if (outputType === "flowchart") {
    enhancedPrompt += " presented as a structured flowchart with arrows and process blocks";
  }
  else if (outputType === "concept") {
    enhancedPrompt += " presented as a connected concept map with labeled nodes";
  }
  else if (outputType === "3d") {
    enhancedPrompt += " rendered as a clean 3D educational illustration";
  }

  clearError();
  resetImageCard();
  setGenerating(true);

  const [w, h] = $sizeSelect.value.split('x').map(Number);
  const steps = parseInt($stepsSelect.value, 10);

  setStatus('Submitting request...');

  try {
    const response = await fetch('https://eduvision-xsch.onrender.com/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: enhancedPrompt,
        width: w,
        height: h,
        steps: steps
      })
    });

    if (!response.ok) {
      throw new Error("Backend error: " + response.status);
    }

    const data = await response.json();

    if (!data.imageUrl) {
      throw new Error("No image returned from backend.");
    }

    showImage(data.imageUrl, promptText);

    if (data.explanation && $explanationBox) {
      $explanationText.textContent = data.explanation;
      $explanationBox.style.display = "block";
    }

    setGenerating(false);

  } catch (err) {
    showError(err.message);
    setGenerating(false);
  }
}

/* ===============================
   VOICE TO TEXT
================================ */

const SpeechRecognition =
  window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition && $voiceBtn) {

  const recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.continuous = false;
  recognition.interimResults = false;

  $voiceBtn.addEventListener("click", () => {
    recognition.start();
    $voiceBtn.textContent = "🎙 Listening...";
  });

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    $prompt.value = transcript;
    $prompt.dispatchEvent(new Event("input"));
  };

  recognition.onend = () => {
    $voiceBtn.textContent = "🎤 Speak";
  };

}

/* ===============================
   TEXT TO SPEECH
================================ */

if ('speechSynthesis' in window && $speakBtn) {

  $speakBtn.addEventListener("click", () => {
    const text = $explanationText.textContent;
    if (!text) return;

    const utterance = new SpeechSynthesisUtterance(text);
    speechSynthesis.speak(utterance);
  });

}
