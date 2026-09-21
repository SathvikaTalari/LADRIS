"""Check and run migration 014 for live sync tables."""
import asyncio
import asyncpg
import pathlib

SQL_PATH = pathlib.Path(__file__).parent.parent / "database" / "migrations" / "014_live_sync.sql"

async def main():
    conn = None
    for port in [15432, 5432]:
        try:
            conn = await asyncpg.connect(
                host="localhost", port=port,
                database="ladris", user="ladris_user", password="landpulse_pass"
            )
            print(f"Connected on port {port}")
            break
        except Exception as e:
            print(f"Port {port} failed: {e}")

    if conn is None:
        print("ERROR: Could not connect to database")
        return

    try:
        # Check if tables already exist
        existing = await conn.fetchval(
            "SELECT COUNT(*) FROM pg_tables "
            "WHERE schemaname = 'public' AND tablename IN ('live_sync_jobs', 'project_change_log')"
        )
        print(f"Tables already present: {existing}/2")

        if existing < 2:
            sql = SQL_PATH.read_text(encoding="utf-8")
            await conn.execute(sql)
            print("Migration 014_live_sync.sql applied successfully")
        else:
            print("Tables already exist — skipping migration")

        # Verify
        rows = await conn.fetch(
            "SELECT tablename FROM pg_tables "
            "WHERE schemaname = 'public' AND tablename IN ('live_sync_jobs', 'project_change_log')"
        )
        for r in rows:
            print(f"  ✅ Table verified: {r['tablename']}")

        # Check indexes
        idx_rows = await conn.fetch(
            "SELECT indexname FROM pg_indexes "
            "WHERE schemaname = 'public' AND tablename IN ('live_sync_jobs', 'project_change_log')"
        )
        for r in idx_rows:
            print(f"  ✅ Index: {r['indexname']}")

    except Exception as e:
        print(f"Migration error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        await conn.close()

asyncio.run(main())
