// src/utils/technicalAnalysis.ts

import { BollingerBands, MACD, RSI, SMA, Stochastic, EMA, ATR, WilliamsR } from 'technicalindicators';
import { ProcessedCandle, TradingSignal, TechnicalIndicators, TradingSymbol } from '../types/trading';

export class TechnicalAnalyzer {
    // Calculate all technical indicators
    static calculateIndicators(candles: ProcessedCandle[]): TechnicalIndicators {
        const closes = candles.map(c => c.close);
        const highs = candles.map(c => c.high);
        const lows = candles.map(c => c.low);
        const volumes = candles.map(c => c.volume);

        const rsi = RSI.calculate({ values: closes, period: 14 });
        const macd = MACD.calculate({ values: closes, fastPeriod: 12, slowPeriod: 26, signalPeriod: 9 });
        const sma20 = SMA.calculate({ values: closes, period: 20 });
        const sma50 = SMA.calculate({ values: closes, period: 50 });
        const ema12 = EMA.calculate({ values: closes, period: 12 });
        const ema26 = EMA.calculate({ values: closes, period: 26 });
        const atr = ATR.calculate({ high: highs, low: lows, close: closes, period: 14 });
        const avgVolume = SMA.calculate({ values: volumes, period: 20 });

        return {
            rsi: rsi[rsi.length - 1] || 50,
            macd: macd[macd.length - 1]?.MACD || 0,
            macdSignal: macd[macd.length - 1]?.signal || 0,
            macdHistogram: macd[macd.length - 1]?.histogram || 0,
            sma20: sma20[sma20.length - 1] || 0,
            sma50: sma50[sma50.length - 1] || 0,
            ema12: ema12[ema12.length - 1] || 0,
            ema26: ema26[ema26.length - 1] || 0,
            atr: atr[atr.length - 1] || 0,
            volume: volumes[volumes.length - 1] || 0,
            avgVolume: avgVolume[avgVolume.length - 1] || 0,
        };
    }

    // Calculate Bollinger Bands
    static calculateBollingerBands(closes: number[], period = 20, stdDev = 2) {
        const bb = BollingerBands.calculate({ period, values: closes, stdDev });
        return bb[bb.length - 1] || { middle: 0, upper: 0, lower: 0 };
    }

    // Calculate Stochastic Oscillator
    static calculateStochastic(candles: ProcessedCandle[], period = 14, signalPeriod = 3) {
        const inputs = {
            high: candles.map(c => c.high),
            low: candles.map(c => c.low),
            close: candles.map(c => c.close),
            period: period,
            signalPeriod: signalPeriod
        };
        const stoch = Stochastic.calculate(inputs);
        return stoch[stoch.length - 1] || { k: 50, d: 50 };
    }

