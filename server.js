"use strict";

require("dotenv").config();

const express = require("express");
const path = require("path");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const multer = require("multer");
const { GoogleGenAI } = require("@google/genai");

const app = express();

const PORT = Number(process.env.PORT || 3000);

app.set("trust proxy", 1);

/* =========================================================
   GEMINI
========================================================= */

if (!process.env.GEMINI_API_KEY) {
    console.error(
        "ERROR: GEMINI_API_KEY غير موجود في متغيرات البيئة."
    );
    process.exit(1);
}

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

const GEMINI_MODEL =
    process.env.GEMINI_MODEL ||
    "gemini-2.5-flash";

/* =========================================================
   DATABASE
========================================================= */

const db = new Database(
    path.join(__dirname, "physics-ai.db")
);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL DEFAULT 'محادثة جديدة',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        image TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (conversation_id)
        REFERENCES conversations(id)
        ON DELETE CASCADE
    );
`);

/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(
    express.json({
        limit: "15mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "15mb"
    })
);

app.use(
    session({
        secret:
            process.env.SESSION_SECRET ||
            "physics-ai-session-secret-change-this",

        resave: false,
        saveUninitialized: false,

        cookie: {
            httpOnly: true,
            sameSite: "lax",

            secure:
                process.env.NODE_ENV === "production",

            maxAge:
                1000 *
                60 *
                60 *
                24 *
                30
        }
    })
);

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);

/* =========================================================
   UPLOADS
========================================================= */

const imageUpload = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize:
            10 * 1024 * 1024
    },

    fileFilter(req, file, cb) {
        if (
            file.mimetype &&
            file.mimetype.startsWith("image/")
        ) {
            return cb(null, true);
        }

        cb(
            new Error(
                "يسمح برفع الصور فقط."
            )
        );
    }
});

const audioUpload = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize:
            25 * 1024 * 1024
    },

    fileFilter(req, file, cb) {
        const mime = String(
            file.mimetype || ""
        )
            .toLowerCase()
            .split(";")[0];

        if (
            mime.startsWith("audio/")
        ) {
            return cb(null, true);
        }

        cb(
            new Error(
                "نوع الملف الصوتي غير مدعوم."
            )
        );
    }
});

/* =========================================================
   AUTH
========================================================= */

function requireLogin(req, res, next) {
    if (!req.session.userId) {
        return res.status(401).json({
            error:
                "لازم تسجل دخول الأول."
        });
    }

    next();
}

/* =========================================================
   HOME
========================================================= */

app.get("/", (req, res) => {
    res.sendFile(
        path.join(
            __dirname,
            "public",
            "index.html"
        )
    );
});

/* =========================================================
   REGISTER
========================================================= */

app.post(
    "/api/auth/register",
    async (req, res) => {
        try {
            const name = String(
                req.body.name || ""
            )
                .trim()
                .slice(0, 80);

            const email = String(
                req.body.email || ""
            )
                .trim()
                .toLowerCase()
                .slice(0, 160);

            const password = String(
                req.body.password || ""
            );

            if (!name) {
                return res.status(400).json({
                    error: "اكتب اسمك."
                });
            }

            if (!email || !email.includes("@")) {
                return res.status(400).json({
                    error:
                        "اكتب بريد إلكتروني صحيح."
                });
            }

            if (password.length < 6) {
                return res.status(400).json({
                    error:
                        "كلمة السر لازم تكون 6 أحرف على الأقل."
                });
            }

            const existing =
                db.prepare(`
                    SELECT id
                    FROM users
                    WHERE email = ?
                `).get(email);

            if (existing) {
                return res.status(409).json({
                    error:
                        "البريد الإلكتروني مستخدم بالفعل."
                });
            }

            const hashed =
                await bcrypt.hash(
                    password,
                    12
                );

            const result =
                db.prepare(`
                    INSERT INTO users
                    (name, email, password)
                    VALUES (?, ?, ?)
                `).run(
                    name,
                    email,
                    hashed
                );

            req.session.userId =
                Number(
                    result.lastInsertRowid
                );

            req.session.userName =
                name;

            res.json({
                success: true,
                user: {
                    id:
                        Number(
                            result.lastInsertRowid
                        ),
                    name,
                    email
                }
            });

        } catch (error) {
            console.error(
                "REGISTER ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "حصل خطأ أثناء إنشاء الحساب."
            });
        }
    }
);

/* =========================================================
   LOGIN
========================================================= */

app.post(
    "/api/auth/login",
    async (req, res) => {
        try {
            const email = String(
                req.body.email || ""
            )
                .trim()
                .toLowerCase();

            const password = String(
                req.body.password || ""
            );

            if (!email || !password) {
                return res.status(400).json({
                    error:
                        "اكتب البريد الإلكتروني وكلمة السر."
                });
            }

            const user =
                db.prepare(`
                    SELECT *
                    FROM users
                    WHERE email = ?
                `).get(email);

            if (!user) {
                return res.status(401).json({
                    error:
                        "البريد الإلكتروني أو كلمة السر غير صحيحة."
                });
            }

            const valid =
                await bcrypt.compare(
                    password,
                    user.password
                );

            if (!valid) {
                return res.status(401).json({
                    error:
                        "البريد الإلكتروني أو كلمة السر غير صحيحة."
                });
            }

            req.session.userId =
                user.id;

            req.session.userName =
                user.name;

            res.json({
                success: true,
                user: {
                    id: user.id,
                    name: user.name,
                    email: user.email
                }
            });

        } catch (error) {
            console.error(
                "LOGIN ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "حصل خطأ أثناء تسجيل الدخول."
            });
        }
    }
);

/* =========================================================
   LOGOUT
========================================================= */

app.post(
    "/api/auth/logout",
    (req, res) => {
        req.session.destroy(
            (error) => {
                if (error) {
                    return res.status(500).json({
                        error:
                            "تعذر تسجيل الخروج."
                    });
                }

                res.clearCookie(
                    "connect.sid"
                );

                res.json({
                    success: true
                });
            }
        );
    }
);

/* =========================================================
   CURRENT USER
========================================================= */

app.get(
    "/api/auth/me",
    (req, res) => {
        if (!req.session.userId) {
            return res.json({
                loggedIn: false
            });
        }

        const user =
            db.prepare(`
                SELECT
                    id,
                    name,
                    email
                FROM users
                WHERE id = ?
            `).get(
                req.session.userId
            );

        if (!user) {
            req.session.destroy(
                () => {}
            );

            return res.json({
                loggedIn: false
            });
        }

        res.json({
            loggedIn: true,
            user
        });
    }
);

/* =========================================================
   CREATE CONVERSATION
========================================================= */

app.post(
    "/api/conversations",
    requireLogin,
    (req, res) => {
        try {
            const title =
                String(
                    req.body.title ||
                    "محادثة جديدة"
                )
                    .trim()
                    .slice(0, 120);

            const result =
                db.prepare(`
                    INSERT INTO conversations
                    (user_id, title)
                    VALUES (?, ?)
                `).run(
                    req.session.userId,
                    title ||
                        "محادثة جديدة"
                );

            res.json({
                success: true,
                conversation: {
                    id:
                        Number(
                            result.lastInsertRowid
                        ),
                    title:
                        title ||
                        "محادثة جديدة"
                }
            });

        } catch (error) {
            console.error(
                "CREATE CONVERSATION ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "تعذر إنشاء المحادثة."
            });
        }
    }
);

/* =========================================================
   GET CONVERSATIONS
========================================================= */

app.get(
    "/api/conversations",
    requireLogin,
    (req, res) => {
        try {
            const conversations =
                db.prepare(`
                    SELECT
                        id,
                        title,
                        created_at,
                        updated_at
                    FROM conversations
                    WHERE user_id = ?
                    ORDER BY updated_at DESC
                `).all(
                    req.session.userId
                );

            res.json({
                conversations
            });

        } catch (error) {
            console.error(
                "GET CONVERSATIONS ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "تعذر تحميل المحادثات."
            });
        }
    }
);

/* =========================================================
   GET ONE CONVERSATION
========================================================= */

app.get(
    "/api/conversations/:id",
    requireLogin,
    (req, res) => {
        try {
            const id =
                Number(req.params.id);

            if (!Number.isInteger(id)) {
                return res.status(400).json({
                    error:
                        "رقم المحادثة غير صحيح."
                });
            }

            const conversation =
                db.prepare(`
                    SELECT *
                    FROM conversations
                    WHERE id = ?
                    AND user_id = ?
                `).get(
                    id,
                    req.session.userId
                );

            if (!conversation) {
                return res.status(404).json({
                    error:
                        "المحادثة غير موجودة."
                });
            }

            const messages =
                db.prepare(`
                    SELECT
                        id,
                        role,
                        content,
                        image,
                        created_at
                    FROM messages
                    WHERE conversation_id = ?
                    ORDER BY id ASC
                `).all(id);

            res.json({
                conversation,
                messages
            });

        } catch (error) {
            console.error(
                "GET CONVERSATION ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "تعذر تحميل المحادثة."
            });
        }
    }
);

/* =========================================================
   DELETE CONVERSATION
========================================================= */

app.delete(
    "/api/conversations/:id",
    requireLogin,
    (req, res) => {
        try {
            const id =
                Number(req.params.id);

            const result =
                db.prepare(`
                    DELETE FROM conversations
                    WHERE id = ?
                    AND user_id = ?
                `).run(
                    id,
                    req.session.userId
                );

            if (!result.changes) {
                return res.status(404).json({
                    error:
                        "المحادثة غير موجودة."
                });
            }

            res.json({
                success: true
            });

        } catch (error) {
            console.error(
                "DELETE CONVERSATION ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "تعذر حذف المحادثة."
            });
        }
    }
);

/* =========================================================
   SAVE MESSAGE
========================================================= */

app.post(
    "/api/conversations/:id/messages",
    requireLogin,
    (req, res) => {
        try {
            const conversationId =
                Number(
                    req.params.id
                );

            const role =
                req.body.role ===
                "assistant"
                    ? "assistant"
                    : "user";

            const content =
                String(
                    req.body.content || ""
                )
                    .trim();

            let image =
                req.body.image ||
                null;

            if (
                typeof image === "string" &&
                image.length > 8_000_000
            ) {
                image = null;
            }

            if (!content) {
                return res.status(400).json({
                    error:
                        "الرسالة فارغة."
                });
            }

            const conversation =
                db.prepare(`
                    SELECT id
                    FROM conversations
                    WHERE id = ?
                    AND user_id = ?
                `).get(
                    conversationId,
                    req.session.userId
                );

            if (!conversation) {
                return res.status(404).json({
                    error:
                        "المحادثة غير موجودة."
                });
            }

            const result =
                db.prepare(`
                    INSERT INTO messages
                    (conversation_id, role, content, image)
                    VALUES (?, ?, ?, ?)
                `).run(
                    conversationId,
                    role,
                    content,
                    image
                );

            db.prepare(`
                UPDATE conversations
                SET updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(
                conversationId
            );

            res.json({
                success: true,
                message: {
                    id:
                        Number(
                            result.lastInsertRowid
                        ),
                    role,
                    content,
                    image
                }
            });

        } catch (error) {
            console.error(
                "SAVE MESSAGE ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "تعذر حفظ الرسالة."
            });
        }
    }
);

