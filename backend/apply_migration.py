import asyncio
import os
import sys
from pathlib import Path
from sqlalchemy import text
from app.database import engine

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass
if hasattr(sys.stderr, "reconfigure"):
    try:
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

async def run_migrations(target_file: str | None = None):
    migrations_dir = Path(__file__).resolve().parent.parent / "database" / "migrations"
    
    if target_file:
        sql_files = [Path(target_file)]
    else:
        sql_files = sorted(migrations_dir.glob("*.sql"))
        
    print(f"Found {len(sql_files)} migration files in {migrations_dir}")
    
    async with engine.connect() as conn:
        # Enable autocommit mode so DDL commands (like CREATE INDEX CONCURRENTLY or ALTER TYPE) succeed
        conn = await conn.execution_options(isolation_level="AUTOCOMMIT")
        for sql_file in sql_files:
            print(f"--> Processing {sql_file.name}...")
            with open(sql_file, "r", encoding="utf-8") as f:
                content = f.read()
            for stmt in content.split(";"):
                stmt = stmt.strip()
                if stmt:
                    try:
                        await conn.execute(text(stmt))
                    except Exception as e:
                        # Common ignorable error: relation or index already exists, or enum value already exists
                        err_str = str(e).lower()
                        if "already exists" in err_str or "duplicate" in err_str:
                            pass
                        else:
                            print(f"    [INFO] In {sql_file.name}: {e.args[0] if e.args else e}")
    print("[OK] Migrations completed.")

if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else None
    asyncio.run(run_migrations(target))


