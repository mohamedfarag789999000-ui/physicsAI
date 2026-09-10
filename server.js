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

/* =========================================================
   SERVER / RENDER
========================================================= */

const PORT = Number(process.env.PORT || 10000);

app.set("trust proxy", 1);

/* =========================================================
   GEMINI
========================================================= */

const GEMINI_API_KEY =
    process.env.GEMINI_API_KEY || "";

const GEMINI_MODEL =
    process.env.GEMINI_MODEL ||
    "gemini-3.6-flash";

if (!GEMINI_API_KEY) {
    console.error(
        "ERROR: GEMINI_API_KEY غير موجود في Environment Variables."
    );
}

const ai = GEMINI_API_KEY
    ? new GoogleGenAI({
          apiKey: GEMINI_API_KEY
      })
    : null;

/* =========================================================
   DATABASE
========================================================= */

const db = new Database(
    path.join(
        __dirname,
        "physics-ai.db"
    )
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

/*
 * مهم جدًا على Render:
 * trust proxy موجود فوق
 * و secure:auto يسمح لـ express-session
 * يحدد Secure حسب HTTPS.
 */
app.use(
    session({
        name: "physicsai.sid",

        secret:
            process.env.SESSION_SECRET ||
            "physics-ai-production-session-secret-change-this",

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
        path.join(
            __dirname,
            "public"
        )
    )
);

/* =========================================================
   MULTER - IMAGE
========================================================= */

const imageUpload = multer({
    storage:
        multer.memoryStorage(),

    limits: {
        fileSize:
            10 *
            1024 *
            1024
    },

    fileFilter:
        function (
            req,
            file,
            cb
        ) {
            if (
                file.mimetype &&
                file.mimetype.startsWith(
                    "image/"
                )
            ) {
                return cb(
                    null,
                    true
                );
            }

            cb(
                new Error(
                    "يسمح برفع الصور فقط."
                )
            );
        }
});

/* =========================================================
   MULTER - AUDIO
========================================================= */

const audioUpload = multer({
    storage:
        multer.memoryStorage(),

    limits: {
        fileSize:
            25 *
            1024 *
            1024
    },

    fileFilter:
        function (
            req,
            file,
            cb
        ) {
            const mimeType =
                String(
                    file.mimetype ||
                        ""
                )
                    .toLowerCase()
                    .split(";")[0];

            if (
                mimeType.startsWith(
                    "audio/"
                )
            ) {
                return cb(
                    null,
                    true
                );
            }

            cb(
                new Error(
                    "نوع الملف الصوتي غير مدعوم."
                )
            );
        }
});

/* =========================================================
   HELPERS
========================================================= */

function cleanText(
    value,
    maxLength = 10000
) {
    return String(
        value || ""
    )
        .trim()
        .slice(0, maxLength);
}

function requireLogin(
    req,
    res,
    next
) {
    if (
        !req.session ||
        !req.session.userId
    ) {
        return res.status(
            401
        ).json({
            error:
                "لازم تسجل دخول الأول."
        });
    }

    next();
}

function saveSession(
    req,
    res,
    payload
) {
    req.session.save(
        function (error) {
            if (error) {
                console.error(
                    "SESSION SAVE ERROR:",
                    error
                );

                return res.status(
                    500
                ).json({
                    error:
                        "تعذر حفظ جلسة الدخول. حاول مرة أخرى."
                });
            }

            res.json(payload);
        }
    );
}

/* =========================================================
   HOME
========================================================= */

app.get(
    "/",
    function (
        req,
        res
    ) {
        res.sendFile(
            path.join(
                __dirname,
                "public",
                "index.html"
            )
        );
    }
);

/* =========================================================
   HEALTH
========================================================= */

app.get(
    "/api/health",
    function (
        req,
        res
    ) {
        res.json({
            success:
                true,

            server:
                "online",

            model:
                GEMINI_MODEL,

            session:
                Boolean(
                    req.session &&
                    req.session.userId
                ),

            time:
                new Date().toISOString()
        });
    }
);

/* =========================================================
   REGISTER
========================================================= */

app.post(
    "/api/auth/register",
    async function (
        req,
        res
    ) {
        try {
            const name =
                cleanText(
                    req.body.name,
                    80
                );

            const email =
                cleanText(
                    req.body.email,
                    160
                ).toLowerCase();

            const password =
                String(
                    req.body.password ||
                        ""
                );

            if (!name) {
                return res.status(
                    400
                ).json({
                    error:
                        "اكتب اسمك."
                });
            }

            if (!email) {
                return res.status(
                    400
                ).json({
                    error:
                        "اكتب البريد الإلكتروني."
                });
            }

            if (
                !email.includes("@")
            ) {
                return res.status(
                    400
                ).json({
                    error:
                        "اكتب بريد إلكتروني صحيح."
                });
            }

            if (
                password.length <
                6
            ) {
                return res.status(
                    400
                ).json({
                    error:
                        "كلمة السر لازم تكون 6 أحرف على الأقل."
                });
            }

            const existingUser =
                db.prepare(`
                    SELECT id
                    FROM users
                    WHERE email = ?
                `).get(
                    email
                );

            if (existingUser) {
                return res.status(
                    409
                ).json({
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
                    (
                        name,
                        email,
                        password
                    )
                    VALUES (?, ?, ?)
                `).run(
                    name,
                    email,
                    hashedPassword
                );

            req.session.userId =
                result.lastInsertRowid;

            req.session.userName =
                name;

            req.session.authenticated =
                true;

            saveSession(
                req,
                res,
                {
                    success:
                        true,

                    user: {
                        id:
                            result.lastInsertRowid,

                        name,

                        email
                    }
                }
            );

        } catch (error) {
            console.error(
                "REGISTER ERROR:",
                error
            );

            res.status(
                500
            ).json({
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
    async function (
        req,
        res
    ) {
        try {
            const email =
                cleanText(
                    req.body.email,
                    160
                ).toLowerCase();

            const password =
                String(
                    req.body.password ||
                        ""
                );

            if (
                !email ||
                !password
            ) {
                return res.status(
                    400
                ).json({
                    error:
                        "اكتب البريد الإلكتروني وكلمة السر."
                });
            }

            const user =
                db.prepare(`
                    SELECT *
                    FROM users
                    WHERE email = ?
                `).get(
                    email
                );

            if (!user) {
                return res.status(
                    401
                ).json({
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
                return res.status(
                    401
                ).json({
                    error:
                        "البريد الإلكتروني أو كلمة السر غير صحيحة."
                });
            }

            /*
             * إعادة إنشاء session ID
             * لتقليل مشاكل الجلسات القديمة.
             */
            req.session.regenerate(
                function (
                    sessionError
                ) {
                    if (
                        sessionError
                    ) {
                        console.error(
                            "SESSION REGENERATE ERROR:",
                            sessionError
                        );

                        return res.status(
                            500
                        ).json({
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

                    saveSession(
                        req,
                        res,
                        {
                            success:
                                true,

                            user: {
                                id:
                                    user.id,

                                name:
                                    user.name,

                                email:
                                    user.email
                            }
                        }
                    );
                }
            );

        } catch (error) {
            console.error(
                "LOGIN ERROR:",
                error
            );

            res.status(
                500
            ).json({
                error:
                    "حصل خطأ أثناء تسجيل الدخول."
            });
        }
    }
);

/* =========================================================
   CURRENT USER
========================================================= */

app.get(
    "/api/auth/me",
    function (
        req,
        res
    ) {
        try {
            if (
                !req.session ||
                !req.session.userId
            ) {
                return res.json({
                    loggedIn:
                        false
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
                return req.session.destroy(
                    function () {
                        res.clearCookie(
                            "physicsai.sid"
                        );

                        res.json({
                            loggedIn:
                                false
                        });
                    }
                );
            }

            res.json({
                loggedIn:
                    true,

                user
            });

        } catch (error) {
            console.error(
                "AUTH ME ERROR:",
                error
            );

            res.status(
                500
            ).json({
                error:
                    "تعذر التحقق من جلسة المستخدم."
            });
        }
    }
);

/* =========================================================
   LOGOUT
========================================================= */

app.post(
    "/api/auth/logout",
    function (
        req,
        res
    ) {
        req.session.destroy(
            function (
                error
            ) {
                if (error) {
                    console.error(
                        "LOGOUT ERROR:",
                        error
                    );

                    return res.status(
                        500
                    ).json({
                        error:
                            "تعذر تسجيل الخروج."
                    });
                }

                res.clearCookie(
                    "physicsai.sid",
                    {
                        path: "/"
                    }
                );

                /*
                 * دعم cookie القديمة أيضًا.
                 */
                res.clearCookie(
                    "connect.sid",
                    {
                        path: "/"
                    }
                );

                res.json({
                    success:
                        true
                });
            }
        );
    }
);

/* =========================================================
   CONVERSATIONS
========================================================= */

app.post(
    "/api/conversations",
    requireLogin,
    function (
        req,
        res
    ) {
        try {
            const title =
                cleanText(
                    req.body.title,
                    120
                ) ||
                "محادثة جديدة";

            const result =
                db.prepare(`
                    INSERT INTO conversations
                    (
                        user_id,
                        title
                    )
                    VALUES (?, ?)
                `).run(
                    req.session.userId,
                    title
                );

            res.json({
                success:
                    true,

                conversation: {
                    id:
                        result.lastInsertRowid,

                    title
                }
            });

        } catch (error) {
            console.error(
                "CREATE CONVERSATION ERROR:",
                error
            );

            res.status(
                500
            ).json({
                error:
                    "تعذر إنشاء المحادثة."
            });
        }
    }
);

app.get(
    "/api/conversations",
    requireLogin,
    function (
        req,
        res
    ) {
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

            res.status(
                500
            ).json({
                error:
                    "تعذر تحميل المحادثات."
            });
        }
    }
);

app.get(
    "/api/conversations/:id",
    requireLogin,
    function (
        req,
        res
    ) {
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
                return res.status(
                    400
                ).json({
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
                return res.status(
                    404
                ).json({
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

            res.status(
                500
            ).json({
                error:
                    "تعذر تحميل المحادثة."
            });
        }
    }
);

app.delete(
    "/api/conversations/:id",
    requireLogin,
    function (
        req,
        res
    ) {
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

            if (
                !result.changes
            ) {
                return res.status(
                    404
                ).json({
                    error:
                        "المحادثة غير موجودة."
                });
            }

            res.json({
                success:
                    true
            });

        } catch (error) {
            console.error(
                "DELETE CONVERSATION ERROR:",
                error
            );

            res.status(
                500
            ).json({
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
    function (
        req,
        res
    ) {
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
                cleanText(
                    req.body.content,
                    50000
                );

            let image =
                req.body.image ||
                null;

            if (
                typeof image ===
                    "string" &&
                image.length >
                    8_000_000
            ) {
                image = null;
            }

            if (!content) {
                return res.status(
                    400
                ).json({
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
                return res.status(
                    404
                ).json({
                    error:
                        "المحادثة غير موجودة."
                });
            }

            const result =
                db.prepare(`
                    INSERT INTO messages
                    (
                        conversation_id,
                        role,
                        content,
                        image
                    )
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
                success:
                    true,

                message: {
                    id:
                        result.lastInsertRowid,

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

            res.status(
                500
            ).json({
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
    g:
        9.80665,

    c:
        299792458,

    h:
        6.62607015e-34,

    hbar:
        1.054571817e-34,

    e:
        1.602176634e-19,

    me:
        9.1093837139e-31,

    mp:
        1.67262192595e-27,

    eps0:
        8.8541878128e-12,

    mu0:
        1.25663706212e-6,

    G:
        6.67430e-11,

    kB:
        1.380649e-23,

    R:
        8.31446261815324,

    NA:
        6.02214076e23
};

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
    µA: 1e-6,

    C: 1,
    mC: 1e-3,

    ohm: 1,
    Ω: 1,

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
            "زاوية",
            "سرعة زاوية",
            "تسارع زاوي",
            "اتزان"
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
            "قانون كبلر",
            "سرعة الإفلات",
            "كتلة الأرض"
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
            "حث ذاتي",
            "قدرة كهربائية"
        ]
    },

    {
        name:
            "المغناطيسية والحث",

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
    },

    {
        name:
            "الكهرومغناطيسية المتقدمة",

        keys: [
            "ماكسويل",
            "جاوس",
            "أمبير-ماكسويل",
            "موجة كهرومغناطيسية",
            "استقطاب"
        ]
    }
];

/* =========================================================
   PHYSICS ANALYSIS
========================================================= */

function normalizeArabicUnits(
    text
) {
    let output =
        String(
            text || ""
        );

    for (
        const [
            arabic,
            english
        ] of Object.entries(
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

function normalizeNumberToken(
    raw
) {
    const value =
        String(
            raw || ""
        )
            .replace(
                /,/g,
                "."
            )
            .trim();

    const number =
        Number(value);

    return Number.isFinite(
        number
    )
        ? number
        : null;
}

function escapeRegex(
    value
) {
    return String(
        value
    ).replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
    );
}

function extractQuantities(
    text
) {
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

    const unitPattern =
        Object.keys(
            UNIT_FACTORS
        )
            .sort(
                (
                    a,
                    b
                ) =>
                    b.length -
                    a.length
            )
            .map(
                escapeRegex
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
        (match =
            regex.exec(
                source
            )) &&
        result.length < 80
    ) {
        const value =
            normalizeNumberToken(
                match[1]
            );

        const unit =
            match[2];

        if (
            value === null
        ) {
            continue;
        }

        const factor =
            UNIT_FACTORS[
                unit
            ] ?? 1;

        result.push({
            raw:
                match[0],

            value,

            unit,

            siValue:
                value * factor
        });
    }

    return result;
}

function detectDomains(
    text
) {
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

        if (
            score > 0
        ) {
            scores.push({
                name:
                    rule.name,

                score
            });
        }
    }

    return scores
        .sort(
            (
                a,
                b
            ) =>
                b.score -
                a.score
        )
        .slice(0, 5);
}

function complexityScore(
    text,
    quantities,
    domains,
    hasImage
) {
    const source =
        String(
            text || ""
        );

    let score = 0;

    if (
        quantities.length >=
        4
    ) {
        score += 2;
    }

    if (
        quantities.length >=
        8
    ) {
        score += 2;
    }

    if (
        domains.length >=
        2
    ) {
        score += 2;
    }

    if (hasImage) {
        score += 3;
    }

    if (
        (
            source.match(
                /[=]/g
            ) || []
        ).length >= 2
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
        /نظام معادلات|معادلات|تفاضل|تكامل|مصفوف|متجه|اشتقاق|أثبت|برهن|أقصى|أدنى|احتمال|دالة/.test(
            source
        )
    ) {
        score += 3;
    }

    if (
        /ثم|بعد ذلك|على التوالي|على التوازي|معًا|في نفس الوقت|يتصل|متصل/.test(
            source
        )
    ) {
        score += 2;
    }

    if (
        /تصادم|بكرة|مستويين|دوائر|كيرتشوف|ماكسويل|نسبي|كمومي/.test(
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

    const compactQuantities =
        quantities.map(
            (
                quantity
            ) =>
                `${quantity.raw} => ${quantity.siValue} (SI)`
        );

    return {
        quantities,

        domains,

        complexity,

        promptBlock: `
تحليل أولي آلي قبل الحل:

- فروع الفيزياء المحتملة:
${
    domains.length
        ? domains
              .map(
                  x =>
                      x.name
              )
              .join(
                  "، "
              )
        : "غير محدد، حدّد الفرع بنفسك"
}

- مستوى التعقيد:
${complexity}/15

- القيم والوحدات المستخرجة:
${
    compactQuantities.length
        ? compactQuantities
              .map(
                  x =>
                      `  • ${x}`
              )
              .join(
                  "\n"
              )
        : "  • لا توجد قيمة رقمية بوحدة واضحة"
}

مهم:
التحليل الأولي مساعد فقط.
يجب مراجعة كل قيمة من سؤال الطالب والصورة قبل استخدامها.
`
    };
}

function getPhysicsConstantsText() {
    return `
ثوابت مرجعية عند الحاجة:

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
   EXPERT PROMPT
========================================================= */

function buildExpertInstructions(
    {
        complex,
        hasImage
    }
) {
    const base = `
أنت Physics AI، محرك حل فيزياء متقدم جدًا.

هدفك:
حل المسائل بدقة علمية عالية، وشرحها بطريقة تفصيلية قابلة للمراجعة.

قواعد صارمة:

1. لا تخترع أي معلومة.
2. افصل بين المعطيات والافتراضات والاستنتاجات.
3. استخدم SI عند الحاجة.
4. اكتب القانون رمزيًا قبل التعويض.
5. لا تتجاوز الخطوات الرياضية المؤثرة.
6. راجع الإشارات والاتجاهات.
7. افحص الوحدات والأبعاد.
8. افحص الحالات الحدية والمنطق الفيزيائي.
9. لو البيانات ناقصة أو متناقضة قل ذلك بوضوح.
10. لو النظام مركب، قسّمه لأجزاء.

شكل الإجابة:

## فهم المسألة
## المعطيات
## المطلوب
## الفرضيات
## القوانين
## الاشتقاق الرمزي
## التعويض العددي
## الحسابات
## فحص الوحدات والأبعاد
## التحقق الفيزيائي
## النتيجة النهائية
## ملاحظات

استخدم العربية المصرية الطبيعية.
حافظ على المصطلحات الفيزيائية القياسية.
لا تعطِ كلامًا عامًا طويلًا قبل الحل.
`;

    const advanced =
        complex
            ? `
وضع EXPERT:

- حل متعدد المراحل.
- عرّف الرموز.
- استخدم القوانين الأساسية المناسبة.
- افصل معادلات كل جسم أو جزء من النظام.
- ميّز بين الكميات الخطية والزاوية.
- راجع الطاقة والزخم والشحنة عندما تكون مناسبة.
- راجع الإشارات والاتجاهات.
- في الدوائر استخدم العقد والحلقات بشكل واضح.
- في الموائع راجع معادلة الاستمرارية وبرنولي والضغط.
- في الحرارة راجع الوحدات والحالات الديناميكية.
- في البصريات راجع الإشارات واتفاقية المسافات.
- في الفيزياء الحديثة لا تخلط eV وJ.
- عند الحاجة لحل منظومة معادلات، وضّح الحل الرمزي.
- نفّذ مراجعة ثانية مستقلة قبل النتيجة النهائية.
`
            : `
للمسائل العادية:
لا تعقّد الحل بلا داعٍ، لكن لا تهمل التحقق والوحدات.
`;

    const imageRules =
        hasImage
            ? `
تعليمات الصورة:

- افحص الرسم أولًا.
- استخرج الأرقام والرموز.
- ميّز بين المقروء وغير الواضح.
- لا تخمّن شيئًا غير واضح.
- اربط الرسم بالمعادلات الصحيحة.
`
            : "";

    return (
        base +
        advanced +
        imageRules +
        getPhysicsConstantsText()
    );
}

/* =========================================================
   GEMINI CALL
========================================================= */

async function callGemini(
    contents,
    systemInstruction,
    temperature = 0.2
) {
    if (!ai) {
        throw Object.assign(
            new Error(
                "GEMINI_API_KEY غير مضبوط."
            ),
            {
                status:
                    500
            }
        );
    }

    return ai.models.generateContent(
        {
            model:
                GEMINI_MODEL,

            contents,

            config: {
                temperature,

                systemInstruction
            }
        }
    );
}

/* =========================================================
   VERIFY COMPLEX ANSWER
========================================================= */

async function verifyComplexAnswer(
    {
        question,
        draft,
        contextText,
        preflight,
        image
    }
) {
    const verifierInstructions = `
أنت مراجع فيزياء مستقل داخل Physics AI.

راجع الحل التالي بدقة.

راجع:
- فهم السؤال
- المعطيات
- الفرضيات
- القوانين
- الاشتقاق
- الحسابات
- الوحدات
- الإشارات
- المعقولية الفيزيائية
- الصورة إن وجدت

إذا وجدت خطأ، صححه.
إذا كان الحل صحيحًا، حافظ على النتيجة وحسّن الوضوح.

في النهاية أظهر:

## التحقق النهائي
`;

    const verifyText = `
سؤال الطالب:
${question}

${contextText}

${preflight.promptBlock}

الحل الأول:
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
                    role:
                        "user",

                    parts
                }
            ],
            verifierInstructions,
            0.1
        );

    return String(
        response?.text ||
            draft
    ).trim();
}

/* =========================================================
   CHAT
========================================================= */

app.post(
    "/api/chat",
    requireLogin,
    async function (
        req,
        res
    ) {
        try {
            const message =
                cleanText(
                    req.body.message,
                    50000
                );

            const history =
                Array.isArray(
                    req.body.history
                )
                    ? req.body.history.slice(
                          -20
                      )
                    : [];

            const grade =
                cleanText(
                    req.body.grade,
                    200
                );

            const subject =
                cleanText(
                    req.body.subject ||
                        "الفيزياء",
                    200
                );

            const unit =
                cleanText(
                    req.body.unit,
                    300
                );

            const lesson =
                cleanText(
                    req.body.lesson,
                    300
                );

            const mode =
                cleanText(
                    req.body.mode ||
                        "general",
                    100
                );

            const image =
                req.body.image ||
                null;

            if (
                !message &&
                !image
            ) {
                return res.status(
                    400
                ).json({
                    error:
                        "اكتب السؤال أو أرفق صورة."
                });
            }

            if (
                typeof image ===
                    "string" &&
                image.length >
                    8_000_000
            ) {
                return res.status(
                    400
                ).json({
                    error:
                        "الصورة كبيرة جدًا."
                });
            }

            const preflight =
                buildPreflight(
                    message,
                    image
                );

            const complex =
                preflight.complexity >=
                5;

            const contextText = `
معلومات الطالب:

الصف:
${grade || "غير محدد"}

المادة:
${subject}

الوحدة:
${unit || "غير محددة"}

الدرس:
${lesson || "غير محدد"}

نوع الجلسة:
${mode || "دردشة عامة"}
`;

            const systemInstructions = `
${buildExpertInstructions({
    complex,
    hasImage:
        Boolean(image)
})}

${contextText}

${preflight.promptBlock}

تعليمات إضافية:

- استخدم العربية المصرية.
- استخدم Markdown واضح.
- اعرض المعادلات بشكل مفهوم.
- لا تختصر الحل في المسائل الصعبة.
- لا تخترع أي قيم.
`;

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

                contents.push({
                    role:
                        item.role ===
                        "assistant"
                            ? "model"
                            : "user",

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

            const currentParts = [
                {
                    text:
                        systemInstructions +
                        "\n\nسؤال الطالب الحالي:\n" +
                        (
                            message ||
                            "حل السؤال الموجود في الصورة بالتفصيل."
                        )
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
                    currentParts.push(
                        {
                            inlineData: {
                                mimeType:
                                    match[1],

                                data:
                                    match[2]
                            }
                        }
                    );
                }
            }

            contents.push({
                role:
                    "user",

                parts:
                    currentParts
            });

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
                        preflight
                            .quantities
                            .length,

                    image:
                        Boolean(
                            image
                        )
                }
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
                String(
                    response?.text ||
                        ""
                ).trim();

            if (!answer) {
                return res.status(
                    502
                ).json({
                    error:
                        "Gemini لم يرجع إجابة نصية."
                });
            }

            let verified =
                false;

            if (
                complex &&
                process.env
                    .PHYSICS_VERIFY !==
                    "false"
            ) {
                try {
                    answer =
                        await verifyComplexAnswer(
                            {
                                question:
                                    message ||
                                    "السؤال موجود في الصورة.",

                                draft:
                                    answer,

                                contextText,

                                preflight,

                                image
                            }
                        );

                    verified =
                        true;
                } catch (
                    verifyError
                ) {
                    console.error(
                        "PHYSICS VERIFY ERROR:",
                        verifyError
                    );
                }
            }

            res.json({
                success:
                    true,

                answer,

                physicsEngine: {
                    version:
                        "2.0",

                    complexity:
                        preflight.complexity,

                    domains:
                        preflight.domains.map(
                            x =>
                                x.name
                        ),

                    verified
                }
            });

        } catch (error) {
            console.error(
                "GEMINI PHYSICS ENGINE ERROR:",
                error
            );

            const status =
                Number(
                    error?.status ||
                        error?.statusCode ||
                        500
                );

            if (
                status ===
                400
            ) {
                return res.status(
                    400
                ).json({
                    error:
                        error?.message ||
                        "الطلب غير صحيح."
                });
            }

            if (
                status ===
                401 ||
                status ===
                403
            ) {
                return res.status(
                    500
                ).json({
                    error:
                        "مفتاح Gemini غير صحيح أو غير مصرح باستخدامه."
                });
            }

            if (
                status ===
                404
            ) {
                return res.status(
                    500
                ).json({
                    error:
                        `موديل Gemini غير متاح: ${GEMINI_MODEL}`
                });
            }

            if (
                status ===
                429
            ) {
                return res.status(
                    429
                ).json({
                    error:
                        "تم الوصول إلى حد استخدام Gemini حاليًا. حاول بعد قليل."
                });
            }

            res.status(
                500
            ).json({
                error:
                    error?.message ||
                    "حصل خطأ أثناء تشغيل Physics Engine."
            });
        }
    }
);

/* =========================================================
   TRANSCRIBE AUDIO
========================================================= */

app.post(
    "/api/transcribe",
    requireLogin,
    audioUpload.single(
        "audio"
    ),
    async function (
        req,
        res
    ) {
        try {
            if (!req.file) {
                return res.status(
                    400
                ).json({
                    error:
                        "لم يتم إرسال تسجيل صوتي."
                });
            }

            if (
                req.file.size >
                19 *
                    1024 *
                    1024
            ) {
                return res.status(
                    400
                ).json({
                    error:
                        "التسجيل كبير جدًا. استخدم ملفًا أقل من 19MB."
                });
            }

            if (!ai) {
                return res.status(
                    500
                ).json({
                    error:
                        "GEMINI_API_KEY غير مضبوط."
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
                                role:
                                    "user",

                                parts: [
                                    {
                                        text: `
استمع إلى التسجيل الصوتي التالي.

المطلوب:
- حوّل كلام الطالب إلى نص مكتوب فقط.
- اللغة الأساسية العربية المصرية.
- حافظ على المصطلحات العلمية والفيزيائية.
- لا تشرح.
- لا تجب عن السؤال.
- لا تضف أي كلام من عندك.
- أخرج النص الذي قاله الطالب فقط.
`
                                    },

                                    {
                                        inlineData:
                                            {
                                                mimeType,

                                                data:
                                                    audioBase64
                                            }
                                    }
                                ]
                            }
                        ],

                        config: {
                            temperature:
                                0.1
                        }
                    }
                );

            const text =
                String(
                    response?.text ||
                        ""
                ).trim();

            if (!text) {
                return res.status(
                    502
                ).json({
                    error:
                        "Gemini لم يرجع نصًا من التسجيل."
                });
            }

            res.json({
                success:
                    true,

                text
            });

        } catch (error) {
            console.error(
                "TRANSCRIPTION ERROR:",
                error
            );

            res.status(
                500
            ).json({
                error:
                    error?.message ||
                    "تعذر تحويل التسجيل الصوتي إلى نص."
            });
        }
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
            error?.code ===
            "LIMIT_FILE_SIZE"
        ) {
            return res.status(
                400
            ).json({
                error:
                    "حجم الملف كبير جدًا."
            });
        }

        if (
            error?.message ===
            "يسمح برفع الصور فقط."
        ) {
            return res.status(
                400
            ).json({
                error:
                    error.message
            });
        }

        if (
            error?.message ===
            "نوع الملف الصوتي غير مدعوم."
        ) {
            return res.status(
                400
            ).json({
                error:
                    error.message
            });
        }

        if (
            error?.name ===
            "MulterError"
        ) {
            return res.status(
                400
            ).json({
                error:
                    "حصل خطأ أثناء رفع الملف."
            });
        }

        res.status(
            500
        ).json({
            error:
                error?.message ||
                "حصل خطأ في السيرفر."
        });
    }
);

/* =========================================================
   START
========================================================= */

const server =
    app.listen(
        PORT,
        "0.0.0.0",
        function () {
            console.log(
                "========================================"
            );

            console.log(
                "Physics AI SERVER ONLINE"
            );

            console.log(
                "PORT:",
                PORT
            );

            console.log(
                "MODEL:",
                GEMINI_MODEL
            );

            console.log(
                "NODE_ENV:",
                process.env.NODE_ENV ||
                    "development"
            );

            console.log(
                "SESSION:",
                "READY"
            );

            console.log(
                "DATABASE:",
                "READY"
            );

            console.log(
                "========================================"
            );
        }
    );

/* =========================================================
   SHUTDOWN
========================================================= */

function shutdown(
    signal
) {
    console.log(
        `${signal} received...`
    );

    server.close(
        function () {
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

            process.exit(
                0
            );
        }
    );
}

process.on(
    "SIGINT",
    function () {
        shutdown(
            "SIGINT"
        );
    }
);

process.on(
    "SIGTERM",
    function () {
        shutdown(
            "SIGTERM"
        );
    }
);