/* =========================================================
   PHYSICS CONSTANTS
========================================================= */

const PHYSICS_CONSTANTS = {
    g: 9.80665,
    c: 299792458,
    h: 6.62607015e-34,
    hbar: 1.054571817e-34,
    e: 1.602176634e-19,
    me: 9.1093837139e-31,
    mp: 1.67262192595e-27,
    eps0: 8.8541878128e-12,
    mu0: 1.25663706212e-6,
    G: 6.67430e-11,
    kB: 1.380649e-23,
    R: 8.31446261815324,
    NA: 6.02214076e23
};

/* =========================================================
   UNIT SYSTEM
========================================================= */

const UNIT_FACTORS = {
    mm: 1e-3,
    cm: 1e-2,
    m: 1,
    km: 1e3,

    mg: 1e-6,
    g: 1e-3,
    kg: 1,

    ms: 1e-3,
    s: 1,
    min: 60,
    h: 3600,

    mN: 1e-3,
    N: 1,
    kN: 1e3,

    J: 1,
    kJ: 1e3,

    W: 1,
    kW: 1e3,

    Pa: 1,
    kPa: 1e3,
    MPa: 1e6,

    V: 1,
    mV: 1e-3,

    A: 1,
    mA: 1e-3,
    uA: 1e-6,

    C: 1,
    mC: 1e-3,

    ohm: 1,
    Hz: 1,
    kHz: 1e3,
    MHz: 1e6,

    K: 1,
    mol: 1
};

