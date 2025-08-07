import React, { useState, useEffect } from 'react';
import { TelegramConfig } from '../types/trading';
import { Send, Settings, Eye, EyeOff } from 'lucide-react';

interface TelegramSettingsProps {
  config: TelegramConfig;
  onConfigChange: (config: TelegramConfig) => void;
  onTestMessage: () => void;
}

export const TelegramSettings: React.FC<TelegramSettingsProps> = ({
  config,
  onConfigChange,
  onTestMessage
}) => {
  const [showToken, setShowToken] = useState(false);
  const [isExpanded, setIsExpanded] = useState(true);

  // Auto-set defaults when component mounts
  useEffect(() => {
    let updatedConfig: TelegramConfig = { ...config };
    let changed = false;

    if (updatedConfig.enabled === undefined) {
      updatedConfig.enabled = true;
      changed = true;
    }

    if (!updatedConfig.botToken || updatedConfig.botToken === 'YOUR_BOT_TOKEN_HERE') {
      updatedConfig.botToken = '7578707048:AAG5Vr667I-3LerfhO1YzYbgTinXJwuHmAA';
      changed = true;
    }

    if (!updatedConfig.chatId || updatedConfig.chatId === 'YOUR_CHAT_ID_HERE') {
      updatedConfig.chatId = '-1002577959257';
      changed = true;
    }

    if (changed) {
      onConfigChange(updatedConfig);
    }
  }, [config, onConfigChange]);

  const handleInputChange = (field: keyof TelegramConfig, value: string | boolean) => {
    onConfigChange({
      ...config,
      [field]: value
    });
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
          <Settings className="w-5 h-5" />
          <span>Telegram Alerts</span>
        </h3>
        <div className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${config.enabled ? 'bg-green-400' : 'bg-gray-400'}`} />
          <span className="text-sm text-gray-400">
            {isExpanded ? '▼' : '▶'}
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-4">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="telegram-enabled"
              checked={config.enabled}
              onChange={(e) => handleInputChange('enabled', e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
            />
            <label htmlFor="telegram-enabled" className="text-white">
              Enable Telegram Alerts
            </label>
          </div>

          {config.enabled && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Bot Token
                </label>
                <div className="relative">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={config.botToken || ''}
                    onChange={(e) => handleInputChange('botToken', e.target.value)}
                    placeholder="Enter your Telegram bot token"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Chat ID
                </label>
                <input
                  type="text"
                  value={config.chatId || ''}
                  onChange={(e) => handleInputChange('chatId', e.target.value)}
                  placeholder="Enter your chat ID or group ID"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  AI Confirmation Level
                </label>
                <select 
                  value={config.aiConfirmationLevel || 'STANDARD'}
                  onChange={(e) => handleInputChange('aiConfirmationLevel', e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="STRICT">Strict - AI phải đồng ý 100%</option>
                  <option value="STANDARD">Standard - AI có thể điều chỉnh</option>
                  <option value="PERMISSIVE">Permissive - AI chỉ cảnh báo</option>
                </select>
              </div>

              <button
                onClick={onTestMessage}
                disabled={!config.botToken || !config.chatId}
                className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg transition-colors"
              >
                <Send className="w-4 h-4" />
                <span>Test Message</span>
              </button>

            <div className="mt-4 p-3 bg-gray-900/50 rounded">
    <h4 className="text-sm font-medium text-gray-300 mb-2">📋 Auto-send Conditions</h4>
    <div className="text-xs text-gray-400 space-y-1">
      {/* Condition 1: Strong Signal.
        The initial technical analysis must identify the signal as "STRONG" or "VERY_STRONG."
        This filters out weak or neutral signals, ensuring only high-potential opportunities are considered. 
      */}
      <div>• <strong>Strong Signal:</strong> STRONG/VERY_STRONG only</div>

      {/* Condition 2: Quality.
        This sets a high bar for the signal's quality.
        - Probability ≥70%: A high likelihood of the price moving in the predicted direction.
        - Confidence ≥65%: The strength of the indicators supporting the signal is high.
      */}
      <div>• <strong>Quality:</strong> Probability ≥70% AND Confidence ≥65%</div>

      {/* Condition 3: Gemini Decision.
        The AI's final confirmation is crucial. The order is only placed if Gemini agrees with the technical analysis and confirms a "BUY" or "SELL" action. 
        This acts as a final layer of verification.
      */}
      <div>• <strong>Gemini Decision:</strong> Final BUY/SELL confirmation</div>

      {/* Condition 4: Cooldown.
        A 1-minute cooldown period prevents the system from placing multiple orders for the same asset in rapid succession. This helps manage risk and avoid over-trading.
      */}
      <div>• <strong>Cooldown:</strong> 1 phút giữa các tín hiệu</div>

      {/* Condition 5: Fallback.
        If Gemini's analysis fails or times out, the system will still place an order based on the initial strong technical analysis signal. 
        This ensures that potential opportunities aren't missed due to AI issues.
      */}
      <div>• <strong>Fallback:</strong> Gửi TA signal nếu Gemini fail</div>
    </div>
  </div>

  <div className="mt-4 p-3 bg-green-900/20 border border-green-700 rounded">
    <h4 className="text-sm font-medium text-green-300 mb-2">🚀 New Trading Flow</h4>
    <div className="text-xs text-green-200 space-y-1">
      {/* Step 1: The system first looks for "strong signals" based on the technical analysis criteria defined above (Strong/Very_Strong, Probability ≥70%, Confidence ≥65%). 
      */}
      <div>1. Phát hiện tín hiệu MẠNH từ chỉ số kỹ thuật</div>

      {/* Step 2: Once a strong signal is found, it's sent to Gemini for a comprehensive, final analysis. Gemini considers a wide range of factors to either confirm or deny the initial signal.
      */}
      <div>2. Gemini phân tích tổng hợp → Quyết định cuối</div>

      {/* Step 3: An order is placed (via a Telegram alert) only if Gemini's final decision is a clear "BUY" or "SELL." This ensures that every trade has been vetted by both technical indicators and the AI.
      */}
      <div>3. Gửi Telegram ngay khi có BUY/SELL</div>

      {/* Step 4: This entire process is designed to find the highest-quality, most probable trading opportunities, thereby aiming to maximize profit potential while minimizing risk from false signals.
      */}
      <div>4. Tối ưu hóa lợi nhuận cao nhất</div>
    </div>
  </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};
