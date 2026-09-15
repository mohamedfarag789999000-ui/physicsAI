require("dotenv").config();

const express = require("express");
const path = require("path");
const cookieSession = require("cookie-session");
const Database = require("better-sqlite3");
const multer = require("multer");
const fs = require("fs");
const crypto = require("crypto");
const { GoogleGenAI } = require("@google/genai");

const app = express();

const PORT = process.env.PORT || 3000;

const db = new Database(
    path.join(__dirname, "physics-ai.db")
);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

app.set("trust proxy", 1);

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

const publicPath = path.join(
    __dirname,
    "public"
);

app.use(
    express.static(publicPath)
);

const uploadsDir = path.join(
    __dirname,
    "uploads"
);

if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(
        uploadsDir,
        {
            recursive: true
        }
    );
}

const upload = multer({
    dest: uploadsDir,

    limits: {
        fileSize:
            15 *
            1024 *
            1024
    }
});

const GEMINI_API_KEY =
    process.env.GEMINI_API_KEY;

const GEMINI_MODEL =
    process.env.GEMINI_MODEL ||
    "gemini-3.6-flash";

let ai = null;

if (GEMINI_API_KEY) {
    ai = new GoogleGenAI({
        apiKey: GEMINI_API_KEY
    });
}

function normalizeUserId(value) {
    const id = Number(value);

    if (!Number.isFinite(id)) {
        return null;
    }

    return id;
}

function requireLogin(req, res, next) {
    const userId =
        normalizeUserId(
            req.session &&
            req.session.userId
        );

    if (!userId) {
        return res.status(401).json({
            error:
                "يجب تسجيل الدخول أولًا."
        });
    }

    req.userId = userId;

    next();
}

function saveSession(req) {
    return Promise.resolve();
}

function regenerateSession(req) {
    req.session = {};

    return Promise.resolve();
}

function getGeminiStatus(error) {
    return Number(
        error?.status ||
        error?.statusCode ||
        error?.response?.status ||
        0
    );
}

function getRetryAfterMs(error) {
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

    const seconds = Number(
        retryAfter
    );

    if (
        Number.isFinite(seconds) &&
        seconds > 0
    ) {
        return Math.min(
            seconds * 1000,
            15000
        );
    }

    return 0;
}

function isRetryableGeminiError(error) {
    const status =
        getGeminiStatus(error);

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
    if (!ai) {
        throw new Error(
            "GEMINI_API_KEY is missing"
        );
    }

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
                getGeminiStatus(error);

            if (
                !isRetryableGeminiError(
                    error
                ) ||
                attempt === maxRetries
            ) {
                throw error;
            }

            const retryAfter =
                getRetryAfterMs(error);

            const exponential =
                Math.min(
                    baseDelay *
                    (2 ** attempt),
                    8000
                );

            const jitter =
                Math.floor(
                    Math.random() * 500
                );

            const delay =
                Math.max(
                    retryAfter,
                    exponential + jitter
                );

            console.warn(
                `${label}: retry ${
                    attempt + 1
                }/${maxRetries} after ${
                    delay
                }ms (status ${status})`
            );

            await new Promise(
                resolve =>
                    setTimeout(
                        resolve,
                        delay
                    )
            );
        }
    }

    throw lastError;
}

function safeJsonParse(value) {
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

function cleanText(value) {
    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value)
        .replace(/\r\n/g, "\n")
        .replace(/\r/g, "\n")
        .trim();
}

function normalizeEmail(email) {
    return cleanText(email)
        .toLowerCase();
}

function hashPassword(password) {
    return crypto
        .createHash("sha256")
        .update(String(password))
        .digest("hex");
}

function makeTitle(text) {
    const value =
        cleanText(text);

    if (!value) {
        return "محادثة جديدة";
    }

    const firstLine =
        value
            .split("\n")[0]
            .trim();

    if (
        firstLine.length <= 60
    ) {
        return firstLine;
    }

    return (
        firstLine.slice(0, 57) +
        "..."
    );
}

/* =========================================================
   DATABASE
   ========================================================= */

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password TEXT NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL DEFAULT 'محادثة جديدة',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,

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
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,

        FOREIGN KEY (conversation_id)
        REFERENCES conversations(id)
        ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS
    idx_conversations_user
    ON conversations(user_id);

    CREATE INDEX IF NOT EXISTS
    idx_messages_conversation
    ON messages(conversation_id);
