require("dotenv").config();

const express = require("express");
const path = require("path");
const cookieSession = require("cookie-session");
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
   APP CONFIG
========================================================= */

app.use(
    express.json({
        limit: "25mb"
    })
);

app.use(
    express.urlencoded({
        extended: true,
        limit: "25mb"
    })
);

/* =========================================================
   SESSION
========================================================= */

app.use(
    cookieSession({
        name: "physicsai.sid",

        keys: [
            process.env.SESSION_SECRET ||
            "physics-ai-session-secret-change-this"
        ],

        maxAge:
            1000 *
            60 *
            60 *
            24 *
            365,

        httpOnly: true,

        sameSite: "lax",

        secure:
            process.env.NODE_ENV === "production",

        path: "/"
    })
);

/* =========================================================
   STATIC FILES
========================================================= */

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);

/* =========================================================
   DATABASE
========================================================= */

const db = new Database(
    path.join(__dirname, "physics-ai.db")
);

db.pragma("journal_mode = WAL");

db.pragma("foreign_keys = ON");

/* =========================================================
   DATABASE TABLES
========================================================= */

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        name TEXT NOT NULL,

        email TEXT NOT NULL UNIQUE,

        password TEXT NOT NULL,

        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,

        user_id INTEGER NOT NULL,

        title TEXT NOT NULL DEFAULT 'دردشة جديدة',

        created_at TEXT NOT NULL,

        updated_at TEXT NOT NULL,

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

        created_at TEXT NOT NULL,

        FOREIGN KEY (conversation_id)
            REFERENCES conversations(id)
            ON DELETE CASCADE
    );
