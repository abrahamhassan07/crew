import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getViewer } from "@/lib/auth";
import { readPhotoForm, savePhoto } from "@/lib/photoUpload";

// Upload one job photo from the site (already compressed to JPEG in the browser). All checks live in savePhoto,
// shared with the phone app.
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Please sign in again." }, { status: 401 });

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "That upload couldn't be read." }, { status: 400 });
  }
  const input = readPhotoForm(form);
  if ("error" in input) return NextResponse.json({ error: input.error }, { status: input.status });
  const result = await savePhoto(await getViewer(), input.jobId, input.kind, input.file);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, id: result.id });
}
