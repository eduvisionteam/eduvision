require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors({ origin: "*" }));
app.use(express.json());
app.use(express.static("../public"));

const PORT = process.env.PORT || 3000;

/* 🔥 MULTIPLE API KEYS SUPPORT */

const API_KEYS = [
  process.env.KREA_API_KEY_1,
  process.env.KREA_API_KEY_2,
  process.env.KREA_API_KEY_3,
  process.env.KREA_API_KEY_4,
  process.env.KREA_API_KEY_5
].filter(Boolean);

if (API_KEYS.length === 0) {
  console.error("No KREA API keys found in environment variables.");
  process.exit(1);
}

/* =========================================
   GENERATE ROUTE
========================================= */

app.post("/generate", async (req, res) => {
  try {
    const { prompt, width, height, steps } = req.body;

    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return res.status(400).json({
        error: "Prompt is required"
      });
    }

    let createResponse = null;
    let createData = null;
    let workingKey = null;

    /* 🔥 TRY EACH KEY UNTIL ONE WORKS */

    for (let key of API_KEYS) {
      try {
        createResponse = await fetch(
          "https://api.krea.ai/generate/image/bfl/flux-1-dev",
          {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${key}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              prompt: prompt.trim(),
              width: width || 1024,
              height: height || 1024,
              steps: steps || 28
            })
          }
        );

        createData = await createResponse.json();

        if (createResponse.ok) {
          workingKey = key;
          console.log("Using API Key:", key.slice(-6));
          break; // SUCCESS
        }

        const errorMessage =
          createData?.error ||
          createData?.message ||
          JSON.stringify(createData);

        const lowerError = errorMessage.toLowerCase();

        if (lowerError.includes("balance") || lowerError.includes("insufficient")) {
          console.warn("Key exhausted. Trying next key...");
          continue; // Try next key
        }

        if (lowerError.includes("unauthorized") || lowerError.includes("invalid")) {
          console.warn("Invalid key. Trying next key...");
          continue; // Try next key
        }

        return res.status(createResponse.status).json({
          error: "Krea API error",
          details: createData
        });

      } catch (err) {
        console.error("Key attempt failed:", err);
        continue;
      }
    }

    if (!createResponse || !createResponse.ok) {
      return res.status(402).json({
        error: "All API keys exhausted or invalid."
      });
    }

    const jobId = createData.job_id;

    if (!jobId) {
      return res.status(400).json({
        error: "Job creation failed",
        details: createData
      });
    }

    /* =========================================
       POLLING USING WORKING KEY
    ========================================= */

    let imageUrl = null;
    let attempts = 0;
    const maxAttempts = 40;

    while (!imageUrl && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 3000));
      attempts++;

      const pollResponse = await fetch(
        `https://api.krea.ai/jobs/${jobId}`,
        {
          headers: {
            "Authorization": `Bearer ${workingKey}`
          }
        }
      );

      const pollData = await pollResponse.json();

      if (!pollResponse.ok) {
        return res.status(pollResponse.status).json({
          error: "Polling error",
          details: pollData
        });
      }

      const status = pollData.status?.toLowerCase();

      if (["completed", "succeeded", "done", "success"].includes(status)) {
        imageUrl =
          pollData?.result?.urls?.[0] ||
          pollData?.result?.images?.[0]?.url ||
          pollData?.result?.image_url ||
          pollData?.image_url ||
          pollData?.output?.url ||
          null;
      }

      if (["failed", "error", "cancelled"].includes(status)) {
        return res.status(500).json({
          error: "Image generation failed",
          details: pollData
        });
      }
    }

    if (!imageUrl) {
      return res.status(500).json({
        error: "Generation timed out"
      });
    }

    /* 🔥 SMART EXPLANATION */

    const explanation = `This image illustrates ${prompt}. It visually represents the key structures and relationships to help students understand the concept clearly in an educational context.`;

    return res.json({
      imageUrl,
      explanation
    });

  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({
      error: "Internal server error"
    });
  }
});

/* ========================================= */

app.listen(PORT, () => {
  console.log(`EduVision backend running on port ${PORT}`);
});