`);

/* =========================================================
   HELPERS
========================================================= */

function nowISO() {
    return new Date().toISOString();
}

function saveSession(req) {
    return Promise.resolve();
}

function regenerateSession(req) {
    req.session = {};

    return Promise.resolve();
}

function requireAuth(
    req,
    res,
    next
) {
    if (
        !req.session ||
        !req.session.userId
    ) {
        return res.status(401).json({
            error:
                "يجب تسجيل الدخول أولاً."
        });
    }

    next();
}

function cleanString(
    value,
    maxLength = 10000
) {
    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value)
        .trim()
        .slice(0, maxLength);
}

function normalizeEmail(email) {
    return cleanString(email, 320)
        .toLowerCase();
}

/* =========================================================
   MULTER
========================================================= */

const upload = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize:
            15 *
            1024 *
            1024
    }
});

/* =========================================================
   AUTH
========================================================= */

app.post(
    "/api/auth/register",
    async (req, res) => {
        try {
            const name =
                cleanString(
                    req.body?.name,
                    100
                );

            const email =
                normalizeEmail(
                    req.body?.email
                );

            const password =
                String(
                    req.body?.password ||
                        ""
                );

            if (!name) {
                return res
                    .status(400)
                    .json({
                        error:
                            "اكتب اسمك."
                    });
            }

            if (!email) {
                return res
                    .status(400)
                    .json({
                        error:
                            "اكتب البريد الإلكتروني."
                    });
            }

            if (
                password.length <
                6
            ) {
                return res
                    .status(400)
                    .json({
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
                return res
                    .status(409)
                    .json({
                        error:
                            "البريد الإلكتروني مستخدم بالفعل."
                    });
            }

            const hashedPassword =
                await bcrypt.hash(
                    password,
                    12
                );

            const createdAt =
                nowISO();

            const result =
                db.prepare(`
                    INSERT INTO users (
                        name,
                        email,
                        password,
                        created_at
                    )
                    VALUES (?, ?, ?, ?)
                `).run(
                    name,
                    email,
                    hashedPassword,
                    createdAt
                );

            await regenerateSession(
                req
            );

            req.session.userId =
                result.lastInsertRowid;

            req.session.userName =
                name;

            req.session.authenticated =
                true;

            await saveSession(req);

            return res.json({
                success: true,

                user: {
                    id:
                        result.lastInsertRowid,

                    name,

                    email
                }
            });
        } catch (error) {
            console.error(
                "REGISTER ERROR:",
                error
            );

            return res
                .status(500)
                .json({
                    error:
                        "حصل خطأ أثناء إنشاء الحساب."
                });
        }
    }
);

app.post(
    "/api/auth/login",
    async (req, res) => {
        try {
            const email =
                normalizeEmail(
                    req.body?.email
                );

            const password =
                String(
                    req.body?.password ||
                        ""
                );

            if (!email || !password) {
                return res
                    .status(400)
                    .json({
                        error:
                            "اكتب البريد وكلمة السر."
                    });
            }

            const user =
                db.prepare(`
                    SELECT *
                    FROM users
                    WHERE email = ?
                `).get(email);

            if (!user) {
                return res
                    .status(401)
                    .json({
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
                return res
                    .status(401)
                    .json({
                        error:
                            "البريد الإلكتروني أو كلمة السر غير صحيحة."
                    });
            }

            await regenerateSession(
                req
            );

            req.session.userId =
                user.id;

            req.session.userName =
                user.name;

            req.session.authenticated =
                true;

            await saveSession(req);

            return res.json({
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

            return res
                .status(500)
                .json({
                    error:
                        "حصل خطأ أثناء تسجيل الدخول."
                });
        }
    }
);

app.get(
    "/api/auth/me",
    (req, res) => {
        if (
            !req.session ||
            !req.session.userId
        ) {
            return res.json({
                authenticated: false
            });
        }

        const user =
            db.prepare(`
                SELECT
                    id,
                    name,
                    email,
                    created_at
                FROM users
                WHERE id = ?
            `).get(
                req.session.userId
            );

        if (!user) {
            return res.json({
                authenticated: false
            });
        }

        return res.json({
            authenticated: true,

            user
        });
    }
);

app.post(
    "/api/auth/logout",
    async (req, res) => {
        try {
            req.session = null;

            res.clearCookie(
                "physicsai.sid",
                {
                    httpOnly: true,

                    sameSite: "lax",

                    secure:
                        process.env.NODE_ENV ===
                        "production",

                    path: "/"
                }
            );

            return res.json({
                success: true
            });
        } catch (error) {
            console.error(
                "LOGOUT ERROR:",
                error
            );

            return res
                .status(500)
                .json({
                    error:
                        "حصل خطأ أثناء تسجيل الخروج."
                });
        }
    }
);

/* =========================================================
   CONVERSATIONS
========================================================= */

app.get(
    "/api/conversations",
    requireAuth,
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

            return res.json({
                conversations
            });
        } catch (error) {
            console.error(
                "GET CONVERSATIONS ERROR:",
                error
            );

            return res
                .status(500)
                .json({
                    error:
                        "حصل خطأ أثناء تحميل المحادثات."
                });
        }
    }
);

app.post(
    "/api/conversations",
    requireAuth,
    (req, res) => {
        try {
            const title =
                cleanString(
                    req.body?.title,
                    200
                ) ||
                "دردشة جديدة";

            const createdAt =
                nowISO();

            const result =
                db.prepare(`
                    INSERT INTO conversations (
                        user_id,
                        title,
                        created_at,
                        updated_at
                    )
                    VALUES (?, ?, ?, ?)
                `).run(
                    req.session.userId,
                    title,
                    createdAt,
                    createdAt
                );

            const conversation =
                db.prepare(`
                    SELECT
                        id,
                        title,
                        created_at,
                        updated_at
                    FROM conversations
                    WHERE id = ?
                `).get(
                    result.lastInsertRowid
                );

            return res.json({
                conversation
            });
        } catch (error) {
            console.error(
                "CREATE CONVERSATION ERROR:",
                error
            );

            return res
                .status(500)
                .json({
                    error:
                        "حصل خطأ أثناء إنشاء المحادثة."
                });
        }
    }
);

app.get(
    "/api/conversations/:id",
    requireAuth,
    (req, res) => {
        try {
            const conversationId =
                Number(req.params.id);

            if (
                !Number.isInteger(
                    conversationId
                )
            ) {
                return res
                    .status(400)
                    .json({
                        error:
                            "رقم المحادثة غير صحيح."
                    });
            }

            const conversation =
                db.prepare(`
                    SELECT
                        id,
                        title,
                        created_at,
                        updated_at
                    FROM conversations
                    WHERE id = ?
                    AND user_id = ?
                `).get(
                    conversationId,
                    req.session.userId
                );

            if (!conversation) {
                return res
                    .status(404)
                    .json({
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

            return res.json({
                conversation,

                messages
            });
        } catch (error) {
            console.error(
                "GET CONVERSATION ERROR:",
                error
            );

            return res
                .status(500)
                .json({
                    error:
                        "حصل خطأ أثناء تحميل المحادثة."
                });
        }
    }
);

app.get(
    "/api/conversations/:id/messages",
    requireAuth,
    (req, res) => {
        try {
            const conversationId =
                Number(req.params.id);

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
                return res
                    .status(404)
                    .json({
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

            return res.json({
                messages
            });
        } catch (error) {
            console.error(
                "GET MESSAGES ERROR:",
                error
            );

            return res
                .status(500)
                .json({
                    error:
                        "حصل خطأ أثناء تحميل الرسائل."
                });
        }
    }
);

app.delete(
    "/api/conversations/:id",
    requireAuth,
    (req, res) => {
        try {
            const conversationId =
                Number(req.params.id);

            const result =
                db.prepare(`
                    DELETE FROM conversations
                    WHERE id = ?
                    AND user_id = ?
                `).run(
                    conversationId,
                    req.session.userId
                );

            if (
                result.changes === 0
            ) {
                return res
                    .status(404)
                    .json({
                        error:
                            "المحادثة غير موجودة."
                    });
            }

            return res.json({
                success: true
            });
        } catch (error) {
            console.error(
                "DELETE CONVERSATION ERROR:",
                error
            );

            return res
                .status(500)
                .json({
                    error:
                        "حصل خطأ أثناء حذف المحادثة."
                });
        }
    }
);

/* =========================================================
   PHYSICS CONSTANTS
========================================================= */

const PHYSICS_CONSTANTS = {
    g: "9.81 m/s²",

    c: "3 × 10^8 m/s",

    h: "6.626 × 10^-34 J·s",

    G: "6.674 × 10^-11 N·m²/kg²",

    e:
        "1.602 × 10^-19 C",

    me:
        "9.109 × 10^-31 kg",

    mp:
        "1.673 × 10^-27 kg",

    R:
        "8.314 J/(mol·K)",

    k:
        "1.381 × 10^-23 J/K",

    epsilon0:
        "8.854 × 10^-12 F/m",

    mu0:
        "1.257 × 10^-6 H/m",

    NA:
        "6.022 × 10^23 mol^-1"
};

/* =========================================================
   UNIT FACTORS
========================================================= */

const UNIT_FACTORS = {
    length: {
        m: 1,
        cm: 0.01,
        mm: 0.001,
        km: 1000,
        inch: 0.0254,
        ft: 0.3048
    },

    mass: {
        kg: 1,
        g: 0.001,
        mg: 0.000001,
        ton: 1000
    },

    time: {
        s: 1,
        ms: 0.001,
        min: 60,
        h: 3600
    },

    speed: {
        "m/s": 1,
        "km/h":
            1000 / 3600,
        "cm/s": 0.01
    },

    force: {
        N: 1,
        kN: 1000
    },

    energy: {
        J: 1,
        kJ: 1000,
        MJ: 1000000,
        cal: 4.184,
        kcal: 4184,
        eV:
            1.602176634e-19
    },

    power: {
        W: 1,
        kW: 1000,
        MW: 1000000
    },

    pressure: {
        Pa: 1,
        kPa: 1000,
        MPa: 1000000,
        bar: 100000,
        atm:
            101325
    },

    charge: {
        C: 1,
        mC: 0.001,
        uC: 0.000001,
        nC: 0.000000001
    },

    voltage: {
        V: 1,
        mV: 0.001,
        kV: 1000
    },

    current: {
        A: 1,
        mA: 0.001,
        uA: 0.000001
    },

    frequency: {
        Hz: 1,
        kHz: 1000,
        MHz: 1000000,
        GHz: 1000000000
    }
};

/* =========================================================
   UNIT ALIASES
========================================================= */

const UNIT_ALIASES = {
    متر: "m",

    متر_مربع: "m²",

    متر_مكعب: "m³",

    سنتيمتر: "cm",

    سنتيمتر: "cm",

    مليمتر: "mm",

    كيلومتر: "km",

    جرام: "g",

    غرام: "g",

    كيلوجرام: "kg",

    كيلوغرام: "kg",

    مليجرام: "mg",

    ملليجرام: "mg",

    ثانية: "s",

    ثواني: "s",

    دقيقة: "min",

    دقائق: "min",

    ساعة: "h",

    ساعات: "h",

    نيوتن: "N",

    جول: "J",

    كيلوجول: "kJ",

    وات: "W",

    واط: "W",

    كيلووات: "kW",

    باسكال: "Pa",

    كيلوباسكال: "kPa",

    أمبير: "A",

    امبير: "A",

    ملي_أمبير: "mA",

    فولت: "V",

    ملي_فولت: "mV",

    كولوم: "C",

    ملي_كولوم: "mC",

    ميكروكولوم: "uC",

    هرتز: "Hz",

    كيلوهرتز: "kHz",

    ميجاهرتز: "MHz",

    جيجاهرتز: "GHz",

    متر_لكل_ثانية: "m/s",

    كيلومتر_لكل_ساعة: "km/h",

    درجة_مئوية: "C",

    سيلسيوس: "C",

    كلفن: "K"
};

/* =========================================================
   DOMAIN RULES
========================================================= */

const DOMAIN_RULES = {
    mechanics: [
        "قوة",
        "عجلة",
        "تسارع",
        "سرعة",
        "إزاحة",
        "مسافة",
        "زمن",
        "كتلة",
        "نيوتن",
        "احتكاك",
        "زخم",
        "كمية حركة",
        "طاقة حركية",
        "طاقة وضع",
        "شغل",
        "قدرة",
        "سقوط حر",
        "حركة"
    ],

    electricity: [
        "تيار",
        "جهد",
        "مقاومة",
        "كهرباء",
        "أوم",
        "كولوم",
        "شحنة",
        "دائرة",
        "بطارية",
        "مكثف",
        "حث",
        "فيض",
        "مجال كهربائي"
    ],

    waves: [
        "موجة",
        "تردد",
        "طول موجي",
        "سعة",
        "اهتزاز",
        "صوت",
        "سرعة الموجة",
        "تداخل",
        "حيود",
        "انعكاس"
    ],

    optics: [
        "عدسة",
        "مرآة",
        "بؤرة",
        "بؤري",
        "تكبير",
        "انكسار",
        "انعكاس الضوء",
        "ضوء",
        "شعاع",
        "منشور"
    ],

    thermodynamics: [
        "حرارة",
        "درجة حرارة",
        "كلفن",
        "غاز",
        "ضغط",
        "حجم",
        "تمدد",
        "انكماش",
        "ديناميكا حرارية",
        "حراري"
    ],

    modern: [
        "كم",
        "كمية حركة",
        "فوتون",
        "بلانك",
        "نسبية",
        "كتلة سكون",
        "طاقة سكون",
        "إلكترون",
        "ذرة",
        "نواة",
        "نصف عمر",
        "نشاط إشعاعي",
        "طيف"
    ],

    fluids: [
        "سائل",
        "لزوجة",
        "ضغط السائل",
        "كثافة",
        "طفو",
        "أرخميدس",
        "برنولي",
        "مائع",
        "معدل السريان"
    ]
};

/* =========================================================
   NORMALIZE ARABIC UNITS
========================================================= */

function normalizeArabicUnits(
    text
) {
    let result =
        String(text || "");

    const replacements = [
        [
            /كيلومتر\s*\/\s*ساعة/gi,
            "km/h"
        ],

        [
            /كيلو\s*متر\s*\/\s*ساعة/gi,
            "km/h"
        ],

        [
            /متر\s*\/\s*ثانية/gi,
            "m/s"
        ],

        [
            /متر\s*في\s*الثانية/gi,
            "m/s"
        ],

        [
            /متر\s*لكل\s*ثانية/gi,
            "m/s"
        ],

        [
            /كيلوجرام/gi,
            "kg"
        ],

        [
            /كيلوغرام/gi,
            "kg"
        ],

        [
            /جرام/gi,
            "g"
        ],

        [
            /غرام/gi,
            "g"
        ],

        [
            /سنتيمتر/gi,
            "cm"
        ],

        [
            /مليمتر/gi,
            "mm"
        ],

        [
            /كيلومتر/gi,
            "km"
        ],

        [
            /متر/gi,
            "m"
        ],

        [
            /ثانية/gi,
            "s"
        ],

        [
            /ثواني/gi,
            "s"
        ],

        [
            /دقيقة/gi,
            "min"
        ],

        [
            /دقائق/gi,
            "min"
        ],

        [
            /ساعة/gi,
            "h"
        ],

        [
            /ساعات/gi,
            "h"
        ],

        [
            /نيوتن/gi,
            "N"
        ],

        [
            /جول/gi,
            "J"
        ],

        [
            /وات/gi,
            "W"
        ],

        [
            /واط/gi,
            "W"
        ],

        [
            /أمبير/gi,
            "A"
        ],

        [
            /امبير/gi,
            "A"
        ],

        [
            /فولت/gi,
            "V"
        ],

        [
            /كولوم/gi,
            "C"
        ],

        [
            /هرتز/gi,
            "Hz"
        ]
    ];

    for (
        const [pattern, replacement]
        of replacements
    ) {
        result =
            result.replace(
                pattern,
                replacement
            );
    }

    return result;
}

/* =========================================================
   NORMALIZE NUMBER TOKENS
========================================================= */

function normalizeNumberToken(
    value
) {
    if (
        value === null ||
        value === undefined
    ) {
        return null;
    }

    let text =
        String(value)
            .trim()
            .replace(/،/g, ".")
            .replace(/٫/g, ".")
            .replace(/,/g, "");

    const arabicDigits = {
        "٠": "0",
        "١": "1",
        "٢": "2",
        "٣": "3",
        "٤": "4",
        "٥": "5",
        "٦": "6",
        "٧": "7",
        "٨": "8",
        "٩": "9"
    };

    text =
        text.replace(
            /[٠-٩]/g,
            (digit) =>
                arabicDigits[digit]
        );

    const result =
        Number(text);

    return Number.isFinite(result)
        ? result
        : null;
}

/* =========================================================
   EXTRACT QUANTITIES
========================================================= */

function extractQuantities(
    text
) {
    const normalized =
        normalizeArabicUnits(
            text
        );

    const quantities = [];

    const regex =
        /(-?\d+(?:\.\d+)?)\s*([a-zA-Z]+(?:\/[a-zA-Z]+)?|m\/s|km\/h|N|J|W|Pa|V|A|C|Hz)?/g;

    let match;

    while (
        (match =
            regex.exec(
                normalized
            )) !== null
    ) {
        const value =
            normalizeNumberToken(
                match[1]
            );

        if (
            value === null
        ) {
            continue;
        }

        quantities.push({
            value,

            unit:
                match[2] ||
                null
        });
    }

    return quantities;
}

/* =========================================================
   DETECT DOMAINS
========================================================= */

function detectDomains(
    text
) {
    const normalized =
        String(text || "")
            .toLowerCase();

    const found = [];

    for (
        const [
            domain,
            keywords
        ] of Object.entries(
            DOMAIN_RULES
        )
    ) {
        const matches =
            keywords.filter(
                (keyword) =>
                    normalized.includes(
                        keyword.toLowerCase()
                    )
            );

        if (
            matches.length > 0
        ) {
            found.push({
                domain,

                matches
            });
        }
    }

    return found;
}

/* =========================================================
   COMPLEXITY SCORE
========================================================= */

function complexityScore(
    text
) {
    const input =
        String(text || "");

    let score = 0;

    const quantities =
        extractQuantities(
            input
        );

    const domains =
        detectDomains(
            input
        );

    score +=
        Math.min(
            quantities.length * 2,
            10
        );

    score +=
        Math.min(
            domains.length * 3,
            12
        );

    const complexWords = [
        "أثبت",
        "برهن",
        "اشتق",
        "اشتقاق",
        "قارن",
        "احسب",
        "استنتج",
        "معادلة",
        "معادلات",
        "دائرة",
        "دوائر",
        "عدة",
        "مرحلة",
        "خطوات",
        "بيانات",
        "جدول",
        "رسم",
        "منحنى",
        "طاقة",
        "زخم",
        "مجال",
        "جهد",
        "تيار",
        "مقاومة",
        "موجة"
    ];

    for (
        const word
        of complexWords
    ) {
        if (
            input.includes(word)
        ) {
            score += 1;
        }
    }

    if (
        input.length > 500
    ) {
        score += 3;
    }

    if (
        input.length > 1000
    ) {
        score += 4;
    }

    return Math.min(
        score,
        30
    );
}

/* =========================================================
   PREFLIGHT
========================================================= */

function buildPreflight(
    question
) {
    const quantities =
        extractQuantities(
            question
        );

    const domains =
        detectDomains(
            question
        );

    const score =
        complexityScore(
            question
        );

    return {
        score,

        quantities,

        domains,

        normalized:
            normalizeArabicUnits(
                question
            )
    };
}

/* =========================================================
   PHYSICS CONSTANTS TEXT
========================================================= */

function getPhysicsConstantsText() {
    return Object.entries(
        PHYSICS_CONSTANTS
    )
        .map(
            ([key, value]) =>
                `${key} = ${value}`
        )
        .join("\n");
}

/* =========================================================
   QUESTION INTENT
========================================================= */

function detectQuestionIntent(
    text
) {
    const input =
        String(text || "")
            .trim();

    const lower =
        input.toLowerCase();

    const explainWords = [
        "اشرح",
        "شرح",
        "وضح",
        "توضيح",
        "فهمني",
        "مش فاهم",
        "مش فاهمة",
        "ليه",
        "لماذا",
        "ازاي",
        "كيف"
    ];

    const solveWords = [
        "حل",
        "احسب",
        "أوجد",
        "هات الناتج",
        "الناتج",
        "الإجابة",
        "الاجابة"
    ];

    const explain =
        explainWords.some(
            (word) =>
                input.includes(word)
        );

    const solve =
        solveWords.some(
            (word) =>
                input.includes(word)
        );

    if (
        explain
    ) {
        return "explain";
    }

    if (
        solve
    ) {
        return "solve";
    }

    return "normal";
}

/* =========================================================
   SIMPLE STYLE
========================================================= */

const SIMPLE_STYLE = `
اكتب إجاباتك بالعربية المصرية البسيطة المناسبة لطالب الثانوية العامة.

