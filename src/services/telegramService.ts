import type { TradingSignal, TelegramConfig } from "../types/trading"

export class TelegramService {
  private config: TelegramConfig

  constructor(config: TelegramConfig) {
    this.config = config
  }

  async sendTradingAlert(signal: TradingSignal, currentPrice: number): Promise<boolean> {
    if (!this.config.enabled) {
      return false
    }

    if (!this.config.botToken || !this.config.chatId) {
      return false
    }

    const message = this.formatTradingMessage(signal, currentPrice)

    try {
      const response = await fetch(`https://api.telegram.org/bot${this.config.botToken}/sendMessage`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: this.config.chatId,
          text: message,
          parse_mode: "HTML",
        }),
      })

      const responseData = await response.json()

      return response.ok
    } catch (error) {
      return false
    }
  }

  private formatTradingMessage(signal: TradingSignal, currentPrice: number): string {
    const emoji = signal.action === "BUY" ? "🟢" : "🔴"
    const strengthEmoji = signal.strength === "STRONG" ? "🚀" : "📈"

    return `
${emoji} <b>TRADING SIGNAL</b> ${strengthEmoji}

<b>Action:</b> ${signal.action}
<b>Strength:</b> ${signal.strength}
<b>Confidence:</b> ${signal.confidence}%
<b>Win Probability:</b> ${signal.probability}%

<b>Entry Price:</b> $${signal.entry_price.toFixed(5)}
<b>Stop Loss:</b> $${signal.stop_loss.toFixed(5)}
<b>Take Profit:</b> $${signal.take_profit.toFixed(5)}

<b>Analysis:</b> ${signal.reason}

<b>Risk/Reward:</b> ${this.calculateRiskReward(signal)}

⚠️ <i>Lương của mày 500k/ngày thôi.</i>

<b>Time:</b> ${new Date(signal.timestamp).toLocaleString("vi-VN")}
    `.trim()
  }

  private calculateRiskReward(signal: TradingSignal): string {
    const risk = Math.abs(signal.entry_price - signal.stop_loss)
    const reward = Math.abs(signal.take_profit - signal.entry_price)
    const ratio = (reward / risk).toFixed(2)
    return `1:${ratio}`
  }

  updateConfig(config: Partial<TelegramConfig>): void {
    this.config = { ...this.config, ...config }
  }
}
// Removed export default TelegramService
