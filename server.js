"use strict";

require("dotenv").config();

const express = require("express");
const path = require("path");
const https = require("https");
const crypto = require("crypto");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const Database = require("better-sqlite3");
const multer = require("multer");


/* =========================================================
   APP
========================================================= */

const app = express();

const PORT =
    Number(process.env.PORT) ||
    3000;


/* =========================================================
   ENVIRONMENT
========================================================= */

const GEMINI_API_KEY =
    String(
        process.env.GEMINI_API_KEY ||
        ""
    ).trim();

const GEMINI_MODEL =
    String(
        process.env.GEMINI_MODEL ||
        "gemini-3.5-flash-lite"
    ).trim();

const SESSION_SECRET =
    String(
        process.env.SESSION_SECRET ||
        "physics-ai-session-secret-change-this"
    );


if (!GEMINI_API_KEY) {

    console.error(
        "\nERROR: GEMINI_API_KEY غير موجود في ملف .env\n"
    );

    process.exit(1);
}


/* =========================================================
   DATABASE
========================================================= */

const db =
    new Database(
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

app.set(
    "trust proxy",
    1
);


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
        secret: SESSION_SECRET,

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

const imageUpload =
    multer({
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

const audioUpload =
    multer({
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
                        .split(";")[0]
                        .trim();


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
   AUTH
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

        return res
            .status(401)
            .json({
                error:
                    "لازم تسجل دخول الأول."
            });

    }

    next();
}


/* =========================================================
   HELPERS
========================================================= */

function cleanText(
    value,
    maxLength = 20000
) {

    return String(
        value == null
            ? ""
            : value
    )
        .replace(/\u0000/g, "")
        .trim()
        .slice(
            0,
            maxLength
        );

}


function normalizeEmail(
    email
) {

    return String(
        email || ""
    )
        .trim()
        .toLowerCase()
        .slice(
            0,
            160
        );

}


function makeConversationTitle(
    text
) {

    const cleaned =
        cleanText(
            text,
            120
        );

    if (!cleaned) {
        return "محادثة جديدة";
    }

    return (
        cleaned.length > 55
            ? cleaned.slice(
                0,
                55
            ) + "..."
            : cleaned
    );

}


function buildHistory(
    rawHistory
) {

    if (
        !Array.isArray(
            rawHistory
        )
    ) {
        return [];
    }

    return rawHistory
        .slice(-24)
        .filter(
            item =>
                item &&
                (
                    item.role === "user" ||
                    item.role === "assistant" ||
                    item.role === "model"
                ) &&
                item.content
        )
        .map(
            item => ({

                role:
                    item.role ===
                    "assistant" ||
                    item.role ===
                    "model"
                        ? "model"
                        : "user",

                content:
                    cleanText(
                        item.content,
                        12000
                    )

            })
        );

}


/* =========================================================
   PHYSICS DOMAIN
========================================================= */

const PHYSICS_DOMAINS = [

    "الميكانيكا",
    "الديناميكا",
    "الكينماتيكا",
    "الاستاتيكا",
    "الدوران",
    "الجاذبية",
    "الميكانيكا التحليلية",
    "الموائع",
    "الديناميكا الحرارية",
    "النظرية الحركية",
    "الكهرباء",
    "المغناطيسية",
    "الكهرومغناطيسية",
    "الدوائر الكهربائية",
    "التيار المتردد",
    "الموجات",
    "الصوت",
    "البصريات",
    "الاستقطاب",
    "التداخل",
    "الحيود",
    "النسبية الخاصة",
    "النسبية العامة",
    "ميكانيكا الكم",
    "الفيزياء الذرية",
    "الفيزياء النووية",
    "فيزياء الجسيمات",
    "فيزياء المادة المكثفة",
    "فيزياء البلازما",
    "الفيزياء الفلكية",
    "علم الكونيات",
    "الفيزياء الرياضية",
    "الفيزياء التجريبية",
    "فيزياء المواد",
    "الفيزياء الحيوية"
];


/* =========================================================
   PHYSICS CLASSIFIER
========================================================= */

function guessPhysicsDomain(
    text
) {

    const input =
        String(text || "")
            .toLowerCase();

    const groups = [

        {
            name: "الميكانيكا",
            words: [
                "سرعة",
                "عجلة",
                "تسارع",
                "قوة",
                "نيوتن",
                "احتكاك",
                "طاقة",
                "شغل",
                "زخم",
                "تصادم",
                "عزم",
                "دوران",
                "حركة",
                "جاذبية",
                "مدار"
            ]
        },

        {
            name: "الكهرباء والمغناطيسية",
            words: [
                "تيار",
                "جهد",
                "مقاومة",
                "كهرباء",
                "شحنة",
                "مجال كهربائي",
                "مجال مغناطيسي",
                "مغناطيس",
                "مكثف",
                "ملف",
                "كيرشوف",
                "أوم",
                "فاراداي",
                "لنز"
            ]
        },

        {
            name: "الحرارة والديناميكا الحرارية",
            words: [
                "حرارة",
                "درجة الحرارة",
                "غاز",
                "ضغط",
                "كارنو",
                "انتروبي",
                "طاقة داخلية",
                "حرارية",
                "ديناميكا حرارية"
            ]
        },

        {
            name: "الموجات والبصريات",
            words: [
                "موجة",
                "تردد",
                "طول موجي",
                "صوت",
                "مرآة",
                "عدسة",
                "انكسار",
                "انعكاس",
                "حيود",
                "تداخل",
                "دوبلر"
            ]
        },

        {
            name: "الفيزياء الحديثة",
            words: [
                "كم",
                "كمومية",
                "شرودنغر",
                "بلانك",
                "فوتون",
                "إلكترون",
                "ذرة",
                "نووية",
                "نواة",
                "نشاط إشعاعي",
                "نسبية",
                "لورنتز",
                "هيغز",
                "كوارك"
            ]
        }

    ];


    let best =
        "الفيزياء العامة";

    let bestScore =
        0;


    for (
        const group
        of groups
    ) {

        let score = 0;


        for (
            const word
            of group.words
        ) {

            if (
                input.includes(
                    word
                )
            ) {

                score++;

            }

        }


        if (
            score >
            bestScore
        ) {

            bestScore =
                score;

            best =
                group.name;
        }

    }


    return best;

}


/* =========================================================
   PHYSICS SYSTEM PROMPT
========================================================= */

function buildPhysicsSystemPrompt(
    context
) {

    return `

أنت Physics AI، نظام ذكاء اصطناعي متخصص في الفيزياء وحل مسائلها.

أنت مدرس فيزياء مصري محترف، ومهمتك ليست مجرد إعطاء إجابة،
بل فهم السؤال ثم بناء الحل الفيزيائي الصحيح والتحقق منه قبل عرضه.

============================================================
نطاق المعرفة
============================================================

تعامل مع جميع فروع الفيزياء، وليس فقط منهجًا دراسيًا واحدًا.

تشمل معرفتك:

${PHYSICS_DOMAINS.join("، ")}

وكذلك الموضوعات الفرعية والتخصصات المتقدمة داخل هذه الفروع.

إذا كانت المسألة خارج المنهج الدراسي الحالي، لا ترفضها.
حلها بالفيزياء المناسبة لمستواها.

============================================================
قاعدة العمل الأساسية
============================================================

في كل مسألة:

1. افهم المطلوب الحقيقي.
2. حدد المجال الفيزيائي.
3. استخرج المعطيات.
4. حدد المجهول.
5. حدد الفرضيات الضرورية.
6. اختر القانون أو النموذج المناسب.
7. وحّد الوحدات.
8. طبّق القانون.
9. نفّذ الحساب بدقة.
10. راجع الإشارات والاتجاهات.
11. راجع الوحدات والأبعاد.
12. افحص هل النتيجة منطقية فيزيائيًا.
13. قدم الإجابة النهائية بوضوح.

============================================================
منع الاختلاق
============================================================

ممنوع اختراع:
- رقم غير موجود.
- قيمة غير معطاة بدون توضيح.
- قانون غير صحيح.
- معلومة فيزيائية وهمية.
- قراءة غير واضحة من صورة.

إذا كانت معلومة ناقصة فعلًا:
قل للطالب ما الذي ينقصه.

إذا كانت الصورة غير واضحة:
حدد الجزء الذي لم تستطع قراءته.

============================================================
الحسابات
============================================================

انتبه إلى:

- ترتيب العمليات.
- الأقواس.
- الأسس.
- الجذور.
- الكسور.
- الإشارات.
- التقريب.
- الوحدات.

لا تقرب مبكرًا إذا كان ذلك قد يسبب خطأ ملحوظًا.

============================================================
الوحدات
============================================================

استخدم SI افتراضيًا.

انتبه إلى:
m
kg
s
N
J
W
Pa
C
V
A
Ohm
T
Hz
K

وعند الحاجة حوّل الوحدات قبل التعويض.

استخدم تحليل الأبعاد لمراجعة العلاقات عندما يكون مفيدًا.

============================================================
المتجهات
============================================================

عند وجود كميات متجهة:
حدد الاتجاه.

عند الحاجة استخدم المحاور:
x
y
z

وافصل المركبات.

لا تعامل الكمية المتجهة ككمية قياسية إلا إذا كان ذلك صحيحًا.

============================================================
الميكانيكا
============================================================

فرّق بين:

المسافة والإزاحة
السرعة المتجهة والسرعة القياسية
الكتلة والوزن
القوة والطاقة
الزخم والطاقة

انتبه إلى:
قوانين نيوتن
الشغل والطاقة
الزخم والدفع
الحركة الدائرية
العزم
الاتزان
الدوران
الجاذبية
المدارات

============================================================
الكهرباء
============================================================

فرّق بين:

الشحنة
التيار
فرق الجهد
المقاومة
القدرة
الطاقة

وفي الدوائر:
حدد هل العناصر على التوالي أم التوازي.

استخدم قوانين كيرشوف عندما يلزم.

============================================================
المغناطيسية
============================================================

انتبه إلى:
اتجاه المجال
اتجاه القوة
قاعدة اليد اليمنى
شحنة الجسيم
سرعة الجسيم
قوانين الحث

============================================================
الحرارة
============================================================

فرّق بين:
درجة الحرارة
الحرارة
الطاقة الداخلية
الشغل

ولا تخلط بين العمليات الحرارية المختلفة.

============================================================
الموجات
============================================================

عند الحاجة استخدم:

v = f λ

وفرّق بين:
التردد
الطول الموجي
السرعة
الزمن الدوري
السعة

============================================================
البصريات
============================================================

حدد أولًا:
نوع المرآة أو العدسة
موضع الجسم
نوع الصورة
الإشارة
البعد البؤري

ثم طبّق القانون الصحيح.

============================================================
الفيزياء الحديثة
============================================================

عند التعامل مع:
الكم
النسبية
الذرية
النووية
الجسيمات

لا تستخدم تقريبًا كلاسيكيًا بلا سبب.

ميّز بين النظريات والنماذج والتقريبات.

============================================================
النسبية
============================================================

انتبه للفرق بين:
السرعة الكلاسيكية
والعلاقات النسبية.

في المسائل النسبية:
انتبه إلى الزمن الخاص
والطول الخاص
والسرعة
والطاقة
والزخم
وتحويلات لورنتز.

============================================================
الكم
============================================================

انتبه إلى:
دالة الموجة
الاحتمال
مبدأ عدم اليقين
المؤثرات
مستويات الطاقة
التراكب
النفق الكمومي
العزم الزاوي
اللف المغزلي

============================================================
الصورة
============================================================

إذا أرسل الطالب صورة:

اقرأ:
- نص السؤال
- الأرقام
- الوحدات
- الرموز
- الرسم
- الأسهم
- المحاور
- الزوايا

إذا كانت الصورة لمسألة:
حل المسألة اعتمادًا على جميع المعلومات المرئية.

============================================================
أسلوب اللغة
============================================================

تحدث بالعربية المصرية الطبيعية.

خليك محترم وواضح.

مسموح بتعبيرات طبيعية مثل:
"بص"
"خلينا نفكها"
"الفكرة هنا"

لكن لا تجعل العامية تقلل من الدقة العلمية.

============================================================
حسب طلب الطالب
============================================================

إذا قال:
"حل"

→ حل مباشرة بشكل واضح.

إذا قال:
"حل بالخطوات"

→ استخدم:

المعطيات
المطلوب
الفكرة الفيزيائية
القانون
التعويض
الحساب
الوحدة
المراجعة
الإجابة النهائية

إذا قال:
"هات الناتج"

→ كن مباشرًا مع توضيح قصير عند الحاجة.

إذا قال:
"اشرح"

→ اشرح من الأساسيات وحتى الفهم.

إذا قال:
"مش فاهم"

→ غير أسلوب الشرح ولا تكرر نفس الكلام.

إذا قال:
"اختبرني"

→ اطرح سؤالًا وانتظر الإجابة.

إذا قال:
"صححلي"

→ افحص حله خطوة بخطوة وحدد مكان الخطأ.

============================================================
التعامل مع السياق
============================================================

تذكر المحادثة السابقة.

إذا قال:
"طيب احسبها"
أو
"طب السرعة؟"
أو
"ليه؟"

استخدم السياق السابق طالما المقصود واضح.

============================================================
المراجعة النهائية
============================================================

قبل إرسال حل عددي اسأل نفسك داخليًا:

هل القانون صحيح؟
هل البيانات صحيحة؟
هل الوحدات صحيحة؟
هل التعويض صحيح؟
هل الحساب صحيح؟
هل الإشارة صحيحة؟
هل النتيجة منطقية؟
هل أجبت المطلوب؟

إذا وجدت خطأ:
صححه قبل إرسال الإجابة.

============================================================
سياق جلسة الطالب
============================================================

${context}

============================================================
قاعدة أخيرة
============================================================

أنت لا تريد فقط الوصول للناتج.

أنت تريد أن تكون النتيجة:
صحيحة
ومفهومة
ومبررة
وقابلة للمراجعة.

`;
}


/* =========================================================
   GEMINI REST REQUEST
========================================================= */

function callGemini(
    contents,
    systemInstruction
) {

    return new Promise(
        function (
            resolve,
            reject
        ) {

            const payload =
                JSON.stringify({

                    contents,

                    systemInstruction: {
                        parts: [
                            {
                                text:
                                    systemInstruction
                            }
                        ]
                    },

                    generationConfig: {

                        temperature:
                            0.18,

                        topP:
                            0.85,

                        topK:
                            32,

                        maxOutputTokens:
                            5000
                    }

                });


            const request =
                https.request(
                    {
                        hostname:
                            "generativelanguage.googleapis.com",

                        path:
                            "/v1beta/models/" +
                            encodeURIComponent(
                                GEMINI_MODEL
                            ) +
                            ":generateContent",

                        method:
                            "POST",

                        family:
                            4,

                        timeout:
                            60000,

                        headers: {

                            "Content-Type":
                                "application/json",

                            "Content-Length":
                                Buffer
                                    .byteLength(
                                        payload
                                    ),

                            "x-goog-api-key":
                                GEMINI_API_KEY
                        }

                    },

                    function (response) {

                        let raw =
                            "";

                        response.setEncoding(
                            "utf8"
                        );


                        response.on(
                            "data",
                            function (chunk) {

                                raw +=
                                    chunk;

                            }
                        );


                        response.on(
                            "end",
                            function () {

                                let parsed;

                                try {

                                    parsed =
                                        raw
                                            ? JSON.parse(
                                                raw
                                            )
                                            : {};

                                } catch (
                                    error
                                ) {

                                    return reject(
                                        new Error(
                                            "استجابة غير صالحة من Gemini."
                                        )
                                    );

                                }


                                const status =
                                    Number(
                                        response.statusCode ||
                                        500
                                    );


                                if (
                                    status < 200 ||
                                    status >= 300
                                ) {

                                    const apiMessage =
                                        parsed
                                            ?.error
                                            ?.message ||
                                        "Gemini request failed.";


                                    const error =
                                        new Error(
                                            apiMessage
                                        );

                                    error.status =
                                        status;

                                    return reject(
                                        error
                                    );

                                }


                                const candidates =
                                    Array.isArray(
                                        parsed.candidates
                                    )
                                        ? parsed.candidates
                                        : [];


                                const parts =
                                    candidates[0]
                                        ?.content
                                        ?.parts || [];


                                const text =
                                    parts
                                        .map(
                                            part =>
                                                String(
                                                    part?.text ||
                                                    ""
                                                )
                                        )
                                        .join(
                                            "\n"
                                        )
                                        .trim();


                                if (!text) {

                                    return reject(
                                        new Error(
                                            "Gemini returned an empty response."
                                        )
                                    );

                                }


                                resolve(
                                    text
                                );

                            }
                        );

                    }
                );


            request.on(
                "timeout",
                function () {

                    request.destroy(
                        new Error(
                            "انتهت مهلة الاتصال بـ Gemini."
                        )
                    );

                }
            );


            request.on(
                "error",
                function (error) {

                    reject(
                        error
                    );

                }
            );


            request.write(
                payload
            );


            request.end();

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
                normalizeEmail(
                    req.body.email
                );


            const password =
                String(
                    req.body.password ||
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
                !email.includes("@")
            ) {

                return res
                    .status(400)
                    .json({
                        error:
                            "اكتب بريد إلكتروني صحيح."
                    });

            }


            if (
                password.length < 6
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
                `)
                    .get(
                        email
                    );


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


            const result =
                db.prepare(`
                    INSERT INTO users
                    (
                        name,
                        email,
                        password
                    )
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

                success:
                    true,

                user: {

                    id:
                        result.lastInsertRowid,

                    name,

                    email
                }

            });

        } catch (
            error
        ) {

            console.error(
                "REGISTER ERROR:",
                error
            );


            res
                .status(500)
                .json({
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
                normalizeEmail(
                    req.body.email
                );


            const password =
                String(
                    req.body.password ||
                    ""
                );


            if (
                !email ||
                !password
            ) {

                return res
                    .status(400)
                    .json({
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
                    .get(
                        email
                    );


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


            req.session.userId =
                user.id;

            req.session.userName =
                user.name;


            res.json({

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

            });

        } catch (
            error
        ) {

            console.error(
                "LOGIN ERROR:",
                error
            );


            res
                .status(500)
                .json({
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
    function (
        req,
        res
    ) {

        req.session.destroy(
            function (
                error
            ) {

                if (error) {

                    return res
                        .status(500)
                        .json({
                            error:
                                "تعذر تسجيل الخروج."
                        });

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
   CURRENT USER
========================================================= */

app.get(
    "/api/auth/me",
    function (
        req,
        res
    ) {

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
            `)
                .get(
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
                cleanText(
                    req.body.title ||
                    "محادثة جديدة",
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
                `)
                    .run(
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

        } catch (
            error
        ) {

            console.error(
                "CREATE CONVERSATION ERROR:",
                error
            );


            res
                .status(500)
                .json({
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
                    ORDER BY
                        updated_at DESC,
                        id DESC
                `)
                    .all(
                        req.session.userId
                    );


            res.json({

                conversations

            });

        } catch (
            error
        ) {

            console.error(
                "GET CONVERSATIONS ERROR:",
                error
            );


            res
                .status(500)
                .json({
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

            const id =
                Number(
                    req.params.id
                );


            if (
                !Number.isInteger(
                    id
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
                        user_id,
                        title,
                        created_at,
                        updated_at
                    FROM conversations
                    WHERE id = ?
                    AND user_id = ?
                `)
                    .get(
                        id,
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
                    ORDER BY
                        id ASC
                `)
                    .all(
                        id
                    );


            res.json({

                conversation,

                messages

            });

        } catch (
            error
        ) {

            console.error(
                "GET CONVERSATION ERROR:",
                error
            );


            res
                .status(500)
                .json({
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
    function (
        req,
        res
    ) {

        try {

            const id =
                Number(
                    req.params.id
                );


            if (
                !Number.isInteger(
                    id
                )
            ) {

                return res
                    .status(400)
                    .json({
                        error:
                            "رقم المحادثة غير صحيح."
                    });

            }


            const result =
                db.prepare(`
                    DELETE FROM conversations
                    WHERE id = ?
                    AND user_id = ?
                `)
                    .run(
                        id,
                        req.session.userId
                    );


            if (
                !result.changes
            ) {

                return res
                    .status(404)
                    .json({
                        error:
                            "المحادثة غير موجودة."
                    });

            }


            res.json({

                success:
                    true

            });

        } catch (
            error
        ) {

            console.error(
                "DELETE CONVERSATION ERROR:",
                error
            );


            res
                .status(500)
                .json({
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


            const role =
                req.body.role ===
                "assistant"
                    ? "assistant"
                    : "user";


            const content =
                cleanText(
                    req.body.content,
                    20000
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

                image =
                    null;

            }


            if (!content) {

                return res
                    .status(400)
                    .json({
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
                `)
                    .run(
                        conversationId,
                        role,
                        content,
                        image
                    );


            db.prepare(`
                UPDATE conversations
                SET
                    updated_at =
                        CURRENT_TIMESTAMP
                WHERE id = ?
            `)
                .run(
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

        } catch (
            error
        ) {

            console.error(
                "SAVE MESSAGE ERROR:",
                error
            );


            res
                .status(500)
                .json({
                    error:
                        "تعذر حفظ الرسالة."
                });

        }

    }
);


/* =========================================================
   TRANSCRIBE AUDIO
========================================================= */

app.post(
    "/api/transcribe",
    audioUpload.single(
        "audio"
    ),
    async function (
        req,
        res
    ) {

        try {

            if (!req.file) {

                return res
                    .status(400)
                    .json({
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

                return res
                    .status(400)
                    .json({
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


            const transcriptionPrompt = `
استمع إلى التسجيل الصوتي.

حوّل كلام الطالب إلى نص مكتوب فقط.

القواعد:
- اللغة الأساسية العربية المصرية.
- حافظ على المصطلحات الفيزيائية والعلمية.
- إذا نطق الطالب رموزًا أو أرقامًا، اكتبها بوضوح.
- لا تشرح.
- لا تحل السؤال.
- لا تضف معلومات من عندك.
- أخرج نص كلام الطالب فقط.
`;


            const answer =
                await callGemini(

                    [
                        {
                            role:
                                "user",

                            parts: [

                                {
                                    text:
                                        transcriptionPrompt
                                },

                                {
                                    inline_data: {

                                        mime_type:
                                            mimeType,

                                        data:
                                            audioBase64

                                    }

                                }

                            ]

                        }

                    ],

                    `
أنت محول كلام إلى نص.
مهمتك الوحيدة تفريغ التسجيل.
لا تجب عن الأسئلة.
لا تضف أي شرح.
`
                );


            res.json({

                success:
                    true,

                text:
                    answer

            });

        } catch (
            error
        ) {

            console.error(
                "TRANSCRIPTION ERROR:",
                error
            );


            res
                .status(500)
                .json({
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
    async function (
        req,
        res
    ) {

        try {

            const message =
                cleanText(
                    req.body.message,
                    16000
                );


            if (!message) {

                return res
                    .status(400)
                    .json({
                        error:
                            "اكتب سؤالك الأول."
                    });

            }


            const history =
                buildHistory(
                    req.body.history
                );


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
                    500
                );


            const mode =
                cleanText(
                    req.body.mode,
                    100
                );


            const image =
                typeof req.body.image ===
                    "string" &&
                req.body.image.startsWith(
                    "data:image/"
                )
                    ? req.body.image
                    : null;


            const physicsDomain =
                guessPhysicsDomain(
                    message
                );


            const contextText = `

معلومات جلسة الطالب:

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

المجال الفيزيائي المتوقع:
${physicsDomain}

`;


            const systemPrompt =
                buildPhysicsSystemPrompt(
                    contextText
                );


            const contents = [];


            /* =====================================================
               HISTORY
            ====================================================== */

            for (
                const item
                of history
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
                        "model"
                            ? "model"
                            : "user",

                    parts: [

                        {
                            text:
                                item.content
                        }

                    ]

                });

            }


            /* =====================================================
               CURRENT MESSAGE
            ====================================================== */

            const currentParts = [];


            currentParts.push({

                text:
                    `
رسالة الطالب الحالية:

${message}
`
            });


            /* =====================================================
               IMAGE
            ====================================================== */

            if (
                image
            ) {

                const match =
                    image.match(
                        /^data:([^;]+);base64,(.+)$/
                    );


                if (match) {

                    currentParts.push({

                        inline_data: {

                            mime_type:
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


            console.log(
                `Physics request | domain=${physicsDomain} | model=${GEMINI_MODEL}`
            );


            /* =====================================================
               GEMINI
            ====================================================== */

            const answer =
                await callGemini(
                    contents,
                    systemPrompt
                );


            res.json({

                success:
                    true,

                answer:
                    answer

            });

        } catch (
            error
        ) {

            console.error(
                "GEMINI AI ERROR:",
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
                429
            ) {

                return res
                    .status(429)
                    .json({
                        error:
                            "تم الوصول إلى حد الاستخدام الحالي لـ Gemini. حاول بعد قليل."
                    });

            }


            if (
                status ===
                    401 ||
                status ===
                    403
            ) {

                return res
                    .status(500)
                    .json({
                        error:
                            "مفتاح Gemini غير صحيح أو غير مصرح باستخدامه."
                    });

            }


            if (
                status ===
                404
            ) {

                return res
                    .status(500)
                    .json({
                        error:
                            "نموذج Gemini المحدد غير متاح. راجع GEMINI_MODEL في ملف .env."
                    });

            }


            if (
                String(
                    error?.message ||
                    ""
                )
                    .toLowerCase()
                    .includes(
                        "timeout"
                    )
            ) {

                return res
                    .status(504)
                    .json({
                        error:
                            "الاتصال بـ Gemini أخذ وقتًا أطول من المتوقع. حاول السؤال مرة أخرى."
                    });

            }


            res
                .status(500)
                .json({
                    error:
                        "حصل خطأ أثناء الاتصال بـ Physics AI."
                });

        }

    }
);


/* =========================================================
   SERVER ERROR HANDLER
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

            return res
                .status(400)
                .json({
                    error:
                        "حجم الملف كبير جدًا."
                });

        }


        if (
            error &&
            (
                error.message ===
                    "يسمح برفع الصور فقط." ||
                error.message ===
                    "نوع الملف الصوتي غير مدعوم."
            )
        ) {

            return res
                .status(400)
                .json({
                    error:
                        error.message
                });

        }


        if (
            error &&
            error.name ===
                "MulterError"
        ) {

            return res
                .status(400)
                .json({
                    error:
                        "حصل خطأ في رفع الملف."
                });

        }


        res
            .status(500)
            .json({
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
            ""
        );

        console.log(
            "========================================"
        );

        console.log(
            "      Physics AI Server"
        );

        console.log(
            "========================================"
        );

        console.log(
            `Server:
http://localhost:${PORT}`
        );

        console.log(
            `Model:
${GEMINI_MODEL}`
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
            "Image upload: READY"
        );

        console.log(
            "Audio transcription: READY"
        );

        console.log(
            "Physics AI: READY"
        );

        console.log(
            "========================================"
        );

        console.log(
            ""
        );

    }
);