ممنوع استخدام الإيموجي.

ممنوع استخدام LaTeX.

ممنوع استخدام رموز رياضية معقدة.

ممنوع كتابة الضرب بالرمز * أو ×.

اكتب الضرب بكلمة "في".

اكتب القسمة بكلمة "على".

اكتب الأسس بالكلمات.
مثلاً:
v تربيع
a تربيع
r تربيع

بدلاً من:
v^2
a^2
r^2

استخدم علامات ترقيم عادية.

خلي الجمل قصيرة وواضحة.

لا تستخدم مصطلحات معقدة بدون شرحها.

لو الطالب قال "حل":
أعطِ الحل المطلوب والنتيجة بشكل مباشر بدون شرح طويل.

لو الطالب قال "اشرح":
اشرح الفكرة ثم القانون ثم التطبيق بالتدريج.

لو السؤال عادي:
جاوب بشكل طبيعي ومختصر وواضح.

لا تضف معلومات لا يحتاجها السؤال.

لا تخترع بيانات غير موجودة في السؤال.

لو توجد بيانات ناقصة تمنع الحل، اطلب البيانات الناقصة فقط.
`;

/* =========================================================
   EXPERT INSTRUCTIONS
========================================================= */

function buildExpertInstructions(
    question,
    history = []
) {
    const preflight =
        buildPreflight(
            question
        );

    const intent =
        detectQuestionIntent(
            question
        );

    const domainsText =
        preflight.domains
            .map(
                (item) =>
                    `${item.domain}: ${item.matches.join(", ")}`
            )
            .join("\n");

    const quantitiesText =
        preflight.quantities
            .map(
                (item) =>
                    `${item.value} ${item.unit || ""}`.trim()
            )
            .join(", ");

    return `
