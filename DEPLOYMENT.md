# Deployment Guide

Detailed instructions for deploying the Cost Estimator application using Docker Compose.

## Prerequisites
- **Docker** and **Docker Compose** installed on the target machine (VPS or Local).

## Configuration
The project is pre-configured with `docker-compose.yml` to handle:
- **Client**: Next.js (Port 3000)
- **Server**: Express + SQLite (Port 3001)
- **OCR Service**: Python FastAPI (Port 8000)

**Persistence**:
- SQLite database is persisted in `./server/database.sqlite` (mapped to container).
- Uploads are persisted in `./server/uploads`.

## How to Deploy

1.  **Stop existing services** (if running via npm):
    ```bash
    # Kill any node processes
    taskkill /F /IM node.exe
    ```

2.  **Build and Start with Docker**:
    Open a terminal in the project root (`cost-estimator-v2`) and run:
    ```bash
    docker-compose up --build -d
    ```
    *(The `-d` flag runs it in the background)*.

3.  **Access the Application**:
    - **Frontend**: `http://localhost:3000` (or your server IP)
    - **Backend API**: `http://localhost:3001`

4.  **Stopping the Deployment**:
    ```bash
    docker-compose down
    ```

## Troubleshooting
- **Database Reset?**: We added volume mapping so your data *should* persist.
- **Login Error?**: Check server logs: `docker-compose logs -f server`
