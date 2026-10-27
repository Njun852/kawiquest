"use server";

import { asRole, num, str, type ActionResult } from "@/lib/server-actions";
import { CharacterValidation, HandwritingSample, nextId, VALIDATION_STATUSES, type ValidationStatus } from "@/lib/models";

const WORD: Record<ValidationStatus, string> = { approved: "Approved", rejected: "Rejected", flagged: "Flagged" };

/** Record one decision on a sample (character_validations). Remarks are required to reject or flag. */
export async function decide(_prev: ActionResult, fd: FormData): Promise<ActionResult> {
  return asRole(["validator"], async (me) => {
    const sampleId = num(fd, "sample_id");
    const status = str(fd, "status") as ValidationStatus;
    const remarks = str(fd, "remarks").trim();
    if (!(VALIDATION_STATUSES as readonly string[]).includes(status)) return { error: "Choose approve, reject or flag." };
    if (status !== "approved" && !remarks) return { fieldErrors: { remarks: "Add a remark to reject or flag this sample." } };
    if (remarks.length > 255) return { fieldErrors: { remarks: "Keep remarks under 255 characters." } };
    if (!sampleId || !(await HandwritingSample.exists({ sample_id: sampleId }))) return { error: "That sample no longer exists." };

    await CharacterValidation.create({
      validation_id: await nextId("character_validations"),
      sample_id: sampleId,
      account_id: me.id,
      status,
      remarks: remarks || null,
      validated_at: new Date(),
    });
    return { success: `${WORD[status]} sample #${sampleId}.`, id: sampleId, done: "saved" };
  });
}