`);

/* =========================================================
   AUTH
   ========================================================= */

app.post(
    "/api/auth/register",
    async (req, res) => {
        try {
            const name =
                cleanText(
                    req.body?.name
                );

            const email =
                normalizeEmail(
                    req.body?.email
                );

            const password =
                String(
                    req.body?.password || ""
                );

            if (
                !name ||
                !email ||
                !password
            ) {
                return res
                    .status(400)
                    .json({
                        error:
                            "من فضلك املأ جميع البيانات."
                    });
            }

            if (
                password.length < 6
            ) {
                return res
                    .status(400)
                    .json({
                        error:
                            "كلمة المرور يجب أن تكون 6 أحرف على الأقل."
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

            const passwordHash =
                hashPassword(
                    password
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
                    passwordHash
                );

            const userId =
                Number(
                    result.lastInsertRowid
                );

            await regenerateSession(
                req
            );

            req.session.userId =
                userId;

            req.session.userName =
                name;

            req.session.authenticated =
                true;

            await saveSession(req);

            return res.json({
                success: true,

                user: {
                    id: userId,
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
                    req.body?.password || ""
                );

            if (
                !email ||
                !password
            ) {
                return res
                    .status(400)
                    .json({
                        error:
                            "اكتب البريد الإلكتروني وكلمة المرور."
                    });
            }

            const user =
                db.prepare(`
                    SELECT
                        id,
                        name,
                        email,
                        password
                    FROM users
                    WHERE email = ?
                `).get(email);

            if (!user) {
                return res
                    .status(401)
                    .json({
                        error:
                            "البريد الإلكتروني أو كلمة المرور غير صحيحة."
                    });
            }

            const passwordHash =
                hashPassword(
                    password
                );

            if (
                passwordHash !==
                user.password
            ) {
                return res
                    .status(401)
                    .json({
                        error:
                            "البريد الإلكتروني أو كلمة المرور غير صحيحة."
                    });
            }

            await regenerateSession(
                req
            );

            req.session.userId =
                Number(user.id);

            req.session.userName =
                user.name;

            req.session.authenticated =
                true;

            await saveSession(req);

            return res.json({
                success: true,

                user: {
                    id:
                        Number(
                            user.id
                        ),

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
    async (req, res) => {
        try {
            const userId =
                normalizeUserId(
                    req.session &&
                    req.session.userId
                );

            if (!userId) {
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
                `).get(userId);

            if (!user) {
                req.session = null;

                return res.json({
                    loggedIn: false
                });
            }

            return res.json({
                loggedIn: true,

                user: {
                    id:
                        Number(
                            user.id
                        ),

                    name:
                        user.name,

                    email:
                        user.email
                }
            });
        } catch (error) {
            console.error(
                "AUTH ME ERROR:",
                error
            );

            return res
                .status(500)
                .json({
                    loggedIn: false
                });
        }
    }
);

