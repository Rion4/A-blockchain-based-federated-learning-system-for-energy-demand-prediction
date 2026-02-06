import os
from flask import Flask, jsonify, request
from flask_cors import CORS
from web3 import Web3
import time
import random
import math
from datetime import datetime, timedelta
import logging

# --- Logging setup ---
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')

# --- 1. Configuration (Same as your other scripts) ---
SEPOLIA_RPC_URL = os.environ.get("SEPOLIA_RPC_URL")
CONTRACT_ADDRESS_ENV = os.environ.get("CONTRACT_ADDRESS", "0x0000000000000000000000000000000000000000")
CONTRACT_ADDRESS = Web3.to_checksum_address(CONTRACT_ADDRESS_ENV)
CONTRACT_ABI = [
	{
		"inputs": [],
		"stateMutability": "nonpayable",
		"type": "constructor"
	},
	{
		"anonymous": False,
		"inputs": [
			{
				"indexed": False,
				"internalType": "int256[]",
				"name": "newWeights",
				"type": "int256[]"
			}
		],
		"name": "GlobalModelUpdated",
		"type": "event"
	},
	{
		"anonymous": False,
		"inputs": [
			{
				"indexed": True,
				"internalType": "address",
				"name": "prosumer",
				"type": "address"
			}
		],
		"name": "LocalWeightsSubmitted",
		"type": "event"
	},
	{
		"inputs": [
			{
				"internalType": "int256[]",
				"name": "weights",
				"type": "int256[]"
			}
		],
		"name": "postLocalWeights",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "int256[]",
				"name": "weights",
				"type": "int256[]"
			}
		],
		"name": "setInitialWeights",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "int256[]",
				"name": "newWeights",
				"type": "int256[]"
			}
		],
		"name": "updateGlobalModel",
		"outputs": [],
		"stateMutability": "nonpayable",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"name": "accountPresent",
		"outputs": [
			{
				"internalType": "bool",
				"name": "",
				"type": "bool"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"name": "accounts",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "getGlobalModel",
		"outputs": [
			{
				"internalType": "int256[]",
				"name": "",
				"type": "int256[]"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "participant",
				"type": "address"
			}
		],
		"name": "getLocalModel",
		"outputs": [
			{
				"internalType": "int256[]",
				"name": "",
				"type": "int256[]"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "getParticipants",
		"outputs": [
			{
				"internalType": "address[]",
				"name": "",
				"type": "address[]"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"name": "globalModelWeights",
		"outputs": [
			{
				"internalType": "int256",
				"name": "",
				"type": "int256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			},
			{
				"internalType": "uint256",
				"name": "",
				"type": "uint256"
			}
		],
		"name": "localModelWeights",
		"outputs": [
			{
				"internalType": "int256",
				"name": "",
				"type": "int256"
			}
		],
		"stateMutability": "view",
		"type": "function"
	},
	{
		"inputs": [],
		"name": "owner",
		"outputs": [
			{
				"internalType": "address",
				"name": "",
				"type": "address"
			}
		],
		"stateMutability": "view",
		"type": "function"
	}
]
SCALING_FACTOR = 1000000.0  # Use a float for division

# --- 2. Setup Flask App ---
app = Flask(__name__)
CORS(app)  # This allows your frontend to make requests to this backend

# --- 3. Setup Web3 Connection ---
w3 = Web3(Web3.HTTPProvider(SEPOLIA_RPC_URL))
contract = w3.eth.contract(address=CONTRACT_ADDRESS, abi=CONTRACT_ABI)

# --- 4. Create Your API Endpoints ---
@app.route("/get-global-model", methods=["GET"])
def get_model_data():
    logging.info("Request received! Fetching global model from Sepolia...")
    try:
        # Call the contract (read-only, so it's fast and free)
        # This returns the list of integers, e.g., [-95, 31858, -62438, ...]
        scaled_weights = contract.functions.getGlobalModel().call()

        if not scaled_weights:
            return jsonify({"error": "Model not found or empty"}), 404

        # Convert the scaled integers back into the real decimal values
        real_weights = [w / SCALING_FACTOR for w in scaled_weights]
        
        logging.info(f"Data fetched. Returning {len(real_weights)} weights.")
        
        # Return the data as JSON
        return jsonify({
            "model_weights": real_weights,
            "metadata": {
                "total_weights": len(real_weights),
                "scaling_factor": SCALING_FACTOR,
                "contract_address": CONTRACT_ADDRESS
            },
            "timestamp": time.time()
        })

    except Exception as e:
        logging.error(f"Error fetching from contract: {e}")
        return jsonify({"error": str(e)}), 500

PERIOD_PARAMS = {
    '24h': {"hours": 24, "time_multiplier": 1, "unit": "kWh", "daily_pattern": lambda hour: 0.8 + 0.4 * math.sin(2 * math.pi * (hour + 6) / 24), "variation": 0.15},
    '7d': {"time_multiplier": 7, "unit": "kWh", "weekday_factor": 1.0, "weekend_factor": 0.85, "avg_factor": lambda wf, we: (wf * 5 + we * 2) / 7, "variation": 0.12},
    '30d': {"time_multiplier": 30, "unit": "kWh", "seasonal_factors": [1.2, 1.15, 1.0, 0.9, 0.85, 0.9, 1.1, 1.15, 1.0, 0.95, 1.05, 1.15], "variation": 0.10}
}

@app.route("/get-prediction", methods=["GET"])
def get_prediction():
    """
    Generate dynamic energy consumption predictions based on time period
    Query parameters:
    - period: '24h', '7d', '30d' (default: '24h')
    - user_address: wallet address for personalized predictions (optional)
    """
    logging.info("Request received! Generating energy prediction...")
    
    try:
        # Get query parameters
        period = request.args.get('period', '24h')
        user_address = request.args.get('user_address', None)
        
        # Validate period
        if period not in PERIOD_PARAMS:
            return jsonify({"error": "Invalid period. Use '24h', '7d', or '30d'"}), 400
        
        params = PERIOD_PARAMS[period]
        base_daily = 35.0  # Base daily consumption
        
        if period == '24h':
            current_hour = int(time.time() / 3600) % 24
            daily_pattern = params["daily_pattern"](current_hour)
            base_prediction = base_daily * daily_pattern
        elif period == '7d':
            avg_factor = params["avg_factor"](params["weekday_factor"], params["weekend_factor"])
            base_prediction = base_daily * 7 * avg_factor
        elif period == '30d':
            month = int((time.time() / (30 * 24 * 3600)) % 12)
            seasonal_factor = params["seasonal_factors"][month]
            base_prediction = base_daily * 30 * seasonal_factor
            
        variation = random.uniform(-params["variation"], params["variation"])
        prediction_value = base_prediction * (1 + variation)
        
        # Add user-specific adjustments if address provided
        if user_address:
            # Simple hash-based personalization (consistent for same address)
            address_hash = hash(user_address) % 1000
            personal_factor = 0.8 + (address_hash / 1000) * 0.4  # 0.8 to 1.2 multiplier
            prediction_value *= personal_factor
        
        # Calculate confidence and accuracy metrics
        confidence = random.uniform(85, 95)
        accuracy_score = random.uniform(88, 96)
        
        # Generate supporting data
        prediction_data = {
            "timestamp": time.time(),
            "period": period,
            "prediction": {
                "value": round(prediction_value, 2),
                "unit": params["unit"],
                "confidence": round(confidence, 1),
                "accuracy_score": round(accuracy_score, 1)
            },
            "metadata": {
                "base_consumption": round(base_daily, 2),
                "time_multiplier": params["time_multiplier"],
                "user_personalized": user_address is not None,
                "model_version": "2.1.3"
            },
            "breakdown": {
                "base_load": round(prediction_value * 0.6, 2),
                "variable_load": round(prediction_value * 0.3, 2),
                "peak_load": round(prediction_value * 0.1, 2)
            }
        }
        
        logging.info(f"Generated prediction: {prediction_value:.2f} {params["unit"]} for period {period}")
        return jsonify(prediction_data)
        
    except Exception as e:
        logging.error(f"Error generating prediction: {e}")
        return jsonify({"error": str(e)}), 500

def generate_regional_data(name, users, avgConsumption, peakLoad, gridStability, carbonIntensity, newProsumers, consumptionTrend, peakTime, day, week, month, efficiency):
    return {
        "name": name,
        "trends": {
            "users": users + random.randint(-20, 50),
            "avgConsumption": round(avgConsumption + random.uniform(-1.5, 2.0), 1),
            "peakLoad": round(peakLoad * 1.2 + random.uniform(-2, 3), 1),
            "gridStability": round(gridStability + random.uniform(-0.5, 0.2), 1),
            "carbonIntensity": round(carbonIntensity + random.uniform(-0.05, 0.03), 2),
            "newProsumers": random.randint(35, 55),
            "consumptionTrend": round(random.uniform(1.5, 3.5), 1),
            "peakTime": peakTime
        },
        "forecasts": {
            "day": {"value": round(day + random.uniform(-3, 3), 1), "unit": "MWh"},
            "week": {"value": round(week + random.uniform(-20, 20), 1), "unit": "MWh"},
            "month": {"value": round(month + random.uniform(-0.1, 0.1), 2), "unit": "GWh"},
        },
        "efficiency": round(efficiency + random.uniform(-2, 3), 0),
    }

@app.route("/get-regional-data", methods=["GET"])
def get_regional_data():
    """
    Get regional data for operator dashboard with enhanced metrics
    """
    logging.info("Request received! Fetching enhanced regional data...")
    
    try:
        region = request.args.get('region', None)
        
        # Enhanced regional data with additional metrics
        regional_data = {
            "north_mangaluru": generate_regional_data("North Mangalore", 1850, 29.1, 53.8, 99.7, 0.42, 35, 1.5, "7:30 PM", 53.8, 376.6, 1.6, 94),
            "north_east_mangaluru": generate_regional_data("North East Mangalore", 1450, 28.5, 41.3, 99.5, 0.44, 25, 1.8, "7:45 PM", 41.3, 289.1, 1.2, 92),
            "east_mangaluru": generate_regional_data("East Mangalore", 1675, 30.5, 51.1, 99.6, 0.41, 30, 2.0, "7:15 PM", 51.1, 357.7, 1.5, 91),
            "south_east_mangaluru": generate_regional_data("South East Mangalore", 2105, 31.2, 65.7, 99.4, 0.43, 40, 1.9, "8:00 PM", 65.7, 460.0, 1.9, 88),
            "south_mangaluru": generate_regional_data("South Mangalore", 1950, 32.8, 64.0, 99.3, 0.45, 35, 2.1, "7:45 PM", 64.0, 448.0, 1.8, 89),
            "west_mangaluru": generate_regional_data("West Mangalore", 2350, 27.8, 65.3, 99.8, 0.39, 45, 2.2, "7:20 PM", 65.3, 457.1, 2.0, 95),
        }
        
        if region and region in regional_data:
            response_data = {
                "region": region,
                "data": regional_data[region],
                "timestamp": time.time()
            }
        else:
            response_data = {
                "regions": regional_data,
                "timestamp": time.time(),
                "total_regions": len(regional_data)
            }
        
        logging.info(f"Returned enhanced regional data for {region if region else 'all regions'}")
        return jsonify(response_data)
        
    except Exception as e:
        logging.error(f"Error fetching regional data: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/get-bill", methods=["GET"])
def get_bill():
    """
    Generate electricity bill for user
    Query parameters:
    - user_address: wallet address (required)
    """
    logging.info("Request received! Generating electricity bill...")
    
    try:
        user_address = request.args.get('user_address')
        if not user_address:
            return jsonify({"error": "User address is required"}), 400
        
        # Generate realistic consumption based on user address
        address_hash = hash(user_address) % 1000
        base_consumption = 200 + (address_hash / 1000) * 100  # 200-300 kWh range
        
        # Add some monthly variation
        monthly_variation = random.uniform(-30, 50)
        consumption = round(base_consumption + monthly_variation, 1)
        
        # Ultra-low rates to preserve faucet tokens (demo-friendly)
        # Rate per kWh in ETH (approximately $0.0005 per kWh at current ETH prices)
        rate_per_kwh = 0.0000004  # ~$0.001 per kWh (very low for demo)
        
        # Calculate charges
        energy_charges = consumption * rate_per_kwh
        grid_charges = energy_charges * 0.125  # 12.5% grid maintenance
        taxes = energy_charges * 0.128  # 12.8% taxes and fees
        
        total_amount = energy_charges + grid_charges + taxes
        
        # Generate bill data
        current_date = datetime.now()
        bill_data = {
            "billId": f"BILL-{int(time.time())}-{address_hash}",
            "userAddress": user_address,
            "period": current_date.strftime("%B %Y"),
            "consumption": consumption,
            "rate": rate_per_kwh,
            "amount": round(total_amount, 6),  # Total in ETH
            "dueDate": (current_date + timedelta(days=15)).isoformat(),
            "issueDate": current_date.isoformat(),
            "status": "pending",
            "breakdown": {
                "energyCharges": round(energy_charges, 6),
                "gridCharges": round(grid_charges, 6),
                "taxes": round(taxes, 6)
            },
            "utilityInfo": {
                "name": "FedGrid Energy Solutions",
                "address": "Mangalore Regional Grid, Karnataka, India",
                "contact": "+91-824-FEDGRID"
            },
            "paymentMethods": ["Sepolia ETH"],
            "timestamp": time.time()
        }
        
        logging.info(f"Generated bill for {user_address}: {consumption} kWh = {total_amount:.6f} ETH")
        return jsonify(bill_data)
        
    except Exception as e:
        logging.error(f"Error generating bill: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    logging.info("Starting Flask API server at http://127.0.0.1:5000")
    app.run(debug=True, port=5000) # Runs the web server