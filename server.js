require("dotenv").config();

const express = require("express");
const path = require("path");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const multer = require("multer");
const OpenAI = require("openai");
const { toFile } = require("openai/uploads");

const app = express();

const PORT = process.env.PORT || 3000;

/* =========================================================
   DATABASE
========================================================= */

const db = new Database(
    path.join(__dirname, "physics-ai.db")
);

db.pragma("journal_mode = WAL");

db.pragma("foreign_keys = ON");

/* =========================================================
   OPENAI
========================================================= */

if (!process.env.OPENAI_API_KEY) {
    console.error(
        "ERROR: OPENAI_API_KEY غير موجود في ملف .env"
    );

    process.exit(1);
}

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

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

            /*
             * localhost = false
             * production HTTPS = true
             */
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
   MULTER
   مهم:
   الصور والصوت لهم Upload منفصل
========================================================= */

/*
 * IMAGE UPLOAD
 */

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


/*
 * AUDIO UPLOAD
 */

const audioUpload = multer({
    storage: multer.memoryStorage(),

    limits: {
        fileSize: 25 * 1024 * 1024
    },

    fileFilter: function (req, file, cb) {

        const allowedAudioTypes = [
            "audio/webm",
            "audio/ogg",
            "audio/wav",
            "audio/x-wav",
            "audio/mpeg",
            "audio/mp3",
            "audio/mp4",
            "audio/m4a",
            "audio/x-m4a"
        ];

        const mimeType =
            String(
                file.mimetype || ""
            ).toLowerCase();

        /*
         * بعض المتصفحات ترسل نوعًا مثل:
         * audio/webm;codecs=opus
         *
         * لذلك نأخذ الجزء الأساسي فقط.
         */

        const baseMimeType =
            mimeType.split(";")[0];

        if (
            allowedAudioTypes.includes(
                baseMimeType
            ) ||
            baseMimeType.startsWith("audio/")
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
   AUTH HELPERS
========================================================= */

function requireLogin(
    req,
    res,
    next
) {

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

app.get(
    "/",
    function (req, res) {

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
   REGISTER
========================================================= */

app.post(
    "/api/auth/register",
    async function (req, res) {

        try {

            const name =
                String(
                    req.body.name || ""
                )
                    .trim()
                    .slice(0, 80);

            const email =
                String(
                    req.body.email || ""
                )
                    .trim()
                    .toLowerCase()
                    .slice(0, 160);

            const password =
                String(
                    req.body.password || ""
                );

            if (!name) {

                return res.status(400).json({
                    error:
                        "اكتب اسمك."
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

            if (
                password.length < 6
            ) {

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
                `)
                .get(email);

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
                `)
                .run(
                    name,
                    email,
                    hashedPassword
                );

            req.session.userId =
                result.lastInsertRowid;

            req.session.userName =
                name;

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

            const email =
                String(
                    req.body.email || ""
                )
                    .trim()
                    .toLowerCase();

            const password =
                String(
                    req.body.password || ""
                );

            if (
                !email ||
                !password
            ) {

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
                `)
                .get(email);

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
    function (req, res) {

        req.session.destroy(
            function (error) {

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
    function (req, res) {

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
            `)
            .get(
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
    function (req, res) {

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
                `)
                .run(
                    req.session.userId,
                    title ||
                    "محادثة جديدة"
                );

            res.json({

                success: true,

                conversation: {

                    id:
                        result.lastInsertRowid,

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
                `)
                .all(
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
                `)
                .get(
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
                `)
                .all(
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
                `)
                .run(
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
                req.body.role === "assistant"
                    ? "assistant"
                    : "user";

            const content =
                String(
                    req.body.content || ""
                )
                    .trim();

            let image =
                req.body.image || null;

            /*
             * منع تخزين صور ضخمة جدًا في قاعدة البيانات.
             */

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
                `)
                .get(
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
                `)
                .run(
                    conversationId,
                    role,
                    content,
                    image
                );

            db.prepare(`
                UPDATE conversations
                SET updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `)
                .run(
                    conversationId
                );

            res.json({

                success: true,

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
   TRANSCRIBE AUDIO
   الإصلاح الأساسي هنا
========================================================= */

app.post(
    "/api/transcribe",

    audioUpload.single("audio"),

    async function (req, res) {

        try {

            if (!req.file) {

                return res.status(400).json({
                    error:
                        "لم يتم إرسال تسجيل صوتي."
                });
            }

            console.log(
                "Audio received:",
                req.file.originalname,
                req.file.mimetype,
                req.file.size
            );

            const audioFile =
                await toFile(
                    req.file.buffer,

                    req.file.originalname ||
                        "physics-ai-recording.webm",

                    {
                        type:
                            req.file.mimetype ||
                            "audio/webm"
                    }
                );

            const transcription =
                await client.audio.transcriptions.create({

                    file: audioFile,

                    model:
                        "gpt-4o-mini-transcribe",

                    language:
                        "ar"
                });

            const text =
                String(
                    transcription.text || ""
                ).trim();

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
   PHYSICS AI
========================================================= */

app.post(
    "/api/chat",

    requireLogin,

    async function (req, res) {

        try {

            const message =
                String(
                    req.body.message || ""
                )
                    .trim();

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
                    ? req.body.history.slice(-20)
                    : [];

            const grade =
                String(
                    req.body.grade || ""
                )
                    .trim();

            const subject =
                String(
                    req.body.subject ||
                    "الفيزياء"
                )
                    .trim();

            const unit =
                String(
                    req.body.unit || ""
                )
                    .trim();

            const lesson =
                String(
                    req.body.lesson || ""
                )
                    .trim();

            const mode =
                String(
                    req.body.mode || ""
                )
                    .trim();

            const image =
                req.body.image || null;

            const contextText = `

معلومات جلسة الطالب:

الصف:
${grade || "غير محدد"}

المادة:
${subject}

الفصل أو الوحدة:
${unit || "غير محدد"}

الدرس:
${lesson || "غير محدد"}

نوع الجلسة:
${mode || "دردشة عامة"}

`;

            const systemInstructions = `

أنت Physics AI، مدرس فيزياء مصري متخصص في تعليم الطلاب.

هدفك الأساسي إن الطالب يفهم الفيزياء فعلًا، وتكون إجابتك دقيقة علميًا وسهلة.

==============================
أسلوب اللغة
==============================

اتكلم بالمصري الطبيعي.

استخدم لغة مصرية سهلة ومحترمة.

ممكن تستخدم تعبيرات طبيعية مثل:

"بص، الموضوع ببساطة..."

"خلينا نفهمها."

"الفكرة هنا إن..."

"يعني إيه الكلام ده؟"

لكن حافظ دائمًا على الدقة العلمية.

القوانين والرموز والوحدات لازم تكون صحيحة.

ممنوع عامية مبالغ فيها تقلل من جودة الشرح.

==============================
تحديد نوع الإجابة
==============================

حدد من كلام الطالب هو عايز إيه.

إذا قال:

"حل"

"احسب"

"هات الناتج"

"عاوز الإجابة"

فأعطه الحل أو النتيجة المطلوبة بشكل مباشر ومختصر.

لا تقدم شرحًا طويلًا أو خطوات تفصيلية إلا لو الطالب طلبها.

إذا قال:

"حل بالخطوات"

"اشرح الحل"

"وريني جبتها إزاي"

"عاوز أفهم"

فهنا قدم الحل بالخطوات:

1. المعطيات
2. المطلوب
3. القانون
4. التعويض
5. الحساب
6. الوحدة
7. النتيجة النهائية

==============================
شرح الدرس
==============================

إذا قال:

"اشرح الدرس"

"فهمني الدرس"

"شرح"

"عاوز أذاكر"

فاشرح من البداية.

ابدأ بالفكرة الأساسية.

بعدها:

- التعريفات
- المفاهيم
- القوانين
- معنى الرموز
- الوحدات
- مثال بسيط
- مثال تطبيقي
- الأخطاء الشائعة

لا تنسخ نص كتاب.

اكتب شرحًا أصليًا.

==============================
مش فاهم
==============================

إذا قال الطالب:

"مش فاهم"

"مش فاهم خالص"

"وضح"

"اشرح تاني"

لا تكرر نفس الشرح بنفس الأسلوب.

غير طريقة الشرح.

استخدم تشبيهًا أو مثالًا بسيطًا عندما يكون مناسبًا.

وقسم الموضوع لأجزاء أصغر.

==============================
المسائل
==============================

لا تخترع أي رقم غير موجود.

إذا كانت هناك قيمة ناقصة، أخبر الطالب بما ينقصه.

انتبه جدًا إلى:

- الوحدات
- تحويل الوحدات
- الإشارات
- الاتجاهات
- الرموز
- القوانين

إذا كانت هناك أكثر من طريقة للحل، استخدم الأبسط.

==============================
الصور
==============================

إذا أرسل الطالب صورة لمسألة:

اقرأ الصورة بدقة.

حدد المطلوب.

إذا كانت الصورة غير واضحة، قل للطالب إن الجزء غير واضح بدل اختراع محتواه.

إذا قال "حل":

أعطه الحل المباشر.

إذا قال "اشرح":

اشرح بالتفصيل.

==============================
السياق
==============================

تذكر المحادثة السابقة.

إذا قال:

"احسبها"

فارجع للمسألة السابقة.

إذا قال:

"طيب السرعة؟"

افهم أنه يقصد السرعة المتعلقة بالسؤال السابق.

لا تطلب إعادة السؤال طالما السياق واضح.

==============================
الدقة
==============================

لا تخترع قوانين.

لا تخترع معلومات.

إذا كانت البيانات غير كافية، وضح ذلك.

==============================
خارج الفيزياء
==============================

إذا كان السؤال بعيدًا تمامًا عن الفيزياء، قل باختصار إن تخصصك الأساسي هو الفيزياء.

==============================
هوية المشروع
==============================

أنت Physics AI، مدرس الفيزياء الذكي.

تم تطويرك بواسطة محمد عبده فرج.

لا تكشف أي بيانات شخصية أخرى عن المطور.

`;

            const input = [];

            /*
             * إضافة تاريخ المحادثة
             */

            for (
                const item of history
            ) {

                if (
                    !item ||
                    !item.role ||
                    !item.content
                ) {
                    continue;
                }

                input.push({

                    role:
                        item.role === "assistant"
                            ? "assistant"
                            : "user",

                    content:
                        String(
                            item.content
                        )

                });
            }

            /*
             * الرسالة الحالية
             */

            const currentContent = [];

            currentContent.push({

                type:
                    "input_text",

                text:
                    contextText +
                    "\n\nرسالة الطالب:\n" +
                    message

            });

            /*
             * الصورة إن وجدت
             */

            if (
                image &&
                typeof image === "string" &&
                image.startsWith(
                    "data:image/"
                )
            ) {

                currentContent.push({

                    type:
                        "input_image",

                    image_url:
                        image

                });
            }

            input.push({

                role:
                    "user",

                content:
                    currentContent

            });

            console.log(
                "Sending request to Physics AI..."
            );

            const response =
                await client.responses.create({

                    model:
                        "gpt-5.6-luna",

                    instructions:
                        systemInstructions,

                    input

                });

            const answer =
                String(
                    response.output_text || ""
                ).trim() ||
                "مش قادر أطلع إجابة دلوقتي، حاول تاني.";

            console.log(
                "AI response received."
            );

            res.json({

                success: true,

                answer

            });

        } catch (error) {

            console.error(
                "AI ERROR:",
                error
            );

            res.status(500).json({

                error:
                    "حصل خطأ أثناء الاتصال بـ Physics AI."

            });
        }
    }
);

/* =========================================================
   MULTER / SERVER ERROR HANDLER
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

        /*
         * Multer file size
         */

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

        /*
         * Image error
         */

        if (
            error &&
            error.message ===
                "يسمح برفع الصور فقط."
        ) {

            return res.status(400).json({

                error:
                    error.message

            });
        }

        /*
         * Audio error
         */

        if (
            error &&
            error.message ===
                "نوع الملف الصوتي غير مدعوم."
        ) {

            return res.status(400).json({

                error:
                    error.message

            });
        }

        /*
         * General upload error
         */

        if (
            error &&
            error.name ===
                "MulterError"
        ) {

            return res.status(400).json({

                error:
                    "حصل خطأ أثناء رفع الملف."

            });
        }

        /*
         * General error
         */

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
            `Physics AI running at http://localhost:${PORT}`
        );

        console.log(
            "Audio upload: READY"
        );

        console.log(
            "Image upload: READY"
        );

        console.log(
            "Database: READY"
        );

    }
);