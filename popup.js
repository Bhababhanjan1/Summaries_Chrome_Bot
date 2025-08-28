document.getElementById("summarize").addEventListener("click", async () => {
  const resultDiv = document.getElementById("result");
  resultDiv.innerHTML = '<div class="loading"><div class="loader"></div></div>';

  const summaryType = document.getElementById("summary-type").value;

  // Get API key from storage
  chrome.storage.sync.get(["geminiApiKey"], async (result) => {
    if (!result.geminiApiKey) {
      resultDiv.innerHTML =
        "API key not found. Please set your API key in the extension options.";
      
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
      chrome.tabs.sendMessage(
        tab.id,
        { type: "GET_ARTICLE_TEXT" },
        async (res) => {
          if (!res || !res.text) {
            resultDiv.innerText =
              "Could not extract article text from this page.";
            return;
          }

          try {
            const summary = await getGeminiSummary(
              res.text,
              summaryType,
              result.geminiApiKey
            );
            resultDiv.innerText = summary;
          } catch (error) {
            resultDiv.innerText = `Error: ${
              error.message || "Failed to generate summary."
            }`;
          }
        }
      );
    });
  });
});

// ==================== Voice Control ====================
let isSpeaking = false;
let currentUtterance = null;

function stopSpeaking() {
  window.speechSynthesis.cancel();
  isSpeaking = false;
  const voiceBtn = document.getElementById("speak-btn");
  if (voiceBtn) {
    voiceBtn.innerHTML = '<i class="fa-solid fa-volume-high" style="color: black;"></i> speak';
  }
}

document.getElementById("speak-btn").addEventListener("click", () => {
  const voiceBtn = document.getElementById("speak-btn");
  const summaryText = document.getElementById("result").innerText;

  if (!summaryText || summaryText.trim() === "") return;

  if (!isSpeaking) {
    stopSpeaking(); // reset before speaking
    currentUtterance = new SpeechSynthesisUtterance(summaryText);
    currentUtterance.lang = "en-US";
    currentUtterance.rate = 1.0;
    currentUtterance.pitch = 1.0;
    currentUtterance.volume = 1.0;

    currentUtterance.onend = () => stopSpeaking();

    window.speechSynthesis.speak(currentUtterance);
    isSpeaking = true;
    voiceBtn.innerHTML = '<i class="fa-solid fa-stop" style="color: black;"></i> Stop';
  } else {
    stopSpeaking();
  }
});

// Auto-stop when other controls are used
["options","summarize", "copy-btn", "share-btn", "summary-type"].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener("click", () => {
      if (isSpeaking) stopSpeaking();
    });
  }
});
// ==================== Voice Control ====================



document.getElementById("copy-btn").addEventListener("click", () => {
  const summaryText = document.getElementById("result").innerText;

  if (summaryText && summaryText.trim() !== "") {
    navigator.clipboard
      .writeText(summaryText)
      .then(() => {
        const copyBtn = document.getElementById("copy-btn");
        const originalText = copyBtn.innerText;

        copyBtn.innerText = "Copied!";
        setTimeout(() => {
          copyBtn.innerText = originalText;
        }, 2000);
      })
      .catch((err) => {
        console.error("Failed to copy text: ", err);
      });
  }
});


const shareBtn = document.getElementById("share-btn");
const shareMenu = document.getElementById("share-menu");

shareBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  shareMenu.style.display = shareMenu.style.display === "block" ? "none" : "block";
});

// Close menu when clicking outside
document.addEventListener("click", () => {
  shareMenu.style.display = "none";
});

