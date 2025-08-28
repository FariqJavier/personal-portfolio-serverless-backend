import { VercelRequest, VercelResponse } from "@vercel/node";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { prompt } = req.body;
  if (!prompt) {
    return res.status(400).json({ error: "Missing prompt" });
  }

  try {
    // 1. Create the prediction
    const prediction = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: process.env.GRANITE_MODEL_VERSION, // put your Granite version hash here
        input: { prompt },
      }),
    }).then(r => r.json());

    if (prediction.error) {
      return res.status(500).json({ error: prediction.error });
    }

    // 2. Poll until the prediction completes
    let result = prediction;
    while (result.status !== "succeeded" && result.status !== "failed") {
      await new Promise(resolve => setTimeout(resolve, 2000)); // wait 2s
      result = await fetch(`https://api.replicate.com/v1/predictions/${prediction.id}`, {
        headers: { Authorization: `Token ${process.env.REPLICATE_API_TOKEN}` },
      }).then(r => r.json());
    }

    if (result.status === "failed") {
      return res.status(500).json({ error: "Prediction failed" });
    }

    // 3. Return Granite’s final response
    return res.status(200).json({ output: result.output });

  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
}

