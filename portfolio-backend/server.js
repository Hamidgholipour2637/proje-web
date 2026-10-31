require("dotenv").config();
if (!process.env.SESSION_SECRET) {
    throw new Error("SESSION_SECRET در فایل .env تنظیم نشده است.");
}

const rateLimit = require("express-rate-limit");
const express = require("express");
const path = require("path");
const helmet = require("helmet");
const session = require("express-session");
const PgSession = require("connect-pg-simple")(session);
const bcrypt = require("bcrypt");
const pool = require("./db");
const { csrfSync } = require("csrf-sync");
const app = express();
app.set("trust proxy", 1);
const generalApiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "تعداد درخواست‌ها بیش از حد مجاز است. کمی بعد دوباره تلاش کنید."
    }
});

app.use("/api", generalApiLimiter);

app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'"],
                imgSrc: ["'self'", "data:"],
                connectSrc: ["'self'"],
                fontSrc: ["'self'", "data:"],
                objectSrc: ["'none'"],
                baseUri: ["'self'"],
                formAction: ["'self'"],
                frameAncestors: ["'none'"]
            }
        }
    })
);
const PORT = process.env.PORT || 3000;

// خواندن اطلاعات فرم‌ها
app.use(express.urlencoded({
    extended: false,
    limit: "10kb",
    parameterLimit: 20
}));

app.use(express.json({
    limit: "10kb"
}));

// مدیریت نشست کاربر

const isProduction = process.env.NODE_ENV === "production";

const sessionCookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 1000
};

app.use(
    session({
        store: new PgSession({
            pool: pool,
            tableName: "session",
            createTableIfMissing: true
        }),
        name: "connect.sid",
        secret: process.env.SESSION_SECRET,
        resave: false,
        saveUninitialized: false,
        cookie: sessionCookieOptions
    })
);


const {
    csrfSynchronisedProtection,
    generateToken
} = csrfSync({
    getTokenFromRequest: (req) => req.headers["x-csrf-token"]
});

// دریافت توکن برای فرانت‌اند
app.get("/api/csrf-token", (req, res) => {
    res.set("Cache-Control", "no-store");
    res.json({
        csrfToken: generateToken(req)
    });
});


// فایل‌های سایت
app.use(express.static(path.join(__dirname, "..")));
app.use((req, res, next) => {
    if (req.path.startsWith("/portfolio_images/")) {
        console.log("درخواست تصویر:", req.path);
    }
    next();
});
// بررسی فعال بودن API
app.get("/api/test", (req, res) => {
    res.json({
        success: true,
        message: "API is working!"
    });
});

// بررسی اتصال دیتابیس
if (process.env.NODE_ENV !== "production") {
    app.get("/api/db-test", async (req, res) => {
        try {
            const result = await pool.query("SELECT NOW()");

            return res.json({
                success: true,
                time: result.rows[0].now
            });
        } catch (error) {
            console.error("Database health check failed:", error.message);

            return res.status(500).json({
                success: false,
                message: "Database check failed"
            });
        }
    });
}

const contactLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "Too many messages. Please try again in 15 minutes"
    }
});

// ثبت پیام فرم تماس
app.post(
    "/api/contact",
    contactLimiter,
    csrfSynchronisedProtection,
    async (req, res) => {
	const name =
    typeof req.body.name === "string"
        ? req.body.name.trim()
        : "";

const email =
    typeof req.body.email === "string"
        ? req.body.email.trim()
        : "";

const message =
    typeof req.body.message === "string"
        ? req.body.message.trim()
        : "";

if (
    typeof name !== "string" ||
    typeof email !== "string" ||
    typeof message !== "string" ||
    !name.trim() ||
    !email.trim() ||
    !message.trim()
) {
    return res.status(400).json({
        success: false,
        message: "Please fill in all fields correctly"
    });
}
	
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

if (!emailPattern.test(email.trim())) {
    return res.status(400).json({
        success: false,
        message: "Please enter a valid email address"
    });
}


if (name.trim().length > 100 ||
    email.trim().length > 150 ||
    message.trim().length > 5000) {
    return res.status(400).json({
        success: false,
        message: "One or more fields exceed the allowed length"
    });
}

    try {
        await pool.query(
            `INSERT INTO messages (name, email, message)
             VALUES ($1, $2, $3)`,
            [name, email, message]
        );

        res.json({
            success: true,
            message: "Your message has been sent successfully"
        });
    } catch (error) {
        console.error("Contact form error:", error.message);

        res.status(500).json({
            success: false,
            message: "Failed to send your message"
        });
    }
});