const UNIT_ALIASES = {
    "م": "m",
    "متر": "m",
    "سم": "cm",
    "سنتيمتر": "cm",
    "مم": "mm",
    "ملليمتر": "mm",
    "كم": "km",
    "كيلومتر": "km",

    "جرام": "g",
    "غرام": "g",

    "كجم": "kg",
    "كيلوجرام": "kg",

    "نيوتن": "N",
    "جول": "J",
    "وات": "W",
    "باسكال": "Pa",
    "فولت": "V",
    "أمبير": "A",
    "امبير": "A",

    "ث": "s",
    "ثانية": "s",
    "دقيقة": "min",
    "ساعة": "h"
};

/* =========================================================
   PHYSICS DOMAINS
========================================================= */

const DOMAIN_RULES = [
    {
        name:
            "الميكانيكا والحركة",
        keys: [
            "سرعة",
            "سرعته",
            "تسارع",
            "عجلة",
            "إزاحة",
            "مسافة",
            "زمن",
            "قوة",
            "نيوتن",
            "احتكاك",
            "مستوى مائل",
            "بكرة",
            "كتلة",
            "زخم",
            "تصادم",
            "طاقة حركية",
            "طاقة وضع",
            "شغل",
            "قدرة"
        ]
    },

    {
        name:
            "الدوران والاتزان",
        keys: [
            "عزم",
            "عزوم",
            "عزم القصور",
            "قصور ذاتي",
            "سرعة زاوية",
            "تسارع زاوي",
            "اتزان",
            "نصف القطر",
            "دوران"
        ]
    },

    {
        name:
            "الجاذبية والفلك",
        keys: [
            "جاذبية",
            "مدار",
            "كوكب",
            "قمر",
            "كبلر",
            "سرعة الإفلات",
            "الكتلة الأرضية",
            "نصف قطر الأرض"
        ]
    },

    {
        name:
            "الموائع",
        keys: [
            "ضغط",
            "كثافة",
            "لزوجة",
            "طفو",
            "برنولي",
            "استمرارية",
            "سريان",
            "موائع"
        ]
    },

    {
        name:
            "الحرارة والديناميكا الحرارية",
        keys: [
            "حرارة",
            "درجة الحرارة",
            "حراري",
            "قانون الغاز",
            "غاز مثالي",
            "إنتروبيا",
            "انتروبي",
            "إنثالبي",
            "حرارة نوعية",
            "شغل الغاز"
        ]
    },

    {
        name:
            "الكهربية والدوائر",
        keys: [
            "تيار",
            "جهد",
            "مقاومة",
            "مقاومات",
            "قانون أوم",
            "كيرتشوف",
            "دائرة",
            "مكثف",
            "سعة كهربية",
            "قدرة كهربائية",
            "شحنة"
        ]
    },

    {
        name:
            "المغناطيسية والحث",
        keys: [
            "مجال مغناطيسي",
            "مغناطيسي",
            "فيض مغناطيسي",
            "لورنتز",
            "الحث",
            "فاراداي",
            "لينز",
            "ملف",
            "سلك"
        ]
    },

    {
        name:
            "الموجات والاهتزازات",
        keys: [
            "موجة",
            "تردد",
            "طول موجي",
            "سعة",
            "طور",
            "رنين",
            "اهتزاز",
            "موجة واقفة"
        ]
    },

    {
        name:
            "البصريات",
        keys: [
            "عدسة",
            "مرآة",
            "بؤرة",
            "انكسار",
            "انعكاس",
            "زاوية حرجة",
            "منشور",
            "بصري",
            "حيود",
            "تداخل"
        ]
    },

    {
        name:
            "الفيزياء الحديثة والكم",
        keys: [
            "فوتون",
            "كم",
            "بلانك",
            "دالة موجية",
            "شرودنجر",
            "عدم اليقين",
            "ازدواجية",
            "كهروضوئي",
            "نسبية",
            "لورنتز"
        ]
    },

    {
        name:
            "الفيزياء النووية والجسيمات",
        keys: [
            "نواة",
            "نووية",
            "اضمحلال",
            "نشاط إشعاعي",
            "نصف العمر",
            "كتلة ذرية",
            "طاقة ربط",
            "نيوترون",
            "بروتون"
        ]
    },

    {
        name:
            "الكهرومغناطيسية المتقدمة",
        keys: [
            "ماكسويل",
            "جاوس",
            "أمبير ماكسويل",
            "موجة كهرومغناطيسية",
            "استقطاب"
        ]
    }
];

