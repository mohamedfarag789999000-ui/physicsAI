"use strict";

/*
=========================================================
PHYSICS AI - SERVER
=========================================================
Features:
- Express server
- SQLite database
- Register / Login / Logout
- Conversations
- Messages
- Gemini Physics AI
- Image questions
- Voice transcription
- Static frontend
- Render compatible PORT
=========================================================
*/

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
   CONFIG
========================================================= */

const PORT = Number(process.env.PORT) || 10000;

const GEMINI_MODEL =
    process.env.GEMINI_MODEL ||
    "gemini-3.6-flash";

const GEMINI_API_KEY =
    process.env.GEMINI_API_KEY ||
    "";

if (!GEMINI_API_KEY) {
    console.warn(
        "WARNING: GEMINI_API_KEY is not configured."
    );
}

/* =========================================================
   GEMINI
========================================================= */

const ai = new GoogleGenAI({
    apiKey: GEMINI_API_KEY
});

/* =========================================================
   DATABASE
========================================================= */

const dbPath = path.join(
    __dirname,
    "physics-ai.db"
);

const db = new Database(dbPath);

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
                process.env.NODE_ENV ===
                "production",

            maxAge:
                1000 *
                60 *
                60 *
                24 *
                30
        }
    })
);

/* =========================================================
   STATIC FRONTEND
========================================================= */

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
            const mime =
                String(
                    file.mimetype ||
                    ""
                )
                    .toLowerCase()
                    .split(";")[0];

            if (
                mime.startsWith(
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
   AUTH HELPER
========================================================= */

function requireLogin(
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
                "لازم تسجل دخول الأول."
        });
    }

    next();
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
   HEALTH CHECK
========================================================= */