أنت Physics AI، مدرس فيزياء مصري متخصص في مساعدة طلاب الثانوية العامة.

${SIMPLE_STYLE}

قواعد الدقة:

1. اقرأ السؤال بالكامل قبل الإجابة.

2. حدد المطلوب فعلاً.

3. استخرج المعطيات.

4. تأكد من الوحدات.

5. لا تخلط بين الكميات الفيزيائية.

6. استخدم القانون الفيزيائي الصحيح فقط.

7. لا تفترض قيمة غير موجودة.

8. لو توجد أكثر من خطوة، نفذها داخلياً بالترتيب.

9. راجع الحساب قبل إرسال النتيجة.

10. لو هناك تعارض بين بيانات السؤال والقانون، وضح المشكلة.

11. لا تستخدم قانوناً من مجال مختلف.

12. لا تقدم نتيجة رقمية إذا كانت البيانات لا تسمح بها.

13. حافظ على الوحدات.

14. إذا كان السؤال اختيار من متعدد، حدد الاختيار الصحيح مع سبب مختصر عند الحاجة.

15. إذا كان السؤال يحتوي على صورة، اقرأ الصورة بدقة وحاول استخراج الرسم أو البيانات أو النص منها.

16. لا تقل إنك لا تستطيع رؤية الصورة إذا كانت البيانات متاحة في الرسالة.

