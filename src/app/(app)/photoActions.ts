"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { dbError } from "@/lib/errors";
import { newGalleryToken, photoContext, photosWithUrls, removeFiles, type PhotoView } from "@/lib/photos";
import { GALLERY_MAX_DAYS } from "@/lib/photoFiles";

export type PhotoPanelData = { photos: PhotoView[]; links: GalleryLinkView[]; isAdmin: boolean };
export type GalleryLinkView = { id: string; created_at: string; expires_at: string; revoked_at: string | null };

/** Everything the photo panel on a job needs: photos with short-lived links and (for owners) the gallery links. */
export async function loadJobPhotos(jobId: string): Promise<{ ok: true; data: PhotoPanelData } | { ok: false; error: string }> {
  const ctx = await photoContext(jobId);
  if (!ctx.ok) return ctx;
  const photos = await photosWithUrls(ctx.viewer.orgId, jobId, ctx.viewer.userId);
  let links: GalleryLinkView[] = [];
  if (ctx.isAdmin) {
    const { data } = await createAdminClient().from("photo_gallery_links").select("id, created_at, expires_at, revoked_at").eq("org_id", ctx.viewer.orgId).eq("job_id", jobId).is("revoked_at", null).gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }).limit(10);
    links = data ?? [];
  }
  return { ok: true, data: { photos, links, isAdmin: ctx.isAdmin } };
}

async function ownPhoto(photoId: string) {
  const admin = createAdminClient();
  const { data: photo } = await admin.from("job_photos").select("*").eq("id", photoId).maybeSingle();
  if (!photo) return null;
  const ctx = await photoContext(photo.job_id);
  if (!ctx.ok || photo.org_id !== ctx.viewer.orgId) return null;
  return { photo, ctx };
}

/** Keep a photo past the 30-day cleanup (contract or record-keeping), or let it expire again. Owners and admins only. */
export async function setPhotoPreserved(photoId: string, preserved: boolean): Promise<{ ok: boolean; error?: string }> {
  const found = await ownPhoto(photoId);
  if (!found) return { ok: false, error: "Photo not found." };
  if (!found.ctx.isAdmin) return { ok: false, error: "Only owners and admins can keep photos." };
  // Un-keeping gives it a fresh 30 days rather than deleting it at the next cleanup.
  const patch = preserved ? { preserved: true } : { preserved: false, expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString() };
  const { error } = await createAdminClient().from("job_photos").update(patch).eq("id", photoId).eq("org_id", found.ctx.viewer.orgId);
  if (error) return { ok: false, error: dbError(error) };
  revalidatePath(`/jobs/${found.photo.job_id}`);
  return { ok: true };
}

/** Owners and admins delete any photo on their jobs; staff only the ones they took themselves. */
export async function deleteJobPhoto(photoId: string): Promise<{ ok: boolean; error?: string }> {
  const found = await ownPhoto(photoId);
  if (!found) return { ok: false, error: "Photo not found." };
  const { photo, ctx } = found;
  if (!ctx.isAdmin && photo.uploaded_by !== ctx.viewer.userId) return { ok: false, error: "You can only delete photos you took." };
  const removed = await removeFiles([photo.storage_path]);
  if (!removed.ok) return { ok: false, error: "Couldn't delete the file. Please try again." };
  const { error } = await createAdminClient().from("job_photos").delete().eq("id", photoId).eq("org_id", ctx.viewer.orgId);
  if (error) return { ok: false, error: dbError(error) };
  return { ok: true };
}

/** A private link the customer can open to see this job's photos. Owners and admins only. The link is shown once. */
export async function createGalleryLink(jobId: string, days: number): Promise<{ ok: true; token: string; expiresAt: string } | { ok: false; error: string }> {
  const ctx = await photoContext(jobId);
  if (!ctx.ok) return ctx;
  if (!ctx.isAdmin) return { ok: false, error: "Only owners and admins can share photos." };
  const d = Math.min(GALLERY_MAX_DAYS, Math.max(1, Math.floor(Number.isFinite(days) ? days : 7)));
  const admin = createAdminClient();
  const { count } = await admin.from("job_photos").select("id", { count: "exact", head: true }).eq("org_id", ctx.viewer.orgId).eq("job_id", jobId);
  if (!count) return { ok: false, error: "Add a photo before sharing a gallery." };
  const { count: active } = await admin.from("photo_gallery_links").select("id", { count: "exact", head: true }).eq("org_id", ctx.viewer.orgId).eq("job_id", jobId).is("revoked_at", null).gt("expires_at", new Date().toISOString());
  if ((active ?? 0) >= 5) return { ok: false, error: "This job already has 5 active links. Revoke one first." };
  const { token, hash } = newGalleryToken();
  const expiresAt = new Date(Date.now() + d * 86_400_000).toISOString();
  const { error } = await admin.from("photo_gallery_links").insert({ org_id: ctx.viewer.orgId, job_id: jobId, token_hash: hash, created_by: ctx.viewer.userId, expires_at: expiresAt });
  if (error) return { ok: false, error: dbError(error) };
  return { ok: true, token, expiresAt };
}

export async function revokeGalleryLink(linkId: string): Promise<{ ok: boolean; error?: string }> {
  const admin = createAdminClient();
  const { data: link } = await admin.from("photo_gallery_links").select("id, job_id, org_id").eq("id", linkId).maybeSingle();
  if (!link) return { ok: false, error: "Link not found." };
  const ctx = await photoContext(link.job_id);
  if (!ctx.ok || link.org_id !== ctx.viewer.orgId) return { ok: false, error: "Link not found." };
  if (!ctx.isAdmin) return { ok: false, error: "Only owners and admins can change sharing." };
  const { error } = await admin.from("photo_gallery_links").update({ revoked_at: new Date().toISOString() }).eq("id", linkId).eq("org_id", ctx.viewer.orgId);
  if (error) return { ok: false, error: dbError(error) };
  return { ok: true };
}