app.get(
    "/api/health",
    function (
        req,
        res
    ) {
        res.json({
            success: true,
            status: "ok",
            model:
                GEMINI_MODEL,
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
                String(
                    req.body.name ||
                    ""
                )
                    .trim()
                    .slice(
                        0,
                        80
                    );

            const email =
                String(
                    req.body.email ||
                    ""
                )
                    .trim()
                    .toLowerCase()
                    .slice(
                        0,
                        160
                    );

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
                    (name, email, password)
                    VALUES (?, ?, ?)
                `).run(
                    name,
                    email,
                    hashedPassword
                );

            req.session.userId =
                result.lastInsertRowid;

            res.json({
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

            res.status(500).json({
                error:
                    "تعذر إنشاء الحساب."
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
                String(
                    req.body.email ||
                    ""
                )
                    .trim()
                    .toLowerCase();

            const password =
                String(
                    req.body.password ||
                    ""
                );

            if (!email) {
                return res.status(
                    400
                ).json({
                    error:
                        "اكتب البريد الإلكتروني."
                });
            }

            if (!password) {
                return res.status(
                    400
                ).json({
                    error:
                        "اكتب كلمة السر."
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

            const valid =
                await bcrypt.compare(
                    password,
                    user.password
                );

            if (!valid) {
                return res.status(
                    401
                ).json({
                    error:
                        "البريد الإلكتروني أو كلمة السر غير صحيحة."
                });
            }

            req.session.userId =
                user.id;

            res.json({
                success: true,

                user: {
                    id:
                        user.id,

                    name:
                        user.name,

                    email:
                        user.email
                }
            });

        } catch (error) {
            console.error(
                "LOGIN ERROR:",
                error
            );

            res.status(500).json({
                error:
                    "تعذر تسجيل الدخول."
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

            res.status(500).json({
                error:
                    "تعذر قراءة بيانات الحساب."
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
                }

                res.clearCookie(
                    "connect.sid"
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
   CREATE CONVERSATION
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
                String(
                    req.body.title ||
                    "محادثة جديدة"
                )
                    .trim()
                    .slice(
                        0,
                        120
                    ) ||
                "محادثة جديدة";

            const result =
                db.prepare(`
                    INSERT INTO conversations
                    (user_id, title)
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

            res.status(500).json({
                error:
                    "تعذر فتح المحادثة."
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
    function (
        req,
        res
    ) {
        try {
            const conversationId =
                Number(
                    req.params.id
                );

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

            db.prepare(`
                DELETE FROM conversations
                WHERE id = ?
                AND user_id = ?
            `).run(
                conversationId,
                req.session.userId
            );

            res.json({
                success:
                    true
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
                String(
                    req.body.content ||
                    ""
                )
                    .trim();

            let image =
                req.body.image ||
                null;

            if (
                typeof image ===
                    "string" &&
                image.length >
                    8_000_000
            ) {
                image =
                    null;
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

            res.status(500).json({
                error:
                    "تعذر حفظ الرسالة."
            });
        }
    }
);

/* =========================================================
   PHYSICS PROMPT
========================================================= */

function buildPhysicsPrompt(
    options = {}
) {
    const {
        grade,
        subject,
        unit,
        lesson,
        mode,
        image
    } = options;

    return `
أنت Physics AI، مدرس فيزياء متقدم جدًا.

الهدف:
- حل مسائل الفيزياء بدقة.
- شرح المفاهيم بوضوح.
- التعامل مع المسائل العددية والرمزية.
- فحص الوحدات والأبعاد.
- مراجعة الإشارات والاتجاهات.
- عدم اختراع بيانات غير موجودة.
- عند وجود صورة، اقرأ الرسم والمعطيات بعناية.
- لو توجد أكثر من طريقة صحيحة، اذكر الأفضل ثم تحقق منها.
- في المسائل الصعبة، اعمل تحقق مستقل للنتيجة.

أسلوب الإجابة:
- استخدم العربية المصرية بشكل طبيعي.
- اكتب المصطلحات الفيزيائية بشكل واضح.
- لا تختصر خطوات الحساب المهمة.
- عرّف الرموز قبل استخدامها عند الحاجة.
- اكتب القانون ثم التعويض ثم الناتج.
- اذكر الوحدة النهائية.
- استخدم SI عند الحاجة.
- افحص المعقولية الفيزيائية للنتيجة.
- لا تدّعي إجراء حسابات لم تتم.

السياق الحالي:
الصف: ${grade || "غير محدد"}
المادة: ${subject || "الفيزياء"}
الوحدة: ${unit || "غير محددة"}
الدرس: ${lesson || "دردشة عامة"}
الوضع: ${mode || "general"}

${image ? "يوجد صورة مرفقة مع السؤال، ويجب تحليلها." : ""}
`;
}

/* =========================================================
   BUILD GEMINI CONTENTS
========================================================= */

function buildGeminiContents(
    history,
    message,
    image
) {
    const contents = [];

    if (
        Array.isArray(
            history
        )
    ) {
        for (
            const item of history.slice(
                -20
            )
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
    }

    const currentParts = [];

    currentParts.push({
        text:
            String(
                message ||
                "حل المسألة."
            )
    });

    if (
        image &&
        typeof image ===
            "string"
    ) {
        const match =
            image.match(
                /^data:(.*?);base64,(.*)$/
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
        role:
            "user",

        parts:
            currentParts
    });

    return contents;
}

/* =========================================================
   CHAT API
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
                String(
                    req.body.message ||
                    ""
                )
                    .trim();

            const history =
                Array.isArray(
                    req.body.history
                )
                    ? req.body.history
                    : [];

            const grade =
                String(
                    req.body.grade ||
                    ""
                );

            const subject =
                String(
                    req.body.subject ||
                    "الفيزياء"
                );

            const unit =
                String(
                    req.body.unit ||
                    ""
                );

            const lesson =
                String(
                    req.body.lesson ||
                    ""
                );

            const mode =
                String(
                    req.body.mode ||
                    "general"
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

            console.log(
                "PHYSICS PRE-FLIGHT:",
                {
                    mode,
                    grade,
                    subject,
                    unit,
                    lesson,
                    image:
                        Boolean(
                            image
                        ),
                    history:
                        history.length
                }
            );

            if (!GEMINI_API_KEY) {
                return res.status(
                    500
                ).json({
                    error:
                        "مفتاح Gemini API غير مضبوط على السيرفر."
                });
            }

            const systemInstruction =
                buildPhysicsPrompt({
                    grade,
                    subject,
                    unit,
                    lesson,
                    mode,
                    image
                });

            const contents =
                buildGeminiContents(
                    history,
                    message,
                    image
                );

            const response =
                await ai.models.generateContent(
                    {
                        model:
                            GEMINI_MODEL,

                        contents,

                        config: {
                            systemInstruction,

                            temperature:
                                0.2
                        }
                    }
                );

            let answer =
                "";

            if (
                response &&
                typeof response.text ===
                    "string"
            ) {
                answer =
                    response.text;
            } else if (
                response &&
                response.text
            ) {
                answer =
                    String(
                        response.text
                    );
            }

            answer =
                String(
                    answer ||
                    ""
                ).trim();

            if (!answer) {
                throw new Error(
                    "Gemini returned an empty response."
                );
            }

            console.log(
                "PHYSICS ENGINE OK:",
                GEMINI_MODEL
            );

            res.json({
                success:
                    true,

                answer
            });

        } catch (error) {
            console.error(
                "PHYSICS ENGINE ERROR:",
                error
            );

            const code =
                error?.status ||
                error?.code ||
                null;

            let message =
                "حصل خطأ أثناء تشغيل Physics Engine.";

            if (
                code === 401 ||
                code === 403
            ) {
                message =
                    "مفتاح Gemini API غير صالح أو غير مصرح باستخدامه.";
            } else if (
                code === 404
            ) {
                message =
                    `موديل Gemini المطلوب غير متاح: ${GEMINI_MODEL}`;
            } else if (
                code === 429
            ) {
                message =
                    "تم الوصول إلى حد الاستخدام المؤقت لـ Gemini. جرّب بعد قليل.";
            } else if (
                error?.message
            ) {
                message =
                    error.message;
            }

            res.status(500).json({
                error:
                    message
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

            if (!GEMINI_API_KEY) {
                return res.status(
                    500
                ).json({
                    error:
                        "مفتاح Gemini API غير مضبوط على السيرفر."
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
                                role:
                                    "user",

                                parts: [
                                    {
                                        text:
                                            `
استمع إلى التسجيل الصوتي التالي.
حوّل الكلام إلى نص عربي واضح.
لا تشرح ولا تحل، فقط أعد الكلام المسموع كنص.
إذا كان التسجيل سؤال فيزياء، حافظ على الرموز والأرقام والوحدات قدر الإمكان.
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
                    500
                ).json({
                    error:
                        "تعذر استخراج النص من التسجيل."
                });
            }

            res.json({
                success:
                    true,

                text
            });

        } catch (error) {
            console.error(
                "TRANSCRIBE ERROR:",
                error
            );

            res.status(500).json({
                error:
                    error?.message ||
                    "تعذر تحويل التسجيل إلى نص."
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
            "GLOBAL ERROR:",
            error
        );

        if (
            error instanceof multer.MulterError
        ) {
            return res.status(
                400
            ).json({
                error:
                    "حدث خطأ أثناء رفع الملف."
            });
        }

        res.status(500).json({
            error:
                error?.message ||
                "حدث خطأ في السيرفر."
        });
    }
);

/* =========================================================
   SERVER START
========================================================= */

app.listen(
    PORT,
    "0.0.0.0",
    function () {
        console.log(
            "================================================="
        );

        console.log(
            "Physics AI server started"
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
            "================================================="
        );
    }
);

/* =========================================================
   CLEAN SHUTDOWN
========================================================= */

function shutdown(
    signal
) {
    console.log(
        `${signal} received. Shutting down...`
    );

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
