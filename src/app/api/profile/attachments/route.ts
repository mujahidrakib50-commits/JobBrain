import { NextResponse } from "next/server";
import { getSessionUser, getOrCreateDefaultUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    let user = await getSessionUser();
    if (!user) user = await getOrCreateDefaultUser();

    const profile = await prisma.profile.findUnique({
      where: { userId: user.id },
      include: { attachments: { orderBy: { createdAt: "asc" } } },
    });

    return NextResponse.json({ attachments: profile?.attachments || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    let user = await getSessionUser();
    if (!user) user = await getOrCreateDefaultUser();

    const formData = await req.formData();
    const question = formData.get("question") as string;
    const file = formData.get("file") as File | null;

    if (!question || !question.trim()) {
      return NextResponse.json({ error: "Attachment description/question is required" }, { status: 400 });
    }
    if (!file) {
      return NextResponse.json({ error: "File upload is required" }, { status: 400 });
    }

    const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    const uploadsDir = path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const timestamp = Date.now();
    const safeFilename = `${timestamp}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const filePath = path.join(uploadsDir, safeFilename);

    const buffer = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(filePath, buffer);

    const relativeUrl = `/api/uploads/${safeFilename}`;

    const attachment = await prisma.attachment.create({
      data: {
        profileId: profile.id,
        question: question.trim(),
        filename: file.name,
        mimeType: file.type || "application/octet-stream",
        fileUrl: filePath, // Stored path for Playwright upload
      },
    });

    return NextResponse.json({ success: true, attachment });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    let user = await getSessionUser();
    if (!user) user = await getOrCreateDefaultUser();

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

    const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    const attachment = await prisma.attachment.findFirst({
      where: { id, profileId: profile.id },
    });

    if (attachment) {
      // Remove file from disk
      if (fs.existsSync(attachment.fileUrl)) {
        try {
          fs.unlinkSync(attachment.fileUrl);
        } catch {}
      }
      await prisma.attachment.delete({ where: { id: attachment.id } });
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