17. إذا كانت الصورة غير واضحة فعلاً، اطلب صورة أوضح.

18. لا تخترع أي بيانات من صورة غير واضحة.

19. في المسائل الحسابية، احسب النتيجة بدقة.

20. راجع الإشارة الموجبة والسالبة.

21. راجع الأسس.

22. راجع تحويل الوحدات.

23. لا تكتب كلاماً مثل "ربما" إذا كانت الإجابة مؤكدة.

24. إذا كان هناك أكثر من تفسير ممكن للسؤال، اختر التفسير الأكثر منطقية واذكر الافتراض باختصار.

نية السؤال:
${intent}

درجة التعقيد:
${preflight.score}

المجالات المكتشفة:
${domainsText || "غير محدد"}

الكميات المستخرجة:
${quantitiesText || "لا توجد كميات رقمية واضحة"}

الثوابت الفيزيائية المتاحة:
${getPhysicsConstantsText()}

سؤال الطالب:
${question}

مهم جداً:
لا تعرض التحليل الداخلي أو خطوات التفكير الخاصة بك.
اعرض فقط الإجابة النهائية المناسبة للطالب.
`;
}

/* =========================================================
   CLEAN PHYSICS ANSWER
========================================================= */

function cleanPhysicsAnswer(
    answer
) {
    let output =
        String(answer || "");

    output =
        output.replace(
            /```[\s\S]*?```/g,
            (block) =>
                block
                    .replace(/```/g, "")
                    .trim()
        );

    output =
        output.replace(
            /\$\$[\s\S]*?\$\$/g,
            ""
        );

    output =
        output.replace(
            /\$([^$]+)\$/g,
            "$1"
        );

    output =
        output.replace(
            /\\frac\s*\{([^}]*)\}\s*\{([^}]*)\}/g,
            "$1 على $2"
        );

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
            /\*/g,
            " في "
        );

    output =
        output.replace(
            /×/g,
            " في "
        );

    output =
        output.replace(
            /\^2/g,
            " تربيع"
        );

    output =
        output.replace(
            /\^3/g,
            " تكعيب"
        );

    output =
        output.replace(
            /\^([0-9]+)/g,
            " أس $1"
        );

    output =
        output.replace(
            /\/+/g,
            " على "
        );

    output =
        output.replace(
            /\\sqrt\s*\{([^}]*)\}/g,
            "الجذر التربيعي لـ $1"
        );

    output =
        output.replace(
            /\\left/g,
            ""
        );

    output =
        output.replace(
            /\\right/g,
            ""
        );

    output =
        output.replace(
            /\\text\s*\{([^}]*)\}/g,
            "$1"
        );

    output =
        output.replace(
            /\s{2,}/g,
            " "
        );

    output =
        output.replace(
            /\n{3,}/g,
            "\n\n"
        );

    return output.trim();
}

