// ========================================
// عناصر الصفحة
// ========================================

const messageInput =
    document.getElementById("messageInput");

const sendButton =
    document.getElementById("sendButton");

const chat =
    document.getElementById("chat");

const gradeSelect =
    document.getElementById("grade");

const subjectSelect =
    document.getElementById("subject");

const unitSelect =
    document.getElementById("unit");

const lessonSelect =
    document.getElementById("lesson");

const lessonTitle =
    document.getElementById("lessonTitle");

const lessonDescription =
    document.getElementById("lessonDescription");


// ========================================
// ذاكرة المحادثة
// ========================================

let conversationHistory = [];


// ========================================
// المناهج
// ========================================

const curriculum = {

    "الصف الثالث الثانوي العام": {

        subject: "الفيزياء",

        units: [

            {

                title:
                    "الوحدة الأولى: الكهربية التيارية والكهرومغناطيسية",

                lessons: [

                    {
                        title:
                            "الفصل الأول: التيار الكهربي وقانون أوم وقانونا كيرتشوف",

                        description:
                            "دراسة التيار الكهربي وشدة التيار وفرق الجهد والمقاومة وقانون أوم وقوانين كيرتشوف."
                    },

                    {
                        title:
                            "التيار الكهربي وشدة التيار",

                        description:
                            "التعرف على مفهوم التيار الكهربي وشدة التيار والعلاقة بين الشحنة والزمن."
                    },

                    {
                        title:
                            "فرق الجهد والقوة الدافعة الكهربية",

                        description:
                            "فهم فرق الجهد والقوة الدافعة الكهربية ودورهما في الدائرة الكهربية."
                    },

                    {
                        title:
                            "المقاومة الكهربية",

                        description:
                            "دراسة المقاومة الكهربية والعوامل التي تؤثر في مقاومة الموصل."
                    },

                    {
                        title:
                            "المقاومة النوعية والتوصيلية",

                        description:
                            "دراسة المقاومة النوعية والتوصيلية والعلاقة بينهما."
                    },

                    {
                        title:
                            "توصيل المقاومات على التوالي",

                        description:
                            "دراسة توصيل المقاومات على التوالي وحساب المقاومة المكافئة."
                    },

                    {
                        title:
                            "توصيل المقاومات على التوازي",

                        description:
                            "دراسة توصيل المقاومات على التوازي وحساب المقاومة المكافئة."
                    },

                    {
                        title:
                            "قانون أوم",

                        description:
                            "دراسة العلاقة بين فرق الجهد وشدة التيار والمقاومة."
                    },

                    {
                        title:
                            "قانون أوم للدائرة المغلقة",

                        description:
                            "تطبيق قانون أوم على الدوائر المغلقة ودراسة المقاومة الداخلية."
                    },

                    {
                        title:
                            "قانون كيرتشوف الأول",

                        description:
                            "دراسة قانون كيرتشوف الأول وتطبيقه على الدوائر الكهربية."
                    },

                    {
                        title:
                            "قانون كيرتشوف الثاني",

                        description:
                            "دراسة قانون كيرتشوف الثاني واستخدامه في تحليل الدوائر الكهربية."
                    }

                ]

            },


            {

                title:
                    "الفصل الثاني: التأثير المغناطيسي للتيار الكهربي",

                lessons: [

                    {
                        title:
                            "التأثير المغناطيسي للتيار الكهربي",

                        description:
                            "دراسة المجال المغناطيسي الناتج عن مرور التيار الكهربي."
                    }

                ]

            },


            {

                title:
                    "الفصل الثالث: الحث الكهرومغناطيسي",

                lessons: [

                    {
                        title:
                            "الحث الكهرومغناطيسي",

                        description:
                            "دراسة ظاهرة الحث الكهرومغناطيسي وتطبيقاتها."
                    }

                ]

            },


            {

                title:
                    "الفصل الرابع: دوائر التيار المتردد",

                lessons: [

                    {
                        title:
                            "دوائر التيار المتردد",

                        description:
                            "دراسة دوائر التيار المتردد ومبادئ عملها."
                    }

                ]

            },


            {

                title:
                    "الوحدة الثانية: مقدمة في الفيزياء الحديثة",

                lessons: [

                    {
                        title:
                            "الفصل الخامس: ازدواجية الموجة والجسيم",

                        description:
                            "دراسة الطبيعة المزدوجة للموجات والجسيمات."
                    },

                    {
                        title:
                            "الفصل السادس: الأطياف الذرية",

                        description:
                            "دراسة الأطياف الذرية ومستويات الطاقة."
                    },

                    {
                        title:
                            "الفصل السابع: الليزر",

                        description:
                            "دراسة أساسيات الليزر وخصائصه وتطبيقاته."
                    },

                    {
                        title:
                            "الفصل الثامن: الإلكترونيات الحديثة",

                        description:
                            "دراسة بعض أساسيات الإلكترونيات الحديثة وتطبيقاتها."
                    }

                ]

            }

        ]

    },


    // ========================================
    // الصف الثاني بكالوريا
    // ========================================

    "الصف الثاني بكالوريا": {

        subject: "الفيزياء",

        units: [

            {

                title:
                    "المحتوى الرسمي قيد الإضافة",

                lessons: [

                    {

                        title:
                            "سيتم إضافة المنهج الرسمي",

                        description:
                            "سيتم إضافة محتوى الصف الثاني بكالوريا فور توفر واعتماد البيانات الرسمية للمنهج."

                    }

                ]

            }

        ]

    }

};