// محافظت از مسیرهای پنل مدیریت
function requireAdmin(req, res, next) {
    if (req.session && req.session.isAdmin === true) {
        return next();
    }

    return res.status(401).json({
        success: false,
        message: "ابتدا باید وارد پنل مدیریت شوید."
    });
}

const adminLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        message: "تلاش‌های ورود بیش از حد مجاز است. ۱۵ دقیقه دیگر دوباره تلاش کنید."
    }
});

// ورود مدیر
app.post(
    "/api/admin/login",
    adminLoginLimiter,
    csrfSynchronisedProtection,
    async (req, res) => {
  
const password = req.body.password;

if (
    typeof password !== "string" ||
    password.length === 0 ||
    password.length > 128 ||
    !process.env.ADMIN_PASSWORD_HASH
) {
    return res.status(400).json({
        success: false,
        message: "رمز عبور یا تنظیمات ورود معتبر نیست."
    });
}

    try {
        const isValid = await bcrypt.compare(
            password,
            process.env.ADMIN_PASSWORD_HASH
        );

        if (!isValid) {
            return res.status(401).json({
                success: false,
                message: "رمز عبور اشتباه است."
            });
        }

        req.session.regenerate((error) => {
            if (error) {
                console.error("Session error:", error.message);

                return res.status(500).json({
                    success: false,
                    message: "ورود انجام نشد."
                });
            }

            req.session.isAdmin = true;

            req.session.save((saveError) => {
                if (saveError) {
                    console.error("Session save error:", saveError.message);

                    return res.status(500).json({
                        success: false,
                        message: "ورود انجام نشد."
                    });
                }

                res.json({
                    success: true,
                    message: "ورود موفقیت‌آمیز بود."
                });
            });
        });
    } catch (error) {
        console.error("Login error:", error.message);

        res.status(500).json({
            success: false,
            message: "خطای داخلی سرور."
        });
    }
});

app.use("/api/admin", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
});

// بررسی وضعیت ورود
app.get("/api/admin/status", (req, res) => {
	
	res.set("Cache-Control", "no-store");
	
    res.json({
        loggedIn: req.session?.isAdmin === true
    });
});

// خروج مدیر
app.post(
    "/api/admin/logout",
    csrfSynchronisedProtection,
    (req, res) => {
    if (!req.session) {
        return res.json({
            success: true,
            message: "خارج شدید."
        });
    }

    req.session.destroy((error) => {
        if (error) {
            return res.status(500).json({
                success: false,
                message: "خروج انجام نشد."
            });
        }

        res.clearCookie("connect.sid", {
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/"
});

        res.json({
            success: true,
            message: "با موفقیت خارج شدید."
        });
    });
});

 // دریافت پیام‌های تماس، فقط برای مدیر واردشده
app.get("/api/admin/messages", requireAdmin, async (req, res) => {
	res.set("Cache-Control", "no-store");
	
    try {
        const result = await pool.query(
            `SELECT
                id,
                name,
                email,
                message,
                created_at,
                is_read
             FROM messages
             ORDER BY created_at DESC`
        );

        return res.json({
            success: true,
            messages: result.rows
        });
    } catch (error) {
        console.error("Messages error:", error.message);

        return res.status(500).json({
            success: false,
            message: "دریافت پیام‌ها انجام نشد."
        });
    }
});


