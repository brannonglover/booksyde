import type { BooksydeClient } from "../client";

const BUCKET = "avatars";

/** Square size the apps shrink photos to before upload (shown at most ~160px wide, so 2x plus room). */
export const AVATAR_SIZE = 512;

/**
 * Upload a new photo for the signed-in reader and put it on their profile
 * straight away. The photo should already be square and small (the apps crop
 * and shrink it first). Older photos are cleared out afterwards.
 *
 * `photo` is a Blob on the web, an ArrayBuffer on mobile.
 */
export async function setMyAvatar(client: BooksydeClient, photo: Blob | ArrayBuffer, contentType = "image/jpeg") {
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) throw new Error("You need to be signed in.");
  const folder = auth.user.id;
  const ext = contentType === "image/png" ? "png" : contentType === "image/webp" ? "webp" : "jpg";
  // A fresh name each time, so caches never show the old photo.
  const path = `${folder}/${Date.now()}.${ext}`;

  const { error: uploadError } = await client.storage.from(BUCKET).upload(path, photo, { contentType, cacheControl: "31536000" });
  if (uploadError) throw uploadError;

  const url = client.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  const { error } = await client.from("profiles").update({ avatar_url: url }).eq("id", folder);
  if (error) {
    await client.storage.from(BUCKET).remove([path]);
    throw error;
  }
  await removeOldAvatars(client, folder, path);
  return url;
}

/** Take the photo off the signed-in reader's profile; their monogram comes back. */
export async function removeMyAvatar(client: BooksydeClient) {
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) throw new Error("You need to be signed in.");
  const { error } = await client.from("profiles").update({ avatar_url: null }).eq("id", auth.user.id);
  if (error) throw error;
  await removeOldAvatars(client, auth.user.id, null);
}

/** Best effort: a leftover file only costs storage, so failures here are ignored. */
async function removeOldAvatars(client: BooksydeClient, folder: string, keep: string | null) {
  try {
    const { data } = await client.storage.from(BUCKET).list(folder, { limit: 100 });
    const stale = (data ?? []).map((f) => `${folder}/${f.name}`).filter((p) => p !== keep);
    if (stale.length) await client.storage.from(BUCKET).remove(stale);
  } catch {
    // ignore
  }
}