/* =========================================================
   TEXT NORMALIZATION
========================================================= */

function normalizeArabicUnits(text) {
    let output =
        String(text || "");

    for (
        const [arabic, english]
        of Object.entries(
            UNIT_ALIASES
        )
    ) {
        output =
            output.replaceAll(
                arabic,
                english
            );
    }

    return output;
}

/* =========================================================
   EXTRACT NUMBERS + UNITS
========================================================= */

function extractQuantities(text) {
    const source =
        normalizeArabicUnits(
            text
        )
            .replace(
                /[٫٬]/g,
                "."
            )
            .replace(
                /،/g,
                ","
            );

    const numberPattern =
        "(?:\\d+(?:\\.\\d+)?|\\.\\d+)(?:[eE][+-]?\\d+)?";

    const units =
        Object.keys(UNIT_FACTORS)
            .sort(
                (a, b) =>
                    b.length -
                    a.length
            )
            .map(
                x =>
                    x.replace(
                        /[.*+?^${}()|[\]\\]/g,
                        "\\$&"
                    )
            )
            .join("|");

    const regex =
        new RegExp(
            `(${numberPattern})\\s*(${units})(?:\\b|$)`,
            "giu"
        );

    const result = [];

    let match;

    while (
        (match = regex.exec(source)) &&
        result.length < 100
    ) {
        const value =
            Number(
                String(match[1])
                    .replace(
                        /,/g,
                        "."
                    )
            );

        if (!Number.isFinite(value)) {
            continue;
        }

        const unit = match[2];

        const factor =
            UNIT_FACTORS[unit] ?? 1;

        result.push({
            raw: match[0],
            value,
            unit,
            siValue:
                value * factor
        });
    }

    return result;
}

/* =========================================================
   DETECT PHYSICS DOMAIN
========================================================= */

function detectDomains(text) {
    const source =
        normalizeArabicUnits(
            text
        ).toLowerCase();

    const scores = [];

    for (
        const rule of DOMAIN_RULES
    ) {
        let score = 0;

        for (
            const key of rule.keys
        ) {
            const normalizedKey =
                normalizeArabicUnits(
                    key
                ).toLowerCase();

            if (
                source.includes(
                    normalizedKey
                )
            ) {
                score +=
                    key.length >= 8
                        ? 2
                        : 1;
            }
        }

        if (score > 0) {
            scores.push({
                name:
                    rule.name,
                score
            });
        }
    }

    return scores
        .sort(
            (a, b) =>
                b.score -
                a.score
        )
        .slice(0, 5);
}

