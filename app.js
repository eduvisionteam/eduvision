'use strict';

let generating = false;
let currentImgUrl = null;

/* DOM */
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

/* 🔥 NEW — Explanation DOM */
const $explanationBox  = document.getElementById("explanationBox");
const $explanationText = document.getElementById("explanationText");
const $speakBtn        = document.getElementById("speakBtn");

/* Character Counter */
$prompt.addEventListener('input', () => {
  const n = $prompt.value.length;
  $charCounter.textContent = n + ' / 1000';
  $charCounter.classList.toggle('warn', n > 900);
});

/* Enter to Generate */
$prompt.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    triggerGenerate();
  }
});

/* Generate Button */
$genBtn.addEventListener('click', triggerGenerate);

/* Download Button */
$downloadBtn.addEventListener('click', () => {
  if (!currentImgUrl) return;

  const a = document.createElement('a');
  a.href = currentImgUrl;
  a.download = 'eduvision-image.png';
  a.target = '_blank';

  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  showToast("Download started ✔", true);
});

/* UI Helpers */

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

  /* Hide explanation on reset */
  if ($explanationBox) {
    $explanationBox.style.display = "none";
    $explanationText.textContent = "";
  }
}

/* Show Image */

function showImage(url, promptText) {
  $skeleton.style.display = 'none';
  currentImgUrl = url;

  const img = document.createElement('img');
  img.alt = promptText;
  img.src = url;
  img.style.opacity = '0';
  img.style.transition = 'opacity .5s ease';
  img.style.cursor = 'pointer';

  img.onload = () => img.style.opacity = '1';

  img.addEventListener('click', () => {
    window.open(url, '_blank');
  });

  $imageWrap.appendChild(img);
  $promptPrev.textContent = promptText;
  $imageCard.classList.remove('hidden');

  setStatus('Image ready', 'success');
}

/* Toast Notification */

function showToast(message, success = true) {
  const toast = document.createElement('div');
  toast.textContent = message;

  toast.style.position = 'fixed';
  toast.style.bottom = '30px';
  toast.style.right = '30px';
  toast.style.padding = '12px 20px';
  toast.style.borderRadius = '10px';
  toast.style.color = '#fff';
  toast.style.background = success ? '#10b981' : '#ef4444';
  toast.style.boxShadow = '0 10px 25px rgba(0,0,0,0.25)';
  toast.style.zIndex = '9999';
  toast.style.opacity = '0';
  toast.style.transition = 'opacity .3s ease';

  document.body.appendChild(toast);

  setTimeout(() => toast.style.opacity = '1', 10);

  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

/* Backend Call */

async function triggerGenerate() {
  if (generating) return;

  const promptText = $prompt.value.trim();
  if (!promptText) {
    showError('Please describe the image you want to create.');
    return;
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
        prompt: promptText,
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

    /* 🔥 NEW — Show Explanation */
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
   🎤 VOICE TO TEXT
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

  recognition.onerror = (event) => {
    alert("Voice recognition error: " + event.error);
    $voiceBtn.textContent = "🎤 Speak";
  };

} else if ($voiceBtn) {
  $voiceBtn.disabled = true;
  $voiceBtn.textContent = "Voice not supported";
}

/* ===============================
   🔊 TEXT TO SPEECH (Explanation)
================================ */

if ('speechSynthesis' in window && $speakBtn) {

  $speakBtn.addEventListener("click", () => {
    const text = $explanationText.textContent;
    if (!text) return;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    utterance.pitch = 1;

    speechSynthesis.speak(utterance);
  });

}
