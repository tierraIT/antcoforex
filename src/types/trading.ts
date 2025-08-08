export interface KlineData {
  openTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  closeTime: number;
  quoteAssetVolume: string;
  numberOfTrades: number;
  takerBuyBaseAssetVolume: string;
  takerBuyQuoteAssetVolume: string;
  ignore: string;
}

export interface ProcessedCandle {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface TechnicalIndicators {
  sma20: number;
  sma50: number;
  ema12: number;
  ema26: number;
  rsi: number;
  macd: number;
  macdSignal: number;
  macdHistogram: number;
  atr: number;
  volume: number;
  avgVolume: number;
  trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS' | 'UNDEFINED';
  momentum: 'STRONG_UP' | 'UP' | 'NEUTRAL' | 'DOWN' | 'STRONG_DOWN' | 'UNDEFINED';
}

export interface TradingSignal {
  action: 'BUY' | 'SELL' | 'HOLD';
  confidence: number;
  timestamp: number;
  reason: string;
  probability: number;
  strength: 'WEAK' | 'MODERATE' | 'STRONG';
  entry_price: number;
  stop_loss: number;
  take_profit: number;
}

export interface MarketAnalysis {
  trend: 'BULLISH' | 'BEARISH' | 'SIDEWAYS' | 'UNDEFINED';
  momentum: 'STRONG_UP' | 'UP' | 'NEUTRAL' | 'DOWN' | 'STRONG_DOWN' | 'UNDEFINED';
  volatility: 'HIGH' | 'MEDIUM' | 'LOW';
  signals: TradingSignal[];
}

export interface TelegramConfig {
  botToken: string;
  chatId: string;
  enabled: boolean;
}

export interface PredictionModel {
  winRate: number;
  accuracy: number;
  totalSignals: number;
  successfulSignals: number;
}

export interface TradingSymbol {
  symbol: string;
  displayName: string;
  baseAsset: string;
  quoteAsset: string;
  tickSize: number;
  minPrice: number;
  maxPrice: number;
  priceDecimals: number;
  category: 'FOREX' | 'CRYPTO' | 'STOCK';
  description: string;
}

export interface SymbolConfig {
  currentSymbol: TradingSymbol;
  availableSymbols: TradingSymbol[];
}

export interface AIStats {
  callsToday: number;
  successRate: number;
  lastCall: string;
  totalCalls: number;
  approvals: number;
  rejections: number;
}
