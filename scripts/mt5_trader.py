import MetaTrader5 as mt5
import requests # For making HTTP requests
import json
import time
import os

# These divisors are specific to the user's request for BTCUSD and EURUSDT
BTCUSDT_DIVISOR = 218
EURUSDT_DIVISOR = 55

# URL of your Next.js API endpoint
# For local development: "http://localhost:3000/api/signals"
# For deployed Vercel app: "https://your-app-name.vercel.app/api/signals"
NEXTJS_API_URL = os.getenv("NEXTJS_API_URL", "https://dazzling-paprenjak-8aff02.netlify.app/api/signals")

# Polling interval in seconds
POLLING_INTERVAL_SECONDS = 5

# To keep track of the last processed signal's timestamp to avoid duplicate orders
last_processed_signal_timestamp = 0

def connect_mt5():
    """Initializes MT5 connection to the running terminal."""
    if not mt5.initialize():
        print("MT5 initialize() failed, error code =", mt5.last_error())
        return False

    # Check if an account is already logged in
    account_info = mt5.account_info()
    if account_info is None:
        print("No MT5 account is currently logged in or connection failed after initialize(). Error code =", mt5.last_error())
        mt5.shutdown()
        return False
    
    print(f"Connected to MT5 terminal. Account: {account_info.login}, Server: {account_info.server}")
    return True

def disconnect_mt5():
    """Shuts down MT5 connection."""
    mt5.shutdown()
    print("Disconnected from MT5.")

def calculate_lot_size(symbol_name, current_balance):
    """
    Calculates lot size based on the user's specific formula, using the current account balance.
    """
    lot_size = 0.01 # Default fallback lot size

    # Use current_balance as the 'volume' in the user's formula
    if symbol_name == "BTCUSDT":
        lot_size = (0.4 * current_balance) / BTCUSDT_DIVISOR
    elif symbol_name == "EURUSDT":
        lot_size = (0.4 * current_balance) / EURUSDT_DIVISOR
    else:
        print(f"Warning: No specific volume formula for {symbol_name}. Using a default lot size of {lot_size}.")
    
    # Get symbol info to ensure valid lot size (min, max, step)
    symbol_info = mt5.symbol_info(symbol_name)
    if symbol_info is None:
        print(f"Error: Could not get symbol info for {symbol_name}. Using default lot size.")
        return lot_size

    min_volume = symbol_info.volume_min
    max_volume = symbol_info.volume_max
    volume_step = symbol_info.volume_step

    # Adjust lot_size to be a multiple of volume_step and within min/max
    lot_size = round(lot_size / volume_step) * volume_step
    lot_size = max(min_volume, min(lot_size, max_volume))
    
    return round(lot_size, 2) # Round to 2 decimal places for common lot sizes

def process_signal(signal_data):
    """Processes a single trading signal and places an order in MT5."""
    global last_processed_signal_timestamp

    action = signal_data.get('action')
    symbol_name = signal_data.get('symbol', {}).get('symbol') # Access symbol.symbol
    entry_price = signal_data.get('entry_price')
    stop_loss = signal_data.get('stop_loss')
    take_profit = signal_data.get('take_profit')
    signal_timestamp = signal_data.get('timestamp', 0)

    if signal_timestamp <= last_processed_signal_timestamp:
        # print(f"Signal {signal_timestamp} already processed or too old. Skipping.") # Removed this log
        return False

    if not all([action, symbol_name, entry_price, stop_loss, take_profit]):
        print("Missing required signal data. Skipping order placement.")
        return False

    if not connect_mt5():
        print("Failed to connect to MT5. Cannot place order.")
        return False

    try:
        # Get current account balance
        account_info = mt5.account_info()
        if account_info is None:
            print(f"Failed to get account info, error code: {mt5.last_error()}")
            return False
        print(f"Current account balance: {account_info.balance}")

        # Select the symbol in MT5
        selected = mt5.symbol_select(symbol_name, True)
        if not selected:
            print(f"Failed to select {symbol_name}, error code: {mt5.last_error()}")
            return False

        # Get current price for order placement (might be slightly different from signal entry_price)
        symbol_info_tick = mt5.symbol_info_tick(symbol_name)
        if symbol_info_tick is None:
            print(f"Failed to get tick info for {symbol_name}, error code: {mt5.last_error()}")
            return False

        current_bid = symbol_info_tick.bid
        current_ask = symbol_info_tick.ask

        # Calculate lot size using current balance
        lot = calculate_lot_size(symbol_name, account_info.balance)
        if lot <= 0:
            print("Calculated lot size is invalid or too small. Skipping order placement.")
            return False

        # Prepare the trade request
        request_dict = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": symbol_name,
            "volume": lot,
            "type": mt5.ORDER_TYPE_BUY if action == "BUY" else mt5.ORDER_TYPE_SELL,
            "price": current_ask if action == "BUY" else current_bid, # Use ask for buy, bid for sell
            "sl": stop_loss,
            "tp": take_profit,
            "deviation": 20, # Max price deviation in points from the requested price
            "magic": 20230803, # Unique ID for your trades (can be any integer)
            "comment": "v0_AI_Signal",
            "type_time": mt5.ORDER_TIME_GTC, # Good Till Cancelled
            "type_filling": mt5.ORDER_FILLING_FOC, # Fill Or Kill
        }

        print(f"Placing order with request: {request_dict}")
        result = mt5.order_send(request_dict)

        if result.retcode != mt5.TRADE_RETCODE_DONE:
            print(f"Order send failed, retcode={result.retcode}")
            result_dict = result._asdict()
            for field in result_dict:
                if field == 'request':
                    traderequest_dict = result_dict[field]._asdict()
                    for tradereq_field in traderequest_dict:
                        print(f"\t{tradereq_field}: {traderequest_dict[tradereq_field]}")
                else:
                    print(f"\t{field}: {result_dict[field]}")
            return False
        else:
            print(f"Order placed successfully: {result.order}, position={result.deal}")
            last_processed_signal_timestamp = signal_timestamp # Update timestamp on successful order
            return True

    except Exception as e:
        print(f"An error occurred during order placement: {e}")
        return False
    finally:
        disconnect_mt5()

def fetch_and_process_signal():
    """Fetches the latest signal from the Next.js API and processes it."""
    try:
        response = requests.get(NEXTJS_API_URL)
        response.raise_for_status() # Raise an exception for HTTP errors (4xx or 5xx)
        data = response.json()

        if data and 'signal' in data and data['signal'] is not None:
            signal = data['signal']
            # print(f"Fetched signal from API: {json.dumps(signal, indent=2)}") # Removed this log
            process_signal(signal)
        # else: # Removed this else block
            # print("No new signal available from API.") # Removed this log
    except requests.exceptions.RequestException as e:
        print(f"Error fetching signal from API: {e}")
    except json.JSONDecodeError:
        print("Error decoding JSON response from API.")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")

if __name__ == '__main__':
    print(f"Starting MT5 Trader (polling from {NEXTJS_API_URL})...")
    print("Ensure MT5 terminal is running and logged in with 'Allow Algo Trading' enabled.")

    # Initial connection check
    if not connect_mt5():
        print("Initial MT5 connection failed. Exiting.")
        exit()
    disconnect_mt5() # Disconnect after initial check

    while True:
        fetch_and_process_signal()
        time.sleep(POLLING_INTERVAL_SECONDS)