/* =========================================================
   COMPLEXITY
========================================================= */

function calculateComplexity(
    text,
    quantities,
    domains,
    hasImage
) {
    const source =
        String(text || "");

    let score = 0;

    if (
        quantities.length >= 3
    ) {
        score += 1;
    }

    if (
        quantities.length >= 5
    ) {
        score += 2;
    }

    if (
        quantities.length >= 9
    ) {
        score += 2;
    }

    if (
        domains.length >= 2
    ) {
        score += 2;
    }

    if (
        domains.length >= 3
    ) {
        score += 2;
    }

    if (hasImage) {
        score += 3;
    }

    if (
        (source.match(/=/g) || [])
            .length >= 2
    ) {
        score += 2;
    }

    if (
        /معادلات|نظام معادلات|تفاضل|تكامل|اشتقاق|أثبت|برهن|متجه|مصفوف|احتمال|دالة|مشتقة/.test(
            source
        )
    ) {
        score += 3;
    }

    if (
        /ثم|بعد ذلك|على التوالي|على التوازي|في نفس الوقت|متصل|يتصل|مركب/.test(
            source
        )
    ) {
        score += 2;
    }

    if (
        /كيرتشوف|ماكسويل|تصادم|بكرة|احتكاك|دوران|كمومي|نسبي/.test(
            source
        )
    ) {
        score += 2;
    }

    return Math.min(
        score,
        15
    );
}

/* =========================================================
   PREFLIGHT ANALYSIS
========================================================= */

function buildPreflight(
    text,
    image
) {
    const quantities =
        extractQuantities(text);

    const domains =
        detectDomains(text);

    const complexity =
        calculateComplexity(
            text,
            quantities,
            domains,
            Boolean(image)
        );

    const extracted =
        quantities.map(q =>
            `${q.raw} → ${q.siValue} SI`
        );

    const domainText =
        domains.length
            ? domains
                .map(
                    x =>
                        x.name
                )
                .join("، ")
            : "غير محدد";

    return {
        quantities,
        domains,
        complexity,

        promptBlock: `
تحليل أولي آلي:
- فروع الفيزياء المحتملة: ${domainText}
- درجة التعقيد: ${complexity}/15
- القيم والوحدات المكتشفة:
${
    extracted.length
        ? extracted
            .map(
                x =>
                    "  • " +
                    x
            )
            .join("\n")
        : "  • لا توجد قيمة واضحة بوحدة معروفة"
}

هذا التحليل مساعد فقط.
يجب مراجعة السؤال والصورة قبل اعتماد أي قيمة.
`
    };
}

/* =========================================================
   CONSTANTS FOR AI
========================================================= */

function getConstantsText() {
    return `
ثوابت فيزيائية مرجعية عند الحاجة فقط:
g = ${PHYSICS_CONSTANTS.g} m/s²
c = ${PHYSICS_CONSTANTS.c} m/s
h = ${PHYSICS_CONSTANTS.h} J·s
ħ = ${PHYSICS_CONSTANTS.hbar} J·s
e = ${PHYSICS_CONSTANTS.e} C
mₑ = ${PHYSICS_CONSTANTS.me} kg
mₚ = ${PHYSICS_CONSTANTS.mp} kg
ε₀ = ${PHYSICS_CONSTANTS.eps0} F/m
μ₀ = ${PHYSICS_CONSTANTS.mu0} H/m
G = ${PHYSICS_CONSTANTS.G} m³/(kg·s²)
k_B = ${PHYSICS_CONSTANTS.kB} J/K
R = ${PHYSICS_CONSTANTS.R} J/(mol·K)
N_A = ${PHYSICS_CONSTANTS.NA} mol⁻¹
`;
}

/* =========================================================
   EXPERT PHYSICS PROMPT
========================================================= */

