import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt, maskKey } from "@/lib/crypto";

export async function GET() {
  try {
    const user = await requireAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const keys = await prisma.apiKey.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    const safeKeys = keys.map((k) => {
      const dec = decrypt(k.encryptedKey);
      return {
        id: k.id,
        label: k.label,
        provider: k.provider,
        model: k.model,
        maskedKey: maskKey(dec),
        isActive: k.isActive,
        createdAt: k.createdAt,
      };
    });

    return NextResponse.json({ keys: safeKeys });
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

    const { label, provider, model, key } = await req.json();

    if (!label || !provider || !key) {
      return NextResponse.json(
        { error: "Label, provider, and API key are required" },
        { status: 400 }
      );
    }

    const encryptedKey = encrypt(key.trim());

    // If this is the user's first key, make it active by default
    const count = await prisma.apiKey.count({ where: { userId: user.id } });
    const isActive = count === 0;

    const newKey = await prisma.apiKey.create({
      data: {
        userId: user.id,
        label: label.trim(),
        provider: provider.trim(),
        model: (model || "gpt-4o").trim(),
        encryptedKey,
        isActive,
      },
    });

    return NextResponse.json({
      success: true,
      key: {
        id: newKey.id,
        label: newKey.label,
        provider: newKey.provider,
        model: newKey.model,
        maskedKey: maskKey(key.trim()),
        isActive: newKey.isActive,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "Key ID required" }, { status: 400 });

    // Verify key belongs to this user
    const key = await prisma.apiKey.findFirst({
      where: { id, userId: user.id },
    });
    if (!key) {
      return NextResponse.json({ error: "Key not found" }, { status: 404 });
    }

    // Deactivate all keys for this user
    await prisma.apiKey.updateMany({
      where: { userId: user.id },
      data: { isActive: false },
    });

    // Activate the chosen key
    const updated = await prisma.apiKey.update({
      where: { id: key.id },
      data: { isActive: true },
    });

    return NextResponse.json({ success: true, activeId: updated.id });
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
    if (!id) return NextResponse.json({ error: "Key ID required" }, { status: 400 });

    await prisma.apiKey.deleteMany({
      where: { id, userId: user.id },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
