import { NextResponse } from "next/server"
import type { TradingSignal } from "@/types/trading"

// This variable will store the last received signal.
// IMPORTANT: In a serverless environment like Vercel, this variable is NOT persistent
// across cold starts. If the function goes idle and spins down, it will reset.
// For production, consider using a persistent store like Vercel KV, Redis, or a database.
let lastSignal: TradingSignal | null = null

export async function POST(request: Request) {
  try {
    const signal: TradingSignal = await request.json()

    // Store the latest signal
    lastSignal = signal

    return NextResponse.json({ message: "Signal received and stored successfully", signal }, { status: 200 })
  } catch (error) {
    return NextResponse.json({ error: "Failed to process signal" }, { status: 500 })
  }
}

export async function GET() {
  try {
    if (lastSignal) {
      return NextResponse.json({ signal: lastSignal }, { status: 200 })
    } else {
      return NextResponse.json({ message: "No signal available yet" }, { status: 200 })
    }
  } catch (error) {
    return NextResponse.json({ error: "Failed to retrieve signal" }, { status: 500 })
  }
}