function buildPhysicsInstructions({
    complex,
    hasImage
}) {
    const base = `
أنت Physics AI، محرك حل فيزياء متقدم جدًا.

مهمتك ليست مجرد إعطاء جواب؛ مهمتك بناء حل فيزيائي صحيح وقابل للمراجعة.

قواعد صارمة:

1. لا تخترع معطى غير موجود.
2. ميّز بين المعطيات والافتراضات والاستنتاجات.
3. راجع النص والصورة قبل استخدام أي رقم.
4. حوّل الوحدات إلى SI عندما يكون ذلك مناسبًا.
5. اكتب القانون الرمزي قبل التعويض العددي.
6. لا تقفز فوق خطوة رياضية مؤثرة في النتيجة.
7. افحص الإشارات والاتجاهات.
8. افحص الوحدات والأبعاد.
9. افحص النتيجة منطقيًا وحديًا وفيزيائيًا.
10. إذا كانت البيانات غير كافية، قل ذلك صراحة.
11. إذا كانت هناك حالات متعددة، افصل بينها.
12. إذا كانت المسألة مركبة، قسمها إلى أنظمة وأجزاء واضحة.
13. لا تستخدم قانونًا خارج شروط صلاحيته.
14. لا تفترض الاحتكاك أو انعدامه إلا إذا كان السؤال يسمح بذلك.
15. لا تفترض إهمال مقاومة الهواء أو كتلة البكرة أو أي تأثير إلا مع توضيح الافتراض.
16. لا تخلط بين الكميات المتجهة والقياسية.
17. في الكهرباء راجع العقد والحلقات والاتجاهات.
18. في الدوران راجع علاقة الكميات الزاوية بالخطية.
19. في الموجات راجع الوحدات والطور والتردد والطول الموجي.
20. في البصريات راجع الاصطلاحات والإشارات.
21. في الفيزياء الحديثة راجع eV مقابل J بعناية.
22. عند وجود أكثر من طريقة صحيحة، اختر الأكثر وضوحًا ثم اذكر البديل إذا كان مفيدًا.

تنسيق الحل:

## فهم المسألة

## المعطيات

## المطلوب

## النموذج الفيزيائي

## الفروض

## القوانين والمبادئ

## الاشتقاق الرمزي

## تحويل الوحدات

## التعويض العددي

## الحسابات

## فحص الوحدات والأبعاد

## التحقق الفيزيائي

## النتيجة النهائية

## ملاحظات

اللغة:
- عربية مصرية طبيعية.
- مصطلحات فيزيائية قياسية.
- شرح تفصيلي جدًا.
- Markdown واضح.
- المعادلات منظمة.
`;

    let advanced = "";

    if (complex) {
        advanced = `
        
وضع EXPERT مفعل لأن المسألة تبدو مركبة:

- ابنِ خطة حل متعددة المراحل.
- حدد المتغيرات قبل الحساب.
- إذا كان هناك أكثر من جسم، اكتب معادلة مستقلة لكل جسم.
- إذا كان هناك أكثر من محور، حدد الإشارات والمحاور.
- استخدم قوانين الحفظ عند الحاجة.
- لا تختصر الجبر الذي يؤثر في النتيجة.
- تحقق من النتيجة بطريقة مستقلة عندما يكون ذلك ممكنًا.
- راجع المعادلات في حالة الحدود القصوى أو الحالات الخاصة.
- لا تعتمد على الناتج العددي وحده؛ يجب أن يكون الاشتقاق متسقًا.
- في الأنظمة المعقدة، تعامل مع كل subsystem ثم اربط النتائج.
`;
    }

    if (hasImage) {
        advanced += `
        
تعليمات الصورة:

- افحص الرسم والمخطط قبل الحل.
- اقرأ القيم والرموز.
- ميّز بين المعلومات الواضحة وغير الواضحة.
- لا تخمن أي جزء غير مقروء.
- اربط عناصر الرسم بالمعادلات.
- لو هناك دائرة كهربية، حدد العقد والفروع والحلقات.
- لو هناك رسم حركة أو قوى، حدد الاتجاهات والقوى.
`;
    }

    return (
        base +
        advanced +
        getConstantsText()
    );
}

/* =========================================================
   GEMINI CALL
========================================================= */

async function callGemini(
    contents,
    systemInstruction,
    temperature
) {
    return ai.models.generateContent({
        model: GEMINI_MODEL,

        contents,

        config: {
            temperature:
                temperature ?? 0.15,

            systemInstruction
        }
    });
}

/* =========================================================
   VERIFY COMPLEX ANSWER
========================================================= */

async function verifyComplexAnswer({
    question,
    draft,
    contextText,
    preflight,
    image
}) {
    const instructions = `
أنت مراجع فيزياء مستقل.

راجع الحل المعروض لك مراجعة صارمة.

افحص:
- فهم السؤال
- المعطيات
- الافتراضات
- القوانين
- اشتقاق المعادلات
- الحساب
- الوحدات
- الأبعاد
- الإشارات
- اتجاهات المتجهات
- المعقولية الفيزيائية
- التوافق مع الصورة

إذا وجدت خطأ:
صححه.

إذا كان الحل صحيحًا:
حافظ على النتيجة وحسن وضوحه.

ممنوع عرض التفكير الداخلي للمراجع.

في آخر الإجابة ضع:

## التحقق النهائي

واكتب نقاط التحقق المهمة.
`;

    const verifyText = `
سؤال الطالب:
${question}

سياق الطالب:
${contextText}

${preflight.promptBlock}

الحل المراد مراجعته:
${draft}
`;

    const parts = [
        {
            text:
                verifyText
        }
    ];

    if (
        image &&
        typeof image === "string" &&
        image.startsWith(
            "data:image/"
        )
    ) {
        const match =
            image.match(
                /^data:([^;]+);base64,(.+)$/
            );

        if (match) {
            parts.push({
                inlineData: {
                    mimeType:
                        match[1],
                    data:
                        match[2]
                }
            });
        }
    }

    const response =
        await callGemini(
            [
                {
                    role: "user",
                    parts
                }
            ],
            instructions,
            0.05
        );

    return String(
        response.text ||
        draft
    ).trim();
}

