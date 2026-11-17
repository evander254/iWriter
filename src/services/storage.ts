import { supabase, STORAGE_BUCKET } from "../lib/supabase";
import { ApiError, friendlyError } from "./api";

/** Storage folders within the private `attachments` bucket. */
export const STORAGE_FOLDERS = {
  assignments: "assignments",
  submissions: "submissions",
  revisions: "revisions",
  profiles: "profiles",
} as const;

export type StorageFolder = (typeof STORAGE_FOLDERS)[keyof typeof STORAGE_FOLDERS];

const MAX_BYTES = 25 * 1024 * 1024; // 25 MB

const ALLOWED_EXTENSIONS = [
  "pdf", "doc", "docx", "ppt", "pptx", "xls", "xlsx", "txt", "rtf", "odt",
  "csv", "zip", "png", "jpg", "jpeg", "webp", "gif",
];

export interface UploadedFile {
  path: string;
  name: string;
  size: number;
  type: string;
}

function buildPath(folder: StorageFolder, scopeId: string, file: File): string {
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "";
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 60);
  const suffix = ext ? `.${ext.toLowerCase()}` : "";
  return `${folder}/${scopeId}/${unique}-${safeName}${safeName.endsWith(suffix) ? "" : suffix}`;
}

export function validateFile(file: File): string | null {
  if (file.size > MAX_BYTES) return `${file.name} exceeds the 25 MB limit.`;
  const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "";
  if (ext && !ALLOWED_EXTENSIONS.includes(ext)) {
    return `${file.name} is not an allowed file type.`;
  }
  return null;
}

/** Upload a file to the private bucket. Returns the storage path. */
export async function uploadFile(
  folder: StorageFolder,
  scopeId: string,
  file: File,
): Promise<UploadedFile> {
  const invalid = validateFile(file);
  if (invalid) throw new ApiError(invalid);

  const path = buildPath(folder, scopeId, file);
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });

  if (error) throw new ApiError(friendlyError(error as never) || error.message);

  return { path, name: file.name, size: file.size, type: file.type };
}

/** Upload several files, returning metadata for each. */
export async function uploadFiles(
  folder: StorageFolder,
  scopeId: string,
  files: File[],
): Promise<UploadedFile[]> {
  const uploaded: UploadedFile[] = [];
  for (const file of files) {
    uploaded.push(await uploadFile(folder, scopeId, file));
  }
  return uploaded;
}

/** Create a short-lived signed URL for a private file. */
export async function getSignedUrl(path: string, expiresIn = 3600): Promise<string | null> {
  if (!path) return null;
  // Support legacy absolute URLs stored in file_url.
  if (/^https?:\/\//i.test(path)) return path;
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(path, expiresIn);
  if (error) return null;
  return data?.signedUrl ?? null;
}

/** Create signed URLs for many paths at once (falls back to per-file). */
export async function getSignedUrls(paths: string[], expiresIn = 3600): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const local: string[] = [];
  for (const p of paths) {
    if (!p) continue;
    if (/^https?:\/\//i.test(p)) out[p] = p;
    else local.push(p);
  }
  if (local.length > 0) {
    const { data } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrls(local, expiresIn);
    for (const item of data ?? []) {
      if (item.signedUrl && item.path) out[item.path] = item.signedUrl;
    }
  }
  return out;
}

/** Remove a file from storage (used when deleting drafts / replacing uploads). */
export async function removeFile(path: string): Promise<void> {
  if (!path || /^https?:\/\//i.test(path)) return;
  await supabase.storage.from(STORAGE_BUCKET).remove([path]);
}

/** Extract the storage path from a stored file_url value. */
export function pathFromUrl(value: string | null | undefined): string {
  if (!value) return "";
  if (!/^https?:\/\//i.test(value)) return value;
  const marker = `/object/public/${STORAGE_BUCKET}/`;
  const signedMarker = `/object/sign/${STORAGE_BUCKET}/`;
  if (value.includes(marker)) return decodeURIComponent(value.split(marker)[1].split("?")[0]);
  if (value.includes(signedMarker)) return decodeURIComponent(value.split(signedMarker)[1].split("?")[0]);
  return value;
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toFixed(value >= 10 || unit === 0 ? 0 : 1)} ${units[unit]}`;
}
