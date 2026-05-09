import Anthropic from "@anthropic-ai/sdk";
import express from "express";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const client = new Anthropic();

app.use(express.json({ limit: "15mb" }));
app.use(express.static(join(__dirname, "public")));

const PLANT_PROMPT = `You are a plant identification expert. Analyze this image and identify the plant.

Please provide:
1. **Common Name** – the everyday name people use
2. **Scientific Name** – genus and species in italics
3. **Identifying Features** – what you can see in the image that confirms the identification
4. **Confidence** – how certain you are (high/medium/low) and why
5. **Care Tips** – brief watering, light, and soil tips (if it's a cultivated plant)
6. **Fun Fact** – one interesting fact about this plant

If the image does not show a plant, say so clearly and describe what you see instead.`;

app.post("/api/identify", async (req, res) => {
  const { image, mediaType } = req.body;
  if (!image || !mediaType) {
    return res.status(400).json({ error: "Missing image or mediaType" });
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  try {
    const stream = client.messages.stream({
      model: "claude-opus-4-7",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: image,
              },
            },
            { type: "text", text: PLANT_PROMPT },
          ],
        },
      ],
    });

    for await (const event of stream) {
      if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`);
      }
    }
    res.write("data: [DONE]\n\n");
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
  } finally {
    res.end();
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Plant ID app → http://localhost:${PORT}`);
});