/* =========================================================
   AUDIO TRANSCRIPTION
========================================================= */

app.post(
    "/api/transcribe",
    audioUpload.single("audio"),
    async (req, res) => {
        try {
            if (!req.file) {
                return res.status(400).json({
                    error:
                        "لم يتم إرسال تسجيل صوتي."
                });
            }

            if (
                req.file.size >
                19 * 1024 * 1024
            ) {
                return res.status(400).json({
                    error:
                        "التسجيل كبير جدًا. استخدم تسجيلًا أقل من 19MB."
                });
            }

            const mimeType =
                String(
                    req.file.mimetype ||
                    "audio/webm"
                )
                    .split(";")[0]
                    .trim();

            const audioBase64 =
                req.file.buffer.toString(
                    "base64"
                );

            const prompt = `
استمع للتسجيل الصوتي.

حوّل كلام الطالب إلى نص فقط.

القواعد:
- العربية المصرية هي اللغة الأساسية.
- حافظ على المصطلحات الفيزيائية.
- لا تجب عن السؤال.
- لا تشرح.
- لا تضف كلامًا من عندك.
- اكتب فقط ما قاله الطالب.
`;

            const response =
                await callGemini(
                    [
                        {
                            role: "user",
                            parts: [
                                {
                                    text:
                                        prompt
                                },
                                {
                                    inlineData: {
                                        mimeType,
                                        data:
                                            audioBase64
                                    }
                                }
                            ]
                        }
                    ],
                    prompt,
                    0.05
                );

            res.json({
                success: true,
                text:
                    String(
                        response.text ||
                        ""
                    ).trim()
            });

        } catch (error) {
            console.error(
                "TRANSCRIPTION ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "تعذر تحويل التسجيل الصوتي إلى نص."
            });
        }
    }
);

/* =========================================================
   MAIN PHYSICS AI
========================================================= */