// علامت‌گذاری پیام به‌عنوان خوانده‌شده، فقط برای مدیر واردشده
app.patch(
    "/api/admin/messages/:id/read",
    csrfSynchronisedProtection,
    requireAdmin,
    async (req, res) => {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: "شناسه پیام معتبر نیست."
            });
        }

        try {
            const result = await pool.query(
                `UPDATE messages
                 SET is_read = TRUE
                 WHERE id = $1
                 RETURNING id, is_read`,
                [id]
            );

            if (result.rowCount === 0) {
                return res.status(404).json({
                    success: false,
                    message: "پیام پیدا نشد."
                });
            }

            return res.json({
                success: true,
                message: "پیام به‌عنوان خوانده‌شده علامت‌گذاری شد.",
                data: result.rows[0]
            });
        } catch (error) {
            console.error("Mark as read error:", error.message);

            return res.status(500).json({
                success: false,
                message: "تغییر وضعیت پیام انجام نشد."
            });
        }
    }
);


// حذف پیام، فقط برای مدیر واردشده
app.delete(
    "/api/admin/messages/:id",
    csrfSynchronisedProtection,
    requireAdmin,
    async (req, res) => {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) {
        return res.status(400).json({
            success: false,
            message: "شناسه پیام معتبر نیست."
        });
    }

    try {
        const result = await pool.query(
            `DELETE FROM messages
             WHERE id = $1
             RETURNING id`,
            [id]
        );

        if (result.rowCount === 0) {
            return res.status(404).json({
                success: false,
                message: "پیام پیدا نشد."
            });
        }

        return res.json({
            success: true,
            message: "پیام حذف شد."
        });
    } catch (error) {
        console.error("Delete message error:", error.message);

        return res.status(500).json({
            success: false,
            message: "حذف پیام انجام نشد."
        });
    }
});


/* مدیریت پروژه‌ها */

