import { NextResponse } from "next/server"
import type { TradingSignal } from "@/types/trading"

// Store the latest signal in memory
// Note: In production, consider using Redis or a database
let latestSignal: TradingSignal | null = null
let lastSignalTime = 0

export async function POST(request: Request) {
  try {
    const signal: TradingSignal = await request.json()
    
    // Only store STRONG signals with "Doji" in analysis
    if (signal.strength === 'STRONG' && 
        signal.reason && 
        signal.reason.toLowerCase().includes('doji') &&
        (signal.action === 'BUY' || signal.action === 'SELL')) {
      
      latestSignal = {
        ...signal,
        timestamp: Date.now()
      }
      lastSignalTime = Date.now()
      
      console.log('🎯 STRONG Doji signal stored:', {
        action: signal.action,
        reason: signal.reason,
        confidence: signal.confidence,
        probability: signal.probability
      })
    }

    return NextResponse.json({ 
      message: "Signal received", 
      stored: latestSignal !== null 
    }, { status: 200 })
  } catch (error) {
    console.error('Error processing signal:', error)
    return NextResponse.json({ error: "Failed to process signal" }, { status: 500 })
  }
}

export async function GET() {
  try {
    // Return signal if it's less than 5 minutes old
    const signalAge = Date.now() - lastSignalTime
    const maxAge = 5 * 60 * 1000 // 5 minutes
    
    if (latestSignal && signalAge < maxAge) {
      const response = {
        signal: latestSignal,
        age_seconds: Math.floor(signalAge / 1000),
        is_fresh: signalAge < 60000 // Less than 1 minute
      }
      
      // Clear the signal after sending to prevent duplicate trades
      latestSignal = null
      
      return NextResponse.json(response, { status: 200 })
    }
    
    return NextResponse.json({ 
      signal: null, 
      message: "No fresh signals available" 
    }, { status: 200 })
  } catch (error) {
    console.error('Error retrieving signal:', error)
    return NextResponse.json({ error: "Failed to retrieve signal" }, { status: 500 })
  }
}