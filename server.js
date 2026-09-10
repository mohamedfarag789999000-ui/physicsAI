require("dotenv").config();

const express = require("express");
const path = require("path");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const multer = require("multer");
const { GoogleGenAI } = require("@google/genai");

const app = express();

const PORT = process.env.PORT || 3000;

app.set("trust proxy", 1);

/* =========================================================
   GEMINI
========================================================= */

if (!process.env.GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY غير موجود.");
    process.exit(1);
}

const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY
});

const GEMINI_MODEL =
    process.env.GEMINI_MODEL || "gemini-3.6-flash";

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
        name: "physicsai.sid",

        secret:
            process.env.SESSION_SECRET ||
            "physics-ai-session-secret-change-this",

        resave: false,

        saveUninitialized: false,

        proxy: true,

        cookie: {
            httpOnly: true,
            sameSite: "lax",
            secure: "auto",
            path: "/",
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
   IMAGE UPLOAD
========================================================= */

const imageUpload = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize: 10 * 1024 * 1024
    },

    fileFilter: function (req, file, cb) {
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

/* =========================================================
   AUDIO UPLOAD
========================================================= */

const audioUpload = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize: 25 * 1024 * 1024
    },

    fileFilter: function (req, file, cb) {
        const mime = String(
            file.mimetype || ""
        )
            .toLowerCase()
            .split(";")[0];

        if (mime.startsWith("audio/")) {
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
   AUTH HELPERS
========================================================= */

function requireLogin(req, res, next) {
    if (
        !req.session ||
        !req.session.userId
    ) {
        return res.status(401).json({
            error: "لازم تسجل دخول الأول."
        });
    }

    next();
}

function saveSession(req, res, data) {
    req.session.save(function (error) {
        if (error) {
            console.error(
                "SESSION SAVE ERROR:",
                error
            );

            return res.status(500).json({
                error:
                    "حصل خطأ أثناء حفظ جلسة الدخول."
            });
        }

        res.json(data);
    });
}

/* =========================================================
   HOME
========================================================= */

app.get("/", function (req, res) {
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
    async function (req, res) {
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

            if (!email) {
                return res.status(400).json({
                    error:
                        "اكتب البريد الإلكتروني."
                });
            }

            if (!email.includes("@")) {
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

            const existingUser =
                db.prepare(`
                    SELECT id
                    FROM users
                    WHERE email = ?
                `).get(email);

            if (existingUser) {
                return res.status(409).json({
                    error:
                        "البريد الإلكتروني مستخدم بالفعل."
                });
            }

            const hashedPassword =
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
                    hashedPassword
                );

            req.session.regenerate(
                function (sessionError) {
                    if (sessionError) {
                        console.error(
                            "SESSION REGENERATE ERROR:",
                            sessionError
                        );

                        return res.status(500).json({
                            error:
                                "تعذر إنشاء جلسة الدخول."
                        });
                    }

                    req.session.userId =
                        Number(
                            result.lastInsertRowid
                        );

                    req.session.userName =
                        name;

                    req.session.authenticated =
                        true;

                    saveSession(req, res, {
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
                }
            );
        } catch (error) {
            console.error(
                "REGISTER ERROR:",
                error
            );

            if (
                error &&
                error.code ===
                    "SQLITE_CONSTRAINT_UNIQUE"
            ) {
                return res.status(409).json({
                    error:
                        "البريد الإلكتروني مستخدم بالفعل."
                });
            }

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
    async function (req, res) {
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

            const validPassword =
                await bcrypt.compare(
                    password,
                    user.password
                );

            if (!validPassword) {
                return res.status(401).json({
                    error:
                        "البريد الإلكتروني أو كلمة السر غير صحيحة."
                });
            }

            req.session.regenerate(
                function (sessionError) {
                    if (sessionError) {
                        console.error(
                            "SESSION REGENERATE ERROR:",
                            sessionError
                        );

                        return res.status(500).json({
                            error:
                                "تعذر إنشاء جلسة الدخول."
                        });
                    }

                    req.session.userId =
                        user.id;

                    req.session.userName =
                        user.name;

                    req.session.authenticated =
                        true;

                    saveSession(req, res, {
                        success: true,

                        user: {
                            id: user.id,
                            name: user.name,
                            email: user.email
                        }
                    });
                }
            );
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
    function (req, res) {
        req.session.destroy(
            function (error) {
                if (error) {
                    console.error(
                        "LOGOUT ERROR:",
                        error
                    );

                    return res.status(500).json({
                        error:
                            "تعذر تسجيل الخروج."
                    });
                }

                res.clearCookie(
                    "physicsai.sid",
                    {
                        httpOnly: true,
                        sameSite: "lax",
                        secure: "auto",
                        path: "/"
                    }
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
    function (req, res) {
        if (
            !req.session ||
            !req.session.userId
        ) {
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
                function () {}
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
    function (req, res) {
        try {
            const title = String(
                req.body.title ||
                    "محادثة جديدة"
            )
                .trim()
                .slice(0, 120);

            const finalTitle =
                title || "محادثة جديدة";

            const result =
                db.prepare(`
                    INSERT INTO conversations
                    (user_id, title)
                    VALUES (?, ?)
                `).run(
                    req.session.userId,
                    finalTitle
                );

            res.json({
                success: true,

                conversation: {
                    id:
                        Number(
                            result.lastInsertRowid
                        ),
                    title:
                        finalTitle
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
    function (req, res) {
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
    function (req, res) {
        try {
            const conversationId =
                Number(
                    req.params.id
                );

            if (
                !Number.isInteger(
                    conversationId
                )
            ) {
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
                    conversationId,
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
                `).all(
                    conversationId
                );

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
    function (req, res) {
        try {
            const conversationId =
                Number(
                    req.params.id
                );

            const result =
                db.prepare(`
                    DELETE FROM conversations
                    WHERE id = ?
                    AND user_id = ?
                `).run(
                    conversationId,
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
    function (req, res) {
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
                ).trim();

            let image =
                req.body.image ||
                null;

            if (
                typeof image === "string" &&
                image.length >
                    8_000_000
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
                SET updated_at =
                    CURRENT_TIMESTAMP
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
   PHYSICS DATA
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

const DOMAIN_RULES = [
    {
        name: "الميكانيكا والحركة",

        keys: [
            "سرعة",
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
            "شغل",
            "قدرة"
        ]
    },

    {
        name: "الدوران والاتزان",

        keys: [
            "عزم",
            "عزوم",
            "عزم القصور",
            "قصور ذاتي",
            "زاوية",
            "سرعة زاوية",
            "تسارع زاوي",
            "اتزان"
        ]
    },

    {
        name: "الجاذبية والفلك",

        keys: [
            "جاذبية",
            "مدار",
            "كوكب",
            "قمر",
            "قانون كبلر",
            "سرعة الإفلات",
            "كتلة الأرض"
        ]
    },

    {
        name: "الموائع",

        keys: [
            "ضغط",
            "كثافة",
            "لزوجة",
            "طفو",
            "برنولي",
            "استمرارية",
            "موائع",
            "سريان"
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
            "أنتروبي",
            "إنثالبي",
            "حرارة نوعية"
        ]
    },

    {
        name: "الكهربية والدوائر",

        keys: [
            "تيار",
            "جهد",
            "مقاومة",
            "مقاومات",
            "قانون أوم",
            "كيرتشوف",
            "دائرة",
            "مكثف",
            "حث ذاتي",
            "قدرة كهربائية"
        ]
    },

    {
        name: "المغناطيسية والحث",

        keys: [
            "مجال مغناطيسي",
            "مغناطيسي",
            "فيض مغناطيسي",
            "قوة لورنتز",
            "الحث",
            "فاراداي",
            "لينز",
            "ملف",
            "سلك"
        ]
    },

    {
        name: "الموجات والاهتزازات",

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
        name: "البصريات",

        keys: [
            "عدسة",
            "مرآة",
            "بؤرة",
            "انكسار",
            "انعكاس",
            "زاوية حرجة",
            "منشور",
            "بصري"
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
            "تأثير كهروضوئي",
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
    }
];

/* =========================================================
   UNITS
========================================================= */

const UNIT_FACTORS = {
    mm: 1e-3,
    cm: 1e-2,
    km: 1e3,
    m: 1,

    mg: 1e-6,
    g: 1e-3,
    kg: 1,

    N: 1,
    kN: 1e3,
    mN: 1e-3,

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

    s: 1,
    ms: 1e-3,
    min: 60,
    h: 3600,

    K: 1,

    mol: 1
};

const UNIT_ALIASES = {
    "م": "m",
    "سم": "cm",
    "مم": "mm",
    "كم": "km",
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
   NORMALIZE
========================================================= */

function normalizeArabicUnits(text) {
    let output = String(text || "");

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
   EXTRACT NUMBERS
========================================================= */

function extractQuantities(text) {
    const source =
        normalizeArabicUnits(text)
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

    const unitPattern =
        Object.keys(UNIT_FACTORS)
            .sort(
                (a, b) =>
                    b.length - a.length
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
            `(${numberPattern})\\s*(${unitPattern})(?:\\b|$)`,
            "giu"
        );

    const result = [];

    let match;

    while (
        (match = regex.exec(source)) &&
        result.length < 80
    ) {
        const value =
            Number(
                String(
                    match[1]
                ).replace(
                    /,/g,
                    "."
                )
            );

        if (!Number.isFinite(value)) {
            continue;
        }

        const unit =
            match[2];

        const factor =
            UNIT_FACTORS[unit] ?? 1;

        result.push({
            raw: match[0],

            value,

            unit,

            siValue:
                value *
                factor
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
        const rule
        of DOMAIN_RULES
    ) {
        let score = 0;

        for (
            const key
            of rule.keys
        ) {
            if (
                source.includes(
                    normalizeArabicUnits(
                        key
                    ).toLowerCase()
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
                name: rule.name,
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

function complexityScore(
    text,
    quantities,
    domains,
    hasImage
) {
    const source =
        String(text || "");

    let score = 0;

    if (
        quantities.length >= 4
    ) {
        score += 2;
    }

    if (
        quantities.length >= 8
    ) {
        score += 2;
    }

    if (
        domains.length >= 2
    ) {
        score += 2;
    }

    if (hasImage) {
        score += 3;
    }

    if (
        (source.match(/[=]/g) || [])
            .length >= 2
    ) {
        score += 2;
    }

    if (
        (
            source.match(
                /[+\-*/]/g
            ) || []
        ).length >= 6
    ) {
        score += 1;
    }

    if (
        /نظام معادلات|معادلات|تفاضل|تكامل|مصفوف|متجه|اشتقاق|أثبت|برهن|أقصى|أدنى|احتمال|دالة/
            .test(source)
    ) {
        score += 3;
    }

    if (
        /ثم|بعد ذلك|على التوالي|على التوازي|معًا|في نفس الوقت|يتصل|متصل/
            .test(source)
    ) {
        score += 2;
    }

    if (
        /تصادم|بكرة|مستويين|دوائر|كيرتشوف|ماكسويل|نسبي|كمومي/
            .test(source)
    ) {
        score += 2;
    }

    return Math.min(
        score,
        15
    );
}

/* =========================================================
   PRECHECK
========================================================= */

function buildPreflight(
    text,
    image
) {
    const quantities =
        extractQuantities(
            text
        );

    const domains =
        detectDomains(
            text
        );

    const complexity =
        complexityScore(
            text,
            quantities,
            domains,
            Boolean(image)
        );

    const values =
        quantities.map(
            item =>
                `${item.raw} = ${item.siValue} ${item.unit}`
        );

    return {
        quantities,

        domains,

        complexity,

        promptBlock: `
تحليل أولي للسؤال:

الفروع المحتملة:
${
    domains.length
        ? domains
              .map(
                  x =>
                      x.name
              )
              .join("، ")
        : "غير محدد"
}

درجة التعقيد:
${complexity}

القيم الموجودة في السؤال:
${
    values.length
        ? values.join("\n")
        : "لا توجد قيم رقمية واضحة"
}

لا تعتبر هذا التحليل حقيقة نهائية.
راجع السؤال نفسه قبل استخدام أي قيمة.
`
    };
}

/* =========================================================
   QUESTION INTENT
========================================================= */

function detectQuestionIntent(text) {
    const source =
        String(
            text || ""
        ).trim();

    const solve =
        /حل|أوجد|احسب|استنتج|استخرج|جد|حل المسألة|هات الحل|عايز الحل|اعطني الحل|أعطني الحل|احسب قيمة|أوجد قيمة/
            .test(source);

    const explain =
        /اشرح|فهمني|وضح|وضّح|ليه|لماذا|كيف|عايز أفهم|مش فاهم|فهمني الفكرة|اشرحلي|فسر|فسّر/
            .test(source);

    if (solve) {
        return "solution";
    }

    if (explain) {
        return "explanation";
    }

    return "normal";
}

/* =========================================================
   SIMPLE RESPONSE STYLE
========================================================= */

const SIMPLE_STYLE = `
اكتب بالعربية المصرية السهلة.

خليك واضح وطبيعي.

ممنوع الإيموجي.

ممنوع الرموز الغريبة.

ممنوع LaTeX.

ممنوع التنسيق الرياضي المعقد.

ممنوع كتابة معادلات بالشكل البرمجي.

ممنوع استخدام:
*
×
÷
^2
^3
√
π
θ
ω
λ
وغيرها من الرموز التي ممكن تربك الطالب.

بدل ذلك استخدم كلام بسيط.

مثال:
بدل v^2 اكتب "v تربيع".

بدل √x اكتب "الجذر التربيعي لـ x".

بدل x^3 اكتب "x تكعيب".

بدل × اكتب كلمة "في".

مثال:
F = m في a

مثال:
KE = نصف في m في v تربيع

مثال:
v = d على t

مثال:
V = I في R

لو المعادلة ممكن تتقال بالكلام بشكل أوضح، استخدم الكلام.

خلي الطالب يقدر يقرأ الإجابة ويفهمها من أول مرة.
`;

/* =========================================================
   AI INSTRUCTIONS
========================================================= */

function buildExpertInstructions({
    complex,
    hasImage,
    intent
}) {
    let instructions = `
أنت Physics AI.

أنت مدرس فيزياء شاطر جدًا لكن أسلوبك بسيط وواضح.

مهمتك إنك تفهم سؤال الطالب وتجاوب عليه بدقة.

لا تخترع أي معلومة.

لا تفترض رقمًا غير موجود.

راجع الحسابات والوحدات.

لو السؤال ناقص، قل للطالب إن البيانات ناقصة.

لو السؤال واضح، جاوب مباشرة.

${SIMPLE_STYLE}

`;

    if (
        intent === "solution"
    ) {
        instructions += `
الطالب طلب حل.

مهم جدًا:

اكتب الإجابة النهائية مباشرة فقط.

لا تكتب خطوات.

لا تكتب شرح.

لا تكتب مقدمة.

لا تكتب طريقة الحل.

لا تكتب "أولًا" أو "ثانيًا".

لا تكرر السؤال.

خلي الرد قصير وواضح.

مثال:

الإجابة: 20 متر/ثانية

ولو فيه أكثر من قيمة مطلوبة، اكتب كل نتيجة بوضوح.

لا تعرض خطوات الحساب إلا لو الطالب طلب شرح صراحة.
`;
    } else if (
        intent === "explanation"
    ) {
        instructions += `
الطالب طلب شرح.

هنا فقط اشرح بالتفصيل.

ابدأ من الفكرة الأساسية.

وضح معنى القانون.

وضح لماذا نستخدم القانون.

وضح الرموز بالكلام.

استخدم مثال بسيط عند الحاجة.

لو فيه عملية حسابية، اكتبها بطريقة سهلة.

خلي الشرح تدريجي وواضح.

ما تستخدمش تعقيد رياضي بدون داعي.
`;
    } else {
        instructions += `
الطالب لم يطلب حلًا بشكل مباشر ولم يطلب شرحًا بشكل مباشر.

افهم المطلوب.

لو محتاج نتيجة مباشرة، اعط النتيجة.

لو السؤال محتاج توضيح، وضحه.

لو سؤال نظري، جاوب بشكل بسيط.

لو مسألة حسابية، حاول تكون مباشر وواضح.
`;
    }

    if (complex) {
        instructions += `
السؤال ممكن يكون مركب.

اهتم بالدقة جدًا.

راجع كل المعطيات.

راجع الوحدات.

راجع النتيجة.

لكن لا تعرض التعقيد للطالب إلا لو كان مطلوبًا.
`;
    }

    if (hasImage) {
        instructions += `
يوجد صورة مع السؤال.

اقرأ الصورة بعناية.

اقرأ الأرقام والبيانات.

لا تخترع أي رقم مش واضح.

لو جزء من الصورة غير واضح، قل إن الجزء غير واضح.
`;
    }

    return (
        instructions +
        `

ثوابت فيزيائية مرجعية عند الحاجة:

g = ${PHYSICS_CONSTANTS.g}

c = ${PHYSICS_CONSTANTS.c}

h = ${PHYSICS_CONSTANTS.h}

e = ${PHYSICS_CONSTANTS.e}

G = ${PHYSICS_CONSTANTS.G}
`
    );
}

/* =========================================================
   CLEAN AI ANSWER
========================================================= */

function cleanPhysicsAnswer(text) {
    let output =
        String(
            text || ""
        ).trim();

    if (!output) {
        return "";
    }

    /* Remove code blocks */
    output =
        output.replace(
            /```[a-zA-Z0-9_-]*/g,
            ""
        );

    output =
        output.replace(
            /```/g,
            ""
        );

    /* Remove heading marks */
    output =
        output.replace(
            /^\s*#{1,6}\s*/gm,
            ""
        );

    /* Remove bold */
    output =
        output.replace(
            /\*\*(.*?)\*\*/gs,
            "$1"
        );

    output =
        output.replace(
            /__(.*?)__/gs,
            "$1"
        );

    /* Remove LaTeX wrappers */
    output =
        output.replace(
            /\\\[/g,
            ""
        );

    output =
        output.replace(
            /\\\]/g,
            ""
        );

    output =
        output.replace(
            /\\\(/g,
            ""
        );

    output =
        output.replace(
            /\\\)/g,
            ""
        );

    /* LaTeX commands */
    output =
        output.replace(
            /\\times/g,
            " في "
        );

    output =
        output.replace(
            /\\cdot/g,
            " في "
        );

    output =
        output.replace(
            /\\div/g,
            " على "
        );

    output =
        output.replace(
            /\\sqrt\{([^{}]+)\}/g,
            "الجذر التربيعي لـ $1"
        );

    output =
        output.replace(
            /\\pi/g,
            "pi"
        );

    output =
        output.replace(
            /\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g,
            "$1 على $2"
        );

    /* Regular symbols */
    const replacements = {
        "×": " في ",
        "÷": " على ",
        "*": " في ",
        "−": "-",
        "–": "-",
        "—": "-",

        "²": " تربيع",
        "³": " تكعيب",
        "⁴": " أس 4",
        "⁵": " أس 5",

        "√": "الجذر التربيعي لـ ",

        "π": "pi",

        "θ": "theta",
        "φ": "phi",
        "ω": "omega",
        "λ": "lambda",
        "μ": "mu",

        "Δ": "التغير في ",
        "δ": "دلتا"
    };

    for (
        const [from, to]
        of Object.entries(
            replacements
        )
    ) {
        output =
            output.replaceAll(
                from,
                to
            );
    }

    /* Convert common power style */
    output =
        output.replace(
            /([A-Za-z\u0600-\u06FF0-9]+)\^2/g,
            "$1 تربيع"
        );

    output =
        output.replace(
            /([A-Za-z\u0600-\u06FF0-9]+)\^3/g,
            "$1 تكعيب"
        );

    output =
        output.replace(
            /([A-Za-z\u0600-\u06FF0-9]+)\^([4-9])/g,
            "$1 أس $2"
        );

    /* Remove dollar signs */
    output =
        output.replace(
            /\$/g,
            ""
        );

    /* Remove emojis */
    output =
        output.replace(
            /[\u{1F300}-\u{1FAFF}]/gu,
            ""
        );

    output =
        output.replace(
            /[\u{2600}-\u{27BF}]/gu,
            ""
        );

    /* Clean repeated spaces */
    output =
        output.replace(
            /[ \t]{2,}/g,
            " "
        );

    /* Clean spaces before punctuation */
    output =
        output.replace(
            /\s+([،,.؟!])/g,
            "$1"
        );

    /* Clean too many lines */
    output =
        output.replace(
            /\n{3,}/g,
            "\n\n"
        );

    return output.trim();
}

/* =========================================================
   GEMINI CALL
========================================================= */

async function callGemini(
    contents,
    systemInstruction,
    temperature = 0.2
) {
    return ai.models.generateContent({
        model: GEMINI_MODEL,

        contents,

        config: {
            temperature,

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
    image,
    intent
}) {
    const verifierInstructions = `
أنت مراجع فيزياء.

راجع الإجابة للتأكد من صحتها.

مهم جدًا:

لو الطالب طلب حل فقط، لا تضف خطوات.

لو الطالب طلب شرح، حافظ على الشرح.

لا تضف رموز غريبة.

لا تستخدم LaTeX.

لا تستخدم:
*
×
÷
^2
^3

استخدم كلمات بسيطة.

تأكد من:

صحة النتيجة.

صحة الوحدات.

صحة القانون.

عدم اختراع بيانات.

وضوح الإجابة.

لو الإجابة صحيحة اتركها كما هي مع تحسين بسيط للوضوح عند الحاجة.

لو فيها خطأ صححه.

لا تكتب تقرير مراجعة.

لا تتكلم عن عملية المراجعة نفسها.
`;

    const verifyText = `
سؤال الطالب:
${question}

نوع الطلب:
${intent}

${contextText}

${preflight.promptBlock}

الإجابة الحالية:
${draft}
`;

    const parts = [
        {
            text: verifyText
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
            verifierInstructions,
            0.1
        );

    return cleanPhysicsAnswer(
        String(
            response.text ||
                draft
        ).trim()
    );
}

/* =========================================================
   PHYSICS CHAT
========================================================= */

app.post(
    "/api/chat",
    requireLogin,
    async function (req, res) {
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

            const history =
                Array.isArray(
                    req.body.history
                )
                    ? req.body.history.slice(
                          -20
                      )
                    : [];

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
                typeof image === "string" &&
                image.length >
                    8_000_000
            ) {
                return res.status(400).json({
                    error:
                        "الصورة كبيرة جدًا."
                });
            }

            const contextText = `
بيانات الطالب:

الصف:
${
    grade ||
    "غير محدد"
}

المادة:
${subject}

الوحدة:
${
    unit ||
    "غير محدد"
}

الدرس:
${
    lesson ||
    "غير محدد"
}

نوع الجلسة:
${
    mode ||
    "دردشة عامة"
}
`;

            const preflight =
                buildPreflight(
                    message,
                    image
                );

            const complex =
                preflight.complexity >=
                5;

            const intent =
                detectQuestionIntent(
                    message
                );

            const systemInstructions =
                buildExpertInstructions({
                    complex,
                    hasImage:
                        Boolean(image),
                    intent
                });

            const contents = [];

            for (
                const item
                of history
            ) {
                if (
                    !item ||
                    !item.role ||
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

            const currentText = `
${systemInstructions}

${contextText}

${preflight.promptBlock}

السؤال الحالي:
${message}
`;

            const currentParts = [
                {
                    text: currentText
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

                parts: currentParts
            });

            console.log(
                "Physics Engine:",
                JSON.stringify({
                    complexity:
                        preflight.complexity,

                    complex,

                    intent,

                    domains:
                        preflight.domains.map(
                            x =>
                                x.name
                        ),

                    quantities:
                        preflight
                            .quantities
                            .length,

                    image:
                        Boolean(image)
                })
            );

            const response =
                await callGemini(
                    contents,
                    systemInstructions,
                    complex
                        ? 0.15
                        : 0.2
                );

            let answer =
                cleanPhysicsAnswer(
                    String(
                        response.text ||
                            ""
                    ).trim()
                );

            if (!answer) {
                return res.status(502).json({
                    error:
                        "Gemini لم يرجع إجابة."
                });
            }

            /*
             * المراجعة الثانية للمسائل المركبة
             *
             * لا نستخدمها في طلب الحل البسيط
             * حتى يفضل الرد مباشرًا.
             */

            if (
                complex &&
                intent !== "solution" &&
                process.env.PHYSICS_VERIFY !==
                    "false"
            ) {
                try {
                    const verified =
                        await verifyComplexAnswer({
                            question:
                                message,

                            draft:
                                answer,

                            contextText,

                            preflight,

                            image,

                            intent
                        });

                    if (verified) {
                        answer =
                            verified;
                    }
                } catch (
                    verifyError
                ) {
                    console.error(
                        "VERIFY ERROR:",
                        verifyError
                    );
                }
            }

            res.json({
                success: true,

                answer,

                physicsEngine: {
                    version:
                        "2.0",

                    complexity:
                        preflight
                            .complexity,

                    intent,

                    domains:
                        preflight
                            .domains
                            .map(
                                x =>
                                    x.name
                            ),

                    verified:
                        complex &&
                        intent !==
                            "solution" &&
                        process.env
                            .PHYSICS_VERIFY !==
                            "false"
                }
            });
        } catch (error) {
            console.error(
                "PHYSICS AI ERROR:",
                error
            );

            const status =
                Number(
                    error?.status ||
                        error?.statusCode ||
                        500
                );

            if (status === 429) {
                return res.status(429).json({
                    error:
                        "تم الوصول إلى حد الاستخدام الحالي. حاول بعد قليل."
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
                    "حصل خطأ أثناء تشغيل Physics AI."
            });
        }
    }
);

/* =========================================================
   AUDIO TRANSCRIPTION
========================================================= */

app.post(
    "/api/transcribe",
    requireLogin,
    audioUpload.single("audio"),
    async function (req, res) {
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

            const audioBase64 =
                req.file.buffer.toString(
                    "base64"
                );

            const mimeType =
                String(
                    req.file.mimetype ||
                        "audio/webm"
                )
                    .split(";")[0]
                    .trim();

            const response =
                await ai.models.generateContent(
                    {
                        model:
                            GEMINI_MODEL,

                        contents: [
                            {
                                text: `
استمع إلى التسجيل.

اكتب فقط كلام الطالب كنص.

استخدم العربية المصرية الطبيعية.

حافظ على المصطلحات العلمية والفيزيائية.

لا تشرح.

لا تحل السؤال.

لا تضف أي كلام من عندك.

لا تستخدم رموز غريبة.
`
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
                );

            const text =
                cleanPhysicsAnswer(
                    String(
                        response.text ||
                            ""
                    ).trim()
                );

            res.json({
                success: true,
                text
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
   HEALTH
========================================================= */

app.get(
    "/api/health",
    function (req, res) {
        res.json({
            success: true,

            message:
                "Physics AI is running",

            model:
                GEMINI_MODEL,

            loggedIn:
                Boolean(
                    req.session &&
                    req.session.userId
                )
        });
    }
);

/* =========================================================
   ERROR HANDLER
========================================================= */

app.use(
    function (
        error,
        req,
        res,
        next
    ) {
        console.error(
            "SERVER ERROR:",
            error
        );

        if (
            error &&
            error.code ===
                "LIMIT_FILE_SIZE"
        ) {
            return res.status(400).json({
                error:
                    "حجم الملف كبير جدًا."
            });
        }

        if (
            error &&
            error.message ===
                "يسمح برفع الصور فقط."
        ) {
            return res.status(400).json({
                error:
                    "يسمح برفع الصور فقط."
            });
        }

        if (
            error &&
            error.message ===
                "نوع الملف الصوتي غير مدعوم."
        ) {
            return res.status(400).json({
                error:
                    "نوع الملف الصوتي غير مدعوم."
            });
        }

        if (
            error &&
            error.name ===
                "MulterError"
        ) {
            return res.status(400).json({
                error:
                    "حصل خطأ في رفع الملف."
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
    function () {
        console.log(
            `Physics AI running on port ${PORT}`
        );

        console.log(
            "Model:",
            GEMINI_MODEL
        );

        console.log(
            "Authentication: READY"
        );

        console.log(
            "Database: READY"
        );

        console.log(
            "Physics AI: READY"
        );

        console.log(
            "Audio: READY"
        );

        console.log(
            "Image: READY"
        );
    }
);