// دریافت فهرست پروژه‌ها برای نمایش در سایت
app.get("/api/projects", async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT id, title, description, image_url,
                    project_url, technologies, display_order
             FROM projects
             ORDER BY display_order ASC, created_at DESC`
        );

        res.set("Cache-Control", "no-store");

        return res.json({
            success: true,
            projects: result.rows
        });
    } catch (error) {
        console.error("Get projects error:", error.message);

        return res.status(500).json({
            success: false,
            message: "دریافت پروژه‌ها انجام نشد."
        });
    }
});

// افزودن پروژه جدید، فقط برای مدیر واردشده
app.post(
    "/api/admin/projects",
    csrfSynchronisedProtection,
    requireAdmin,
    async (req, res) => {
        const {
            title,
            description,
            image_url,
            project_url,
            technologies,
            display_order
        } = req.body;

        if (
            typeof title !== "string" ||
            !title.trim() ||
            title.trim().length > 200 ||
            typeof description !== "string" ||
            !description.trim() ||
            description.trim().length > 10000
        ) {
            return res.status(400).json({
                success: false,
                message: "عنوان یا توضیحات پروژه معتبر نیست."
            });
        }

        const optionalText = (value, maxLength) =>
            value === undefined || value === null || value === ""
                ? null
                : typeof value === "string" &&
                  value.trim().length <= maxLength
                    ? value.trim()
                    : undefined;

        const imageUrl = optionalText(image_url, 500);
        const projectUrl = optionalText(project_url, 500);
        const technologiesText = optionalText(technologies, 2000);

        if (
            imageUrl === undefined ||
            projectUrl === undefined ||
            technologiesText === undefined
        ) {
            return res.status(400).json({
                success: false,
                message: "اطلاعات اختیاری پروژه معتبر نیست."
            });
        }

        const order = display_order === undefined
            ? 0
            : Number(display_order);

        if (
            !Number.isInteger(order) ||
            order < 0 ||
            order > 100000
        ) {
            return res.status(400).json({
                success: false,
                message: "ترتیب نمایش معتبر نیست."
            });
        }

        for (const url of [imageUrl, projectUrl]) {
            if (url !== null) {
                try {
                    const parsed = new URL(url);
                    if (!["http:", "https:"].includes(parsed.protocol)) {
                        throw new Error("Invalid protocol");
                    }
                } catch {
                    return res.status(400).json({
                        success: false,
                        message: "آدرس تصویر یا پروژه معتبر نیست."
                    });
                }
            }
        }

        try {
            const result = await pool.query(
                `INSERT INTO projects
                    (title, description, image_url, project_url,
                     technologies, display_order)
                 VALUES ($1, $2, $3, $4, $5, $6)
                 RETURNING *`,
                [
                    title.trim(),
                    description.trim(),
                    imageUrl,
                    projectUrl,
                    technologiesText,
                    order
                ]
            );

            return res.status(201).json({
                success: true,
                message: "پروژه با موفقیت اضافه شد.",
                project: result.rows[0]
            });
        } catch (error) {
            console.error("Create project error:", error.message);

            return res.status(500).json({
                success: false,
                message: "افزودن پروژه انجام نشد."
            });
        }
    }
);

/* ویرایش پروژه، فقط برای مدیر واردشده */
app.put(
    "/api/admin/projects/:id",
    csrfSynchronisedProtection,
    requireAdmin,
    async (req, res) => {
        const id = Number(req.params.id);

        if (!Number.isSafeInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: "شناسه پروژه معتبر نیست."
            });
        }

        const {
            title,
            description,
            image_url,
            project_url,
            technologies,
            display_order
        } = req.body;

        if (
            typeof title !== "string" ||
            !title.trim() ||
            title.trim().length > 200 ||
            typeof description !== "string" ||
            !description.trim() ||
            description.trim().length > 10000
        ) {
            return res.status(400).json({
                success: false,
                message: "عنوان یا توضیحات پروژه معتبر نیست."
            });
        }

        const optionalText = (value, maxLength) =>
            value === undefined || value === null || value === ""
                ? null
                : typeof value === "string" &&
                  value.trim().length <= maxLength
                    ? value.trim()
                    : undefined;

        const imageUrl = optionalText(image_url, 500);
        const projectUrl = optionalText(project_url, 500);
        const technologiesText = optionalText(technologies, 2000);
        const order = Number(display_order);

        if (
            imageUrl === undefined ||
            projectUrl === undefined ||
            technologiesText === undefined ||
            !Number.isInteger(order) ||
            order < 0 ||
            order > 100000
        ) {
            return res.status(400).json({
                success: false,
                message: "اطلاعات پروژه معتبر نیست."
            });
        }

        for (const url of [imageUrl, projectUrl]) {
            if (url !== null) {
                try {
                    const parsed = new URL(url);

                    if (!["http:", "https:"].includes(parsed.protocol)) {
                        throw new Error("Invalid protocol");
                    }
                } catch {
                    return res.status(400).json({
                        success: false,
                        message: "آدرس تصویر یا پروژه معتبر نیست."
                    });
                }
            }
        }

        try {
            const result = await pool.query(
                `UPDATE projects
                 SET title = $1,
                     description = $2,
                     image_url = $3,
                     project_url = $4,
                     technologies = $5,
                     display_order = $6
                 WHERE id = $7
                 RETURNING id, title, description, image_url,
                           project_url, technologies, display_order,
                           created_at`,
                [
                    title.trim(),
                    description.trim(),
                    imageUrl,
                    projectUrl,
                    technologiesText,
                    order,
                    id
                ]
            );

            if (result.rowCount === 0) {
                return res.status(404).json({
                    success: false,
                    message: "پروژه پیدا نشد."
                });
            }

            return res.json({
                success: true,
                message: "پروژه با موفقیت ویرایش شد.",
                project: result.rows[0]
            });
        } catch (error) {
            console.error("Update project error:", error.message);

            return res.status(500).json({
                success: false,
                message: "ویرایش پروژه انجام نشد."
            });
        }
    }
);

/* حذف پروژه، فقط برای مدیر واردشده */
app.delete(
    "/api/admin/projects/:id",
    csrfSynchronisedProtection,
    requireAdmin,
    async (req, res) => {
        const id = Number(req.params.id);

        if (!Number.isSafeInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: "شناسه پروژه معتبر نیست."
            });
        }

        try {
            const result = await pool.query(
                "DELETE FROM projects WHERE id = $1 RETURNING id",
                [id]
            );

            if (result.rowCount === 0) {
                return res.status(404).json({
                    success: false,
                    message: "پروژه پیدا نشد."
                });
            }

            return res.json({
                success: true,
                message: "پروژه با موفقیت حذف شد."
            });
        } catch (error) {
            console.error("Delete project error:", error.message);

            return res.status(500).json({
                success: false,
                message: "حذف پروژه انجام نشد."
            });
        }
    }
);


/* =========================
   API مدیریت مهارت‌ها
========================= */

// دریافت مهارت‌ها برای نمایش در سایت
app.get("/api/skills", async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, title, icon_url, percentage, display_order
            FROM skills
            ORDER BY display_order ASC, id ASC
        `);

        res.json({
            success: true,
            skills: result.rows
        });
    } catch (error) {
        console.error("Get skills error:", error);

        res.status(500).json({
            success: false,
            message: "دریافت مهارت‌ها ناموفق بود."
        });
    }
});


