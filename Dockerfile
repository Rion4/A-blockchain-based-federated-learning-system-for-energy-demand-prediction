FROM python:3.9-slim-buster AS builder

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Install Node.js and npm
RUN apt-get update && apt-get install -y --no-install-recommends \
    nodejs \
    npm \
    && rm -rf /var/lib/apt/lists/*

# Copy frontend source code
COPY . .

# Install frontend dependencies
RUN npm install

# Build the frontend
RUN npm run build


FROM python:3.9-slim-buster

WORKDIR /app

# Copy Python dependencies
COPY --from=builder /usr/local/lib/python3.9/site-packages /usr/local/lib/python3.9/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copy backend source code
COPY . .

# Copy frontend build artifacts
COPY --from=builder /app/dist /app/public

# Expose the Flask port
EXPOSE 5000

# Set environment variables for Flask
ENV FLASK_APP=api.py
ENV FLASK_RUN_HOST=0.0.0.0

# Start the Flask API server
CMD ["flask", "run"]