// ========================================
// عند تغيير الصف
// ========================================

gradeSelect.addEventListener(
    "change",
    function () {

        const grade =
            this.value;


        // إعادة الوحدات

        unitSelect.innerHTML = `

            <option value="">
                اختر الوحدة
            </option>

        `;


        // إعادة الدروس

        lessonSelect.innerHTML = `

            <option value="">
                اختر الدرس
            </option>

        `;


        lessonTitle.textContent =
            "اختر درسًا للبدء";


        lessonDescription.textContent =
            "اختر الوحدة والدرس لعرض معلوماته.";


        if (!grade) {
            return;
        }


        const data =
            curriculum[grade];


        if (!data) {
            return;
        }


        data.units.forEach(
            function (unit, index) {

                const option =
                    document.createElement("option");

                option.value =
                    index;

                option.textContent =
                    unit.title;

                unitSelect.appendChild(
                    option
                );

            }
        );

    }
);


// ========================================
// عند تغيير الوحدة
// ========================================

unitSelect.addEventListener(
    "change",
    function () {

        const grade =
            gradeSelect.value;

        const unitIndex =
            this.value;


        lessonSelect.innerHTML = `

            <option value="">
                اختر الدرس
            </option>

        `;


        lessonTitle.textContent =
            "اختر درسًا للبدء";


        lessonDescription.textContent =
            "اختر الدرس لعرض معلوماته.";


        if (
            !grade ||
            unitIndex === ""
        ) {

            return;

        }


        const data =
            curriculum[grade];


        if (!data) {
            return;
        }


        const unit =
            data.units[
                Number(unitIndex)
            ];


        if (!unit) {
            return;
        }


        unit.lessons.forEach(
            function (lesson, index) {

                const option =
                    document.createElement("option");

                option.value =
                    index;

                option.textContent =
                    lesson.title;

                lessonSelect.appendChild(
                    option
                );

            }
        );

    }
);


// ========================================
// عند تغيير الدرس
// ========================================

lessonSelect.addEventListener(
    "change",
    function () {

        const grade =
            gradeSelect.value;

        const unitIndex =
            unitSelect.value;

        const lessonIndex =
            this.value;


        if (
            !grade ||
            unitIndex === "" ||
            lessonIndex === ""
        ) {

            lessonTitle.textContent =
                "اختر درسًا للبدء";

            lessonDescription.textContent =
                "اختر الدرس لعرض معلوماته.";

            return;

        }


        const data =
            curriculum[grade];


        if (!data) {
            return;
        }


        const unit =
            data.units[
                Number(unitIndex)
            ];


        if (!unit) {
            return;
        }


        const lesson =
            unit.lessons[
                Number(lessonIndex)
            ];


        if (!lesson) {
            return;
        }


        lessonTitle.textContent =
            lesson.title;


        lessonDescription.textContent =
            lesson.description;


        messageInput.focus();

    }
);


