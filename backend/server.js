require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors({
  origin: "*"
}));
app.use(express.json());
app.use(express.static("../public"));

const PORT = process.env.PORT || 3000;
const API_KEY = process.env.KREA_API_KEY;

if (!API_KEY) {
    console.error("KREA_API_KEY is missing in .env file");
    process.exit(1);
}

app.post("/generate", async (req, res) => {
    try {
        const { prompt, width, height, steps } = req.body;

        if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
            return res.status(400).json({
                error: "Prompt is required"
            });
        }

        const createResponse = await fetch(
            "https://api.krea.ai/generate/image/bfl/flux-1-dev",
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${API_KEY}`,
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

        const createData = await createResponse.json();

        if (!createResponse.ok) {

            const errorMessage =
                createData?.error ||
                createData?.message ||
                JSON.stringify(createData);

            const lowerError = errorMessage.toLowerCase();

            if (lowerError.includes("balance") || lowerError.includes("insufficient")) {
                return res.status(402).json({
                    error: "Insufficient balance in Krea account"
                });
            }

            if (lowerError.includes("unauthorized") || lowerError.includes("invalid api")) {
                return res.status(401).json({
                    error: "Invalid API key"
                });
            }

            return res.status(createResponse.status).json({
                error: "Krea API error",
                details: createData
            });
        }

        const jobId = createData.job_id;

        if (!jobId) {
            return res.status(400).json({
                error: "Job creation failed",
                details: createData
            });
        }

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
                        "Authorization": `Bearer ${API_KEY}`
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

        return res.json({ imageUrl });

    } catch (error) {
        console.error("Server Error:", error);
        return res.status(500).json({
            error: "Internal server error"
        });
    }
});

app.listen(PORT, () => {
    console.log(`EduVision backend running on http://localhost:${PORT}`);
});
