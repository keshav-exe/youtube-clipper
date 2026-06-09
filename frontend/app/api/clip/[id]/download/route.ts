import { NextRequest, NextResponse } from "next/server";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const backendUrl = process.env.BACKEND_API_URL || "http://localhost:3001";

    const statusRes = await fetch(`${backendUrl}/api/clip/${id}`);
    if (!statusRes.ok) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const jobData = await statusRes.json();
    if (jobData.status !== "ready") {
      return NextResponse.json({ error: "Job not ready" }, { status: 409 });
    }

    const downloadRes = await fetch(`${backendUrl}/api/clip/${id}/file`);
    if (!downloadRes.ok) {
      return NextResponse.json({ error: "Failed to download clip" }, { status: 500 });
    }

    const headers = new Headers();
    downloadRes.headers.forEach((value, key) => {
      if (
        ["content-type", "content-length", "content-disposition"].includes(
          key.toLowerCase()
        )
      ) {
        headers.set(key, value);
      }
    });

    fetch(`${backendUrl}/api/clip/${id}/cleanup`, { method: "DELETE" }).catch(
      () => {}
    );

    return new NextResponse(downloadRes.body, {
      status: downloadRes.status,
      headers,
    });
  } catch (error) {
    console.error("Download route error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