// افزودن مهارت جدید
app.post(
    "/api/admin/skills",
    csrfSynchronisedProtection,
    requireAdmin,
    async (req, res) => {
        try {
            const {
                title,
                icon_url = "",
                percentage,
                display_order = 0
            } = req.body;

            const name = typeof title === "string"
                ? title.trim()
                : "";

            const icon = typeof icon_url === "string"
                ? icon_url.trim()
                : "";

            const percent = Number(percentage);
            const order = Number(display_order);

            if (
                !name ||
                name.length > 100 ||
                icon.length > 500 ||
                !Number.isInteger(percent) ||
                percent < 0 ||
                percent > 100 ||
                !Number.isInteger(order) ||
                order < 0 ||
                order > 100000
            ) {
                return res.status(400).json({
                    success: false,
                    message: "اطلاعات مهارت معتبر نیست."
                });
            }

            const result = await pool.query(
                `INSERT INTO skills
                    (title, icon_url, percentage, display_order)
                 VALUES ($1, $2, $3, $4)
                 RETURNING id, title, icon_url, percentage, display_order`,
                [name, icon, percent, order]
            );

            res.status(201).json({
                success: true,
                message: "مهارت با موفقیت اضافه شد.",
                skill: result.rows[0]
            });
        } catch (error) {
            console.error("Add skill error:", error);

            res.status(500).json({
                success: false,
                message: "افزودن مهارت ناموفق بود."
            });
        }
    }
);


// ویرایش مهارت
app.put(
    "/api/admin/skills/:id",
    csrfSynchronisedProtection,
    requireAdmin,
    async (req, res) => {
        try {
            const id = Number(req.params.id);
            const {
                title,
                icon_url = "",
                percentage,
                display_order = 0
            } = req.body;

            const name = typeof title === "string"
                ? title.trim()
                : "";

            const icon = typeof icon_url === "string"
                ? icon_url.trim()
                : "";

            const percent = Number(percentage);
            const order = Number(display_order);

            if (
                !Number.isInteger(id) ||
                id < 1 ||
                !name ||
                name.length > 100 ||
                icon.length > 500 ||
                !Number.isInteger(percent) ||
                percent < 0 ||
                percent > 100 ||
                !Number.isInteger(order) ||
                order < 0 ||
                order > 100000
            ) {
                return res.status(400).json({
                    success: false,
                    message: "اطلاعات مهارت معتبر نیست."
                });
            }

            const result = await pool.query(
                `UPDATE skills
                 SET title = $1,
                     icon_url = $2,
                     percentage = $3,
                     display_order = $4
                 WHERE id = $5
                 RETURNING id, title, icon_url, percentage, display_order`,
                [name, icon, percent, order, id]
            );

            if (result.rowCount === 0) {
                return res.status(404).json({
                    success: false,
                    message: "مهارت موردنظر پیدا نشد."
                });
            }

            res.json({
                success: true,
                message: "مهارت با موفقیت ویرایش شد.",
                skill: result.rows[0]
            });
        } catch (error) {
            console.error("Update skill error:", error);

            res.status(500).json({
                success: false,
                message: "ویرایش مهارت ناموفق بود."
            });
        }
    }
);


