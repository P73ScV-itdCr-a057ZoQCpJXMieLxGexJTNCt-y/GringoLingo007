// popup.js
const fileInput = document.getElementById('fileInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const statusEl = document.getElementById('status'); // Renamed to avoid clash with function
const extractedTextEl = document.getElementById('extractedText');
const translatedTextEl = document.getElementById('translatedText');
const summaryTextEl = document.getElementById('summaryText');
const targetLangSelect = document.getElementById('targetLang');

function setStatus(msg) { statusEl.textContent = msg; } // Changed to use statusEl

// --- LanguageModel (Prompt API) for OCR ---
async function usePromptToExtractText(file) {
  // Use LanguageModel (Prompt API) to accept an image and extract text
  if (!('LanguageModel' in window)) {
    throw new Error('LanguageModel (Prompt API) not available in this browser.');
  }

  const avail = await LanguageModel.availability();
  if (avail === 'unavailable') {
    throw new Error('LanguageModel unavailable on this device.');
  }

  setStatus('Creating prompt session...');
  // Note: The specific API shape (e.g., monitor, expectedInputs) is highly experimental
  // We'll use a simpler, likely compatible setup for the Prompt API.
  const session = await LanguageModel.create({
    expectedInputs: [{ type: 'image' }],
    initialPrompts: [
      { role: 'system', content: 'You are an OCR and parser. Extract the visible textual content from the supplied image and return only the text in a clean format.' }
    ]
  });

  // Append the image file and the final instruction to the model
  await session.append([
    {
      role: 'user',
      content: [
        { type: 'image', value: file }
      ]
    },
  ]);

  setStatus('Prompting model to extract text...');
  // Request the final output from the model
  const promptResponse = await session.prompt('Return the extracted text.');
  
  // The structure of the response might be a string directly, or an object.
  // Assuming it returns a string for simplicity based on the goal.
  return promptResponse;
}

// --- Translator API ---
async function translateText(sourceText, targetLang) {
  if (!('Translator' in window)) {
    throw new Error('Translator API not supported in this browser.');
  }

  // Attempt to detect language first if LanguageDetector is available.
  let sourceLang = 'auto'; 
  if ('LanguageDetector' in window) {
    try {
      setStatus('Detecting source language...');
      // LanguageDetector.detect may return a promise with { language, confidence }[]
      const detected = await LanguageDetector.detect(sourceText);
      if (detected && detected.length) {
        sourceLang = detected[0].language; 
      }
    } catch (e) {
      console.warn('LanguageDetector failed', e);
      // Fallback to 'auto' or a default like 'en'
    }
  }

  // 'auto' may not be a valid explicit sourceLanguage for .create()
  // Use 'en' as a safe default if detection fails, or if the API doesn't support 'auto'
  const explicitSourceLang = sourceLang === 'auto' ? 'en' : sourceLang;
  
  setStatus('Creating translator...');
  const translator = await Translator.create({
    sourceLanguage: explicitSourceLang,
    targetLanguage: targetLang
  });

  setStatus('Translating text...');
  // The translate method is expected to return the translated string
  const translated = await translator.translate(sourceText);
  return translated;
}

// --- Summarizer API ---
async function summarizeText(longText) {
  if (!('Summarizer' in window)) {
    console.warn('Summarizer API not available; skipping summarization.');
    return '';
  }

  setStatus('Creating summarizer...');
  const summarizer = await Summarizer.create({
    type: 'key-points',
    format: 'plain-text',
    length: 'short',
  });

  setStatus('Summarizing...');
  // The summarize method is expected to return the summary string
  const summary = await summarizer.summarize(longText, { context: 'Make this concise and actionable for a traveler.' });
  return summary;
}

// --- Main Handler ---
analyzeBtn.addEventListener('click', async () => {
  try {
    if (!fileInput.files || !fileInput.files[0]) {
      alert('Please choose an image file of a menu or sign first.');
      return;
    }

    const file = fileInput.files[0];
    extractedTextEl.textContent = '';
    translatedTextEl.textContent = '';
    summaryTextEl.textContent = '';

    // 1. Extract Text
    setStatus('Extracting text from image...');
    const extracted = await usePromptToExtractText(file);
    if (!extracted) {
      extractedTextEl.textContent = '(No text could be extracted)';
      setStatus('Done with error: No text extracted.');
      return;
    }
    extractedTextEl.textContent = extracted;

    // 2. Translate
    const targetLang = targetLangSelect.value || 'en';
    setStatus(`Translating extracted text to ${targetLang}...`);
    const translated = await translateText(extracted, targetLang);
    translatedTextEl.textContent = translated;

    // 3. Summarize
    setStatus('Generating summary...');
    const summary = await summarizeText(translated);
    summaryTextEl.textContent = summary || '(No summary generated)';

    setStatus('Done.');
  } catch (err) {
    console.error(err);
    // Be careful with error messages as they can be large objects
    setStatus('Error: ' + (err.message || String(err))); 
    alert('Operation failed. See console for details.');
  }
});
