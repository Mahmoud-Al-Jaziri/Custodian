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

export async function uploadHandoffAttachment(userId, date, file) {
  if (file.size > MAX_BYTES) {
    throw new Error("That attachment is too big — 10 MB max.");
  }
  const extension = EXT_BY_TYPE[file.type];
  if (!extension) {
    throw new Error("Only photos, PDFs, and Word documents can be attached.");
  }

  const path = `handoffs/${userId}/${date}.${extension}`;
  const storageRef = ref(storage, path);

  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  return url;
}
