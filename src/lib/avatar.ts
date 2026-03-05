const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const BLOCKED_FILENAME_KEYWORDS = [
  "porn",
  "nsfw",
  "nude",
  "nudity",
  "sex",
  "xxx",
  "gore",
  "blood",
  "rape",
  "swastika",
  "hitler",
];

const MAX_ORIGINAL_BYTES = 8 * 1024 * 1024;
const MAX_DIMENSION = 4096;
const MIN_DIMENSION = 64;
const TARGET_MAX_SIDE = 640;
const OUTPUT_TARGET_BYTES = 900 * 1024;

export type AvatarPrepFailure = {
  ok: false;
  reason: string;
  errorTr: string;
  errorEn: string;
};

export type AvatarPrepSuccess = {
  ok: true;
  blob: Blob;
  moderationFlags: Record<string, unknown>;
};

export type AvatarPrepResult = AvatarPrepFailure | AvatarPrepSuccess;

function normalizeText(input: string) {
  return String(input || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

function extractKeywordHits(fileName: string) {
  const bare = normalizeText(fileName).replace(/\.[a-z0-9]+$/i, "");
  const hits: string[] = [];
  for (const key of BLOCKED_FILENAME_KEYWORDS) {
    if (bare.includes(key)) hits.push(key);
  }
  return hits;
}

async function toJpegBlob(canvas: HTMLCanvasElement, quality: number) {
  return await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
  });
}

function fail(reason: string, errorTr: string, errorEn: string): AvatarPrepFailure {
  return { ok: false, reason, errorTr, errorEn };
}

export async function prepareAvatarUpload(file: File): Promise<AvatarPrepResult> {
  const mime = String(file.type || "").toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(mime)) {
    return fail("unsupported_type", "Sadece JPG, PNG veya WebP yükleyebilirsin.", "Only JPG, PNG, or WebP files are allowed.");
  }
  if (file.size > MAX_ORIGINAL_BYTES) {
    return fail("file_too_large", "Avatar dosyası en fazla 8MB olabilir.", "Avatar file size must be at most 8MB.");
  }

  const keywordHits = extractKeywordHits(file.name || "");
  if (keywordHits.length > 0) {
    return fail(
      "filename_blocked",
      "Dosya adı uygun değil. Lütfen farklı bir dosya seç.",
      "File name is not allowed. Please choose a different file."
    );
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return fail("decode_failed", "Görsel dosyası okunamadı.", "Image file could not be decoded.");
  }

  const originalWidth = bitmap.width;
  const originalHeight = bitmap.height;
  if (originalWidth < MIN_DIMENSION || originalHeight < MIN_DIMENSION) {
    bitmap.close();
    return fail(
      "dimensions_too_small",
      "Avatar en az 64x64 piksel olmali.",
      "Avatar must be at least 64x64 pixels."
    );
  }
  if (originalWidth > MAX_DIMENSION || originalHeight > MAX_DIMENSION) {
    bitmap.close();
    return fail(
      "dimensions_too_large",
      "Avatar boyutu çok büyük. Lütfen daha küçük bir görsel seç.",
      "Avatar dimensions are too large. Please choose a smaller image."
    );
  }

  const scale = Math.min(1, TARGET_MAX_SIDE / Math.max(originalWidth, originalHeight));
  const width = Math.max(MIN_DIMENSION, Math.round(originalWidth * scale));
  const height = Math.max(MIN_DIMENSION, Math.round(originalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return fail("canvas_failed", "Görsel işlenemedi.", "Image could not be processed.");
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let blob: Blob | null = null;
  const qualitySteps = [0.9, 0.82, 0.74, 0.66];
  for (const q of qualitySteps) {
    blob = await toJpegBlob(canvas, q);
    if (!blob) continue;
    if (blob.size <= OUTPUT_TARGET_BYTES || q === qualitySteps[qualitySteps.length - 1]) break;
  }
  if (!blob) {
    return fail("encode_failed", "Avatar donusturulemedi.", "Avatar could not be encoded.");
  }

  return {
    ok: true,
    blob,
    moderationFlags: {
      source: "web_upload",
      original_name: file.name || "",
      original_mime: mime,
      original_bytes: file.size,
      original_width: originalWidth,
      original_height: originalHeight,
      output_mime: "image/jpeg",
      output_bytes: blob.size,
      output_width: width,
      output_height: height,
      blocked_filename_hits: keywordHits,
    },
  };
}