/* =========================================================
   GEMINI RETRY SYSTEM
========================================================= */

function getGeminiStatus(
    error
) {
    return Number(
        error?.status ||
            error?.statusCode ||
            error?.response?.status ||
            0
    );
}

function getRetryAfterMs(
    error
) {
    const retryAfter =
        error?.response?.headers?.get?.(
            "retry-after"
        ) ??
        error?.headers?.get?.(
            "retry-after"
        ) ??
        error?.response?.headers?.[
            "retry-after"
        ] ??
        error?.headers?.[
            "retry-after"
        ];

    const seconds =
        Number(
            retryAfter
        );

    if (
        Number.isFinite(
            seconds
        ) &&
        seconds > 0
    ) {
        return Math.min(
            seconds * 1000,
            15000
        );
    }

    return 0;
}

function isRetryableGeminiError(
    error
) {
    const status =
        getGeminiStatus(
            error
        );

    return (
        status === 429 ||
        status === 503 ||
        status === 502 ||
        status === 504 ||
        status === 408
    );
}

async function generateGeminiWithRetry(
    options,
    label = "Gemini"
) {
    const maxRetries = 3;

    const baseDelay = 1000;

    let lastError;

    for (
        let attempt = 0;
        attempt <= maxRetries;
        attempt++
    ) {
        try {
            return await ai.models.generateContent(
                options
            );
        } catch (error) {
            lastError = error;

            const status =
                getGeminiStatus(
                    error
                );

            if (
                !isRetryableGeminiError(
                    error
                ) ||
                attempt ===
                    maxRetries
            ) {
                throw error;
            }

            const retryAfter =
                getRetryAfterMs(
                    error
                );

            const exponential =
                Math.min(
                    baseDelay *
                        2 **
                            attempt,
                    8000
                );

            const jitter =
                Math.floor(
                    Math.random() *
                        500
                );

            const delay =
                Math.max(
                    retryAfter,
                    exponential +
                        jitter
                );

            console.warn(
                `${label}: retry ${
                    attempt + 1
                }/${maxRetries} after ${delay}ms (status ${status})`
            );

            await new Promise(
                (resolve) =>
                    setTimeout(
                        resolve,
                        delay
                    )
            );
        }
    }

    throw lastError;
}

/* =========================================================
   GEMINI CALL
========================================================= */

async function callGemini(
    contents,
    systemInstruction,
    temperature = 0.2
) {
    return generateGeminiWithRetry(
        {
            model:
                GEMINI_MODEL,

            contents,

            config: {
                temperature,

                systemInstruction
            }
        },
        "Gemini"
    );
}

/* =========================================================
   VERIFY COMPLEX ANSWER
========================================================= */

async function verifyComplexAnswer({
    question,
    answer,
    preflight
}) {
    try {
        if (
            !answer ||
            preflight.score < 8
        ) {
            return answer;
        }

        const verificationPrompt = `
أنت مراجع فيزياء.

راجع الإجابة التالية مقابل سؤال الطالب.

لا تعيد كتابة الإجابة بالكامل إلا إذا كان هناك خطأ.

افحص:

- القانون
- الحساب
- الوحدات
- الإشارات
- الأسس
- النتيجة
- هل تم فهم المطلوب بشكل صحيح

إذا كانت الإجابة صحيحة:
أعدها كما هي تقريباً.

إذا كان بها خطأ:
صحح الخطأ.

ممنوع استخدام LaTeX.
ممنوع الرموز الرياضية المعقدة.
استخدم العربية المصرية البسيطة.

السؤال:
${question}

الإجابة:
${answer}

المجالات:
${JSON.stringify(
    preflight.domains
)}

الكميات:
${JSON.stringify(
    preflight.quantities
)}
`;

        const response =
            await callGemini(
                [
                    {
                        role: "user",

                        parts: [
                            {
                                text:
                                    verificationPrompt
                            }
                        ]
                    }
                ],
                SIMPLE_STYLE,
                0.1
            );

        const verified =
            cleanPhysicsAnswer(
                String(
                    response.text ||
                        answer
                )
            );

        return (
            verified ||
            answer
        );
    } catch (error) {
        console.error(
            "VERIFY ERROR:",
            error
        );

        return answer;
    }
}