    // Generate trading signals based on indicators
    static generateTradingSignals(
        candles: ProcessedCandle[],
        indicators: TechnicalIndicators,
        symbol?: TradingSymbol
    ): TradingSignal[] {
        const currentPrice = candles[candles.length - 1].close;
        const bollinger = this.calculateBollingerBands(candles.map(c => c.close));
        const stochastic = this.calculateStochastic(candles);
        
        let score = 0;
        const reasons: string[] = [];
        
        // RSI Analysis (Weight: 25%)
        if (indicators.rsi < 35) {
            score += 25;
            reasons.push('RSI oversold (<35)');
        } else if (indicators.rsi < 45) {
            score += 15;
            reasons.push('RSI approaching oversold');
        } else if (indicators.rsi > 65) {
            score -= 25;
            reasons.push('RSI overbought (>65)');
        } else if (indicators.rsi > 55) {
            score -= 15;
            reasons.push('RSI approaching overbought');
        }

        // MACD Analysis (Weight: 25%)
        if (indicators.macd > indicators.macdSignal && indicators.macdHistogram > 0) {
            const strength = Math.abs(indicators.macdHistogram) * 10000;
            if (strength > 5) {
                score += 25;
                reasons.push('Strong MACD bullish crossover');
            } else {
                score += 15;
                reasons.push('MACD bullish crossover');
            }
        } else if (indicators.macd < indicators.macdSignal && indicators.macdHistogram < 0) {
            const strength = Math.abs(indicators.macdHistogram) * 10000;
            if (strength > 5) {
                score -= 25;
                reasons.push('Strong MACD bearish crossover');
            } else {
                score -= 15;
                reasons.push('MACD bearish crossover');
            }
        }
        
        // *** LOGIC MỚI: Scalping Pullback về EMA (Weight: 20%) ***
        const isUptrend = indicators.ema12 > indicators.ema26;
        const isDowntrend = indicators.ema12 < indicators.ema26;
        
        if (isUptrend && currentPrice <= indicators.ema12 && currentPrice >= indicators.ema26) {
            score += 20;
            reasons.push('Price pullback to EMA dynamic zone in uptrend');
        } else if (isDowntrend && currentPrice >= indicators.ema12 && currentPrice <= indicators.ema26) {
            score -= 20;
            reasons.push('Price pullback to EMA dynamic zone in downtrend');
        }

        // Moving Average Analysis (Weight: 15%)
        if (currentPrice > indicators.sma20 && indicators.sma20 > indicators.sma50) {
            score += 15;
            reasons.push('Price above aligned SMAs');
        } else if (currentPrice < indicators.sma20 && indicators.sma20 < indicators.sma50) {
            score -= 15;
            reasons.push('Price below aligned SMAs');
        }

        // Bollinger Bands Analysis (Weight: 10%)
        if (currentPrice < bollinger.lower) {
            score += 10;
            reasons.push('Price below Bollinger lower band');
        } else if (currentPrice > bollinger.upper) {
            score -= 10;
            reasons.push('Price above Bollinger upper band');
        }

        // Stochastic Analysis (Weight: 5%)
        if (stochastic.k < 20 && stochastic.d < 20) {
            score += 5;
            reasons.push('Stochastic oversold');
        } else if (stochastic.k > 80 && stochastic.d > 80) {
            score -= 5;
            reasons.push('Stochastic overbought');
        }

        // Volume confirmation
        const volumeRatio = indicators.volume / indicators.avgVolume;
        if (volumeRatio > 1.5 && score !== 0) {
            score += Math.sign(score) * 5;
            reasons.push('High volume confirmation');
        }

        // Determine signal
        let action: 'BUY' | 'SELL' | 'HOLD' = 'HOLD';
        let strength: 'WEAK' | 'MODERATE' | 'STRONG' = 'WEAK';
        let confidence = Math.max(25, Math.min(95, 50 + Math.abs(score) * 0.5));
        let probability = Math.max(30, Math.min(85, 40 + Math.abs(score) * 0.4));

        // *** THAY ĐỔI: Hạ ngưỡng điểm để có nhiều tín hiệu hơn ***
        const moderate_threshold = 30;
        const strong_threshold = 50;

        if (score >= strong_threshold) {
            action = 'BUY';
            strength = 'STRONG';
        } else if (score >= moderate_threshold) {
            action = 'BUY';
            strength = 'MODERATE';
        } else if (score <= -strong_threshold) {
            action = 'SELL';
            strength = 'STRONG';
        } else if (score <= -moderate_threshold) {
            action = 'SELL';
            strength = 'MODERATE';
        }

        if (action === 'HOLD') {
            return []; // Không có tín hiệu, trả về mảng rỗng
        }

        // Calculate SL/TP using ATR
        const atr = indicators.atr || currentPrice * 0.001; // Fallback
        const riskRewardRatio = 1.5;
        let entry_price = currentPrice;
        let stop_loss = currentPrice;
        let take_profit = currentPrice;

        if (action === 'BUY') {
            stop_loss = currentPrice - (atr * 1.5);
            take_profit = currentPrice + (atr * 1.5 * riskRewardRatio);
        } else if (action === 'SELL') {
            stop_loss = currentPrice + (atr * 1.5);
            take_profit = currentPrice - (atr * 1.5 * riskRewardRatio);
        }
        
        const priceDecimals = symbol?.priceDecimals || 5;

        return [{
            action,
            confidence: Math.round(confidence),
            timestamp: Date.now(),
            reason: reasons.length > 0 ? reasons.join('; ') : 'Score-based signal',
            probability: Math.round(probability),
            strength,
            entry_price: parseFloat(entry_price.toFixed(priceDecimals)),
            stop_loss: parseFloat(stop_loss.toFixed(priceDecimals)),
            take_profit: parseFloat(take_profit.toFixed(priceDecimals))
        }];
    }
}