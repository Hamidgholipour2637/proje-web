const pool = require("./db");

async function initDb() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS public.projects (
                id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                title VARCHAR(200) NOT NULL,
                description TEXT NOT NULL,
                image_url VARCHAR(500),
                project_url VARCHAR(500),
                technologies TEXT,
                display_order INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE TABLE IF NOT EXISTS public.skills (
                id SERIAL PRIMARY KEY,
                title VARCHAR(100) NOT NULL,
                icon_url VARCHAR(500) NOT NULL DEFAULT '',
                percentage INTEGER NOT NULL DEFAULT 0
                    CHECK (percentage >= 0 AND percentage <= 100),
                display_order INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS public.services (
                id SERIAL PRIMARY KEY,
                title VARCHAR(200) NOT NULL,
                description VARCHAR(1000) NOT NULL,
                icon VARCHAR(500) NOT NULL,
                link VARCHAR(500) NOT NULL,
                display_order INTEGER NOT NULL DEFAULT 0,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );

            CREATE INDEX IF NOT EXISTS idx_services_display_order
            ON public.services (display_order, id);

            CREATE TABLE IF NOT EXISTS public.messages (
                id INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                name VARCHAR(100) NOT NULL,
                email VARCHAR(150) NOT NULL,
                message TEXT NOT NULL,
                created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                is_read BOOLEAN NOT NULL DEFAULT FALSE
            );
        `);

        console.log("ساختار جدول‌های دیتابیس بررسی شد.");
    } catch (error) {
        console.error("خطای آماده‌سازی دیتابیس:", error.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

initDb();
