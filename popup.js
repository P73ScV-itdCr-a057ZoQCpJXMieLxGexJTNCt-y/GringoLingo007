document.getElementById("processBtn").addEventListener("click", async () => {
  const inputText = document.getElementById("inputText").value;
  if (!inputText) return alert("Please enter some text first!");

  try {
    const promptResponse = await chrome.ai.prompt({
      model: "gemini-nano",
      prompt: `You are preparing text for a traveler. Clean up and normalize the following text: ${inputText}`
    });
    const normalizedText = promptResponse.output;

    const translationResponse = await chrome.ai.translator.translate({
      text: normalizedText,
      targetLanguage: "en"
    });
    document.getElementById("translation").innerText =
      "Translation: " + translationResponse.translatedText;

    const summaryResponse = await chrome.ai.summarizer.summarize({
      text: translationResponse.translatedText
    });
    document.getElementById("summary").innerText =
      "Summary: " + summaryResponse.summary;

    const rewriteResponse = await chrome.ai.rewriter.rewrite({
      text: summaryResponse.summary,
      style: "plain-language"
    });
    document.getElementById("simplified").innerText =
      "Simplified: " + rewriteResponse.output;

  } catch (err) {
    console.error("Error processing:", err);
    alert("Error using AI APIs. Check console for details.");
  }
});