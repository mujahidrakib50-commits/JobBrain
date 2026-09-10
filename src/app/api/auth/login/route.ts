import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createSessionToken, AUTH_COOKIE_NAME, hashPassword } from "@/lib/auth";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // If first user, register
      const userCount = await prisma.user.count();
      if (userCount === 0) {
        const passwordHash = await hashPassword(password);
        user = await prisma.user.create({
          data: {
            email,
            passwordHash,
            profile: { create: {} },
          },
        });
      } else {
        return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
      }
    } else {
      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) {
        return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
      }
    }

    const token = createSessionToken({ userId: user.id, email: user.email });
    const response = NextResponse.json({ success: true, user: { id: user.id, email: user.email } });

    response.cookies.set(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60,
      path: "/",
    });

    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