/* =========================================================
   CHAT MEMORY
========================================================= */

function getConversationHistory(
    conversationId,
    limit = 20
) {
    const safeLimit =
        Math.max(
            1,
            Math.min(
                Number(limit) ||
                    20,
                40
            )
        );

    const messages =
        db.prepare(`
            SELECT
                role,
                content,
                image,
                created_at
            FROM messages
            WHERE conversation_id = ?
            ORDER BY id DESC
            LIMIT ${safeLimit}
        `).all(
            conversationId
        );

    return messages.reverse();
}

/* =========================================================
   BUILD GEMINI HISTORY
========================================================= */

function buildGeminiHistory(
    messages
) {
    return messages.map(
        (message) => {
            const parts = [];

            if (
                message.content
            ) {
                parts.push({
                    text:
                        message.content
                });
            }

            if (
                message.image
            ) {
                const image =
                    String(
                        message.image
                    );

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

            return {
                role:
                    message.role ===
                    "assistant"
                        ? "model"
                        : "user",

                parts
            };
        }
    );
}

/* =========================================================
   CHAT API
========================================================= */

app.post(
    "/api/chat",
    requireAuth,
    async (req, res) => {
        try {
            const question =
                cleanString(
                    req.body?.message,
                    20000
                );

            let conversationId =
                Number(
                    req.body
                        ?.conversationId
                );

            const image =
                cleanString(
                    req.body?.image,
                    20000000
                );

            if (
                !question &&
                !image
            ) {
                return res
                    .status(400)
                    .json({
                        error:
                            "اكتب سؤالك أو أرسل صورة."
                    });
            }

            if (
                !Number.isInteger(
                    conversationId
                ) ||
                conversationId <= 0
            ) {
                const createdAt =
                    nowISO();

                const title =
                    question
                        ? question.slice(
                              0,
                              80
                          )
                        : "دردشة جديدة";

                const result =
                    db.prepare(`
                        INSERT INTO conversations (
                            user_id,
                            title,
                            created_at,
                            updated_at
                        )
                        VALUES (?, ?, ?, ?)
                    `).run(
                        req.session.userId,
                        title,
                        createdAt,
                        createdAt
                    );

                conversationId =
                    Number(
                        result.lastInsertRowid
                    );
            }

            const conversation =
                db.prepare(`
                    SELECT
                        id,
                        title
                    FROM conversations
                    WHERE id = ?
                    AND user_id = ?
                `).get(
                    conversationId,
                    req.session.userId
                );

            if (!conversation) {
                return res
                    .status(404)
                    .json({
                        error:
                            "المحادثة غير موجودة."
                    });
            }

            const previousMessages =
                getConversationHistory(
                    conversationId,
                    20
                );

            const userMessageText =
                question ||
                "أريد المساعدة في فهم الصورة.";

            const preflight =
                buildPreflight(
                    userMessageText
                );

            const systemInstruction =
                buildExpertInstructions(
                    userMessageText,
                    previousMessages
                );

            const history =
                buildGeminiHistory(
                    previousMessages
                );

            const userParts = [];

            userParts.push({
                text:
                    userMessageText
            });

            if (image) {
                const match =
                    image.match(
                        /^data:([^;]+);base64,(.+)$/
                    );

                if (match) {
                    userParts.push({
                        inlineData: {
                            mimeType:
                                match[1],

                            data:
                                match[2]
                        }
                    });
                }
            }

            history.push({
                role: "user",

                parts: userParts
            });

            const response =
                await callGemini(
                    history,
                    systemInstruction,
                    0.2
                );

            let answer =
                cleanPhysicsAnswer(
                    String(
                        response.text ||
                            ""
                    )
                );

            if (!answer) {
                answer =
                    "مقدرتش أطلع إجابة من السؤال ده. حاول تكتبه بطريقة أوضح.";
            }

            if (
                preflight.score >=
                8
            ) {
                answer =
                    await verifyComplexAnswer(
                        {
                            question:
                                userMessageText,

                            answer,

                            preflight
                        }
                    );
            }

            const createdAt =
                nowISO();

            db.prepare(`
                INSERT INTO messages (
                    conversation_id,
                    role,
                    content,
                    image,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?)
            `).run(
                conversationId,
                "user",
                userMessageText,
                image || null,
                createdAt
            );

            db.prepare(`
                INSERT INTO messages (
                    conversation_id,
                    role,
                    content,
                    image,
                    created_at
                )
                VALUES (?, ?, ?, ?, ?)
            `).run(
                conversationId,
                "assistant",
                answer,
                null,
                createdAt
            );

            db.prepare(`
                UPDATE conversations
                SET updated_at = ?
                WHERE id = ?
                AND user_id = ?
            `).run(
                createdAt,
                conversationId,
                req.session.userId
            );

            return res.json({
                success: true,

                conversationId,

                answer,

                message: answer
            });
        } catch (error) {
            console.error(
                "CHAT ERROR:",
                error
            );

            const status =
                getGeminiStatus(
                    error
                );

            if (
                status === 429
            ) {
                return res
                    .status(429)
                    .json({
                        error:
                            "تم الوصول إلى حد الاستخدام الحالي بعد عدة محاولات تلقائية. حاول بعد قليل."
                    });
            }

            if (
                status === 401 ||
                status === 403
            ) {
                return res
                    .status(500)
                    .json({
                        error:
                            "مفتاح Gemini غير صحيح أو غير مصرح باستخدامه."
                    });
            }

            if (
                status === 502 ||
                status === 503 ||
                status === 504 ||
                status === 408
            ) {
                return res
                    .status(503)
                    .json({
                        error:
                            "Gemini مشغول حاليًا. حاول بعد قليل."
                    });
            }

            return res
                .status(500)
                .json({
                    error:
                        "حصل خطأ أثناء تشغيل Physics AI."
                });
        }
    }
);

/* =========================================================
   TRANSCRIPTION
========================================================= */

app.post(
    "/api/transcribe",
    requireAuth,
    upload.single("audio"),
    async (req, res) => {
        try {
            if (!req.file) {
                return res
                    .status(400)
                    .json({
                        error:
                            "لم يتم إرسال تسجيل صوتي."
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
                await generateGeminiWithRetry(
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
                    },
                    "Transcription"
                );

            const text =
                cleanPhysicsAnswer(
                    String(
                        response.text ||
                            ""
                    )
                );

            return res.json({
                success: true,

                text
            });
        } catch (error) {
            console.error(
                "TRANSCRIBE ERROR:",
                error
            );

            const status =
                getGeminiStatus(
                    error
                );

            if (
                status === 429
            ) {
                return res
                    .status(429)
                    .json({
                        error:
                            "تم الوصول إلى حد استخدام Gemini. حاول بعد قليل."
                    });
            }

            if (
                status === 401 ||
                status === 403
            ) {
                return res
                    .status(500)
                    .json({
                        error:
                            "مفتاح Gemini غير صحيح أو غير مصرح باستخدامه."
                    });
            }

            if (
                status === 502 ||
                status === 503 ||
                status === 504 ||
                status === 408
            ) {
                return res
                    .status(503)
                    .json({
                        error:
                            "خدمة الصوت مشغولة حاليًا. حاول بعد قليل."
                    });
            }

            return res
                .status(500)
                .json({
                    error:
                        "حصل خطأ أثناء تحويل التسجيل إلى نص."
                });
        }
    }
);

/* =========================================================
   HEALTH
========================================================= */

app.get(
    "/api/health",
    (req, res) => {
        return res.json({
            status: "ok",

            model:
                GEMINI_MODEL,

            database:
                "ready",

            physicsAI:
                "ready",

            audio:
                "ready",

            image:
                "ready",

            timestamp:
                nowISO()
        });
    }
);

/* =========================================================
   ROOT ROUTES
========================================================= */

app.get(
    "/",
    (req, res) => {
        return res.sendFile(
            path.join(
                __dirname,
                "public",
                "index.html"
            )
        );
    }
);

app.get(
    "/login",
    (req, res) => {
        return res.sendFile(
            path.join(
                __dirname,
                "public",
                "login.html"
            )
        );
    }
);

app.get(
    "/study",
    (req, res) => {
        return res.sendFile(
            path.join(
                __dirname,
                "public",
                "study.html"
            )
        );
    }
);

app.get(
    "/chat",
    (req, res) => {
        return res.sendFile(
            path.join(
                __dirname,
                "public",
                "chat.html"
            )
        );
    }
);

/* =========================================================
   ERROR HANDLER
========================================================= */

app.use(
    (
        error,
        req,
        res,
        next
    ) => {
        console.error(
            "GLOBAL ERROR:",
            error
        );

        if (
            error instanceof
            multer.MulterError
        ) {
            return res
                .status(400)
                .json({
                    error:
                        "حجم الملف كبير أو نوع الملف غير مدعوم."
                });
        }

        return res
            .status(500)
            .json({
                error:
                    "حصل خطأ غير متوقع في السيرفر."
            });
    }
);

/* =========================================================
   START SERVER
========================================================= */

const server =
    app.listen(
        PORT,
        () => {
            console.log(
                ""
            );

            console.log(
                "========================================"
            );

            console.log(
                "        PHYSICS AI SERVER"
            );

            console.log(
                "========================================"
            );

            console.log(
                "Port:",
                PORT
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

            console.log(
                "Gemini Retry System: READY"
            );

            console.log(
                "========================================"
            );

            console.log(
                ""
            );
        }
    );

/* =========================================================
   GRACEFUL SHUTDOWN
========================================================= */

function shutdown(
    signal
) {
    console.log(
        `${signal} received. Shutting down...`
    );

    server.close(
        () => {
            try {
                db.close();
            } catch (
                error
            ) {
                console.error(
                    "DB CLOSE ERROR:",
                    error
                );
            }

            process.exit(0);
        }
    );
}

process.on(
    "SIGTERM",
    () =>
        shutdown(
            "SIGTERM"
        )
);

process.on(
    "SIGINT",
    () =>
        shutdown(
            "SIGINT"
        )
);