app.post(
    "/api/auth/logout",
    (req, res) => {
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
                    req.userId
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
    requireLogin,
    (req, res) => {
        try {
            const title =
                makeTitle(
                    req.body?.title
                );

            const result =
                db.prepare(`
                    INSERT INTO conversations
                    (
                        user_id,
                        title
                    )
                    VALUES (?, ?)
                `).run(
                    req.userId,
                    title
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
                    AND user_id = ?
                `).get(
                    Number(
                        result.lastInsertRowid
                    ),
                    req.userId
                );

            return res.json({
                success: true,
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
    requireLogin,
    (req, res) => {
        try {
            const id =
                Number(
                    req.params.id
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
                    AND user_id = ?
                `).get(
                    id,
                    req.userId
                );

            if (!conversation) {
                return res
                    .status(404)
                    .json({
                        error:
                            "المحادثة غير موجودة."
                    });
            }

            return res.json({
                conversation
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
    requireLogin,
    (req, res) => {
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
                    req.userId
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
                        conversation_id,
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
                cleanText(
                    req.body?.role
                );

            const content =
                cleanText(
                    req.body?.content
                );

            const image =
                req.body?.image ||
                null;

            if (
                !["user", "model", "assistant"]
                    .includes(role)
            ) {
                return res
                    .status(400)
                    .json({
                        error:
                            "نوع الرسالة غير صحيح."
                    });
            }

            if (!content) {
                return res
                    .status(400)
                    .json({
                        error:
                            "محتوى الرسالة فارغ."
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
                    req.userId
                );

            if (!conversation) {
                return res
                    .status(404)
                    .json({
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
                SET updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(
                conversationId
            );

            const message =
                db.prepare(`
                    SELECT
                        id,
                        conversation_id,
                        role,
                        content,
                        image,
                        created_at
                    FROM messages
                    WHERE id = ?
                `).get(
                    Number(
                        result.lastInsertRowid
                    )
                );

            return res.json({
                success: true,
                message
            });
        } catch (error) {
            console.error(
                "SAVE MESSAGE ERROR:",
                error
            );

            return res
                .status(500)
                .json({
                    error:
                        "حصل خطأ أثناء حفظ الرسالة."
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
                    req.userId
                );

            if (!conversation) {
                return res
                    .status(404)
                    .json({
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
                req.userId
            );

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
   UPDATE CONVERSATION TITLE
   ========================================================= */

app.patch(
    "/api/conversations/:id",
    requireLogin,
    (req, res) => {
        try {
            const conversationId =
                Number(req.params.id);

            const title =
                makeTitle(
                    req.body?.title
                );

            const conversation =
                db.prepare(`
                    SELECT id
                    FROM conversations
                    WHERE id = ?
                    AND user_id = ?
                `).get(
                    conversationId,
                    req.userId
                );

            if (!conversation) {
                return res
                    .status(404)
                    .json({
                        error:
                            "المحادثة غير موجودة."
                    });
            }

            db.prepare(`
                UPDATE conversations
                SET title = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
                AND user_id = ?
            `).run(
                title,
                conversationId,
                req.userId
            );

            const updated =
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
                    req.userId
                );

            return res.json({
                success: true,
                conversation: updated
            });
        } catch (error) {
            console.error(
                "UPDATE CONVERSATION ERROR:",
                error
            );

            return res
                .status(500)
                .json({
                    error:
                        "حصل خطأ أثناء تعديل المحادثة."
                });
        }
    }
);


/* =========================================================
   AI HELPERS
   ========================================================= */

const SIMPLE_STYLE = `
أنت مدرس فيزياء مصري محترف.

تحدث مع الطالب باللغة العربية المصرية الواضحة والطبيعية.

التزم بالآتي:

- لا تستخدم LaTeX.
- لا تستخدم رموز رياضية معقدة.
- لا تستخدم علامات غريبة.
- اكتب القوى بالكلمات.
مثال:
v تربيع
a تربيع
r تربيع

- اكتب الضرب بكلمة "في".
مثال:
3 في 4

- اكتب القسمة بكلمة "على".
مثال:
10 على 2

- اجعل الكلام سهل القراءة على الهاتف.

- لا تستخدم تنسيقات رياضية معقدة.

- لا تقفز إلى نتيجة غير مبررة.

- افهم سؤال الطالب أولًا.

- إذا طلب الطالب الحل فقط، أعطه النتيجة المطلوبة بدون شرح طويل.

- إذا قال الطالب "اشرح"، اشرح بالتفصيل وبطريقة مدرس مصري.

- إذا كان السؤال يحتاج خطوات للحل، اجعل الخطوات قصيرة وواضحة.

- إذا لم تكن متأكدًا من معلومة، لا تخترع إجابة.

- حافظ على الدقة العلمية.
`;


function detectQuestionIntent(text) {
    const value =
        cleanText(text)
            .toLowerCase();

    const wantsExplanation =
        value.includes("اشرح") ||
        value.includes("شرح") ||
        value.includes("فهمني") ||
        value.includes("وضح") ||
        value.includes("وضّح") ||
        value.includes("ليه") ||
        value.includes("لماذا") ||
        value.includes("ازاي") ||
        value.includes("كيف");

    const wantsSolutionOnly =
        value.includes("حل فقط") ||
        value.includes("الإجابة فقط") ||
        value.includes("الاجابة فقط") ||
        value.includes("من غير شرح") ||
        value.includes("بدون شرح") ||
        value.includes("الناتج فقط") ||
        value.includes("عاوز الحل");

    return {
        wantsExplanation,
        wantsSolutionOnly
    };
}


function buildExpertInstructions(
    question,
    history = []
) {
    const intent =
        detectQuestionIntent(
            question
        );

    let instruction =
        SIMPLE_STYLE;

    instruction += `

السؤال الحالي للطالب:
${question}
`;

    if (
        Array.isArray(history) &&
        history.length
    ) {
        instruction += `

سياق المحادثة السابقة:

`;

        for (
            const item of history
        ) {
            if (!item) {
                continue;
            }

            const role =
                item.role === "user"
                    ? "الطالب"
                    : "ثانو";

            const content =
                cleanText(
                    item.content
                );

            if (!content) {
                continue;
            }

            instruction +=
                `${role}: ${content}\n`;
        }
    }

    if (
        intent.wantsSolutionOnly
    ) {
        instruction += `

الطالب طلب الحل أو الإجابة فقط.
أعطه الإجابة المطلوبة مباشرة.
لا تضف شرحًا طويلًا.
`;
    } else if (
        intent.wantsExplanation
    ) {
        instruction += `

الطالب طلب شرحًا.
اشرح الفكرة ثم خطوات الحل بطريقة واضحة وبسيطة.
`;
    } else {
        instruction += `

أجب بشكل طبيعي ومباشر.
لا تحول كل سؤال إلى شرح طويل إلا إذا كان ذلك ضروريًا للفهم.
`;
    }

    return instruction;
}


function cleanPhysicsAnswer(
    answer
) {
    let value =
        cleanText(answer);

    if (!value) {
        return "";
    }

    value =
        value.replace(
            /\$\$[\s\S]*?\$\$/g,
            ""
        );

    value =
        value.replace(
            /\$([^$]+)\$/g,
            "$1"
        );

    value =
        value.replace(
            /\\frac\s*\{([^{}]+)\}\s*\{([^{}]+)\}/g,
            "$1 على $2"
        );

    value =
        value.replace(
            /\\times/g,
            " في "
        );

    value =
        value.replace(
            /\\cdot/g,
            " في "
        );

    value =
        value.replace(
            /\*/g,
            " في "
        );

    value =
        value.replace(
            /\^2/g,
            " تربيع"
        );

    value =
        value.replace(
            /\^3/g,
            " تكعيب"
        );

    value =
        value.replace(
            /\^(\d+)/g,
            " أس $1"
        );

    value =
        value.replace(
            /\\sqrt\s*\{([^{}]+)\}/g,
            "الجذر التربيعي لـ $1"
        );

    value =
        value.replace(
            /\\[a-zA-Z]+/g,
            ""
        );

    value =
        value.replace(
            /```[\s\S]*?```/g,
            match =>
                match
                    .replace(
                        /```/g,
                        ""
                    )
        );

    value =
        value.replace(
            /\n{3,}/g,
            "\n\n"
        );

    return value.trim();
}


/* =========================================================
   GEMINI CHAT
   ========================================================= */

async function callGemini(
    question,
    history = [],
    image = null
) {
    if (!ai) {
        throw new Error(
            "GEMINI_API_KEY is missing"
        );
    }

    const instructions =
        buildExpertInstructions(
            question,
            history
        );

    const parts = [];

    parts.push({
        text: instructions
    });

    if (image) {
        let imageData = image;

        let mimeType =
            "image/jpeg";

        if (
            typeof image === "string"
        ) {
            const match =
                image.match(
                    /^data:(.+?);base64,(.+)$/
                );

            if (match) {
                mimeType =
                    match[1];

                imageData =
                    match[2];
            }
        }

        if (
            typeof imageData ===
            "string"
        ) {
            parts.push({
                inlineData: {
                    mimeType,
                    data:
                        imageData
                }
            });
        }
    }

    const response =
        await generateGeminiWithRetry(
            {
                model:
                    GEMINI_MODEL,

                contents: [
                    {
                        role: "user",
                        parts
                    }
                ]
            },
            "Gemini chat"
        );

    let answer = "";

    if (
        response?.text
    ) {
        answer =
            response.text;
    } else if (
        response?.candidates?.[0]
            ?.content?.parts
    ) {
        answer =
            response.candidates[0]
                .content
                .parts
                .map(
                    part =>
                        part.text || ""
                )
                .join("\n");
    }

    answer =
        cleanPhysicsAnswer(
            answer
        );

    if (!answer) {
        throw new Error(
            "Gemini returned an empty response"
        );
    }

    return answer;
}


/* =========================================================
   CHAT API
   ========================================================= */

app.post(
    "/api/chat",
    requireLogin,
    async (req, res) => {
        try {
            const question =
                cleanText(
                    req.body?.message
                );

            const image =
                req.body?.image ||
                null;

            let conversationId =
                Number(
                    req.body?.conversationId
                );

            if (
                !question &&
                !image
            ) {
                return res
                    .status(400)
                    .json({
                        error:
                            "اكتب السؤال أولًا."
                    });
            }

            if (
                !Number.isFinite(
                    conversationId
                ) ||
                conversationId <= 0
            ) {
                const title =
                    makeTitle(
                        question ||
                        "محادثة جديدة"
                    );

                const result =
                    db.prepare(`
                        INSERT INTO conversations
                        (
                            user_id,
                            title
                        )
                        VALUES (?, ?)
                    `).run(
                        req.userId,
                        title
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
                    req.userId
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
                db.prepare(`
                    SELECT
                        role,
                        content
                    FROM messages
                    WHERE conversation_id = ?
                    ORDER BY id ASC
                    LIMIT 30
                `).all(
                    conversationId
                );

            if (question || image) {
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
                    "user",
                    question ||
                        "صورة مرفقة",
                    image
                );
            }

            const answer =
                await callGemini(
                    question ||
                        "حلل الصورة المرفقة وأجب عن السؤال الموجود فيها.",
                    previousMessages,
                    image
                );

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
                "model",
                answer,
                null
            );

            db.prepare(`
                UPDATE conversations
                SET updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `).run(
                conversationId
            );

            return res.json({
                success: true,

                conversationId,

                answer
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

            if (status === 429) {
                return res
                    .status(429)
                    .json({
                        error:
                            "الخدمة مشغولة حاليًا. جرّب السؤال مرة تانية بعد قليل."
                    });
            }

            if (
                status === 503 ||
                status === 502 ||
                status === 504
            ) {
                return res
                    .status(503)
                    .json({
                        error:
                            "خدمة الذكاء الاصطناعي مش متاحة مؤقتًا. جرّب مرة تانية."
                    });
            }

            if (
                error?.message ===
                "GEMINI_API_KEY is missing"
            ) {
                return res
                    .status(500)
                    .json({
                        error:
                            "مفتاح Gemini غير موجود على السيرفر."
                    });
            }

            return res
                .status(500)
                .json({
                    error:
                        "حصل خطأ أثناء معالجة السؤال."
                });
        }
    }
);


/* =========================================================
   TRANSCRIPTION
   ========================================================= */

app.post(
    "/api/transcribe",
    requireLogin,
    upload.single("audio"),
    async (req, res) => {
        let uploadedFile =
            req.file?.path;

        try {
            if (!req.file) {
                return res
                    .status(400)
                    .json({
                        error:
                            "لم يتم إرسال ملف صوتي."
                    });
            }

            if (!ai) {
                throw new Error(
                    "GEMINI_API_KEY is missing"
                );
            }

            const audioBuffer =
                fs.readFileSync(
                    req.file.path
                );

            const base64Audio =
                audioBuffer.toString(
                    "base64"
                );

            const mimeType =
                req.file.mimetype ||
                "audio/webm";

            const response =
                await generateGeminiWithRetry(
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
                                            "حوّل التسجيل الصوتي التالي إلى نص عربي واضح فقط. لا تضف شرحًا أو تعليقًا."
                                    },

                                    {
                                        inlineData: {
                                            mimeType,
                                            data:
                                                base64Audio
                                        }
                                    }
                                ]
                            }
                        ]
                    },
                    "Gemini transcription"
                );

            let text = "";

            if (
                response?.text
            ) {
                text =
                    response.text;
            } else if (
                response
                    ?.candidates?.[0]
                    ?.content?.parts
            ) {
                text =
                    response
                        .candidates[0]
                        .content
                        .parts
                        .map(
                            part =>
                                part.text ||
                                ""
                        )
                        .join("\n");
            }

            text =
                cleanText(
                    text
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

            if (status === 429) {
                return res
                    .status(429)
                    .json({
                        error:
                            "الخدمة مشغولة حاليًا. جرّب التسجيل مرة أخرى بعد قليل."
                    });
            }

            if (
                error?.message ===
                "GEMINI_API_KEY is missing"
            ) {
                return res
                    .status(500)
                    .json({
                        error:
                            "مفتاح Gemini غير موجود على السيرفر."
                    });
            }

            return res
                .status(500)
                .json({
                    error:
                        "حصل خطأ أثناء تحويل التسجيل إلى نص."
                });
        } finally {
            if (
                uploadedFile &&
                fs.existsSync(
                    uploadedFile
                )
            ) {
                try {
                    fs.unlinkSync(
                        uploadedFile
                    );
                } catch (
                    cleanupError
                ) {
                    console.warn(
                        "AUDIO CLEANUP ERROR:",
                        cleanupError
                    );
                }
            }
        }
    }
);
/* =========================================================
   CORRECTIONS
   ========================================================= */

app.post(
    "/api/corrections",
    requireLogin,
    (req, res) => {
        try {
            const question =
                cleanText(
                    req.body?.question
                );

            const answer =
                cleanText(
                    req.body?.answer
                );

            const correction =
                cleanText(
                    req.body?.correction
                );

            if (
                !question ||
                !correction
            ) {
                return res
                    .status(400)
                    .json({
                        error:
                            "بيانات التصحيح غير مكتملة."
                    });
            }

            const correctionsDir =
                path.join(
                    __dirname,
                    "knowledge"
                );

            if (
                !fs.existsSync(
                    correctionsDir
                )
            ) {
                fs.mkdirSync(
                    correctionsDir,
                    {
                        recursive: true
                    }
                );
            }

            const filePath =
                path.join(
                    correctionsDir,
                    "corrections.json"
                );

            let corrections = [];

            if (
                fs.existsSync(
                    filePath
                )
            ) {
                try {
                    const existing =
                        fs.readFileSync(
                            filePath,
                            "utf8"
                        );

                    const parsed =
                        JSON.parse(
                            existing
                        );

                    if (
                        Array.isArray(
                            parsed
                        )
                    ) {
                        corrections =
                            parsed;
                    }
                } catch {
                    corrections = [];
                }
            }

            corrections.push({
                id:
                    crypto.randomUUID(),

                userId:
                    req.userId,

                question,

                answer,

                correction,

                createdAt:
                    new Date()
                        .toISOString()
            });

            fs.writeFileSync(
                filePath,
                JSON.stringify(
                    corrections,
                    null,
                    2
                ),
                "utf8"
            );

            return res.json({
                success: true
            });
        } catch (error) {
            console.error(
                "CORRECTION ERROR:",
                error
            );

            return res
                .status(500)
                .json({
                    error:
                        "حصل خطأ أثناء حفظ التصحيح."
                });
        }
    }
);


/* =========================================================
   GET CORRECTIONS
   ========================================================= */

app.get(
    "/api/corrections",
    requireLogin,
    (req, res) => {
        try {
            const filePath =
                path.join(
                    __dirname,
                    "knowledge",
                    "corrections.json"
                );

            if (
                !fs.existsSync(
                    filePath
                )
            ) {
                return res.json({
                    corrections: []
                });
            }

            const content =
                fs.readFileSync(
                    filePath,
                    "utf8"
                );

            const corrections =
                safeJsonParse(
                    content
                );

            if (
                !Array.isArray(
                    corrections
                )
            ) {
                return res.json({
                    corrections: []
                });
            }

            const userCorrections =
                corrections.filter(
                    item =>
                        Number(
                            item.userId
                        ) ===
                        Number(
                            req.userId
                        )
                );

            return res.json({
                corrections:
                    userCorrections
            });
        } catch (error) {
            console.error(
                "GET CORRECTIONS ERROR:",
                error
            );

            return res
                .status(500)
                .json({
                    error:
                        "حصل خطأ أثناء تحميل التصحيحات."
                });
        }
    }
);


/* =========================================================
   HEALTH CHECK
   ========================================================= */

app.get(
    "/api/health",
    (req, res) => {
        return res.json({
            success: true,
            status: "ok",
            ai:
                Boolean(ai),
            model:
                GEMINI_MODEL,
            time:
                new Date()
                    .toISOString()
        });
    }
);


/* =========================================================
   DEFAULT ROUTES
   ========================================================= */

app.get(
    "/",
    (req, res) => {
        return res.sendFile(
            path.join(
                publicPath,
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
                publicPath,
                "login.html"
            )
        );
    }
);

app.get(
    "/chat",
    (req, res) => {
        return res.sendFile(
            path.join(
                publicPath,
                "chat.html"
            )
        );
    }
);

app.get(
    "/study",
    (req, res) => {
        return res.sendFile(
            path.join(
                publicPath,
                "study.html"
            )
        );
    }
);


/* =========================================================
   ERROR HANDLER
   ========================================================= */

app.use(
    (error, req, res, next) => {
        console.error(
            "GLOBAL ERROR:",
            error
        );

        if (
            res.headersSent
        ) {
            return next(
                error
            );
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

app.listen(
    PORT,
    () => {
        console.log(
            `Physics AI server running on port ${PORT}`
        );

        console.log(
            `Gemini model: ${GEMINI_MODEL}`
        );

        console.log(
            `Gemini configured: ${Boolean(ai)}`
        );
    }
);/* =========================================================
   UNIT MAP
   ========================================================= */

const UNIT_MAP = {
    متر: "m",

    سنتيمتر: "cm",

    ملليمتر: "mm",

    كيلومتر: "km",

    ميكرومتر: "um",

    نانومتر: "nm",

    ثانية: "s",

    دقيقة: "min",

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
        "حركة",
        "حركة دائرية",
        "نابض",
        "زنبرك",
        "جاذبية"
    ],

    electricity: [
        "كهرباء",
        "تيار",
        "جهد",
        "مقاومة",
        "مكثف",
        "شحنة",
        "كولوم",
        "أوم",
        "فولت",
        "أمبير",
        "دائرة",
        "بطارية",
        "توالي",
        "توازي",
        "كيرشوف",
        "قدرة كهربائية"
    ],

    waves: [
        "موجة",
        "موجات",
        "تردد",
        "طول موجي",
        "سعة",
        "صوت",
        "انعكاس",
        "انكسار",
        "حيود",
        "تداخل",
        "رنين"
    ],

    optics: [
        "ضوء",
        "بصريات",
        "عدسة",
        "مرآة",
        "بؤرة",
        "بعد بؤري",
        "تكبير",
        "انعكاس الضوء",
        "انكسار الضوء",
        "منشور"
    ],

    thermodynamics: [
        "حرارة",
        "درجة حرارة",
        "حراري",
        "تمدد",
        "انكماش",
        "ضغط",
        "غاز",
        "قانون بويل",
        "قانون شارل",
        "ديناميكا حرارية",
        "حرارة نوعية",
        "انصهار",
        "تبخر"
    ],

    modernPhysics: [
        "ذرة",
        "إلكترون",
        "فوتون",
        "كم",
        "كمية",
        "نواة",
        "إشعاع",
        "نشاط إشعاعي",
        "نصف العمر",
        "نسبية",
        "طاقة الفوتون",
        "دالة الشغل",
        "تأثير كهروضوئي"
    ],

    magnetism: [
        "مغناطيس",
        "مغناطيسية",
        "مجال مغناطيسي",
        "فيض مغناطيسي",
        "حث",
        "فاراداي",
        "لينز",
        "ملف",
        "محث",
        "قوة لورنتز"
    ]
};


/* =========================================================
   DETECT PHYSICS DOMAIN
   ========================================================= */

function detectPhysicsDomain(text) {
    const value =
        cleanText(text)
            .toLowerCase();

    const scores = {};

    for (
        const [domain, keywords]
        of Object.entries(
            DOMAIN_RULES
        )
    ) {
        scores[domain] = 0;

        for (
            const keyword
            of keywords
        ) {
            if (
                value.includes(
                    keyword
                )
            ) {
                scores[domain]++;
            }
        }
    }

    let bestDomain =
        "general";

    let bestScore = 0;

    for (
        const [domain, score]
        of Object.entries(scores)
    ) {
        if (
            score > bestScore
        ) {
            bestScore = score;
            bestDomain = domain;
        }
    }

    return {
        domain: bestDomain,
        score: bestScore,
        scores
    };
}


/* =========================================================
   PHYSICS KNOWLEDGE PROMPT
   ========================================================= */

function getDomainInstructions(
    domain
) {
    const instructions = {
        mechanics: `
المجال: الميكانيكا.

ركز على:
- قوانين نيوتن.
- الحركة.
- السرعة والتسارع.
- الشغل والطاقة.
- الزخم.
- الاحتكاك.
- الحركة الدائرية.
- الجاذبية.
- مسائل السقوط الحر.
`,

        electricity: `
المجال: الكهرباء.

ركز على:
- قانون أوم.
- التيار والجهد والمقاومة.
- التوصيل على التوالي والتوازي.
- القدرة والطاقة الكهربائية.
- الشحنة.
- الدوائر الكهربائية.
- قوانين كيرشوف عند الحاجة.
`,

        waves: `
المجال: الموجات.

ركز على:
- التردد.
- الزمن الدوري.
- الطول الموجي.
- سرعة الموجة.
- السعة.
- التداخل.
- الحيود.
- الانعكاس والانكسار.
- الصوت.
`,

        optics: `
المجال: البصريات.

ركز على:
- المرايا.
- العدسات.
- البعد البؤري.
- الصورة الحقيقية والافتراضية.
- التكبير.
- الانعكاس.
- الانكسار.
`,

        thermodynamics: `
المجال: الحرارة والديناميكا الحرارية.

ركز على:
- الحرارة.
- درجة الحرارة.
- السعة الحرارية.
- الحرارة النوعية.
- تغيرات الحالة.
- قوانين الغازات.
- الضغط والحجم ودرجة الحرارة.
`,

        modernPhysics: `
المجال: الفيزياء الحديثة.

ركز على:
- الفوتونات.
- الإلكترونات.
- التأثير الكهروضوئي.
- الذرة.
- النواة.
- النشاط الإشعاعي.
- نصف العمر.
- النسبية.
`,

        magnetism: `
المجال: المغناطيسية والكهرومغناطيسية.

ركز على:
- المجال المغناطيسي.
- الفيض.
- الحث الكهرومغناطيسي.
- قانون فاراداي.
- قانون لينز.
- قوة لورنتز.
`,

        general: `
المجال: فيزياء عامة.

حدد القانون أو الفكرة المطلوبة من السؤال
قبل إعطاء النتيجة.
`
    };

    return (
        instructions[domain] ||
        instructions.general
    );
}


/* =========================================================
   ADVANCED PHYSICS PROMPT
   ========================================================= */

function buildAdvancedPhysicsPrompt(
    question,
    history = []
) {
    const detection =
        detectPhysicsDomain(
            question
        );

    const domainInstructions =
        getDomainInstructions(
            detection.domain
        );

    let prompt = `
أنت THANO، مدرس فيزياء مصري
متخصص في تدريس طلاب الثانوية.

مهمتك حل وفهم مسائل الفيزياء
بدقة شديدة.

${SIMPLE_STYLE}

${domainInstructions}

قبل الإجابة:
1. حدد المطلوب من السؤال.
2. حدد المعطيات.
3. حدد القانون المناسب.
4. راجع الوحدات.
5. احسب النتيجة بدقة.
6. راجع النتيجة قبل إرسالها.

إذا كان السؤال اختيار من متعدد:
حدد الاختيار الصحيح بوضوح.

إذا كانت هناك صورة:
اقرأ المسألة من الصورة بعناية.
لا تفترض أرقامًا غير واضحة.

السؤال:
${question}
`;

    if (
        history &&
        Array.isArray(history) &&
        history.length
    ) {
        prompt += `

المحادثة السابقة:

`;

        for (
            const item of history
        ) {
            const role =
                item.role === "user"
                    ? "الطالب"
                    : "THANO";

            const content =
                cleanText(
                    item.content
                );

            if (!content) {
                continue;
            }

            prompt +=
                `${role}: ${content}\n`;
        }
    }

    return prompt;
}


/* =========================================================
   NUMERICAL HELPERS
   ========================================================= */

function toNumber(value) {
    if (
        value === null ||
        value === undefined
    ) {
        return null;
    }

    if (
        typeof value === "number"
    ) {
        return Number.isFinite(
            value
        )
            ? value
            : null;
    }

    const normalized =
        String(value)
            .replace(
                /،/g,
                "."
            )
            .replace(
                /,/g,
                "."
            )
            .trim();

    const number =
        Number(
            normalized
        );

    return Number.isFinite(
        number
    )
        ? number
        : null;
}


function formatNumber(
    value
) {
    const number =
        toNumber(value);

    if (
        number === null
    ) {
        return "";
    }

    if (
        Math.abs(number) >=
        0.000001 &&
        Math.abs(number) < 1000000
    ) {
        return Number(
            number.toFixed(6)
        ).toString();
    }

    return number
        .toExponential(4)
        .replace(
            "e+",
            "e"
        );
}


/* =========================================================
   UNIT NORMALIZATION
   ========================================================= */

function normalizeUnit(
    unit
) {
    if (!unit) {
        return "";
    }

    const value =
        cleanText(unit)
            .toLowerCase();

    if (
        UNIT_MAP[value]
    ) {
        return UNIT_MAP[value];
    }

    return value;
}


function convertUnitValue(
    value,
    fromUnit,
    toUnit
) {
    const number =
        toNumber(value);

    if (
        number === null
    ) {
        return null;
    }

    const from =
        normalizeUnit(
            fromUnit
        );

    const to =
        normalizeUnit(
            toUnit
        );

    if (
        !from ||
        !to ||
        from === to
    ) {
        return number;
    }

    const lengthFactors = {
        m: 1,
        cm: 0.01,
        mm: 0.001,
        km: 1000,
        um: 0.000001,
        nm: 0.000000001
    };

    if (
        lengthFactors[from] &&
        lengthFactors[to]
    ) {
        return (
            number *
            lengthFactors[from] /
            lengthFactors[to]
        );
    }

    const timeFactors = {
        s: 1,
        min: 60,
        h: 3600
    };

    if (
        timeFactors[from] &&
        timeFactors[to]
    ) {
        return (
            number *
            timeFactors[from] /
            timeFactors[to]
        );
    }

    return null;
}


/* =========================================================
   CREATE CONVERSATION IF NEEDED
   ========================================================= */

function ensureConversation(
    userId,
    conversationId,
    title
) {
    let id =
        Number(
            conversationId
        );

    if (
        Number.isFinite(id) &&
        id > 0
    ) {
        const existing =
            db.prepare(`
                SELECT id
                FROM conversations
                WHERE id = ?
                AND user_id = ?
            `).get(
                id,
                userId
            );

        if (existing) {
            return id;
        }
    }

    const result =
        db.prepare(`
            INSERT INTO conversations
            (
                user_id,
                title
            )
            VALUES (?, ?)
        `).run(
            userId,
            makeTitle(
                title ||
                "محادثة جديدة"
            )
        );

    id =
        Number(
            result.lastInsertRowid
        );

    return id;
}


/* =========================================================
   UPDATE CONVERSATION
   ========================================================= */

function touchConversation(
    conversationId
) {
    db.prepare(`
        UPDATE conversations
        SET updated_at =
            CURRENT_TIMESTAMP
        WHERE id = ?
    `).run(
        conversationId
    );
}


/* =========================================================
   SAVE MESSAGE HELPER
   ========================================================= */

function saveMessage(
    conversationId,
    role,
    content,
    image = null
) {
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
            cleanText(content),
            image
        );

    touchConversation(
        conversationId
    );

    return db.prepare(`
        SELECT
            id,
            conversation_id,
            role,
            content,
            image,
            created_at
        FROM messages
        WHERE id = ?
    `).get(
        Number(
            result.lastInsertRowid
        )
    );
}
/* =========================================================
   END OF SERVER.JS
   ========================================================= */
