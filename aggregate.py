import os
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
import numpy as np
from web3 import Web3
from eth_account import Account
import time

# --- CONFIGURATION ---
SEPOLIA_RPC_URL_ENV = os.environ.get("SEPOLIA_RPC_URL")
if not SEPOLIA_RPC_URL_ENV:
    raise ValueError("SEPOLIA_RPC_URL environment variable not set.")
SEPOLIA_RPC_URL = SEPOLIA_RPC_URL_ENV

CONTRACT_ADDRESS_ENV = os.environ.get("CONTRACT_ADDRESS")
if not CONTRACT_ADDRESS_ENV:
    raise ValueError("CONTRACT_ADDRESS environment variable not set.")
CONTRACT_ADDRESS = CONTRACT_ADDRESS_ENV

OWNER_PRIVATE_KEY = os.environ.get("OWNER_PRIVATE_KEY")
if not OWNER_PRIVATE_KEY:
    raise ValueError("OWNER_PRIVATE_KEY environment variable not set.")

# Contract ABI (minimal - just what we need for aggregation)
CONTRACT_ABI = [
    {
        "inputs": [],
        "name": "getParticipants",
        "outputs": [{"internalType": "address[]", "name": "", "type": "address[]"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "address", "name": "participant", "type": "address"}],
        "name": "getLocalModel",
        "outputs": [{"internalType": "int256[]", "name": "", "type": "int256[]"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "getGlobalModel",
        "outputs": [{"internalType": "int256[]", "name": "", "type": "int256[]"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "int256[]", "name": "newWeights", "type": "int256[]"}],
        "name": "updateGlobalModel",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
]

def main():
    logging.info(" Federated Learning Aggregation")
    print("=" * 40)
    
    # Connect to Sepolia
    logging.info("Connecting to Sepolia testnet...")
    w3 = Web3(Web3.HTTPProvider(SEPOLIA_RPC_URL))
    if not w3.is_connected():
        logging.info(" Connection failed.")
        return

    # Load owner account
    try:
        owner_account = Account.from_key(OWNER_PRIVATE_KEY)
        logging.info(f" Connected as Owner: {owner_account.address}")
    except Exception as e:
        logging.error(f" Error loading private key: {e}")
        return

    # Connect to contract
    contract = w3.eth.contract(address=w3.to_checksum_address(CONTRACT_ADDRESS), abi=CONTRACT_ABI)
    logging.info(f" Connected to contract: {CONTRACT_ADDRESS}")

    try:
        # --- STEP 1: Fetch Current State ---
        logging.info(f"\n STEP 1: Fetching Current State")
        print("-" * 30)
        
        # Get current global model
        current_global = contract.functions.getGlobalModel().call()
        logging.info(f" Current Global Model: {len(current_global)} weights")
        logging.info(f"   First 3 weights: {current_global[:3]}")
        
        # Get all participants
        participants = contract.functions.getParticipants().call()
        logging.info(f" Participants: {len(participants)}")
        
        if len(participants) == 0:
            logging.info(" No participants found! Run submit_weights.py first.")
            return
            
        for i, addr in enumerate(participants):
            logging.info(f"   {i+1}. {addr}")

        # --- STEP 2: Fetch Local Models ---
        logging.info(f"\n STEP 2: Fetching Local Models")
        print("-" * 30)
        
        all_local_weights = []
        for i, addr in enumerate(participants):
            try:
                local_weights = contract.functions.getLocalModel(addr).call()
                all_local_weights.append(local_weights)
                logging.info(f" Prosumer {i+1}: {len(local_weights)} weights")
                logging.info(f"   First 3: {local_weights[:3]}")
            except Exception as e:
                logging.error(f" Error fetching weights for {addr}: {e}")
                return

        # --- STEP 3: Federated Averaging ---
        logging.info(f"\n STEP 3: Federated Averaging")
        print("-" * 30)
        
        # Convert to numpy for easy averaging
        weights_array = np.array(all_local_weights, dtype=np.int64)
        logging.info(f" Shape: {weights_array.shape} (participants x weights)")
        
        # Calculate federated average
        averaged_weights = np.mean(weights_array, axis=0)
        new_global_weights = averaged_weights.astype(np.int64).tolist()
        
        logging.info(f" Averaging complete!")
        logging.info(f" New global weights (first 3): {new_global_weights[:3]}")
        
        # Show the difference
        old_avg = np.mean(current_global)
        new_avg = np.mean(new_global_weights)
        logging.info(f" Average change: {old_avg:.0f} → {new_avg:.0f}")

        # --- STEP 4: Update Global Model ---
        logging.info(f"\n STEP 4: Updating Global Model")
        print("-" * 30)
        
        # Check balance
        balance = w3.eth.get_balance(owner_account.address)
        balance_eth = w3.from_wei(balance, 'ether')
        logging.info(f" Owner balance: {balance_eth:.6f} ETH")
        
        if balance_eth < 0.001:
            logging.info(" Insufficient balance for transaction!")
            return
        
        # Build transaction
        nonce = w3.eth.get_transaction_count(owner_account.address)
        gas_price = w3.eth.gas_price
        
        logging.info(f"🔧 Building transaction...")
        transaction = contract.functions.updateGlobalModel(
            new_global_weights
        ).build_transaction({
            'chainId': 11155111,  # Sepolia
            'from': owner_account.address,
            'nonce': nonce,
            'gas': 500000,
            'gasPrice': gas_price,
        })

        # Sign and send
        signed_txn = owner_account.sign_transaction(transaction)
        tx_hash = w3.eth.send_raw_transaction(signed_txn.raw_transaction)
        
        logging.info(f" Transaction sent: {tx_hash.hex()}")
        logging.info(" Waiting for confirmation...")
        
        tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        
        if tx_receipt.status == 1:
            logging.info(f" SUCCESS! Global model updated!")
            logging.info(f" Block: {tx_receipt.blockNumber}")
            logging.info(f" Gas used: {tx_receipt.gasUsed:,}")
            logging.info(f" Etherscan: https://sepolia.etherscan.io/tx/{tx_hash.hex()}")
            
            # Verify the update
            logging.info(f"\n VERIFICATION")
            print("-" * 15)
            updated_global = contract.functions.getGlobalModel().call()
            logging.info(f" Updated global model: {len(updated_global)} weights")
            logging.info(f"   First 3: {updated_global[:3]}")
            
            if updated_global == new_global_weights:
                logging.info("Verification successful - models match!")
            else:
                logging.info("  Warning: Models don't match exactly")
                
        else:
            logging.info(" Transaction failed!")

    except Exception as e:
        logging.error(f" Error: {e}")
        return

    logging.info(f"\n FEDERATED LEARNING ROUND COMPLETE!")
    print("=" * 40)
    logging.info(" Local models aggregated")
    logging.info(" Global model updated on blockchain") 
    logging.info(" Ready for next round of training")
if __name__ == "__main__":
    main()