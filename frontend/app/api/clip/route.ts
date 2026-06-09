import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const body = await req.json();

  if (!body.url) {
    return NextResponse.json({ error: "url field is required" }, { status: 400 });
  }

  const backendRes = await fetch(`${process.env.BACKEND_API_URL}/api/clip`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json = await backendRes.json();
  return NextResponse.json(json, { status: backendRes.status });
}
