import uvicorn
import sys
import os
from pathlib import Path

if __name__ == "__main__":
    # Add the backend directory to sys.path
    # This allows 'app' to be imported when running from the root or backend folder
    current_dir = Path(__file__).resolve().parent
    # If running from scripts/, go up one level to backend/
    backend_dir = current_dir.parent if current_dir.name == "scripts" else current_dir

    if str(backend_dir) not in sys.path:
        sys.path.insert(0, str(backend_dir))

    # Ensure the reloader subprocess can also find 'app'
    os.environ["PYTHONPATH"] = str(backend_dir) + os.pathsep + os.environ.get("PYTHONPATH", "")

    # Auto-configure SQLite if DATABASE_URL is missing or default
    if "DATABASE_URL" not in os.environ:
        sqlite_path = backend_dir / "westernpumps.db"
        if not sqlite_path.exists():
            dev_path = backend_dir / "devdata" / "westernpumps.db"
            if dev_path.exists():
                sqlite_path = dev_path
        
        db_url = f"sqlite:///{sqlite_path.resolve().as_posix()}"
        print(f"Startup: Forcing database URL to local SQLite: {db_url}")
        os.environ["DATABASE_URL"] = db_url

    print(f"Starting WesternPumps Backend from {backend_dir}")
    print("Access API at http://127.0.0.1:8000")
    
    # Run Uvicorn
    try:
        uvicorn.run("app.main:app", host="127.0.0.1", port=8000, reload=True, reload_dirs=[str(backend_dir)])
    except KeyboardInterrupt:
        pass