#!/usr/bin/env python3
"""
Launcher script for Gemini Batch Watermark Remover.
Starts the FastAPI application and automatically opens your browser.
"""

import sys
import time
import webbrowser
import uvicorn
from threading import Thread

def open_browser(url: str, delay: float = 1.2):
    time.sleep(delay)
    try:
        webbrowser.open(url)
    except Exception:
        pass

if __name__ == "__main__":
    host = "127.0.0.1"
    port = 8000
    url = f"http://{host}:{port}"

    print("=" * 65)
    print("  GEMINI BATCH WATERMARK REMOVER (ZERO QUALITY LOSS)")
    print("=" * 65)
    print(f"  Starting local server at: {url}")
    print("  Mathematical Alpha Unblending Engine loaded.")
    print("  Press Ctrl+C to stop the server.")
    print("=" * 65)

    # Launch browser after a short delay
    Thread(target=open_browser, args=(url,), daemon=True).start()

    # Run FastAPI via Uvicorn
    uvicorn.run(
        "backend.app.main:app",
        host=host,
        port=port,
        reload=False,
        log_level="info"
    )