// ========================================
// إضافة رسالة
// ========================================

function addMessage(
    text,
    type
) {

    const message =
        document.createElement("div");


    message.className =
        `message ${type}`;


    const avatar =
        type === "user"
            ? "👤"
            : "⚛️";


    const name =
        type === "user"
            ? "أنت"
            : "Physics AI";


    const avatarElement =
        document.createElement("div");


    avatarElement.className =
        "avatar";


    avatarElement.textContent =
        avatar;


    const bubble =
        document.createElement("div");


    bubble.className =
        "bubble";


    const strong =
        document.createElement("strong");


    strong.textContent =
        name;


    const paragraph =
        document.createElement("p");


    paragraph.textContent =
        text;


    bubble.appendChild(
        strong
    );


    bubble.appendChild(
        paragraph
    );


    message.appendChild(
        avatarElement
    );


    message.appendChild(
        bubble
    );


    chat.appendChild(
        message
    );


    chat.scrollTop =
        chat.scrollHeight;

}


// ========================================
// إرسال السؤال
// ========================================

async function sendMessage() {

    const text =
        messageInput.value.trim();


    if (!text) {
        return;
    }


    // ========================================
    // بيانات المنهج
    // ========================================

    const grade =
        gradeSelect.value ||
        "غير محدد";


    const subject =
        subjectSelect.value ||
        "الفيزياء";


    let unit =
        "غير محددة";


    let lesson =
        "غير محدد";


    if (
        grade &&
        unitSelect.value !== ""
    ) {

        const data =
            curriculum[grade];


        if (data) {

            const selectedUnit =
                data.units[
                    Number(
                        unitSelect.value
                    )
                ];


            if (selectedUnit) {

                unit =
                    selectedUnit.title;


                if (
                    lessonSelect.value !== ""
                ) {

                    const selectedLesson =
                        selectedUnit.lessons[
                            Number(
                                lessonSelect.value
                            )
                        ];


                    if (selectedLesson) {

                        lesson =
                            selectedLesson.title;

                    }

                }

            }

        }

    }


    // ========================================
    // عرض رسالة الطالب
    // ========================================

    addMessage(
        text,
        "user"
    );


    messageInput.value =
        "";


    // ========================================
    // تعطيل الزر
    // ========================================

    sendButton.disabled =
        true;


    sendButton.textContent =
        "جاري التفكير...";


    try {


        const response =
            await fetch(
                "/api/chat",
                {

                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify({

                            message:
                                text,

                            history:
                                conversationHistory,

                            grade:
                                grade,

                            subject:
                                subject,

                            unit:
                                unit,

                            lesson:
                                lesson

                        })

                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.error ||
                "حدث خطأ."
            );

        }


        // ========================================
        // عرض إجابة الذكاء الاصطناعي
        // ========================================

        addMessage(
            data.answer,
            "bot"
        );


        // ========================================
        // حفظ المحادثة
        // ========================================

        conversationHistory.push({

            role:
                "user",

            content:
                text

        });


        conversationHistory.push({

            role:
                "assistant",

            content:
                data.answer

        });


        // آخر 20 رسالة

        if (
            conversationHistory.length > 20
        ) {

            conversationHistory =
                conversationHistory.slice(
                    -20
                );

        }


    } catch (error) {

        console.error(
            "CHAT ERROR:",
            error
        );


        addMessage(
            "تعذر الاتصال بالمدرس الذكي حاليًا.",
            "bot"
        );

    } finally {

        sendButton.disabled =
            false;


        sendButton.textContent =
            "إرسال";


        messageInput.focus();

    }

}


// ========================================
// زر الإرسال
// ========================================

sendButton.addEventListener(
    "click",
    sendMessage
);


// ========================================
// Enter
// ========================================

messageInput.addEventListener(
    "keydown",
    function (event) {

        if (
            event.key === "Enter" &&
            !event.shiftKey
        ) {

            event.preventDefault();

            sendMessage();

        }

    }
);