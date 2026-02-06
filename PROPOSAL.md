## Proposal

This PR addresses the following issues:

- **C1: Missing Dockerfile:** The repository lacks a Dockerfile, making it difficult to containerize and deploy the application. A Dockerfile will be added to simplify deployment.
- **C2: Untracked data:** The repository contains untracked csv and npz data files. These files should be tracked by git lfs, or removed if they are not needed for the application.
