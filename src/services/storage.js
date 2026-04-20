import { storage } from "../firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

export async function uploadHandoffAttachment(userId, date, file) {
  const extension = file.name.split(".").pop()
  const path = `handoffs/${userId}/${date}.${extension}`
  const storageRef = ref(storage, path)

  await uploadBytes(storageRef, file)
  const url = await getDownloadURL(storageRef)
  return url
}