// حذف مهارت
app.delete(
    "/api/admin/skills/:id",
    csrfSynchronisedProtection,
    requireAdmin,
    async (req, res) => {
        try {
            const id = Number(req.params.id);

            if (!Number.isInteger(id) || id < 1) {
                return res.status(400).json({
                    success: false,
                    message: "شناسه مهارت معتبر نیست."
                });
            }

            const result = await pool.query(
                "DELETE FROM skills WHERE id = $1",
                [id]
            );

            if (result.rowCount === 0) {
                return res.status(404).json({
                    success: false,
                    message: "مهارت موردنظر پیدا نشد."
                });
            }

            res.json({
                success: true,
                message: "مهارت با موفقیت حذف شد."
            });
        } catch (error) {
            console.error("Delete skill error:", error);

            res.status(500).json({
                success: false,
                message: "حذف مهارت ناموفق بود."
            });
        }
    }
);

// نمونه مسیر محافظت‌شده برای پنل
app.get("/api/admin/check", requireAdmin, (req, res) => {
    res.json({
        success: true,
        message: "دسترسی مدیر تأیید شد."
    });
});


/* =========================
   بخش درباره من
========================= */

// دریافت اطلاعات درباره من برای سایت
app.get("/api/about", async (req, res, next) => {
    try {
        const result = await pool.query(`
            SELECT title, description, updated_at
            FROM about
            WHERE id = 1
        `);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "اطلاعات درباره من ثبت نشده است."
            });
        }

        res.set("Cache-Control", "no-store");

        return res.json({
            success: true,
            about: result.rows[0]
        });
    } catch (error) {
        next(error);
    }
});






/* مدیریت خدمات */

// دریافت خدمات فعال برای صفحه اصلی
app.get("/api/services", async (req, res) => {
    res.set("Cache-Control", "no-store");

    try {
        const result = await pool.query(`
            SELECT id, title, description, icon, link, display_order
            FROM services
            WHERE is_active = TRUE
            ORDER BY display_order ASC, id ASC
        `);

        return res.json({
            success: true,
            services: result.rows
        });
    } catch (error) {
        console.error("Get services error:", error.message);

        return res.status(500).json({
            success: false,
            message: "دریافت خدمات انجام نشد."
        });
    }
});

// دریافت تمام خدمات برای مدیر
app.get("/api/admin/services", requireAdmin, async (req, res) => {
    res.set("Cache-Control", "no-store");

    try {
        const result = await pool.query(`
            SELECT id, title, description, icon, link,
                   display_order, is_active, created_at, updated_at
            FROM services
            ORDER BY display_order ASC, id ASC
        `);

        return res.json({
            success: true,
            services: result.rows
        });
    } catch (error) {
        console.error("Admin get services error:", error.message);

        return res.status(500).json({
            success: false,
            message: "دریافت خدمات انجام نشد."
        });
    }
});

function validateService(body) {
    const { title, description, icon, link, display_order } = body;

    if (
        typeof title !== "string" ||
        !title.trim() ||
        title.trim().length > 200 ||
        typeof description !== "string" ||
        !description.trim() ||
        description.trim().length > 1000 ||
        typeof icon !== "string" ||
        !icon.trim() ||
        icon.trim().length > 500 ||
        typeof link !== "string" ||
        !link.trim() ||
        link.trim().length > 500
    ) {
        return "عنوان، توضیحات، آیکون یا لینک معتبر نیست.";
    }

    const order = Number(display_order);

    if (
        !Number.isInteger(order) ||
        order < 0 ||
        order > 100000
    ) {
        return "ترتیب نمایش معتبر نیست.";
    }

    // مسیر نسبی سایت یا آدرس HTTP/HTTPS مجاز است.
    for (const value of [icon.trim(), link.trim()]) {
        if (
            value.startsWith("/") &&
            !value.startsWith("//") &&
            !value.startsWith("/\\")
        ) {
            continue;
        }

        if (
            !value.startsWith("/") &&
            !/^[a-zA-Z][a-zA-Z\d+.-]*:/.test(value)
        ) {
            continue;
        }

        try {
            const url = new URL(value, "http://localhost");

            if (
                !["http:", "https:"].includes(url.protocol) ||
                value.startsWith("//") ||
                value.startsWith("/\\")
            ) {
                return "آدرس آیکون یا لینک معتبر نیست.";
            }
        } catch {
            return "آدرس آیکون یا لینک معتبر نیست.";
        }
    }

    return null;
}

