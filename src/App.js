let isWakeListening = false;

import React, { useEffect } from "react";

function App() {
  function startCommandRecognition() {
    navigator.mediaDevices.getUserMedia({ audio: true }).then((stream) => {
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: "audio/webm"
      });
      const audioChunks = [];

      mediaRecorder.addEventListener("dataavailable", (event) => {
        audioChunks.push(event.data);
      });

      mediaRecorder.addEventListener("stop", () => {
        const blob = new Blob(audioChunks, { type: "audio/webm" });
        console.log("🎙️ Blob size:", blob.size);
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Audio = reader.result.split(",")[1];

          fetch("/api/transcribe", {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({ file: base64Audio })
          })
            .then((res) => res.json())
            .then((data) => {
              if (data.text) {
                fetch("https://api.openai.com/v1/chat/completions", {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": "Bearer " + process.env.REACT_APP_OPENAI_KEY // ✅ oculto
                  },
                  body: JSON.stringify({
                    model: "gpt-4",
                    messages: [
                      {
                        role: "system",
                        content: "Eres Tigresa, una asistente cálida, sabia y sensible. Hablas en español de forma empática y breve."
                      },
                      {
                        role: "user",
                        content: data.text
                      }
                    ],
                    temperature: 0.7
                  })
                })
                .then(res => res.json())
                .then(gptData => {
                  const response = gptData.choices[0].message.content;

                  fetch("https://texttospeech.googleapis.com/v1/text:synthesize?key=" + process.env.REACT_APP_GOOGLE_TTS_KEY, {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                      input: { text: response },
                      voice: { languageCode: "es-ES", name: "es-ES-Standard-A" },
                      audioConfig: { audioEncoding: "MP3" }
                    })
                  })
                  .then(res => res.json())
                  .then(data => {
                    if (data.audioContent) {
                      const audio = new Audio("data:audio/mp3;base64," + data.audioContent);
                      audio.play();
                    } else {
                      console.error("TTS failed:", data);
                    }
                  });

                  alert("Transcription: " + data.text + "\nTigresa says: " + response);
                })
                .catch(err => {
                  console.error("GPT error:", err);
                });
              } else {
                console.warn("⚠️ Transcription missing or failed:", data);
                alert("❌ Transcription failed: " + (data.error || "Unknown error"));
              }
            })
            .catch((err) => {
              console.error("Google STT command failed:", err);
            });
        };
        reader.readAsDataURL(blob);
      });

      mediaRecorder.start();
      setTimeout(() => {
        mediaRecorder.stop();
      }, 3000);
    }).catch((err) => {
      console.error("❌ Mic access failed:", err);
    });
  }

  function startWakeWordListener() {
    if (isWakeListening) return;
    isWakeListening = true;

    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "es-ES";

    recognition.onresult = (event) => {
      const transcript = event.results[event.results.length - 1][0].transcript.toLowerCase();
      console.log("🎤 Wake word heard:", transcript);
      if (transcript.includes("tigresa")) {
        console.log("🟢 Wake word detected. Activating command mode.");
        recognition.stop();
        startCommandRecognition();
        setTimeout(() => {
          isWakeListening = false;
          startWakeWordListener();
        }, 5000);
      }
    };

    recognition.onerror = (event) => {
      console.error("Wake word listener error:", event.error);
      isWakeListening = false;
      setTimeout(startWakeWordListener, 3000);
    };

    recognition.onend = () => {
      console.warn("Wake word listener ended. Restarting...");
      isWakeListening = false;
      setTimeout(startWakeWordListener, 3000);
    };

    recognition.start();
  }

  // Removed automatic wake word listener start to require manual user action.

  return (
    <div>
      <h1>Sky Care Assistant</h1>
    </div>
  );
}

export default App;
