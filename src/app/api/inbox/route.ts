import { NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  try {
    const user = await requireAuthUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url);
    const category = url.searchParams.get("category"); // REJECTION | POSITIVE | JOB_MATCH | all
    const sort = url.searchParams.get("sort") || "newest"; // newest | oldest | sender | category
    const search = url.searchParams.get("search")?.trim().toLowerCase();

    const whereClause: any = { userId: user.id };

    if (category && category !== "all") {
      whereClause.category = category.toUpperCase();
    }

    let emails = await prisma.jobEmail.findMany({
      where: whereClause,
      orderBy: { receivedAt: sort === "oldest" ? "asc" : "desc" },
    });

    if (search) {
      emails = emails.filter(
        (e) =>
          e.subject.toLowerCase().includes(search) ||
          e.sender.toLowerCase().includes(search) ||
          e.senderEmail.toLowerCase().includes(search) ||
          e.snippet.toLowerCase().includes(search)
      );
    }

    if (sort === "sender") {
      emails.sort((a, b) => a.sender.localeCompare(b.sender));
    } else if (sort === "category") {
      emails.sort((a, b) => a.category.localeCompare(b.category));
    }

    // Counts across all categories for this user
    const allUserEmails = await prisma.jobEmail.findMany({
      where: { userId: user.id },
      select: { category: true, isRead: true },
    });

    const counts = {
      all: allUserEmails.length,
      unread: allUserEmails.filter((e) => !e.isRead).length,
      rejection: allUserEmails.filter((e) => e.category === "REJECTION").length,
      positive: allUserEmails.filter((e) => e.category === "POSITIVE").length,
      jobMatch: allUserEmails.filter((e) => e.category === "JOB_MATCH").length,
    };

    return NextResponse.json({ emails, counts });
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

    const { id, ids, isRead, markAllRead } = await req.json();

    if (markAllRead) {
      await prisma.jobEmail.updateMany({
        where: { userId: user.id },
        data: { isRead: true },
      });
      return NextResponse.json({ success: true });
    }

    if (Array.isArray(ids) && ids.length > 0) {
      const updated = await prisma.jobEmail.updateMany({
        where: { id: { in: ids }, userId: user.id },
        data: { isRead: !!isRead },
      });
      return NextResponse.json({ success: true, count: updated.count });
    }

    if (!id) {
      return NextResponse.json({ error: "Email ID or IDs required" }, { status: 400 });
    }

    const updated = await prisma.jobEmail.updateMany({
      where: { id, userId: user.id },
      data: { isRead: !!isRead },
    });

    return NextResponse.json({ success: true, updated: updated.count });
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

    const { id, ids, deleteAll } = await req.json();

    if (deleteAll) {
      const deleted = await prisma.jobEmail.deleteMany({
        where: { userId: user.id },
      });
      return NextResponse.json({ success: true, count: deleted.count });
    }

    if (Array.isArray(ids) && ids.length > 0) {
      const deleted = await prisma.jobEmail.deleteMany({
        where: { id: { in: ids }, userId: user.id },
      });
      return NextResponse.json({ success: true, count: deleted.count });
    }

    if (!id) {
      return NextResponse.json({ error: "Email ID or IDs required" }, { status: 400 });
    }

    await prisma.jobEmail.deleteMany({
      where: { id, userId: user.id },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}