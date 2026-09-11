import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";

export async function POST(req: Request) {
  try {
    const user = await requireAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();
    const file = formData.get("avatar") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No avatar file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || "image/jpeg";
    const base64Data = buffer.toString("base64");
    const avatarDataUrl = `data:${mimeType};base64,${base64Data}`;

    // Also persist to disk as backup
    try {
      const uploadsDir = path.join(process.cwd(), "uploads");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      const ext = path.extname(file.name) || ".png";
      const filename = `avatar_${user.id}_${Date.now()}${ext}`;
      const filePath = path.join(uploadsDir, filename);
      fs.writeFileSync(filePath, buffer);
    } catch (e) {
      console.warn("Failed saving avatar to disk fallback:", e);
    }

    // Save persistent data URL to profile
    const profile = await prisma.profile.upsert({
      where: { userId: user.id },
      update: { avatarUrl: avatarDataUrl },
      create: { userId: user.id, avatarUrl: avatarDataUrl },
    });

    return NextResponse.json({ success: true, avatarUrl: profile.avatarUrl });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
