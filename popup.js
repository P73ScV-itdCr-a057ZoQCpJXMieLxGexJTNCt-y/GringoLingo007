// popup.js
const fileInput = document.getElementById('fileInput');
const analyzeBtn = document.getElementById('analyzeBtn');
const statusEl = document.getElementById('status');
const extractedTextEl = document.getElementById('extractedText');
const translatedTextEl = document.getElementById('translatedText');
const summaryTextEl = document.getElementById('summaryText');
const targetLangSelect = document.getElementById('targetLang');

function setStatus(msg) { statusEl.textContent = msg; }

// --- LanguageModel (Prompt API) for OCR ---

// popup.js - The updated function definition

async function usePromptToExtractText(file, outputLangCode) {
  if (!('LanguageModel' in window)) {
    throw new Error('LanguageModel (Prompt API) not available in this browser.');
  }

  // Check availability
  const avail = await LanguageModel.availability();
  if (avail === 'unavailable') {
    throw new Error('LanguageModel unavailable on this device.');
  }
  
  setStatus('Creating prompt session...');
  
  // Create the session without speculative config, relying on the system prompt
  const session = await LanguageModel.create({
    expectedInputs: [{ type: 'image' }],
    initialPrompts: [
      { role: 'system', content: `You are an OCR and parser. Extract the visible textual content from the supplied image.` }
    ]
  });

  // Append the image file
  await session.append([
    {
      role: 'user',
      content: [
        { type: 'image', value: file }
      ]
    },
  ]);

  setStatus('Prompting model to extract text...');
  
  // 💡 CRITICAL FIX: The output language is specified in the prompt options for attestation.
  const promptResponse = await session.prompt(
    // The final prompt instruction
    `Return the extracted text in the language corresponding to the code: ${outputLangCode}.`, 
    {
      // Pass the language code in the dedicated options object for safety/quality checks
      outputLanguage: outputLangCode 
    }
  );
  
  return promptResponse;
}

// ... (The rest of popup.js remains the same)
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
      // The LanguageDetector API structure is experimental, assume it returns a list of languages.
      const detected = await LanguageDetector.detect(sourceText);
      if (detected && detected.length && detected[0].language) {
        sourceLang = detected[0].language; 
      }
    } catch (e) {
      console.warn('LanguageDetector failed', e);
    }
  }

  // Use 'en' as a safe default if detection fails, or if the API doesn't support 'auto'
  const explicitSourceLang = sourceLang === 'auto' ? 'en' : sourceLang;
  
  setStatus('Creating translator...');
  const translator = await Translator.create({
    sourceLanguage: explicitSourceLang,
    targetLanguage: targetLang
  });

  setStatus('Translating text...');
  const translated = await translator.translate(sourceText);
  return translated;
}

// --- Summarizer API ---
async function summarizeText(longText) {
  if (!('Summarizer' in window)) {
    console.warn('Summarizer API not available; skipping summarization.');
    return '';
  }

  // It's good practice to check availability, though we omit erroring out for summarization.
  const avail = await Summarizer.availability();
  if (avail === 'unavailable') {
    console.warn('Summarizer not available on this device.');
    return '';
  }

  setStatus('Creating summarizer...');
  const summarizer = await Summarizer.create({
    type: 'key-points',
    format: 'plain-text',
    length: 'short',
  });

  setStatus('Summarizing...');
  const summary = await summarizer.summarize(longText, { context: 'Make this concise and actionable for a traveler.' });
  return summary;
}

// --- Main Handler ---
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
    
    // Get the target language ONCE
    const targetLang = targetLangSelect.value || 'en';

    // 1. Extract Text
    setStatus('Extracting text from image...');
    const extracted = await usePromptToExtractText(file, targetLang); 
    if (!extracted) {
      extractedTextEl.textContent = '(No text could be extracted)';
      setStatus('Done with error: No text extracted.');
      return;
    }
    extractedTextEl.textContent = extracted;

    // 2. Translate
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
    
    // 💡 FIX: Handle DOMException explicitly, as it usually implies a security or system failure.
    if (err instanceof DOMException) {
      // Provide a more informative error message for the user.
      const msg = `API Operation Blocked: ${err.name || 'DOMException'}. This usually means an on-device resource, security, or hardware restriction failed (check Chrome Flags).`;
      setStatus('Error: ' + msg);
      alert(msg);
    } else {
      // Handle all other errors
      setStatus('Error: ' + (err.message || String(err))); 
      alert('Operation failed. See console for details.');
    }
  }
});
