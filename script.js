document.addEventListener('DOMContentLoaded', () => {
  const analyzeButton = document.getElementById('analyze-button');
  const textInput = document.getElementById('text-input');
  const languageSelect = document.getElementById('language-select');
  const statusMessage = document.getElementById('status-message');
  const resultCard = document.getElementById('result-card');
  const sentimentOutput = document.getElementById('sentiment-output');
  const reasoningOutput = document.getElementById('reasoning-output');
  const errorMessage = document.getElementById('error-message');

  // ⚠️ Better to move API key to backend / .env file in production
  const apiKey = "AIzaSyD_nDwa_XZ5vhUETpPo25FZkoVVdPO7SQQ";
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

  // Utility function: fetch with exponential backoff
  const fetchWithBackoff = async (url, options, retries = 3, delay = 1000) => {
    try {
      const response = await fetch(url, options);
      if (response.status === 429 && retries > 0) {
        await new Promise(res => setTimeout(res, delay));
        return fetchWithBackoff(url, options, retries - 1, delay * 2);
      }
      return response;
    } catch (error) {
      if (retries > 0) {
        await new Promise(res => setTimeout(res, delay));
        return fetchWithBackoff(url, options, retries - 1, delay * 2);
      }
      throw error;
    }
  };

  analyzeButton.addEventListener('click', async () => {
    const text = textInput.value.trim();
    const language = languageSelect.value;

    if (!text) {
      errorMessage.textContent = "Please enter some text to analyze.";
      errorMessage.classList.remove('hidden');
      return;
    }

    // Reset UI states
    resultCard.classList.add('hidden');
    errorMessage.classList.add('hidden');
    statusMessage.classList.remove('hidden');
    analyzeButton.disabled = true;

    const systemPrompt = `
      You are a sentiment analysis tool. 
      Analyze the sentiment of the following text and its language. 
      Respond with a JSON object only.
      - sentiment: one of 'Positive', 'Negative', or 'Neutral'
      - reasoning: concise explanation for the classification
    `;

    let userQuery = `Text to analyze: "${text}"`;
    if (language !== 'auto') {
      userQuery = `Text in ${language}: "${text}"`;
    }

    const payload = {
      contents: [{ parts: [{ text: userQuery }] }],
      systemInstruction: { parts: [{ text: systemPrompt }] },
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            "sentiment": {
              "type": "STRING",
              "enum": ["Positive", "Negative", "Neutral"]
            },
            "reasoning": { "type": "STRING" }
          },
          "propertyOrdering": ["sentiment", "reasoning"]
        }
      }
    };

    try {
      const response = await fetchWithBackoff(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      const candidate = result.candidates?.[0];

      if (candidate && candidate.content?.parts?.[0]?.text) {
        const jsonString = candidate.content.parts[0].text;
        const parsedData = JSON.parse(jsonString);

        const sentiment = parsedData.sentiment;
        const reasoning = parsedData.reasoning;

        // Reset and apply sentiment styling
        sentimentOutput.textContent = sentiment;
        sentimentOutput.className = 'result-sentiment';
        if (sentiment === 'Positive') {
          sentimentOutput.classList.add('positive');
        } else if (sentiment === 'Negative') {
          sentimentOutput.classList.add('negative');
        } else {
          sentimentOutput.classList.add('neutral');
        }

        reasoningOutput.textContent = reasoning;
        resultCard.classList.remove('hidden');
      } else {
        throw new Error("Invalid response format from API.");
      }
    } catch (error) {
      console.error("Analysis failed:", error);
      errorMessage.textContent = "Analysis failed. Please check the console for more details.";
      errorMessage.classList.remove('hidden');
    } finally {
      statusMessage.classList.add('hidden');
      analyzeButton.disabled = false;
    }
  });
});