// افزودن خدمت
app.post(
    "/api/admin/services",
    csrfSynchronisedProtection,
    requireAdmin,
    async (req, res) => {
        const validationError = validateService(req.body);

        if (validationError) {
            return res.status(400).json({
                success: false,
                message: validationError
            });
        }

        const {
            title, description, icon, link, display_order
        } = req.body;

        try {
            const result = await pool.query(`
                INSERT INTO services
                    (title, description, icon, link, display_order)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *
            `, [
                title.trim(),
                description.trim(),
                icon.trim(),
                link.trim(),
                Number(display_order)
            ]);

            return res.status(201).json({
                success: true,
                message: "خدمت اضافه شد.",
                service: result.rows[0]
            });
        } catch (error) {
            console.error("Create service error:", error.message);

            return res.status(500).json({
                success: false,
                message: "افزودن خدمت انجام نشد."
            });
        }
    }
);

// ویرایش خدمت
app.put(
    "/api/admin/services/:id",
    csrfSynchronisedProtection,
    requireAdmin,
    async (req, res) => {
        const id = Number(req.params.id);
        const validationError = validateService(req.body);
        const { title, description, icon, link, display_order, is_active } =
            req.body;

        if (!Number.isSafeInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: "شناسه خدمت معتبر نیست."
            });
        }

        if (
            validationError ||
            typeof is_active !== "boolean"
        ) {
            return res.status(400).json({
                success: false,
                message: validationError || "وضعیت خدمت معتبر نیست."
            });
        }

        try {
            const result = await pool.query(`
                UPDATE services
                SET title = $1,
                    description = $2,
                    icon = $3,
                    link = $4,
                    display_order = $5,
                    is_active = $6,
                    updated_at = NOW()
                WHERE id = $7
                RETURNING *
            `, [
                title.trim(),
                description.trim(),
                icon.trim(),
                link.trim(),
                Number(display_order),
                is_active,
                id
            ]);

            if (result.rowCount === 0) {
                return res.status(404).json({
                    success: false,
                    message: "خدمت پیدا نشد."
                });
            }

            return res.json({
                success: true,
                message: "خدمت ویرایش شد.",
                service: result.rows[0]
            });
        } catch (error) {
            console.error("Update service error:", error.message);

            return res.status(500).json({
                success: false,
                message: "ویرایش خدمت انجام نشد."
            });
        }
    }
);

// حذف خدمت
app.delete(
    "/api/admin/services/:id",
    csrfSynchronisedProtection,
    requireAdmin,
    async (req, res) => {
        const id = Number(req.params.id);

        if (!Number.isSafeInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: "شناسه خدمت معتبر نیست."
            });
        }

        try {
            const result = await pool.query(
                "DELETE FROM services WHERE id = $1 RETURNING id",
                [id]
            );

            if (result.rowCount === 0) {
                return res.status(404).json({
                    success: false,
                    message: "خدمت پیدا نشد."
                });
            }

            return res.json({
                success: true,
                message: "خدمت حذف شد."
            });
        } catch (error) {
            console.error("Delete service error:", error.message);

            return res.status(500).json({
                success: false,
                message: "حذف خدمت انجام نشد."
            });
        }
    }
);

// صفحه اصلی سایت
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "index.html"));
});

// مدیریت خطاهای CSRF

app.use((err, req, res, next) => {
    if (res.headersSent) {
        return next(err);
    }

    if (err.code === "EBADCSRFTOKEN") {
        return res.status(403).json({
            success: false,
            message: "درخواست رد شد؛ توکن امنیتی نامعتبر است. صفحه را تازه‌سازی کنید."
        });
    }

    if (err.type === "entity.too.large") {
        return res.status(413).json({
            success: false,
            message: "حجم اطلاعات ارسالی بیش از حد مجاز است."
        });
    }

    if (err.type === "entity.parse.failed") {
        return res.status(400).json({
            success: false,
            message: "ساختار اطلاعات ارسالی معتبر نیست."
        });
    }

    console.error("Server error:", err);

    return res.status(500).json({
        success: false,
        message: "خطای داخلی سرور."
    });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