// Share functionality
document.querySelectorAll(".share-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const platform = btn.dataset.platform;
    const resultText = document.getElementById("result")?.innerText?.trim() || "";
    const encodedText = encodeURIComponent(resultText);
    const shareUrl = encodeURIComponent(window.location.href); // optional

    if (!resultText) {
      alert("No result to share!");
      return;
    }

    switch(platform) {
      case "whatsapp":
        window.open(`https://wa.me/?text=${encodedText}`, "_blank");
        break;
      case "twitter":
        window.open(`https://twitter.com/intent/tweet?text=${encodedText}`, "_blank");
        break;
      case "facebook":
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}&quote=${encodedText}`, "_blank");
        break;
      case "linkedin":
        window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}&summary=${encodedText}`, "_blank");
        break;
      case "copy":
        navigator.clipboard.writeText(resultText)
          .then(() => alert("Result copied to clipboard!"))
          .catch(err => alert("Copy failed: " + err));
        break;
    }

    shareMenu.style.display = "none"; // close menu after click
  });
});


async function getGeminiSummary(text, summaryType, apiKey) {
  // Truncate very long texts to avoid API limits (typically around 30K tokens)
  const maxLength = 20000;
  const truncatedText =
    text.length > maxLength ? text.substring(0, maxLength) + "..." : text;

  let prompt;
  switch (summaryType) {
    case "brief":
      prompt = `Provide a brief summary of the following article in 2-3 sentences:\n\n${truncatedText}`;
      break;
    case "detailed":
      prompt = `Provide a detailed summary of the following article, covering all main points and key details:\n\n${truncatedText}`;
      break;
    case "bullets":
      prompt = `Summarize the following article in 5-7 key points. Format each point as a line starting with "- " (dash followed by a space). Do not use asterisks or other bullet symbols, only use the dash. Keep each point concise and focused on a single key insight from the article:\n\n${truncatedText}`;
      break;
    default:
      prompt = `Summarize the following article:\n\n${truncatedText}`;
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.2,
          },
        }),
      }
    );

    if (!res.ok) {
      const errorData = await res.json();
      throw new Error(errorData.error?.message || "API request failed");
    }

    const data = await res.json();
    return (
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "No summary available."
    );
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    throw new Error("Failed to generate summary. Please try again later.");
  }
}


 document.getElementById("close-btn").onclick = () => {
    window.close();
  };
let currentBackground = ""; // store latest applied background

// Icons
const checkbox = document.getElementById("checkbox");
const notchIcon = document.getElementById("notch");
const checkIcon = document.getElementById("check"); // renamed to avoid conflict with "check" button
const checkButton = document.getElementById("check"); // actual save button

// Apply background and reset checkbox visuals
function applyBackground(bg, height) {
  document.body.style.background = bg;
  document.body.style.backgroundRepeat = 'no-repeat';
  // document.body.style.height = height;
  document.body.style.height = '350px'; // instead of 350px
  document.body.style.minHeight = '350px';

  // Reset checkbox spinner and check icon state
  if (notchIcon) notchIcon.style.display = "block";
  if (checkIcon) checkIcon.style.opacity = "0";
}

// Gradient buttons
const whiteblack = document.getElementById("white-black");
whiteblack.onclick = () => {
  currentBackground = 'linear-gradient(-11deg, #1c1c1cf2 37%, #2c2c2eed 76%)';
  applyBackground(currentBackground, '350px');
};

const blackblue = document.getElementById("black-blue");
blackblue.onclick = () => {
  currentBackground = 'linear-gradient(90deg, rgba(2, 0, 36, 1) 0%, rgba(9, 9, 121, 1) 35%, rgba(0, 212, 255, 1) 100%)';
  applyBackground(currentBackground, '350px');
};

const redpink = document.getElementById("red-pink");
redpink.onclick = () => {
  currentBackground = 'linear-gradient(90deg, rgba(131, 58, 180, 1) 0%, rgba(253, 29, 29, 1) 50%, rgba(252, 176, 69, 1) 100%)';
  applyBackground(currentBackground, '350px');
};

const blackred = document.getElementById("black-red");
blackred.onclick = () => {
  currentBackground = 'linear-gradient(-11deg, #9a0f0ff2 40%, #121213ed 62%)';
  applyBackground(currentBackground, '350px');
};

