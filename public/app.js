(() => {
    "use strict";

    /* =========================================================
       PHYSICS AI - FRONTEND
       الملف مسؤول عن:
       - الشات
       - تسجيل الدخول
       - المحادثات
       - الصور
       - الكاميرا
       - الصوت
       - الاتصال بالسيرفر
    ========================================================= */


    /* =========================================================
       DOM HELPERS
    ========================================================= */

    const $ = (id) =>
        document.getElementById(id);


    /* =========================================================
       DOM ELEMENTS
    ========================================================= */

    const messageInput =
        $("messageInput");

    const sendButton =
        $("sendButton");

    const chat =
        $("chat");


    const sidebar =
        $("sidebar");

    const newChatButton =
        $("newChatButton");

    const conversationList =
        $("conversationList");

    const userName =
        $("userName");

    const logoutButton =
        $("logoutButton");


    const chatMode =
        $("chatMode");

    const lessonName =
        $("lessonName");

    const lessonDescription =
        $("lessonDescription");


    /* =========================================================
       IMAGE ELEMENTS
    ========================================================= */

    const imagePreview =
        $("imagePreview");

    const previewImage =
        $("previewImage");

    const removeImageButton =
        $("removeImageButton");

    const uploadButton =
        $("uploadButton");

    const cameraButton =
        $("cameraButton");

    const imageInput =
        $("imageInput");

    const cameraInput =
        $("cameraInput");


    /* =========================================================
       VOICE ELEMENTS
    ========================================================= */

    const voiceButton =
        $("voiceButton");

    const voiceStatus =
        $("voiceStatus");


    /* =========================================================
       CAMERA ELEMENTS
    ========================================================= */

    const cameraModal =
        $("cameraModal");

    const closeCameraButton =
        $("closeCameraButton");

    const cameraVideo =
        $("cameraVideo");

    const cameraCanvas =
        $("cameraCanvas");

    const takePhotoButton =
        $("takePhotoButton");

    const cameraError =
        $("cameraError");


    /* =========================================================
       STATE
    ========================================================= */

    let conversationHistory = [];

    let activeConversationId =
        null;

    let pendingImage =
        null;

    let cameraStream =
        null;

    let mediaRecorder =
        null;

    let audioChunks =
        [];

    let isSending =
        false;


    /* =========================================================
       URL / SESSION CONTEXT
    ========================================================= */

    const params =
        new URLSearchParams(
            window.location.search
        );


    const sessionContext = {

        mode:
            params.get("mode") ||
            "general",

        grade:
            params.get("grade") ||
            "غير محدد",

        subject:
            params.get("subject") ||
            "الفيزياء",

        unit:
            params.get("unit") ||
            "غير محددة",

        lesson:
            params.get("lesson") ||
            "دردشة عامة",

        description:
            params.get("description") ||
            "مساعدك الذكي لفهم الفيزياء وحل المسائل."
    };


    /* =========================================================
       SESSION CONTEXT
    ========================================================= */

    function renderSessionContext() {

        if (chatMode) {

            if (
                sessionContext.mode ===
                "encyclopedia"
            ) {

                chatMode.textContent =
                    "موسوعة الفيزياء";

            } else if (
                sessionContext.mode ===
                "curriculum"
            ) {

                chatMode.textContent =
                    "جلسة المنهج";

            } else {

                chatMode.textContent =
                    "المساعد الذكي";
            }
        }


        if (lessonName) {

            lessonName.textContent =
                sessionContext.lesson ||
                "دردشة عامة";
        }


        if (lessonDescription) {

            lessonDescription.textContent =
                sessionContext.description;
        }
    }


    /* =========================================================
       TEXTAREA
    ========================================================= */

    function resizeTextarea() {

        if (!messageInput) {
            return;
        }


        messageInput.style.height =
            "auto";


        const height =
            Math.min(
                messageInput.scrollHeight,
                160
            );


        messageInput.style.height =
            `${height}px`;
    }


    /* =========================================================
       SAFE HTML
    ========================================================= */

    function escapeHtml(
        value
    ) {

        return String(
            value ?? ""
        )

            .replaceAll(
                "&",
                "&amp;"
            )

            .replaceAll(
                "<",
                "&lt;"
            )

            .replaceAll(
                ">",
                "&gt;"
            )

            .replaceAll(
                '"',
                "&quot;"
            )

            .replaceAll(
                "'",
                "&#039;"
            );
    }


    /* =========================================================
       MESSAGE RENDERING
    ========================================================= */

    function addMessage(
        text,
        type,
        image = null
    ) {

        if (!chat) {
            return;
        }


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
                ? "أنت"
                : "AI";


        const bubble =
            document.createElement(
                "div"
            );


        bubble.className =
            "bubble";


        const name =
            document.createElement(
                "strong"
            );


        name.textContent =
            type === "user"
                ? "أنت"
                : "Physics AI";


        bubble.appendChild(
            name
        );


        /* -----------------------------------------------------
           IMAGE
        ----------------------------------------------------- */

        if (image) {

            const imageElement =
                document.createElement(
                    "img"
                );


            imageElement.src =
                image;


            imageElement.alt =
                "الصورة المرفقة";


            imageElement.style.maxWidth =
                "280px";


            imageElement.style.width =
                "100%";


            imageElement.style.display =
                "block";


            imageElement.style.borderRadius =
                "12px";


            imageElement.style.marginTop =
                "10px";


            imageElement.style.marginBottom =
                "10px";


            bubble.appendChild(
                imageElement
            );
        }


        /* -----------------------------------------------------
           TEXT
        ----------------------------------------------------- */

        const paragraph =
            document.createElement(
                "p"
            );


        paragraph.innerHTML =
            escapeHtml(
                text
            ).replaceAll(
                "\n",
                "<br>"
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


        requestAnimationFrame(
            () => {

                chat.scrollTop =
                    chat.scrollHeight;
            }
        );
    }


    /* =========================================================
       WELCOME SCREEN
    ========================================================= */

    function showWelcome() {

        if (!chat) {
            return;
        }


        chat.innerHTML = `

            <div class="welcome">

                <div class="welcome-topline"></div>

                <div class="welcome-number">
                    PHYSICS AI / START
                </div>

                <h2>
                    خلينا نفهم
                    <span>
                        الفيزياء.
                    </span>
                </h2>

                <p class="welcome-description">
                    اسأل عن أي فكرة،
                    حل مسألة،
                    ابعت صورة،
                    أو سجل صوتك.
                    المدرس الذكي هيمشي معاك خطوة بخطوة.
                </p>

                <div class="quick-prompts">

                    <button
                        class="quick-card"
                        type="button"
                        data-prompt="اشرح لي قانون نيوتن الثاني ببساطة"
                    >
                        <span class="quick-card-number">
                            01
                        </span>

                        <strong>
                            اشرحلي مفهوم
                        </strong>

                        <span>
                            شرح بسيط من غير تعقيد
                        </span>
                    </button>


                    <button
                        class="quick-card"
                        type="button"
                        data-prompt="حل المسألة دي خطوة بخطوة"
                    >
                        <span class="quick-card-number">
                            02
                        </span>

                        <strong>
                            حل مسألة
                        </strong>

                        <span>
                            المعطيات ثم القانون ثم الحل
                        </span>
                    </button>


                    <button
                        class="quick-card"
                        type="button"
                        data-prompt="راجعلي أهم قوانين الدرس"
                    >
                        <span class="quick-card-number">
                            03
                        </span>

                        <strong>
                            مراجعة سريعة
                        </strong>

                        <span>
                            أهم القوانين والأفكار
                        </span>
                    </button>


                    <button
                        class="quick-card"
                        type="button"
                        data-prompt="اختبرني في الفيزياء"
                    >
                        <span class="quick-card-number">
                            04
                        </span>

                        <strong>
                            اختبرني
                        </strong>

                        <span>
                            سؤال وراء سؤال
                        </span>
                    </button>

                </div>

            </div>
        `;


        /* -----------------------------------------------------
           QUICK PROMPTS
        ----------------------------------------------------- */

        chat
            .querySelectorAll(
                "[data-prompt]"
            )
            .forEach(
                button => {

                    button.addEventListener(
                        "click",
                        () => {

                            if (
                                !messageInput
                            ) {
                                return;
                            }


                            messageInput.value =
                                button.dataset.prompt ||
                                "";


                            resizeTextarea();


                            messageInput.focus();
                        }
                    );
                }
            );
    }


    /* =========================================================
       API RESPONSE PARSER
    ========================================================= */

    async function parseResponse(
        response
    ) {

        const contentType =
            response.headers.get(
                "content-type"
            ) || "";


        if (
            contentType.includes(
                "application/json"
            )
        ) {

            try {

                return await response.json();

            } catch {

                return {
                    error:
                        "تعذر قراءة استجابة السيرفر."
                };
            }
        }


        const text =
            await response.text();


        return {

            error:
                text ||
                "حدث خطأ غير معروف."
        };
    }


    /* =========================================================
       API HELPER
    ========================================================= */

    async function api(
        url,
        options = {}
    ) {

        const response =
            await fetch(
                url,
                {
                    credentials:
                        "same-origin",

                    ...options
                }
            );


        const data =
            await parseResponse(
                response
            );


        if (
            !response.ok
        ) {

            const error =
                new Error(
                    data?.error ||
                    "حدث خطأ."
                );


            error.status =
                response.status;


            throw error;
        }


        return data;
    }


    /* =========================================================
       AUTH
    ========================================================= */

    async function loadCurrentUser() {

        try {

            const data =
                await api(
                    "/api/auth/me"
                );


            if (
                !data.loggedIn
            ) {

                window.location.href =
                    "/login.html";


                return false;
            }


            if (userName) {

                userName.textContent =
                    data.user?.name ||
                    "الطالب";
            }


            return true;

        } catch (
            error
        ) {

            console.error(
                "AUTH ERROR:",
                error
            );


            window.location.href =
                "/login.html";


            return false;
        }
    }


    /* =========================================================
       LOGOUT
    ========================================================= */

    logoutButton?.addEventListener(
        "click",
        async () => {

            try {

                await api(
                    "/api/auth/logout",
                    {
                        method:
                            "POST"
                    }
                );

            } catch (
                error
            ) {

                console.error(
                    "LOGOUT ERROR:",
                    error
                );

            } finally {

                window.location.href =
                    "/login.html";
            }
        }
    );


    /* =========================================================
       CONVERSATIONS
    ========================================================= */

    async function loadConversations() {

        if (
            !conversationList
        ) {

            return;
        }


        try {

            const data =
                await api(
                    "/api/conversations"
                );


            conversationList.innerHTML =
                "";


            const conversations =
                Array.isArray(
                    data.conversations
                )
                    ? data.conversations
                    : [];


            if (
                conversations.length === 0
            ) {

                const empty =
                    document.createElement(
                        "div"
                    );


                empty.textContent =
                    "مفيش محادثات لسه.";


                empty.style.padding =
                    "15px";


                empty.style.textAlign =
                    "center";


                empty.style.opacity =
                    "0.55";


                empty.style.fontSize =
                    "11px";


                conversationList.appendChild(
                    empty
                );


                return;
            }


            conversations.forEach(
                conversation => {

                    const item =
                        document.createElement(
                            "div"
                        );


                    item.className =
                        "conversation-item";


                    if (
                        Number(
                            conversation.id
                        ) ===
                        Number(
                            activeConversationId
                        )
                    ) {

                        item.classList.add(
                            "active"
                        );
                    }


                    /* -------------------------------------------------
                       TITLE
                    ------------------------------------------------- */

                    const title =
                        document.createElement(
                            "div"
                        );


                    title.className =
                        "conversation-title";


                    title.textContent =
                        conversation.title ||
                        "محادثة جديدة";


                    /* -------------------------------------------------
                       DELETE
                    ------------------------------------------------- */

                    const deleteButton =
                        document.createElement(
                            "button"
                        );


                    deleteButton.className =
                        "delete-conversation";


                    deleteButton.type =
                        "button";


                    deleteButton.textContent =
                        "×";


                    deleteButton.title =
                        "حذف المحادثة";


                    /* -------------------------------------------------
                       OPEN
                    ------------------------------------------------- */

                    item.addEventListener(
                        "click",
                        async event => {

                            if (
                                event.target ===
                                deleteButton
                            ) {

                                return;
                            }


                            await loadConversation(
                                Number(
                                    conversation.id
                                )
                            );
                        }
                    );


                    /* -------------------------------------------------
                       DELETE ACTION
                    ------------------------------------------------- */

                    deleteButton.addEventListener(
                        "click",
                        async event => {

                            event.stopPropagation();


                            const ok =
                                window.confirm(
                                    "حذف هذه المحادثة؟"
                                );


                            if (
                                !ok
                            ) {

                                return;
                            }


                            try {

                                await api(
                                    `/api/conversations/${conversation.id}`,
                                    {
                                        method:
                                            "DELETE"
                                    }
                                );


                                if (
                                    Number(
                                        activeConversationId
                                    ) ===
                                    Number(
                                        conversation.id
                                    )
                                ) {

                                    activeConversationId =
                                        null;


                                    conversationHistory =
                                        [];


                                    showWelcome();
                                }


                                await loadConversations();

                            } catch (
                                error
                            ) {

                                console.error(
                                    "DELETE CONVERSATION ERROR:",
                                    error
                                );


                                alert(
                                    error.message ||
                                    "تعذر حذف المحادثة."
                                );
                            }
                        }
                    );


                    item.appendChild(
                        title
                    );


                    item.appendChild(
                        deleteButton
                    );


                    conversationList.appendChild(
                        item
                    );
                }
            );

        } catch (
            error
        ) {

            console.error(
                "CONVERSATIONS ERROR:",
                error
            );
        }
    }


    /* =========================================================
       CREATE CONVERSATION
    ========================================================= */

    async function ensureConversation(
        title =
            "محادثة جديدة"
    ) {

        if (
            activeConversationId
        ) {

            return activeConversationId;
        }


        const cleanTitle =
            String(
                title || "محادثة جديدة"
            )
                .trim()
                .slice(
                    0,
                    80
                ) ||
            "محادثة جديدة";


        const data =
            await api(
                "/api/conversations",
                {

                    method:
                        "POST",

                    headers: {

                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({

                            title:
                                cleanTitle
                        })
                }
            );


        activeConversationId =
            Number(
                data.conversation.id
            );


        await loadConversations();


        return activeConversationId;
    }


    /* =========================================================
       LOAD ONE CONVERSATION
    ========================================================= */

    async function loadConversation(
        id
    ) {

        try {

            const data =
                await api(
                    `/api/conversations/${id}`
                );


            activeConversationId =
                Number(id);


            conversationHistory =
                [];


            if (chat) {

                chat.innerHTML =
                    "";
            }


            const messages =
                Array.isArray(
                    data.messages
                )
                    ? data.messages
                    : [];


            messages.forEach(
                message => {

                    const type =
                        message.role ===
                        "assistant"

                            ? "bot"

                            : "user";


                    addMessage(
                        message.content,
                        type,
                        message.image ||
                        null
                    );


                    conversationHistory.push({

                        role:
                            message.role,

                        content:
                            message.content
                    });
                }
            );


            await loadConversations();

        } catch (
            error
        ) {

            console.error(
                "LOAD CONVERSATION ERROR:",
                error
            );


            addMessage(
                error.message ||
                "تعذر فتح المحادثة.",
                "bot"
            );
        }
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
            !activeConversationId ||
            !content
        ) {

            return;
        }


        try {

            await api(
                `/api/conversations/${activeConversationId}/messages`,
                {

                    method:
                        "POST",

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

        } catch (
            error
        ) {

            console.error(
                "SAVE MESSAGE ERROR:",
                error
            );
        }
    }


    /* =========================================================
       NEW CHAT
    ========================================================= */

    newChatButton?.addEventListener(
        "click",
        async () => {

            activeConversationId =
                null;


            conversationHistory =
                [];


            pendingImage =
                null;


            renderImagePreview(
                null
            );


            showWelcome();


            await loadConversations();


            if (
                messageInput
            ) {

                messageInput.value =
                    "";


                resizeTextarea();


                messageInput.focus();
            }
        }
    );


    /* =========================================================
       IMAGE PREVIEW
    ========================================================= */

    function renderImagePreview(
        dataUrl
    ) {

        if (
            !imagePreview
        ) {

            return;
        }


        if (
            !dataUrl
        ) {

            imagePreview.classList.add(
                "hidden"
            );


            imagePreview.style.display =
                "none";


            if (
                previewImage
            ) {

                previewImage.removeAttribute(
                    "src"
                );
            }


            return;
        }


        imagePreview.classList.remove(
            "hidden"
        );


        imagePreview.style.display =
            "flex";


        if (
            previewImage
        ) {

            previewImage.src =
                dataUrl;
        }
    }


    /* =========================================================
       FILE -> DATA URL
    ========================================================= */

    function readFileAsDataUrl(
        file
    ) {

        return new Promise(
            (
                resolve,
                reject
            ) => {

                const reader =
                    new FileReader();


                reader.onload =
                    () =>
                        resolve(
                            reader.result
                        );


                reader.onerror =
                    error =>
                        reject(
                            error
                        );


                reader.readAsDataURL(
                    file
                );
            }
        );
    }


    /* =========================================================
       SET IMAGE
    ========================================================= */

    async function setPendingImage(
        file
    ) {

        if (
            !file
        ) {

            return;
        }


        if (
            !file.type ||
            !file.type.startsWith(
                "image/"
            )
        ) {

            return;
        }


        try {

            const dataUrl =
                await readFileAsDataUrl(
                    file
                );


            if (
                typeof dataUrl !==
                "string"
            ) {

                throw new Error(
                    "تعذر قراءة الصورة."
                );
            }


            /* -------------------------------------------------
               حماية إضافية من الصور الضخمة
            ------------------------------------------------- */

            if (
                dataUrl.length >
                8_000_000
            ) {

                alert(
                    "الصورة كبيرة جدًا. استخدم صورة أصغر."
                );


                return;
            }


            pendingImage =
                dataUrl;


            renderImagePreview(
                dataUrl
            );

        } catch (
            error
        ) {

            console.error(
                "IMAGE ERROR:",
                error
            );


            alert(
                "تعذر قراءة الصورة."
            );
        }
    }


    /* =========================================================
       UPLOAD IMAGE
    ========================================================= */

    uploadButton?.addEventListener(
        "click",
        () => {

            imageInput?.click();
        }
    );


    imageInput?.addEventListener(
        "change",
        async () => {

            const file =
                imageInput.files?.[0];


            if (
                file
            ) {

                await setPendingImage(
                    file
                );
            }


            imageInput.value =
                "";
        }
    );


    cameraInput?.addEventListener(
        "change",
        async () => {

            const file =
                cameraInput.files?.[0];


            if (
                file
            ) {

                await setPendingImage(
                    file
                );
            }


            cameraInput.value =
                "";
        }
    );


    /* =========================================================
       REMOVE IMAGE
    ========================================================= */

    removeImageButton?.addEventListener(
        "click",
        () => {

            pendingImage =
                null;


            renderImagePreview(
                null
            );
        }
    );


    /* =========================================================
       CAMERA - ERROR
    ========================================================= */

    function showCameraError(
        message
    ) {

        if (
            !cameraError
        ) {

            return;
        }


        cameraError.textContent =
            message || "";


        cameraError.style.display =
            message
                ? "block"
                : "none";
    }


    /* =========================================================
       CAMERA - OPEN
    ========================================================= */

    async function openCamera() {

        if (
            !cameraModal
        ) {

            return;
        }


        showCameraError(
            ""
        );


        cameraModal.classList.remove(
            "hidden"
        );


        cameraModal.style.display =
            "grid";


        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {

            closeCamera();


            cameraInput?.click();


            return;
        }


        try {

            cameraStream =
                await navigator.mediaDevices.getUserMedia({

                    video: {

                        facingMode: {

                            ideal:
                                "environment"
                        }
                    },

                    audio:
                        false
                });


            if (
                cameraVideo
            ) {

                cameraVideo.srcObject =
                    cameraStream;


                await cameraVideo
                    .play()
                    .catch(
                        () => {}
                    );
            }

        } catch (
            error
        ) {

            console.error(
                "CAMERA ERROR:",
                error
            );


            showCameraError(
                "تعذر تشغيل الكاميرا. اسمح للمتصفح باستخدام الكاميرا أو استخدم رفع صورة."
            );
        }
    }


    /* =========================================================
       CAMERA - CLOSE
    ========================================================= */

    function closeCamera() {

        if (
            cameraStream
        ) {

            cameraStream
                .getTracks()
                .forEach(
                    track =>
                        track.stop()
                );


            cameraStream =
                null;
        }


        if (
            cameraVideo
        ) {

            cameraVideo.srcObject =
                null;
        }


        if (
            cameraModal
        ) {

            cameraModal.style.display =
                "none";


            cameraModal.classList.add(
                "hidden"
            );
        }
    }


    /* =========================================================
       CAMERA EVENTS
    ========================================================= */

    cameraButton?.addEventListener(
        "click",
        openCamera
    );


    closeCameraButton?.addEventListener(
        "click",
        closeCamera
    );


    cameraModal?.addEventListener(
        "click",
        event => {

            if (
                event.target ===
                cameraModal
            ) {

                closeCamera();
            }
        }
    );


    /* =========================================================
       TAKE PHOTO
    ========================================================= */

    takePhotoButton?.addEventListener(
        "click",
        async () => {

            if (
                !cameraVideo ||
                !cameraCanvas
            ) {

                return;
            }


            const width =
                cameraVideo.videoWidth ||
                1280;


            const height =
                cameraVideo.videoHeight ||
                720;


            cameraCanvas.width =
                width;


            cameraCanvas.height =
                height;


            const context =
                cameraCanvas.getContext(
                    "2d"
                );


            if (
                !context
            ) {

                showCameraError(
                    "تعذر تجهيز الصورة."
                );


                return;
            }


            context.drawImage(
                cameraVideo,
                0,
                0,
                width,
                height
            );


            cameraCanvas.toBlob(
                async blob => {

                    if (
                        !blob
                    ) {

                        showCameraError(
                            "تعذر التقاط الصورة."
                        );


                        return;
                    }


                    const file =
                        new File(
                            [
                                blob
                            ],
                            "physics-question.jpg",
                            {
                                type:
                                    "image/jpeg"
                            }
                        );


                    await setPendingImage(
                        file
                    );


                    closeCamera();
                },
                "image/jpeg",
                0.88
            );
        }
    );


    /* =========================================================
       VOICE STATUS
    ========================================================= */

    function setVoiceStatus(
        text
    ) {

        if (
            !voiceStatus
        ) {

            return;
        }


        voiceStatus.textContent =
            text || "";


        voiceStatus.style.display =
            text
                ? "block"
                : "none";
    }


    /* =========================================================
       START VOICE RECORDING
    ========================================================= */

    async function startVoiceRecording() {

        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {

            setVoiceStatus(
                "التسجيل الصوتي غير مدعوم في هذا المتصفح."
            );


            return;
        }


        if (
            !window.MediaRecorder
        ) {

            setVoiceStatus(
                "التسجيل الصوتي غير مدعوم في هذا المتصفح."
            );


            return;
        }


        try {

            const stream =
                await navigator.mediaDevices.getUserMedia({

                    audio:
                        true
                });


            audioChunks =
                [];


            let options = {};


            if (
                MediaRecorder.isTypeSupported(
                    "audio/webm"
                )
            ) {

                options.mimeType =
                    "audio/webm";

            } else if (
                MediaRecorder.isTypeSupported(
                    "audio/ogg"
                )
            ) {

                options.mimeType =
                    "audio/ogg";
            }


            mediaRecorder =
                new MediaRecorder(
                    stream,
                    options
                );


            mediaRecorder.addEventListener(
                "dataavailable",
                event => {

                    if (
                        event.data &&
                        event.data.size >
                        0
                    ) {

                        audioChunks.push(
                            event.data
                        );
                    }
                }
            );


            mediaRecorder.addEventListener(
                "stop",
                async () => {

                    stream
                        .getTracks()
                        .forEach(
                            track =>
                                track.stop()
                        );


                    const mimeType =
                        mediaRecorder.mimeType ||
                        "audio/webm";


                    const blob =
                        new Blob(
                            audioChunks,
                            {
                                type:
                                    mimeType
                            }
                        );


                    await transcribeAudio(
                        blob
                    );
                }
            );


            mediaRecorder.start();


            setVoiceStatus(
                "جاري الاستماع... اضغط مرة ثانية للإيقاف"
            );

        } catch (
            error
        ) {

            console.error(
                "VOICE START ERROR:",
                error
            );


            setVoiceStatus(
                "تعذر استخدام الميكروفون."
            );
        }
    }


    /* =========================================================
       STOP VOICE RECORDING
    ========================================================= */

    function stopVoiceRecording() {

        if (
            mediaRecorder &&
            mediaRecorder.state !==
                "inactive"
        ) {

            setVoiceStatus(
                "جاري تحويل التسجيل إلى نص..."
            );


            mediaRecorder.stop();
        }
    }


    /* =========================================================
       TRANSCRIBE AUDIO
    ========================================================= */

    async function transcribeAudio(
        blob
    ) {

        try {

            if (
                !blob ||
                blob.size === 0
            ) {

                throw new Error(
                    "التسجيل فارغ."
                );
            }


            const formData =
                new FormData();


            const extension =
                blob.type.includes(
                    "ogg"
                )

                    ? "ogg"

                    : "webm";


            formData.append(
                "audio",
                blob,
                `recording.${extension}`
            );


            const data =
                await api(
                    "/api/transcribe",
                    {

                        method:
                            "POST",

                        body:
                            formData
                    }
                );


            if (
                messageInput &&
                data.text
            ) {

                messageInput.value =
                    data.text;


                resizeTextarea();


                messageInput.focus();
            }


            setVoiceStatus(
                ""
            );

        } catch (
            error
        ) {

            console.error(
                "TRANSCRIBE ERROR:",
                error
            );


            setVoiceStatus(
                error.message ||
                "تعذر تحويل التسجيل إلى نص."
            );
        }
    }


    /* =========================================================
       VOICE BUTTON
    ========================================================= */

    voiceButton?.addEventListener(
        "click",
        () => {

            if (
                !mediaRecorder ||
                mediaRecorder.state ===
                    "inactive"
            ) {

                startVoiceRecording();

            } else {

                stopVoiceRecording();
            }
        }
    );


    /* =========================================================
       SEND MESSAGE
    ========================================================= */

    async function sendMessage() {

        if (
            !messageInput ||
            !sendButton
        ) {

            return;
        }


        if (
            isSending
        ) {

            return;
        }


        const text =
            messageInput.value.trim();


        if (
            !text &&
            !pendingImage
        ) {

            return;
        }


        isSending =
            true;


        sendButton.disabled =
            true;


        const oldButtonText =
            sendButton.textContent;


        sendButton.textContent =
            "...";


        const imageToSend =
            pendingImage;


        /*
            ناخد نسخة من التاريخ
            قبل ما نضيف السؤال الحالي
        */

        const historyForRequest =
            conversationHistory
                .slice(
                    -20
                );


        try {

            /* ---------------------------------------------------
               إنشاء محادثة لو مش موجودة
            --------------------------------------------------- */

            await ensureConversation(
                text ||
                "مسألة بصورة"
            );


            /* ---------------------------------------------------
               عرض سؤال الطالب
            --------------------------------------------------- */

            addMessage(
                text ||
                "صورة مرفقة",
                "user",
                imageToSend
            );


            /* ---------------------------------------------------
               حفظ سؤال الطالب
            --------------------------------------------------- */

            await saveMessage(
                "user",
                text ||
                "صورة مرفقة",
                imageToSend
            );


            /* ---------------------------------------------------
               تنظيف input
            --------------------------------------------------- */

            messageInput.value =
                "";


            resizeTextarea();


            /* ---------------------------------------------------
               حذف الصورة المعلقة من الواجهة
            --------------------------------------------------- */

            pendingImage =
                null;


            renderImagePreview(
                null
            );


            /* ---------------------------------------------------
               طلب الذكاء الاصطناعي
            --------------------------------------------------- */

            const data =
                await api(
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
                                    text ||
                                    "حل المسألة الموجودة في الصورة.",

                                history:
                                    historyForRequest,

                                grade:
                                    sessionContext.grade,

                                subject:
                                    sessionContext.subject,

                                unit:
                                    sessionContext.unit,

                                lesson:
                                    sessionContext.lesson,

                                mode:
                                    sessionContext.mode,

                                image:
                                    imageToSend
                            })
                    }
                );


            /* ---------------------------------------------------
               الإجابة
            --------------------------------------------------- */

            const answer =
                String(
                    data.answer ||
                    ""
                ).trim();


            if (
                !answer
            ) {

                throw new Error(
                    "المدرس الذكي لم يرجع إجابة."
                );
            }


            /* ---------------------------------------------------
               عرض الإجابة
            --------------------------------------------------- */

            addMessage(
                answer,
                "bot"
            );


            /* ---------------------------------------------------
               حفظ إجابة AI
            --------------------------------------------------- */

            await saveMessage(
                "assistant",
                answer,
                null
            );


            /* ---------------------------------------------------
               تحديث تاريخ المحادثة
            --------------------------------------------------- */

            conversationHistory.push({

                role:
                    "user",

                content:
                    text ||
                    "صورة مرفقة"
            });


            conversationHistory.push({

                role:
                    "assistant",

                content:
                    answer
            });


            /* ---------------------------------------------------
               الاحتفاظ بآخر 20 رسالة فقط
            --------------------------------------------------- */

            if (
                conversationHistory.length >
                20
            ) {

                conversationHistory =
                    conversationHistory.slice(
                        -20
                    );
            }


            /* ---------------------------------------------------
               تحديث قائمة المحادثات
            --------------------------------------------------- */

            await loadConversations();


        } catch (
            error
        ) {

            console.error(
                "CHAT ERROR:",
                error
            );


            addMessage(
                error.message ||
                "تعذر الاتصال بالمدرس الذكي حاليًا.",
                "bot"
            );

        } finally {

            isSending =
                false;


            sendButton.disabled =
                false;


            sendButton.textContent =
                oldButtonText ||
                "إرسال";


            messageInput.focus();
        }
    }


    /* =========================================================
       SEND BUTTON
    ========================================================= */

    sendButton?.addEventListener(
        "click",
        sendMessage
    );


    /* =========================================================
       ENTER TO SEND
    ========================================================= */

    messageInput?.addEventListener(
        "keydown",
        event => {

            if (
                event.key ===
                    "Enter" &&
                !event.shiftKey
            ) {

                event.preventDefault();


                sendMessage();
            }
        }
    );


    /* =========================================================
       TEXTAREA AUTO RESIZE
    ========================================================= */

    messageInput?.addEventListener(
        "input",
        resizeTextarea
    );


    /* =========================================================
       INITIALIZATION
    ========================================================= */

    async function init() {

        /* -----------------------------------------------------
           عرض بيانات الدرس
        ----------------------------------------------------- */

        renderSessionContext();


        /* -----------------------------------------------------
           تجهيز input
        ----------------------------------------------------- */

        resizeTextarea();


        /* -----------------------------------------------------
           الصفحة الترحيبية
        ----------------------------------------------------- */

        showWelcome();


        /* -----------------------------------------------------
           التأكد من تسجيل الدخول
        ----------------------------------------------------- */

        const loggedIn =
            await loadCurrentUser();


        if (
            !loggedIn
        ) {

            return;
        }


        /* -----------------------------------------------------
           المحادثات
        ----------------------------------------------------- */

        await loadConversations();


        /* -----------------------------------------------------
           فتح محادثة من الرابط
           مثال:
           /chat.html?conversation=5
        ----------------------------------------------------- */

        const requestedConversation =
            params.get(
                "conversation"
            );


        if (
            requestedConversation &&
            /^\d+$/.test(
                requestedConversation
            )
        ) {

            await loadConversation(
                Number(
                    requestedConversation
                )
            );
        }
    }


    /* =========================================================
       START
    ========================================================= */

    init();

})();
