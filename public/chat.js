"use strict";

document.addEventListener("DOMContentLoaded", () => {

    /* =========================================================
       ELEMENTS
    ========================================================= */

    const messageInput =
        document.getElementById("messageInput");

    const sendButton =
        document.getElementById("sendButton");

    const chat =
        document.getElementById("chat");

    const sidebar =
        document.getElementById("sidebar");

    const sidebarButton =
        document.getElementById("sidebarButton");

    const themeButton =
        document.getElementById("themeButton");

    const newChatButton =
        document.getElementById("newChatButton");

    const conversationList =
        document.getElementById("conversationList");

    const logoutButton =
        document.getElementById("logoutButton");

    const userName =
        document.getElementById("userName");

    const gradeSelect =
        document.getElementById("grade");

    const subjectSelect =
        document.getElementById("subject");

    const unitSelect =
        document.getElementById("unit");

    const lessonSelect =
        document.getElementById("lesson");

    const uploadButton =
        document.getElementById("uploadButton");

    const cameraButton =
        document.getElementById("cameraButton");

    const voiceButton =
        document.getElementById("voiceButton");

    const imageInput =
        document.getElementById("imageInput");

    const cameraInput =
        document.getElementById("cameraInput");

    const imagePreview =
        document.getElementById("imagePreview");

    const previewImage =
        document.getElementById("previewImage");

    const removeImageButton =
        document.getElementById("removeImageButton");

    const voiceStatus =
        document.getElementById("voiceStatus");

    const cameraModal =
        document.getElementById("cameraModal");

    const cameraVideo =
        document.getElementById("cameraVideo");

    const cameraCanvas =
        document.getElementById("cameraCanvas");

    const closeCameraButton =
        document.getElementById("closeCameraButton");

    const takePhotoButton =
        document.getElementById("takePhotoButton");

    const cameraError =
        document.getElementById("cameraError");

    const lessonName =
        document.getElementById("lessonName");

    const lessonDescription =
        document.getElementById("lessonDescription");


    /* =========================================================
       REQUIRED ELEMENTS
    ========================================================= */

    if (
        !messageInput ||
        !sendButton ||
        !chat
    ) {
        console.error(
            "Physics AI: العناصر الأساسية للشات غير موجودة."
        );

        return;
    }


    /* =========================================================
       STATE
    ========================================================= */

    let currentUser = null;

    let currentConversationId = null;

    let conversationHistory = [];

    let selectedImage = null;

    let cameraStream = null;

    let mediaRecorder = null;

    let recordingStream = null;

    let recordedChunks = [];

    let isRecording = false;

    let isSending = false;


    /* =========================================================
       CURRICULUM
    ========================================================= */

    const curriculum = {

        "الصف الثالث الثانوي العام": {

            units: [

                {
                    title:
                        "الوحدة الأولى: الكهربية التيارية والكهرومغناطيسية",

                    lessons: [
                        "التيار الكهربي وشدة التيار",
                        "فرق الجهد والقوة الدافعة الكهربية",
                        "المقاومة الكهربية",
                        "المقاومة النوعية والتوصيلية",
                        "توصيل المقاومات على التوالي",
                        "توصيل المقاومات على التوازي",
                        "قانون أوم",
                        "قانون أوم للدائرة المغلقة",
                        "قانون كيرتشوف الأول",
                        "قانون كيرتشوف الثاني",
                        "التأثير المغناطيسي للتيار الكهربي",
                        "الحث الكهرومغناطيسي",
                        "دوائر التيار المتردد"
                    ]
                },

                {
                    title:
                        "الوحدة الثانية: مقدمة في الفيزياء الحديثة",

                    lessons: [
                        "ازدواجية الموجة والجسيم",
                        "الأطياف الذرية",
                        "الليزر",
                        "الإلكترونيات الحديثة"
                    ]
                }
            ]
        },

        "الصف الثاني بكالوريا": {

            units: [

                {
                    title:
                        "المحتوى الرسمي قيد الإضافة",

                    lessons: [
                        "سيتم إضافة المنهج الرسمي"
                    ]
                }
            ]
        }
    };


    /* =========================================================
       THEME
    ========================================================= */

    function getTheme() {

        return (
            localStorage.getItem(
                "physicsai-theme"
            ) || "dark"
        );
    }


    function applyTheme(theme) {

        const isLight =
            theme === "light";

        document.body.classList.toggle(
            "light",
            isLight
        );

        if (themeButton) {

            themeButton.textContent =
                isLight
                    ? "☾"
                    : "☀";

            themeButton.title =
                isLight
                    ? "الوضع الليلي"
                    : "الوضع النهاري";
        }

        const metaTheme =
            document.querySelector(
                'meta[name="theme-color"]'
            );

        if (metaTheme) {

            metaTheme.setAttribute(
                "content",

                isLight
                    ? "#f7f8fb"
                    : "#0b0e13"
            );
        }
    }


    applyTheme(
        getTheme()
    );


    themeButton?.addEventListener(
        "click",
        () => {

            const current =
                getTheme();

            const next =
                current === "light"
                    ? "dark"
                    : "light";

            localStorage.setItem(
                "physicsai-theme",
                next
            );

            applyTheme(
                next
            );
        }
    );


    /* =========================================================
       SIDEBAR
    ========================================================= */

    function isMobile() {

        return (
            window.innerWidth <= 900
        );
    }


    function closeMobileSidebar() {

        sidebar?.classList.remove(
            "mobile-open"
        );

        document
            .getElementById("mobileOverlay")
            ?.classList.remove("show");
    }


    function openMobileSidebar() {

        sidebar?.classList.add(
            "mobile-open"
        );

        document
            .getElementById("mobileOverlay")
            ?.classList.add("show");
    }


    sidebarButton?.addEventListener(
        "click",
        () => {

            if (!sidebar) {
                return;
            }

            if (isMobile()) {

                const opened =
                    sidebar.classList.toggle(
                        "mobile-open"
                    );

                document
                    .getElementById(
                        "mobileOverlay"
                    )
                    ?.classList.toggle(
                        "show",
                        opened
                    );

            } else {

                sidebar.classList.toggle(
                    "collapsed"
                );
            }
        }
    );


    document
        .getElementById("mobileOverlay")
        ?.addEventListener(
            "click",
            closeMobileSidebar
        );


    window.addEventListener(
        "resize",
        () => {

            if (!isMobile()) {

                sidebar?.classList.remove(
                    "mobile-open"
                );

                document
                    .getElementById(
                        "mobileOverlay"
                    )
                    ?.classList.remove(
                        "show"
                    );
            }
        }
    );


    /* =========================================================
       TEXTAREA
    ========================================================= */

    function resizeInput() {

        messageInput.style.height =
            "auto";

        messageInput.style.height =
            Math.min(
                messageInput.scrollHeight,
                160
            ) + "px";
    }


    messageInput.addEventListener(
        "input",
        resizeInput
    );


    messageInput.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();

                sendMessage();
            }
        }
    );


    /* =========================================================
       SEND BUTTON
       الإصلاح الأساسي
    ========================================================= */

    sendButton.addEventListener(
        "click",
        () => {

            sendMessage();
        }
    );


    /* =========================================================
       CURRENT USER
    ========================================================= */

    async function loadUser() {

        const response =
            await fetch(
                "/api/auth/me",
                {
                    credentials:
                        "include"
                }
            );

        let data;

        try {

            data =
                await response.json();

        } catch {

            throw new Error(
                "تعذر قراءة بيانات الحساب."
            );
        }

        if (!response.ok) {

            throw new Error(
                data.error ||
                "تعذر التحقق من الحساب."
            );
        }

        if (!data.loggedIn) {

            window.location.href =
                "/login.html";

            return false;
        }

        currentUser =
            data.user;

        if (userName) {

            userName.textContent =
                currentUser.name ||
                "";
        }

        return true;
    }


    /* =========================================================
       CONVERSATIONS
    ========================================================= */

    async function loadConversations() {

        if (!conversationList) {
            return;
        }

        try {

            const response =
                await fetch(
                    "/api/conversations",
                    {
                        credentials:
                            "include"
                    }
                );

            const data =
                await response.json();

            if (!response.ok) {

                throw new Error(
                    data.error ||
                    "تعذر تحميل المحادثات."
                );
            }

            conversationList.innerHTML =
                "";

            const conversations =
                Array.isArray(
                    data.conversations
                )
                    ? data.conversations
                    : [];

            conversations.forEach(
                conversation => {

                    const button =
                        document.createElement(
                            "button"
                        );

                    button.type =
                        "button";

                    button.className =
                        "conversation-item";

                    button.dataset.id =
                        conversation.id;

                    const title =
                        document.createElement(
                            "div"
                        );

                    title.className =
                        "conversation-item-title";

                    title.textContent =
                        conversation.title ||
                        "محادثة جديدة";

                    const date =
                        document.createElement(
                            "div"
                        );

                    date.className =
                        "conversation-item-date";

                    date.textContent =
                        formatDate(
                            conversation.updated_at
                        );

                    button.appendChild(
                        title
                    );

                    button.appendChild(
                        date
                    );

                    button.addEventListener(
                        "click",
                        async () => {

                            await loadConversation(
                                Number(
                                    conversation.id
                                )
                            );

                            closeMobileSidebar();
                        }
                    );

                    conversationList.appendChild(
                        button
                    );
                }
            );

            highlightConversation();

        } catch (error) {

            console.error(
                "CONVERSATIONS ERROR:",
                error
            );
        }
    }


    function formatDate(value) {

        if (!value) {
            return "";
        }

        const date =
            new Date(value);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return "";
        }

        return date.toLocaleDateString(
            "ar-EG",
            {
                day: "numeric",
                month: "short"
            }
        );
    }


    function highlightConversation() {

        document
            .querySelectorAll(
                ".conversation-item"
            )
            .forEach(
                item => {

                    item.classList.toggle(
                        "active",

                        Number(
                            item.dataset.id
                        ) ===
                        Number(
                            currentConversationId
                        )
                    );
                }
            );
    }


    /* =========================================================
       CREATE CONVERSATION
    ========================================================= */

    async function createConversation(
        title
    ) {

        const response =
            await fetch(
                "/api/conversations",
                {
                    method:
                        "POST",

                    credentials:
                        "include",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            title:
                                title ||
                                "محادثة جديدة"
                        })
                }
            );

        let data;

        try {

            data =
                await response.json();

        } catch {

            throw new Error(
                "السيرفر لم يرجع استجابة صحيحة."
            );
        }

        if (!response.ok) {

            throw new Error(
                data.error ||
                "تعذر إنشاء المحادثة."
            );
        }

        currentConversationId =
            Number(
                data.conversation.id
            );

        await loadConversations();
    }


    /* =========================================================
       LOAD CONVERSATION
    ========================================================= */

    async function loadConversation(
        id
    ) {

        try {

            const response =
                await fetch(
                    `/api/conversations/${id}`,
                    {
                        credentials:
                            "include"
                    }
                );

            const data =
                await response.json();

            if (!response.ok) {

                throw new Error(
                    data.error ||
                    "تعذر تحميل المحادثة."
                );
            }

            currentConversationId =
                Number(
                    data.conversation.id
                );

            conversationHistory =
                [];

            chat.innerHTML =
                "";

            const titleElement =
                document.getElementById(
                    "chatTitle"
                );

            if (titleElement) {

                titleElement.textContent =
                    data.conversation.title ||
                    "Physics AI";
            }

            const messages =
                Array.isArray(
                    data.messages
                )
                    ? data.messages
                    : [];

            messages.forEach(
                message => {

                    conversationHistory.push({
                        role:
                            message.role,

                        content:
                            message.content
                    });

                    addMessage(
                        message.content,

                        message.role ===
                            "assistant"
                            ? "bot"
                            : "user",

                        message.image
                    );
                }
            );

            highlightConversation();

            scrollBottom();

        } catch (error) {

            console.error(
                "LOAD CONVERSATION ERROR:",
                error
            );

            addMessage(
                error.message ||
                "تعذر تحميل المحادثة.",
                "bot"
            );
        }
    }


    /* =========================================================
       NEW CHAT
    ========================================================= */

    newChatButton?.addEventListener(
        "click",
        () => {

            currentConversationId =
                null;

            conversationHistory =
                [];

            clearImage();

            hideTyping();

            chat.innerHTML =
                `
                <div class="welcome">

                    <div class="welcome-icon">
                        ⚛️
                    </div>

                    <h1>
                        أهلاً بيك في Physics AI 👋
                    </h1>

                    <p>
                        اكتب سؤالك أو ارفع صورة
                        المسألة وأنا هساعدك.
                    </p>

                </div>
                `;

            const title =
                document.getElementById(
                    "chatTitle"
                );

            if (title) {

                title.textContent =
                    "Physics AI";
            }

            messageInput.value =
                "";

            resizeInput();

            closeMobileSidebar();

            messageInput.focus();
        }
    );


    /* =========================================================
       ADD MESSAGE
    ========================================================= */

    function addMessage(
        text,
        type,
        image = null
    ) {

        const wrapper =
            document.createElement(
                "div"
            );

        wrapper.className =
            `message ${type}`;


        const avatar =
            document.createElement(
                "div"
            );

        avatar.className =
            "avatar";

        avatar.textContent =
            type === "user"
                ? "👤"
                : "⚛️";


        const bubble =
            document.createElement(
                "div"
            );

        bubble.className =
            "bubble";


        const strong =
            document.createElement(
                "strong"
            );

        strong.textContent =
            type === "user"
                ? (
                    currentUser?.name ||
                    "أنت"
                )
                : "Physics AI";


        const paragraph =
            document.createElement(
                "p"
            );

        paragraph.textContent =
            String(
                text || ""
            );


        bubble.appendChild(
            strong
        );

        bubble.appendChild(
            paragraph
        );


        if (
            image &&
            typeof image === "string" &&
            image.startsWith(
                "data:image/"
            )
        ) {

            const img =
                document.createElement(
                    "img"
                );

            img.src =
                image;

            img.alt =
                "الصورة المرفقة";

            img.loading =
                "lazy";

            bubble.appendChild(
                img
            );
        }


        wrapper.appendChild(
            avatar
        );

        wrapper.appendChild(
            bubble
        );

        chat.appendChild(
            wrapper
        );

        scrollBottom();
    }


    /* =========================================================
       TYPING INDICATOR
    ========================================================= */

    function showTyping() {

        hideTyping();

        const wrapper =
            document.createElement(
                "div"
            );

        wrapper.id =
            "physicsTyping";

        wrapper.className =
            "message bot";


        const avatar =
            document.createElement(
                "div"
            );

        avatar.className =
            "avatar";

        avatar.textContent =
            "⚛️";


        const bubble =
            document.createElement(
                "div"
            );

        bubble.className =
            "bubble";


        const strong =
            document.createElement(
                "strong"
            );

        strong.textContent =
            "Physics AI";


        const paragraph =
            document.createElement(
                "p"
            );

        paragraph.textContent =
            "جاري التفكير...";


        bubble.appendChild(
            strong
        );

        bubble.appendChild(
            paragraph
        );


        wrapper.appendChild(
            avatar
        );

        wrapper.appendChild(
            bubble
        );

        chat.appendChild(
            wrapper
        );

        scrollBottom();
    }


    function hideTyping() {

        document
            .getElementById(
                "physicsTyping"
            )
            ?.remove();
    }


    function scrollBottom() {

        requestAnimationFrame(
            () => {

                chat.scrollTop =
                    chat.scrollHeight;
            }
        );
    }


    /* =========================================================
       SAVE MESSAGE
    ========================================================= */

    async function saveMessage(
        role,
        content,
        image = null
    ) {

        if (
            !currentConversationId ||
            !content
        ) {
            return;
        }

        try {

            const response =
                await fetch(
                    `/api/conversations/${currentConversationId}/messages`,
                    {
                        method:
                            "POST",

                        credentials:
                            "include",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify({
                                role,
                                content,
                                image
                            })
                    }
                );

            if (!response.ok) {

                const data =
                    await response
                        .json()
                        .catch(
                            () => ({})
                        );

                console.error(
                    "SAVE MESSAGE:",
                    data
                );
            }

        } catch (error) {

            console.error(
                "SAVE MESSAGE ERROR:",
                error
            );
        }
    }


    /* =========================================================
       SEND MESSAGE
    ========================================================= */

    async function sendMessage() {

        if (isSending) {
            return;
        }

        const text =
            messageInput.value.trim();

        if (
            !text &&
            !selectedImage
        ) {
            return;
        }

        isSending =
            true;

        sendButton.disabled =
            true;

        const image =
            selectedImage;

        const userText =
            text ||
            "حل المسألة الموجودة في الصورة.";

        try {

            /* إنشاء محادثة جديدة */

            if (
                !currentConversationId
            ) {

                await createConversation(
                    userText.slice(
                        0,
                        50
                    )
                );
            }


            /* عرض رسالة المستخدم */

            addMessage(
                userText,
                "user",
                image
            );


            conversationHistory.push({
                role:
                    "user",

                content:
                    userText
            });


            /* الحفاظ على التاريخ */

            if (
                conversationHistory.length >
                20
            ) {

                conversationHistory =
                    conversationHistory.slice(
                        -20
                    );
            }


            /* تنظيف */

            messageInput.value =
                "";

            resizeInput();

            clearImage();

            showTyping();


            /* إرسال للسيرفر */

            const response =
                await fetch(
                    "/api/chat",
                    {
                        method:
                            "POST",

                        credentials:
                            "include",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify({

                                message:
                                    userText,

                                history:
                                    conversationHistory
                                        .slice(
                                            -20
                                        ),

                                grade:
                                    gradeSelect?.value ||
                                    "",

                                subject:
                                    subjectSelect?.value ||
                                    "الفيزياء",

                                unit:
                                    getSelectText(
                                        unitSelect
                                    ),

                                lesson:
                                    getSelectText(
                                        lessonSelect
                                    ),

                                mode:
                                    "دردشة عامة",

                                image:
                                    image
                            })
                    }
                );


            let data;

            try {

                data =
                    await response.json();

            } catch {

                throw new Error(
                    "السيرفر لم يرجع استجابة صحيحة."
                );
            }


            if (!response.ok) {

                if (
                    response.status ===
                    401
                ) {

                    window.location.href =
                        "/login.html";

                    return;
                }

                throw new Error(
                    data.error ||
                    "فشل إرسال السؤال."
                );
            }


            hideTyping();


            const answer =
                String(
                    data.answer ||
                    ""
                ).trim();


            addMessage(
                answer ||
                "لم تصل إجابة من Physics AI.",

                "bot"
            );


            conversationHistory.push({
                role:
                    "assistant",

                content:
                    answer
            });


            if (
                conversationHistory.length >
                20
            ) {

                conversationHistory =
                    conversationHistory.slice(
                        -20
                    );
            }


            /* حفظ السؤال */

            await saveMessage(
                "user",
                userText,
                image
            );


            /* حفظ الإجابة */

            await saveMessage(
                "assistant",
                answer
            );


            await loadConversations();

            highlightConversation();


        } catch (error) {

            console.error(
                "SEND MESSAGE ERROR:",
                error
            );

            hideTyping();

            addMessage(
                error.message ||
                "حصل خطأ أثناء إرسال السؤال.",
                "bot"
            );

        } finally {

            isSending =
                false;

            sendButton.disabled =
                false;

            messageInput.focus();
        }
    }


    function getSelectText(
        select
    ) {

        if (
            !select ||
            select.value === ""
        ) {
            return "";
        }

        return (
            select.options[
                select.selectedIndex
            ]?.text ||
            ""
        );
    }


    /* =========================================================
       IMAGE UPLOAD
    ========================================================= */

    uploadButton?.addEventListener(
        "click",
        () => {

            if (!imageInput) {
                return;
            }

            imageInput.value =
                "";

            imageInput.click();
        }
    );


    imageInput?.addEventListener(
        "change",
        () => {

            const file =
                imageInput.files?.[0];

            if (!file) {
                return;
            }

            prepareImage(
                file
            );
        }
    );


    function prepareImage(
        file
    ) {

        if (
            !file.type ||
            !file.type.startsWith(
                "image/"
            )
        ) {

            alert(
                "من فضلك اختر صورة."
            );

            return;
        }


        if (
            file.size >
            10 * 1024 * 1024
        ) {

            alert(
                "حجم الصورة أكبر من 10MB."
            );

            return;
        }


        const reader =
            new FileReader();


        reader.onload =
            () => {

                const img =
                    new Image();


                img.onload =
                    () => {

                        const max =
                            1600;

                        let width =
                            img.width;

                        let height =
                            img.height;


                        const ratio =
                            Math.min(
                                max /
                                    width,

                                max /
                                    height,

                                1
                            );


                        width =
                            Math.round(
                                width *
                                ratio
                            );

                        height =
                            Math.round(
                                height *
                                ratio
                            );


                        const canvas =
                            document.createElement(
                                "canvas"
                            );


                        canvas.width =
                            width;

                        canvas.height =
                            height;


                        const ctx =
                            canvas.getContext(
                                "2d"
                            );


                        if (!ctx) {

                            alert(
                                "تعذر تجهيز الصورة."
                            );

                            return;
                        }


                        ctx.drawImage(
                            img,
                            0,
                            0,
                            width,
                            height
                        );


                        selectedImage =
                            canvas.toDataURL(
                                "image/jpeg",
                                0.80
                            );


                        showImagePreview();


                        messageInput.focus();
                    };


                img.onerror =
                    () => {

                        alert(
                            "تعذر قراءة الصورة."
                        );
                    };


                img.src =
                    String(
                        reader.result
                    );
            };


        reader.onerror =
            () => {

                alert(
                    "تعذر قراءة الصورة."
                );
            };


        reader.readAsDataURL(
            file
        );
    }


    function showImagePreview() {

        if (
            !imagePreview ||
            !previewImage ||
            !selectedImage
        ) {
            return;
        }

        previewImage.src =
            selectedImage;

        imagePreview.classList.remove(
            "hidden"
        );

        imagePreview.style.display =
            "";
    }


    function clearImage() {

        selectedImage =
            null;


        if (previewImage) {

            previewImage.removeAttribute(
                "src"
            );
        }


        if (imagePreview) {

            imagePreview.classList.add(
                "hidden"
            );

            imagePreview.style.display =
                "none";
        }


        if (imageInput) {

            imageInput.value =
                "";
        }


        if (cameraInput) {

            cameraInput.value =
                "";
        }
    }


    removeImageButton?.addEventListener(
        "click",
        clearImage
    );


    /* =========================================================
       CAMERA
    ========================================================= */

    cameraButton?.addEventListener(
        "click",
        async () => {

            if (isMobile()) {

                cameraInput?.click();

                return;
            }

            await openCamera();
        }
    );


    cameraInput?.addEventListener(
        "change",
        () => {

            const file =
                cameraInput.files?.[0];

            if (!file) {
                return;
            }

            prepareImage(
                file
            );
        }
    );


    async function openCamera() {

        if (!cameraModal) {
            return;
        }


        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {

            if (cameraError) {

                cameraError.textContent =
                    "الكاميرا غير مدعومة في هذا المتصفح.";
            }

            cameraModal.classList.remove(
                "hidden"
            );

            return;
        }


        try {

            cameraStream =
                await navigator.mediaDevices.getUserMedia(
                    {
                        video: {
                            facingMode: {
                                ideal:
                                    "environment"
                            }
                        },

                        audio:
                            false
                    }
                );


            if (cameraVideo) {

                cameraVideo.srcObject =
                    cameraStream;
            }


            if (cameraError) {

                cameraError.textContent =
                    "";
            }


            cameraModal.classList.remove(
                "hidden"
            );

        } catch (error) {

            console.error(
                "CAMERA ERROR:",
                error
            );


            if (cameraError) {

                cameraError.textContent =
                    "اسمح للمتصفح باستخدام الكاميرا ثم حاول مرة أخرى.";
            }


            cameraModal.classList.remove(
                "hidden"
            );
        }
    }


    function closeCamera() {

        cameraModal?.classList.add(
            "hidden"
        );


        if (cameraStream) {

            cameraStream
                .getTracks()
                .forEach(
                    track => {
                        track.stop();
                    }
                );

            cameraStream =
                null;
        }


        if (cameraVideo) {

            cameraVideo.srcObject =
                null;
        }
    }


    closeCameraButton?.addEventListener(
        "click",
        closeCamera
    );


    takePhotoButton?.addEventListener(
        "click",
        () => {

            if (
                !cameraVideo ||
                !cameraCanvas
            ) {
                return;
            }


            if (
                !cameraVideo.videoWidth
            ) {

                if (cameraError) {

                    cameraError.textContent =
                        "استنى لحظة لحد ما الكاميرا تشتغل.";
                }

                return;
            }


            const width =
                cameraVideo.videoWidth;

            const height =
                cameraVideo.videoHeight;

            const max =
                1600;


            const ratio =
                Math.min(
                    max /
                        width,

                    max /
                        height,

                    1
                );


            cameraCanvas.width =
                Math.round(
                    width *
                    ratio
                );

            cameraCanvas.height =
                Math.round(
                    height *
                    ratio
                );


            const ctx =
                cameraCanvas.getContext(
                    "2d"
                );


            if (!ctx) {

                return;
            }


            ctx.drawImage(
                cameraVideo,
                0,
                0,
                cameraCanvas.width,
                cameraCanvas.height
            );


            selectedImage =
                cameraCanvas.toDataURL(
                    "image/jpeg",
                    0.80
                );


            showImagePreview();

            closeCamera();

            messageInput.focus();
        }
    );


    /* =========================================================
       VOICE RECORDING
    ========================================================= */

    voiceButton?.addEventListener(
        "click",
        async () => {

            if (isRecording) {

                stopRecording();

                return;
            }

            await startRecording();
        }
    );


    async function startRecording() {

        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {

            setVoiceStatus(
                "الميكروفون غير مدعوم."
            );

            return;
        }


        if (
            typeof MediaRecorder ===
            "undefined"
        ) {

            setVoiceStatus(
                "تسجيل الصوت غير مدعوم في هذا المتصفح."
            );

            return;
        }


        try {

            recordingStream =
                await navigator.mediaDevices.getUserMedia(
                    {
                        audio:
                            true
                    }
                );


            recordedChunks =
                [];


            let mimeType =
                "";


            const possibleTypes = [
                "audio/webm;codecs=opus",
                "audio/webm",
                "audio/ogg;codecs=opus",
                "audio/ogg"
            ];


            for (
                const type
                of possibleTypes
            ) {

                if (
                    MediaRecorder.isTypeSupported(
                        type
                    )
                ) {

                    mimeType =
                        type;

                    break;
                }
            }


            const options =
                mimeType
                    ? { mimeType }
                    : undefined;


            mediaRecorder =
                new MediaRecorder(
                    recordingStream,
                    options
                );


            mediaRecorder.ondataavailable =
                event => {

                    if (
                        event.data &&
                        event.data.size >
                            0
                    ) {

                        recordedChunks.push(
                            event.data
                        );
                    }
                };


            mediaRecorder.onerror =
                event => {

                    console.error(
                        "MEDIA RECORDER ERROR:",
                        event
                    );
                };


            mediaRecorder.onstop =
                async () => {

                    recordingStream
                        ?.getTracks()
                        .forEach(
                            track => {
                                track.stop();
                            }
                        );

                    recordingStream =
                        null;

                    await transcribeAudio();
                };


            mediaRecorder.start(
                250
            );


            isRecording =
                true;


            if (voiceButton) {

                voiceButton.textContent =
                    "⏹️";
            }


            setVoiceStatus(
                "جاري التسجيل... اضغط مرة أخرى للإيقاف."
            );

        } catch (error) {

            console.error(
                "RECORDING ERROR:",
                error
            );


            setVoiceStatus(
                "تعذر فتح الميكروفون. اسمح للمتصفح باستخدامه."
            );
        }
    }


    function stopRecording() {

        if (
            mediaRecorder &&
            mediaRecorder.state !==
                "inactive"
        ) {

            mediaRecorder.stop();

        } else {

            recordingStream
                ?.getTracks()
                .forEach(
                    track => {
                        track.stop();
                    }
                );
        }


        isRecording =
            false;


        if (voiceButton) {

            voiceButton.textContent =
                "🎙️";
        }
    }


    async function transcribeAudio() {

        try {

            if (
                !recordedChunks.length
            ) {

                setVoiceStatus(
                    "لم يتم تسجيل صوت."
                );

                return;
            }


            setVoiceStatus(
                "جاري تحويل التسجيل إلى نص..."
            );


            const blob =
                new Blob(
                    recordedChunks,
                    {
                        type:
                            recordedChunks[0]
                                ?.type ||
                            "audio/webm"
                    }
                );


            if (!blob.size) {

                throw new Error(
                    "التسجيل فارغ."
                );
            }


            const formData =
                new FormData();


            formData.append(
                "audio",
                blob,
                "physics-question.webm"
            );


            const response =
                await fetch(
                    "/api/transcribe",
                    {
                        method:
                            "POST",

                        credentials:
                            "include",

                        body:
                            formData
                    }
                );


            const data =
                await response.json();


            if (!response.ok) {

                throw new Error(
                    data.error ||
                    "تعذر تحويل التسجيل."
                );
            }


            const text =
                String(
                    data.text ||
                    ""
                ).trim();


            if (text) {

                messageInput.value =
                    text;

                resizeInput();

                messageInput.focus();

                setVoiceStatus(
                    "تم تحويل التسجيل إلى نص."
                );

            } else {

                setVoiceStatus(
                    "لم أستطع استخراج كلام واضح من التسجيل."
                );
            }

        } catch (error) {

            console.error(
                "TRANSCRIBE ERROR:",
                error
            );


            setVoiceStatus(
                error.message ||
                "فشل تحويل التسجيل."
            );

        } finally {

            recordedChunks =
                [];

            mediaRecorder =
                null;


            setTimeout(
                () => {

                    setVoiceStatus(
                        ""
                    );

                },
                3000
            );
        }
    }


    function setVoiceStatus(
        text
    ) {

        if (voiceStatus) {

            voiceStatus.textContent =
                text || "";
        }
    }


    /* =========================================================
       CURRICULUM
    ========================================================= */

    function resetUnitsAndLessons() {

        if (unitSelect) {

            unitSelect.innerHTML =
                `
                <option value="">
                    اختر الوحدة
                </option>
                `;
        }


        if (lessonSelect) {

            lessonSelect.innerHTML =
                `
                <option value="">
                    اختر الدرس
                </option>
                `;
        }
    }


    gradeSelect?.addEventListener(
        "change",
        () => {

            resetUnitsAndLessons();


            const data =
                curriculum[
                    gradeSelect.value
                ];


            if (!data) {

                if (lessonName) {

                    lessonName.textContent =
                        "دردشة عامة";
                }


                if (lessonDescription) {

                    lessonDescription.textContent =
                        "اسأل Physics AI عن الفيزياء.";
                }

                return;
            }


            data.units.forEach(
                (
                    unit,
                    index
                ) => {

                    const option =
                        document.createElement(
                            "option"
                        );


                    option.value =
                        String(index);


                    option.textContent =
                        unit.title;


                    unitSelect?.appendChild(
                        option
                    );
                }
            );


            if (lessonName) {

                lessonName.textContent =
                    "اختر الدرس";
            }


            if (lessonDescription) {

                lessonDescription.textContent =
                    "حدد الوحدة والدرس لزيادة دقة السياق.";
            }
        }
    );


    unitSelect?.addEventListener(
        "change",
        () => {

            if (lessonSelect) {

                lessonSelect.innerHTML =
                    `
                    <option value="">
                        اختر الدرس
                    </option>
                    `;
            }


            const data =
                curriculum[
                    gradeSelect?.value
                ];


            if (
                !data ||
                !unitSelect ||
                unitSelect.value === ""
            ) {

                return;
            }


            const unit =
                data.units[
                    Number(
                        unitSelect.value
                    )
                ];


            if (!unit) {
                return;
            }


            unit.lessons.forEach(
                (
                    lesson,
                    index
                ) => {

                    const option =
                        document.createElement(
                            "option"
                        );


                    option.value =
                        String(index);


                    option.textContent =
                        lesson;


                    lessonSelect?.appendChild(
                        option
                    );
                }
            );


            if (lessonName) {

                lessonName.textContent =
                    unit.title;
            }


            if (lessonDescription) {

                lessonDescription.textContent =
                    "اختر الدرس لتحديد السياق الدراسي.";
            }
        }
    );


    lessonSelect?.addEventListener(
        "change",
        () => {

            if (
                lessonName &&
                lessonSelect &&
                lessonSelect.value !== ""
            ) {

                lessonName.textContent =
                    lessonSelect.options[
                        lessonSelect.selectedIndex
                    ]?.text ||
                    "الدرس";
            }


            if (lessonDescription) {

                lessonDescription.textContent =
                    "اسأل Physics AI عن أي سؤال في هذا الدرس.";
            }
        }
    );


    /* =========================================================
       LOGOUT
    ========================================================= */

    logoutButton?.addEventListener(
        "click",
        async () => {

            try {

                await fetch(
                    "/api/auth/logout",
                    {
                        method:
                            "POST",

                        credentials:
                            "include"
                    }
                );

            } catch (error) {

                console.error(
                    "LOGOUT ERROR:",
                    error
                );
            }


            window.location.href =
                "/login.html";
        }
    );


    /* =========================================================
       INIT
    ========================================================= */

    (async function init() {

        try {

            const loggedIn =
                await loadUser();


            if (!loggedIn) {
                return;
            }


            await loadConversations();


            resizeInput();


            messageInput.focus();

        } catch (error) {

            console.error(
                "INIT ERROR:",
                error
            );


            window.location.href =
                "/login.html";
        }

    })();

});
