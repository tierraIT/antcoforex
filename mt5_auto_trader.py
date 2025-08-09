import MetaTrader5 as mt5
import requests
import json
import time
import threading
from datetime import datetime
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('mt5_trader.log'),
        logging.StreamHandler()
    ]
)

class MT5AutoTrader:
    def __init__(self, api_url="http://localhost:3000/api/trading-signals", poll_interval=5):
        self.api_url = api_url
        self.poll_interval = poll_interval
        self.running = False
        self.positions = {}  # Track open positions
        self.initial_balance = 0
        
    def connect_mt5(self):
        """Initialize MT5 connection"""
        if not mt5.initialize():
            logging.error(f"MT5 initialize() failed, error code = {mt5.last_error()}")
            return False
            
        # Check account info
        account_info = mt5.account_info()
        if account_info is None:
            logging.error(f"Failed to get account info, error code = {mt5.last_error()}")
            mt5.shutdown()
            return False
            
        self.initial_balance = account_info.balance
        logging.info(f"Connected to MT5. Account: {account_info.login}, Balance: {account_info.balance}")
        return True
        
    def disconnect_mt5(self):
        """Shutdown MT5 connection"""
        mt5.shutdown()
        logging.info("Disconnected from MT5")
        
    def get_signal_from_api(self):
        """Fetch trading signal from API"""
        try:
            response = requests.get(self.api_url, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            if data.get('signal'):
                signal = data['signal']
                logging.info(f"Received signal: {signal['action']} - {signal.get('reason', 'No reason')}")
                return signal
            else:
                logging.debug("No fresh signals available")
                return None
                
        except requests.exceptions.RequestException as e:
            logging.error(f"Error fetching signal from API: {e}")
            return None
        except json.JSONDecodeError as e:
            logging.error(f"Error decoding JSON response: {e}")
            return None
            
    def calculate_lot_size(self, symbol="EURUSD", risk_percent=1.0):
        """Calculate lot size based on account balance and risk"""
        account_info = mt5.account_info()
        if account_info is None:
            return 0.01
            
        balance = account_info.balance
        
        # Get symbol info
        symbol_info = mt5.symbol_info(symbol)
        if symbol_info is None:
            logging.warning(f"Symbol {symbol} not found, using default lot size")
            return 0.01
            
        # Calculate lot size (1% risk)
        risk_amount = balance * (risk_percent / 100)
        
        # Simple lot calculation - can be enhanced
        if symbol == "EURUSD":
            lot_size = min(max(risk_amount / 10000, symbol_info.volume_min), symbol_info.volume_max)
        else:
            lot_size = min(max(risk_amount / 100000, symbol_info.volume_min), symbol_info.volume_max)
            
        # Round to valid step
        lot_size = round(lot_size / symbol_info.volume_step) * symbol_info.volume_step
        
        return round(lot_size, 2)
        
    def place_order(self, signal, symbol="EURUSD"):
        """Place order based on signal"""
        if not self.connect_mt5():
            return False
            
        try:
            # Get current price
            tick = mt5.symbol_info_tick(symbol)
            if tick is None:
                logging.error(f"Failed to get tick for {symbol}")
                return False
                
            # Calculate lot size
            lot_size = self.calculate_lot_size(symbol)
            
            # Prepare order request
            if signal['action'] == 'BUY':
                order_type = mt5.ORDER_TYPE_BUY
                price = tick.ask
            else:  # SELL
                order_type = mt5.ORDER_TYPE_SELL
                price = tick.bid
                
            request = {
                "action": mt5.TRADE_ACTION_DEAL,
                "symbol": symbol,
                "volume": lot_size,
                "type": order_type,
                "price": price,
                "deviation": 20,
                "magic": 123456,
                "comment": f"Auto_{signal['action']}_Doji",
                "type_time": mt5.ORDER_TIME_GTC,
                "type_filling": mt5.ORDER_FILLING_IOC,
            }
            
            # Send order
            result = mt5.order_send(request)
            
            if result.retcode != mt5.TRADE_RETCODE_DONE:
                logging.error(f"Order failed, retcode={result.retcode}")
                return False
            else:
                # Store position info
                position_info = {
                    'ticket': result.order,
                    'symbol': symbol,
                    'action': signal['action'],
                    'volume': lot_size,
                    'open_price': price,
                    'open_time': datetime.now(),
                    'initial_balance': self.initial_balance
                }
                self.positions[result.order] = position_info
                
                logging.info(f"Order placed successfully: {signal['action']} {lot_size} {symbol} at {price}")
                logging.info(f"Order ticket: {result.order}")
                return True
                
        except Exception as e:
            logging.error(f"Error placing order: {e}")
            return False
        finally:
            self.disconnect_mt5()
            
    def check_and_close_positions(self):
        """Check positions and close if profit conditions are met"""
        if not self.positions:
            return
            
        if not self.connect_mt5():
            return
            
        try:
            # Get current positions
            positions = mt5.positions_get()
            if positions is None:
                return
                
            for position in positions:
                ticket = position.ticket
                if ticket not in self.positions:
                    continue
                    
                position_info = self.positions[ticket]
                current_profit = position.profit
                
                # Get current account balance
                account_info = mt5.account_info()
                if account_info is None:
                    continue
                    
                initial_balance = position_info['initial_balance']
                profit_percent = (current_profit / initial_balance) * 100
                
                # Close conditions:
                # 1. Profit > $1 AND profit >= 20% of initial balance
                should_close = (current_profit > 1.0 and profit_percent >= 20.0)
                
                if should_close:
                    # Close position
                    close_request = {
                        "action": mt5.TRADE_ACTION_DEAL,
                        "symbol": position.symbol,
                        "volume": position.volume,
                        "type": mt5.ORDER_TYPE_SELL if position.type == mt5.ORDER_TYPE_BUY else mt5.ORDER_TYPE_BUY,
                        "position": ticket,
                        "deviation": 20,
                        "magic": 123456,
                        "comment": "Auto_Close_Profit",
                        "type_time": mt5.ORDER_TIME_GTC,
                        "type_filling": mt5.ORDER_FILLING_IOC,
                    }
                    
                    result = mt5.order_send(close_request)
                    
                    if result.retcode == mt5.TRADE_RETCODE_DONE:
                        logging.info(f"Position {ticket} closed with profit: ${current_profit:.2f} ({profit_percent:.2f}%)")
                        del self.positions[ticket]
                    else:
                        logging.error(f"Failed to close position {ticket}, retcode={result.retcode}")
                else:
                    logging.debug(f"Position {ticket}: Profit=${current_profit:.2f} ({profit_percent:.2f}%) - Keeping open")
                    
        except Exception as e:
            logging.error(f"Error checking positions: {e}")
        finally:
            self.disconnect_mt5()
            
    def monitor_positions(self):
        """Monitor positions in a separate thread"""
        while self.running:
            try:
                self.check_and_close_positions()
                time.sleep(10)  # Check every 10 seconds
            except Exception as e:
                logging.error(f"Error in position monitoring: {e}")
                time.sleep(30)  # Wait longer on error
                
    def start_trading(self):
        """Start the trading bot"""
        logging.info("Starting MT5 Auto Trader...")
        
        # Test MT5 connection
        if not self.connect_mt5():
            logging.error("Failed to connect to MT5. Exiting.")
            return
        self.disconnect_mt5()
        
        self.running = True
        
        # Start position monitoring thread
        monitor_thread = threading.Thread(target=self.monitor_positions, daemon=True)
        monitor_thread.start()
        
        # Main trading loop
        while self.running:
            try:
                # Get signal from API
                signal = self.get_signal_from_api()
                
                if signal and signal.get('action') in ['BUY', 'SELL']:
                    # Check if signal contains "doji" and is STRONG
                    if (signal.get('strength') == 'STRONG' and 
                        signal.get('reason') and 
                        'doji' in signal.get('reason', '').lower()):
                        
                        logging.info(f"Processing STRONG Doji signal: {signal['action']}")
                        
                        # Place order
                        success = self.place_order(signal)
                        if success:
                            logging.info("Order placed successfully")
                        else:
                            logging.error("Failed to place order")
                    else:
                        logging.debug("Signal doesn't meet criteria (not STRONG or no Doji)")
                
                # Wait before next poll
                time.sleep(self.poll_interval)
                
            except KeyboardInterrupt:
                logging.info("Received interrupt signal. Stopping...")
                self.running = False
                break
            except Exception as e:
                logging.error(f"Unexpected error in main loop: {e}")
                time.sleep(30)  # Wait longer on error
                
        logging.info("MT5 Auto Trader stopped")
        
    def stop_trading(self):
        """Stop the trading bot"""
        self.running = False

if __name__ == "__main__":
    # Configuration
    API_URL = "https://dazzling-paprenjak-8aff02.netlify.app/api/trading-signals"  # Change to your deployed URL
    POLL_INTERVAL = 5  # seconds
    
    # Create and start trader
    trader = MT5AutoTrader(api_url=API_URL, poll_interval=POLL_INTERVAL)
    
    try:
        trader.start_trading()
    except KeyboardInterrupt:
        logging.info("Shutting down...")
        trader.stop_trading()