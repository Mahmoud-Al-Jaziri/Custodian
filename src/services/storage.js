import { storage } from "../firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

// Client-side mirror of storage.rules: same size cap and type whitelist, so
// users get a friendly error instead of a rules rejection. The extension is
// derived from the MIME type — never from the client filename — so the
// stored path can't carry a misleading extension.
const MAX_BYTES = 10 * 1024 * 1024;
const EXT_BY_TYPE = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/heic": "heic",
  "image/heif": "heif",
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "docx",
};

// Re-encode target. A phone photo is 3-5 MB; at 1600px WebP it's ~200-400 KB
// with no visible difference in a card that renders at maxHeight 300, and the
// long edge still holds up if the user opens it full-size. This is the single
// biggest lever on the Storage bill: it cuts stored bytes AND every future
// download of them by roughly an order of magnitude.
const MAX_DIMENSION = 1600;
const WEBP_QUALITY = 0.82;

// Worth re-encoding. GIF is deliberately absent — drawing it to a canvas would
// flatten an animation to its first frame. PDFs and Word docs aren't images.
const COMPRESSIBLE = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
]);

// Returns a smaller WebP Blob, or null to mean "upload the original as-is".
// Every failure path returns null: a bigger attachment is far better than a
// lost one, so nothing in here can cost the user their photo.
async function compressImage(file) {
  if (!COMPRESSIBLE.has(file.type)) return null;

  let bitmap;
  try {
    // from-image applies the EXIF orientation tag, so portrait phone photos
    // don't come back rotated on their side.
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    // Usually HEIC/HEIF on a browser that can't decode it (everything but
    // Safari). Fall back to uploading the original.
    return null;
  }

  const scale = Math.min(
    1,
    MAX_DIMENSION / Math.max(bitmap.width, bitmap.height)
  );
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/webp", WEBP_QUALITY)
  );

  // toBlob silently falls back to PNG where WebP encoding isn't available,
  // and a PNG of a photo is often LARGER than the JPEG we started with. Take
  // the result only if it's actually WebP and actually smaller.
  if (!blob || blob.type !== "image/webp" || blob.size >= file.size) return null;
  return blob;
}

export async function uploadHandoffAttachment(userId, date, file) {
  if (!EXT_BY_TYPE[file.type]) {
    throw new Error("Only photos, PDFs, and Word documents can be attached.");
  }

  // Compress before the size check, not after: a 15 MB photo is perfectly
  // fine once it's a 300 KB WebP, and rejecting it up front would be the
  // more annoying half of the tradeoff. Non-images fall straight through.
  const compressed = await compressImage(file);
  const upload = compressed ?? file;
  const extension = compressed ? "webp" : EXT_BY_TYPE[file.type];

  if (upload.size > MAX_BYTES) {
    throw new Error("That attachment is too big — 10 MB max.");
  }

  // Must stay in lockstep with the filename pattern in storage.rules — the
  // rules reject anything that isn't <YYYY-MM-DD>.<ext>, which is what caps
  // how many objects a single account can create.
  const path = `handoffs/${userId}/${date}.${extension}`;
  const storageRef = ref(storage, path);

  try {
    await uploadBytes(storageRef, upload, {
      contentType: upload.type,
      // Without this, re-viewing a letter re-downloads its image every time.
      // Safe to cache hard: overwriting an object mints a NEW download token,
      // so a stored URL always points at the exact bytes it was minted for —
      // re-attaching to the same date produces a different URL, not a stale
      // cache hit.
      cacheControl: "public, max-age=31536000",
    });
    return await getDownloadURL(storageRef);
  } catch (err) {
    // A rules rejection or a failed App Check attestation both surface as
    // storage/unauthorized. Neither is anything the user can act on, and the
    // raw SDK message ("Firebase Storage: User does not have permission...")
    // is alarming next to a note they just wrote. Keep the note savable.
    if (err?.code === "storage/unauthorized") {
      console.error("Attachment rejected by Storage rules or App Check:", err);
      throw new Error("Couldn't attach that file. Your note is still safe — try saving without it.");
    }
    throw err;
  }
}
