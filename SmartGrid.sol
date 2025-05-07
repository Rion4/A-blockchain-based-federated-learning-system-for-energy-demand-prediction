// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract FederatedLearning {
    int256[] public globalModelWeights; // Stores the global model weights
    mapping(address => int256[]) public localModelWeights; // Maps edge nodes to their local weights
    address[] public accounts; // List of participating edge nodes
    mapping(address => bool) public accountPresent; // Tracks if an edge node has participated

    // Event to log updates to the global model
    event GlobalModelUpdated(int256[] newWeights);

    // Function to initialize the global model weights
    function setInitialWeights(int256[] memory weights) public {
        require(
            globalModelWeights.length == 0,
            "Global model already initialized"
        );
        globalModelWeights = weights;
    }

    // Retrieve the initial global model weights
    function getInitialWeights() public view returns (int256[] memory) {
        return globalModelWeights;
    }

    // Edge nodes to post their local model weights
    function postLocalWeights(int256[] memory weights) public {
        if (!accountPresent[msg.sender]) {
            accounts.push(msg.sender);
            accountPresent[msg.sender] = true;
        }
        // Store the local weights for the sender
        localModelWeights[msg.sender] = weights;
    }

    // Update the global model by averaging local weights
    function updateGlobalModel() public {
        require(
            accounts.length > 0,
            "No participants to update the global model"
        );

        uint256 numParticipants = accounts.length;
        uint256 numWeights = globalModelWeights.length;

        // Initialize aggregated weights array
        int256[] memory aggregatedWeights = new int256[](numWeights);
        for (uint256 j = 0; j < numWeights; j++) {
            aggregatedWeights[j] = 0;
        }
        // Aggregate weights from all participants
        for (uint256 i = 0; i < numParticipants; i++) {
            address participant = accounts[i];
            int256[] memory participantWeights = localModelWeights[participant];

            for (uint256 j = 0; j < numWeights; j++) {
                aggregatedWeights[j] += participantWeights[j];
            }
        }

        // Compute the average for each weight
        for (uint256 j = 0; j < numWeights; j++) {
            aggregatedWeights[j] /= int256(numParticipants);
        }

        // Update the global model weights
        globalModelWeights = aggregatedWeights;

        // Emit an event to log the update
        emit GlobalModelUpdated(aggregatedWeights);
    }

    // Edge nodes to retrieve the latest global model weights
    function getGlobalModel() public view returns (int256[] memory) {
        return globalModelWeights;
    }

    // Edge nodes to retrieve their local model weights
    function getLocalModel(
        address participant
    ) public view returns (int256[] memory) {
        require(accountPresent[participant], "Participant not found");
        return localModelWeights[participant];
    }
}
