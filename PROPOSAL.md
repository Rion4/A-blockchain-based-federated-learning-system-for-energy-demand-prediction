## Proposal

This PR addresses the following issues:

- **C1: Missing Dockerfile:** A Dockerfile is essential for containerizing the application, ensuring consistent deployments across different environments.
- **C2: Use of `print()` instead of `logging`:** The `print()` statements in `aggregate.py` and `api.py` should be replaced with proper logging for better debugging and monitoring.