const yellowgreen = document.getElementById("yellow-green");
yellowgreen.onclick = () => {
  currentBackground = 'linear-gradient(to left, rgb(16, 193, 16), rgb(214, 228, 5))';
  applyBackground(currentBackground, '350px');
};

// Save background on "check" button click
checkButton.onclick = (e) => {
  e.preventDefault();
  if (currentBackground) {
    localStorage.setItem('customBackground', currentBackground);

    // Show check icon as confirmation
    if (notchIcon) notchIcon.style.display = "none";
    if (checkIcon) checkIcon.style.opacity = "1";
  }
};

// Restore background on page load
window.addEventListener("DOMContentLoaded", () => {
  const savedBg = localStorage.getItem('customBackground');
  if (savedBg) {
    currentBackground = savedBg;
    applyBackground(savedBg, '350px');
  }
});

// Checkbox spinner control
checkbox.addEventListener("click", () => {
  if (notchIcon) notchIcon.style.display = "none";
  if (checkIcon) checkIcon.style.opacity = "1";
});


// updates option working conditions

document.getElementById("updates-btn").addEventListener("click", () => {
  chrome.windows.create({
    url: "updates.html",
    type: "popup",
    width: 420,
    height: 320
  });
});



  // Get elements
const dropdownBtn = document.getElementById("dropdownBtn");
const dropdownMenu = document.getElementById("dropdownMenu");
const angleIcon = document.getElementById("angleIcon");

// Toggle dropdown
dropdownBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  dropdownMenu.classList.toggle("show");

  // Toggle angle icon
  if (dropdownMenu.classList.contains("show")) {
    angleIcon.classList.remove("fa-angle-down");
    angleIcon.classList.add("fa-angle-up");
  } else {
    angleIcon.classList.remove("fa-angle-up");
    angleIcon.classList.add("fa-angle-down");
  }
});

// Close dropdown when clicking outside
document.addEventListener("click", (event) => {
  if (!dropdownMenu.contains(event.target) && !dropdownBtn.contains(event.target)) {
    dropdownMenu.classList.remove("show");
    angleIcon.classList.remove("fa-angle-up");
    angleIcon.classList.add("fa-angle-down");
  }
});



// Get buttons
const downloadPdfBtn = document.getElementById("downloadPdfBtn");
const copyLinkBtn = document.getElementById("copyLinkBtn");

// Attach events
if (downloadPdfBtn) {
  downloadPdfBtn.addEventListener("click", () => saveFile("PDF"));
}
if (copyLinkBtn) {
  copyLinkBtn.addEventListener("click", copyLink);
}

async function saveFile(type) {
  const resultDiv = document.getElementById("result");
  if (!resultDiv || !resultDiv.innerText.trim()) {
    alert("No content to save!");
    return;
  }

  if (type === "PDF") {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // Add title
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("AI Summary", 10, 15);

    // Add summary text
    doc.setFont("helvetica", "normal");
    doc.setFontSize(12);
    const textLines = doc.splitTextToSize(resultDiv.innerText, 180);
    doc.text(textLines, 10, 30);

    // ✅ Generate Blob instead of dataurlstring
    const pdfBlob = doc.output("blob");
    const pdfUrl = URL.createObjectURL(pdfBlob);

    // ✅ Send message to background.js
    chrome.runtime.sendMessage(
      { action: "downloadPDF", url: pdfUrl },
      (response) => {
        if (chrome.runtime.lastError) {
          console.error("Message error:", chrome.runtime.lastError.message);
          return;
        }
        if (response?.status === "ok") {
          console.log("Download started");
        } else {
          console.error("Download failed", response);
        }
      }
    );
  }
}

// Copy link feature
function copyLink() {
  const dummyLink = "https://example.com/share";
  navigator.clipboard.writeText(dummyLink)
    .then(() => alert("Link copied!"))
    .catch((err) => alert("Copy failed: " + err));
}

