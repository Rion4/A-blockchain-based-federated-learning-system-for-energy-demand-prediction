import json
import os
import numpy as np
from web3 import Web3
from eth_account import Account
import time

# --- CONFIGURATION ---
SEPOLIA_RPC_URL = "https://eth-sepolia.g.alchemy.com/v2/4XOe07lHUIlGXcd2xroEw"
CONTRACT_ADDRESS = "0x8eaa1ceea2629d42765cbf9032981cef419a2a39"

# Owner's private key (must be the contract owner to call updateGlobalModel)
OWNER_PRIVATE_KEY = "0x70e6397afcf08eca3a9ba76d77e4f3a755f977adc7e697c7660101bcc7a0bc25"

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
    print(" Federated Learning Aggregation")
    print("=" * 40)
    
    # Connect to Sepolia
    print("Connecting to Sepolia testnet...")
    w3 = Web3(Web3.HTTPProvider(SEPOLIA_RPC_URL))
    if not w3.is_connected():
        print(" Connection failed.")
        return

    # Load owner account
    try:
        owner_account = Account.from_key(OWNER_PRIVATE_KEY)
        print(f" Connected as Owner: {owner_account.address}")
    except Exception as e:
        print(f" Error loading private key: {e}")
        return

    # Connect to contract
    contract = w3.eth.contract(address=w3.to_checksum_address(CONTRACT_ADDRESS), abi=CONTRACT_ABI)
    print(f" Connected to contract: {CONTRACT_ADDRESS}")

    try:
        # --- STEP 1: Fetch Current State ---
        print(f"\n STEP 1: Fetching Current State")
        print("-" * 30)
        
        # Get current global model
        current_global = contract.functions.getGlobalModel().call()
        print(f" Current Global Model: {len(current_global)} weights")
        print(f"   First 3 weights: {current_global[:3]}")
        
        # Get all participants
        participants = contract.functions.getParticipants().call()
        print(f" Participants: {len(participants)}")
        
        if len(participants) == 0:
            print(" No participants found! Run submit_weights.py first.")
            return
            
        for i, addr in enumerate(participants):
            print(f"   {i+1}. {addr}")

        # --- STEP 2: Fetch Local Models ---
        print(f"\n STEP 2: Fetching Local Models")
        print("-" * 30)
        
        all_local_weights = []
        for i, addr in enumerate(participants):
            try:
                local_weights = contract.functions.getLocalModel(addr).call()
                all_local_weights.append(local_weights)
                print(f" Prosumer {i+1}: {len(local_weights)} weights")
                print(f"   First 3: {local_weights[:3]}")
            except Exception as e:
                print(f" Error fetching weights for {addr}: {e}")
                return

        # --- STEP 3: Federated Averaging ---
        print(f"\n STEP 3: Federated Averaging")
        print("-" * 30)
        
        # Convert to numpy for easy averaging
        weights_array = np.array(all_local_weights, dtype=np.int64)
        print(f" Shape: {weights_array.shape} (participants x weights)")
        
        # Calculate federated average
        averaged_weights = np.mean(weights_array, axis=0)
        new_global_weights = averaged_weights.astype(np.int64).tolist()
        
        print(f" Averaging complete!")
        print(f" New global weights (first 3): {new_global_weights[:3]}")
        
        # Show the difference
        old_avg = np.mean(current_global)
        new_avg = np.mean(new_global_weights)
        print(f" Average change: {old_avg:.0f} → {new_avg:.0f}")

        # --- STEP 4: Update Global Model ---
        print(f"\n STEP 4: Updating Global Model")
        print("-" * 30)
        
        # Check balance
        balance = w3.eth.get_balance(owner_account.address)
        balance_eth = w3.from_wei(balance, 'ether')
        print(f" Owner balance: {balance_eth:.6f} ETH")
        
        if balance_eth < 0.001:
            print(" Insufficient balance for transaction!")
            return
        
        # Build transaction
        nonce = w3.eth.get_transaction_count(owner_account.address)
        gas_price = w3.eth.gas_price
        
        print(f"🔧 Building transaction...")
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
        
        print(f" Transaction sent: {tx_hash.hex()}")
        print(" Waiting for confirmation...")
        
        tx_receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        
        if tx_receipt.status == 1:
            print(f" SUCCESS! Global model updated!")
            print(f" Block: {tx_receipt.blockNumber}")
            print(f" Gas used: {tx_receipt.gasUsed:,}")
            print(f" Etherscan: https://sepolia.etherscan.io/tx/{tx_hash.hex()}")
            
            # Verify the update
            print(f"\n VERIFICATION")
            print("-" * 15)
            updated_global = contract.functions.getGlobalModel().call()
            print(f" Updated global model: {len(updated_global)} weights")
            print(f"   First 3: {updated_global[:3]}")
            
            if updated_global == new_global_weights:
                print("Verification successful - models match!")
            else:
                print("  Warning: Models don't match exactly")
                
        else:
            print(" Transaction failed!")

    except Exception as e:
        print(f" Error: {e}")
        return

    print(f"\n FEDERATED LEARNING ROUND COMPLETE!")
    print("=" * 40)
    print(" Local models aggregated")
    print(" Global model updated on blockchain") 
    print(" Ready for next round of training")
if __name__ == "__main__":
    main()