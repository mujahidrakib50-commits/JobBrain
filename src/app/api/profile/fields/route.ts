import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateLocalEmbedding } from "@/lib/embeddings";

export async function GET() {
  try {
    const user = await requireAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await prisma.profile.findUnique({
      where: { userId: user.id },
      include: { fields: { orderBy: { createdAt: "asc" } } },
    });

    return NextResponse.json({ fields: profile?.fields || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { question, answer } = await req.json();
    if (!question || typeof question !== "string" || !question.trim()) {
      return NextResponse.json({ error: "Question is required" }, { status: 400 });
    }
    if (answer === undefined || answer === null) {
      return NextResponse.json({ error: "Answer is required" }, { status: 400 });
    }

    const profile = await prisma.profile.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id },
    });

    const embedding = JSON.stringify(generateLocalEmbedding(question.trim()));

    const field = await prisma.profileField.upsert({
      where: {
        profileId_question: {
          profileId: profile.id,
          question: question.trim(),
        },
      },
      update: {
        answer: String(answer).trim(),
        embedding,
      },
      create: {
        profileId: profile.id,
        question: question.trim(),
        answer: String(answer).trim(),
        embedding,
      },
    });

    return NextResponse.json({ success: true, field });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    await prisma.profileField.deleteMany({
      where: { id, profileId: profile.id },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
