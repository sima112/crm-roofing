import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildUserDataExport, buildZipBuffer } from "@/lib/data-export";
import { logSecurityEvent } from "@/lib/password-security";
import { withPermission } from "@/middleware/withPermission";

export const GET = withPermission("data:export")(
  async (_req: NextRequest, { user, business }) => {
    const admin = createAdminClient();
    const payload = await buildUserDataExport(admin, user.id, business.id);
    const buffer  = await buildZipBuffer(payload);

    await logSecurityEvent(admin, {
      type:     "team_member_added", // closest available; replaced by proper event
      userId:   user.id,
      email:    user.email,
      metadata: { action: "data_export_requested" },
    });

    const date = new Date().toISOString().split("T")[0];

    return new NextResponse(buffer.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type":        "application/zip",
        "Content-Disposition": `attachment; filename="crewbooks-data-${date}.zip"`,
        "Content-Length":      String(buffer.byteLength),
      },
    });
  }
);
