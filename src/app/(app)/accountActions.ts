"use server";

import { getViewer } from "@/lib/auth";
import { deleteOwnAccount, deletionPlan, type DeleteResult, type DeletionPlan } from "@/lib/accountDeletion";

/** What deleting this person's account would remove (shown before they confirm). */
export async function getDeletionPlan(): Promise<DeletionPlan> {
  return deletionPlan(await getViewer());
}

/** Deletes the signed-in person's own account (and their business when they're its only admin). */
export async function deleteMyAccount(input: { password?: string; confirmName?: string }): Promise<DeleteResult> {
  const viewer = await getViewer();
  return deleteOwnAccount(viewer, { password: typeof input?.password === "string" ? input.password : undefined, confirmName: typeof input?.confirmName === "string" ? input.confirmName.slice(0, 300) : undefined });
}
