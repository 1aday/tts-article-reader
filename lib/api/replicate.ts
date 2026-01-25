import { put } from "@vercel/blob";

const REPLICATE_API_URL = "https://api.replicate.com/v1/predictions";
const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;

const isProduction = process.env.VERCEL === "1" || process.env.NODE_ENV === "production";

interface ImageGenerationOptions {
  prompt: string;
  aspectRatio?: "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "4:5" | "5:4" | "9:16" | "16:9" | "21:9";
  resolution?: "1K" | "2K" | "4K";
  outputFormat?: "jpg" | "png";
  safetyFilterLevel?: "block_low_and_above" | "block_medium_and_above" | "block_only_high";
}

interface ReplicatePrediction {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output?: string | string[];
  error?: string;
  urls: {
    get: string;
    cancel: string;
  };
}

/**
 * Generate an image using Replicate's Nano Banana (FLUX Realism) model
 * Downloads the generated image and uploads to Vercel Blob for persistence
 * Returns the Vercel Blob URL
 */
export async function generateImage(options: ImageGenerationOptions): Promise<string> {
  if (!REPLICATE_API_TOKEN) {
    throw new Error("REPLICATE_API_TOKEN is not configured");
  }

  const {
    prompt,
    aspectRatio = "3:4",
    resolution = "2K",
    outputFormat = "jpg",
    safetyFilterLevel = "block_only_high"
  } = options;

  console.log("[Replicate] Starting image generation:", {
    promptLength: prompt.length,
    aspectRatio,
    resolution,
    outputFormat
  });

  // Step 1: Create prediction
  const createResponse = await fetch(REPLICATE_API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Token ${REPLICATE_API_TOKEN}`,
      "Content-Type": "application/json",
      "Prefer": "wait" // Wait for result instead of immediate return
    },
    body: JSON.stringify({
      version: "black-forest-labs/flux-1.1-pro",
      input: {
        prompt,
        aspect_ratio: aspectRatio,
        output_format: outputFormat,
        image_input: [] // No input images for article covers
      }
    })
  });

  if (!createResponse.ok) {
    const errorText = await createResponse.text();
    throw new Error(`Replicate API error: ${createResponse.status} ${errorText}`);
  }

  let prediction: ReplicatePrediction = await createResponse.json();
  console.log("[Replicate] Prediction created:", prediction.id);

  // Step 2: Poll for completion (if not already completed)
  while (prediction.status !== "succeeded" && prediction.status !== "failed") {
    await new Promise(resolve => setTimeout(resolve, 1000));

    const checkResponse = await fetch(prediction.urls.get, {
      headers: {
        "Authorization": `Token ${REPLICATE_API_TOKEN}`
      }
    });

    if (!checkResponse.ok) {
      throw new Error(`Failed to check prediction status: ${checkResponse.status}`);
    }

    prediction = await checkResponse.json();
    console.log("[Replicate] Prediction status:", prediction.status);
  }

  if (prediction.status === "failed") {
    throw new Error(prediction.error || "Image generation failed");
  }

  // Step 3: Get image URL from output
  const imageUrl = Array.isArray(prediction.output)
    ? prediction.output[0]
    : prediction.output;

  if (!imageUrl) {
    throw new Error("No image URL in prediction output");
  }

  console.log("[Replicate] Image generated:", imageUrl);

  // Step 4: Download image
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download generated image: ${imageResponse.status}`);
  }

  const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
  console.log("[Replicate] Downloaded image:", {
    size: imageBuffer.length,
    contentType: imageResponse.headers.get("content-type")
  });

  // Step 5: Upload to Vercel Blob for persistence
  if (isProduction) {
    const filename = `generated-${Date.now()}.${outputFormat}`;
    const blob = await put(filename, imageBuffer, {
      access: "public",
      addRandomSuffix: false,
      contentType: `image/${outputFormat}`
    });

    console.log("[Replicate] Uploaded to Vercel Blob:", blob.url);
    return blob.url;
  } else {
    // Development: Return original Replicate URL (temporary, but OK for dev)
    console.log("[Replicate] Development mode: Using Replicate URL");
    return imageUrl;
  }
}