app.post(
    "/api/chat",
    requireLogin,
    async (req, res) => {
        try {
            const message =
                String(
                    req.body.message ||
                    ""
                ).trim();

            if (!message) {
                return res.status(400).json({
                    error:
                        "اكتب سؤالك الأول."
                });
            }

            let history =
                Array.isArray(
                    req.body.history
                )
                    ? req.body.history
                    : [];

            history =
                history.slice(-20);

            const grade =
                String(
                    req.body.grade ||
                    ""
                ).trim();

            const subject =
                String(
                    req.body.subject ||
                    "الفيزياء"
                ).trim();

            const unit =
                String(
                    req.body.unit ||
                    ""
                ).trim();

            const lesson =
                String(
                    req.body.lesson ||
                    ""
                ).trim();

            const mode =
                String(
                    req.body.mode ||
                    ""
                ).trim();

            const image =
                req.body.image ||
                null;

            if (
                typeof image ===
                    "string" &&
                image.length >
                    8_000_000
            ) {
                return res.status(400).json({
                    error:
                        "الصورة كبيرة جدًا."
                });
            }

            /* -----------------------------------------------------
               CONTEXT
            ----------------------------------------------------- */

            const contextText = `
معلومات جلسة الطالب:
- الصف: ${grade || "غير محدد"}
- المادة: ${subject}
- الوحدة: ${unit || "غير محدد"}
- الدرس: ${lesson || "غير محدد"}
- نوع الجلسة: ${mode || "دردشة عامة"}
`;

            /* -----------------------------------------------------
               PRE-FLIGHT
            ----------------------------------------------------- */

            const preflight =
                buildPreflight(
                    message,
                    image
                );

            const isComplex =
                preflight.complexity >= 5;

            console.log(
                "PHYSICS PRE-FLIGHT:",
                {
                    complexity:
                        preflight.complexity,

                    domains:
                        preflight.domains.map(
                            x =>
                                x.name
                        ),

                    quantities:
                        preflight.quantities.length,

                    image:
                        Boolean(image)
                }
            );

            /* -----------------------------------------------------
               SYSTEM
            ----------------------------------------------------- */

            const systemInstruction = `
${buildPhysicsInstructions({
    complex: isComplex,
    hasImage: Boolean(image)
})}

السياق:
${contextText}

${preflight.promptBlock}

ملاحظات مهمة:
- تعامل مع السؤال الحالي باعتباره أهم رسالة.
- استخدم التاريخ السابق فقط لفهم السياق.
- إذا قال الطالب "كمل" أو "احسبها" فارجع للسياق السابق.
- إذا كانت هناك معلومة ناقصة فعلًا، وضح ما ينقص بدل التخمين.
- لا تستخدم نتائج سابقة إذا كانت غير موثوقة.
`;

            /* -----------------------------------------------------
               BUILD HISTORY
            ----------------------------------------------------- */

            const contents = [];

            for (
                const item of history
            ) {
                if (
                    !item ||
                    !item.content
                ) {
                    continue;
                }

                const role =
                    item.role ===
                    "assistant"
                        ? "model"
                        : "user";

                contents.push({
                    role,

                    parts: [
                        {
                            text:
                                String(
                                    item.content
                                )
                        }
                    ]
                });
            }

            /* -----------------------------------------------------
               CURRENT USER
            ----------------------------------------------------- */

            const currentParts = [
                {
                    text:
                        systemInstruction +
                        "\n\n" +
                        "رسالة الطالب الحالية:\n" +
                        message
                }
            ];

            if (
                image &&
                typeof image ===
                    "string" &&
                image.startsWith(
                    "data:image/"
                )
            ) {
                const match =
                    image.match(
                        /^data:([^;]+);base64,(.+)$/
                    );

                if (match) {
                    currentParts.push({
                        inlineData: {
                            mimeType:
                                match[1],
                            data:
                                match[2]
                        }
                    });
                }
            }

            contents.push({
                role: "user",

                parts:
                    currentParts
            });

            /* -----------------------------------------------------
               FIRST PASS
            ----------------------------------------------------- */

            const response =
                await callGemini(
                    contents,
                    systemInstruction,
                    isComplex
                        ? 0.10
                        : 0.15
                );

            let answer =
                String(
                    response.text ||
                    ""
                ).trim();

            if (!answer) {
                return res.status(502).json({
                    error:
                        "النموذج لم يرجع إجابة."
                });
            }

            /* -----------------------------------------------------
               SECOND PASS VERIFICATION
            ----------------------------------------------------- */

            let verified =
                false;

            if (
                isComplex &&
                process.env.PHYSICS_VERIFY !==
                    "false"
            ) {
                try {
                    answer =
                        await verifyComplexAnswer({
                            question:
                                message,

                            draft:
                                answer,

                            contextText,

                            preflight,

                            image
                        });

                    verified = true;

                } catch (verifyError) {
                    console.error(
                        "VERIFY ERROR:",
                        verifyError
                    );

                    /*
                     * لو المراجعة فشلت،
                     * نحتفظ بالحل الأول.
                     */
                }
            }

            res.json({
                success: true,

                answer,

                physicsEngine: {
                    version:
                        "2.0",

                    complexity:
                        preflight.complexity,

                    complex:
                        isComplex,

                    domains:
                        preflight.domains.map(
                            x =>
                                x.name
                        ),

                    extractedQuantities:
                        preflight.quantities
                            .map(
                                q => ({
                                    value:
                                        q.value,
                                    unit:
                                        q.unit,
                                    siValue:
                                        q.siValue
                                })
                            ),

                    verified
                }
            });

        } catch (error) {
            console.error(
                "PHYSICS ENGINE ERROR:",
                error
            );

            const status =
                Number(
                    error?.status ||
                    error?.statusCode ||
                    500
                );

            if (
                status === 429
            ) {
                return res.status(429).json({
                    error:
                        "تم الوصول إلى حد استخدام Gemini حاليًا. حاول بعد قليل."
                });
            }

            if (
                status === 401 ||
                status === 403
            ) {
                return res.status(500).json({
                    error:
                        "مفتاح Gemini غير صحيح أو غير مصرح باستخدامه."
                });
            }

            res.status(500).json({
                error:
                    "حصل خطأ أثناء تشغيل Physics Engine."
            });
        }
    }
);

/* =========================================================
   ERROR HANDLER
========================================================= */

app.use(
    (error, req, res, next) => {
        console.error(
            "SERVER ERROR:",
            error
        );

        if (
            error?.code ===
            "LIMIT_FILE_SIZE"
        ) {
            return res.status(400).json({
                error:
                    "حجم الملف كبير جدًا."
            });
        }

        if (
            error?.message ===
            "يسمح برفع الصور فقط."
        ) {
            return res.status(400).json({
                error:
                    error.message
            });
        }

        if (
            error?.message ===
            "نوع الملف الصوتي غير مدعوم."
        ) {
            return res.status(400).json({
                error:
                    error.message
            });
        }

        if (
            error?.name ===
            "MulterError"
        ) {
            return res.status(400).json({
                error:
                    "حصل خطأ أثناء رفع الملف."
            });
        }

        res.status(500).json({
            error:
                "حصل خطأ في السيرفر."
        });
    }
);

/* =========================================================
   START SERVER
========================================================= */

app.listen(
    PORT,
    () => {
        console.log(
            "========================================"
        );

        console.log(
            `Physics AI running on port ${PORT}`
        );

        console.log(
            "Model:",
            GEMINI_MODEL
        );

        console.log(
            "Physics Engine: V2"
        );

        console.log(
            "Complex Problem Verification:",
            process.env.PHYSICS_VERIFY !==
                "false"
                ? "ON"
                : "OFF"
        );

        console.log(
            "Database: READY"
        );

        console.log(
            "Authentication: READY"
        );

        console.log(
            "Conversations: READY"
        );

        console.log(
            "Images: READY"
        );

        console.log(
            "Audio: READY"
        );

        console.log(
            "========================================"
        );
    }
);
