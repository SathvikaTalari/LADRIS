FROM python:3.12-slim

WORKDIR /app

# Install system dependencies (for psycopg2, asyncpg native builds, etc.)
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Run a stable application process. Source changes are applied with
# `docker compose restart backend`; filesystem watchers can fail on Windows
# bind mounts and must not terminate production inference.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
