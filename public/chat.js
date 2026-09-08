const messageInput =
    document.getElementById(
        "messageInput"
    );

const sendButton =
    document.getElementById(
        "sendButton"
    );

const chat =
    document.getElementById(
        "chat"
    );

const userName =
    document.getElementById(
        "userName"
    );

const logoutButton =
    document.getElementById(
        "logoutButton"
    );

const conversationList =
    document.getElementById(
        "conversationList"
    );

const newChatButton =
    document.getElementById(
        "newChatButton"
    );

const uploadButton =
    document.getElementById(
        "uploadButton"
    );

const cameraButton =
    document.getElementById(
        "cameraButton"
    );

const voiceButton =
    document.getElementById(
        "voiceButton"
    );

const imageInput =
    document.getElementById(
        "imageInput"
    );

const cameraInput =
    document.getElementById(
        "cameraInput"
    );

const imagePreview =
    document.getElementById(
        "imagePreview"
    );

const previewImage =
    document.getElementById(
        "previewImage"
    );

const removeImageButton =
    document.getElementById(
        "removeImageButton"
    );

const voiceStatus =
    document.getElementById(
        "voiceStatus"
    );

const cameraModal =
    document.getElementById(
        "cameraModal"
    );

const cameraVideo =
    document.getElementById(
        "cameraVideo"
    );

const cameraCanvas =
    document.getElementById(
        "cameraCanvas"
    );

const takePhotoButton =
    document.getElementById(
        "takePhotoButton"
    );

const closeCameraButton =
    document.getElementById(
        "closeCameraButton"
    );

const cameraError =
    document.getElementById(
        "cameraError"
    );


let conversationHistory = [];

let currentConversationId =
    null;

let selectedImage =
    null;

let mediaRecorder =
    null;

let audioChunks =
    [];

let cameraStream =
    null;


/* =========================================================
   URL PARAMS
========================================================= */

const params =
    new URLSearchParams(
        window.location.search
    );

const mode =
    params.get("mode") ||
    "general";

const grade =
    params.get("grade") ||
    "";

const subject =
    params.get("subject") ||
    "الفيزياء";

const unit =
    params.get("unit") ||
    "";

const lesson =
    params.get("lesson") ||
    "";

const description =
    params.get("description") ||
    "";


/* =========================================================
   LESSON UI
========================================================= */

document.getElementById(
    "chatMode"
).textContent =
    mode === "encyclopedia"
        ? "🌌 موسوعة الفيزياء"
        : "📚 المنهج";


document.getElementById(
    "lessonName"
).textContent =
    lesson ||
    "دردشة عامة";


document.getElementById(
    "lessonDescription"
).textContent =
    description ||
    "اسأل Physics AI عن الفيزياء.";


/* =========================================================
   AUTH
========================================================= */

async function loadUser() {

    try {

        const response =
            await fetch(
                "/api/auth/me"
            );

        const data =
            await response.json();


        if (
            !data.loggedIn
        ) {

            window.location.href =
                "/login.html";

            return false;

        }


        userName.textContent =
            data.user.name;


        return true;


    } catch (error) {

        console.error(
            error
        );

        return false;

    }

}


/* =========================================================
   LOAD CONVERSATIONS
========================================================= */

async function loadConversations() {

    try {

        const response =
            await fetch(
                "/api/conversations"
            );


        if (
            response.status === 401
        ) {

            window.location.href =
                "/login.html";

            return;

        }


        const data =
            await response.json();


        conversationList.innerHTML =
            "";


        if (
            !data.conversations ||
            data.conversations.length === 0
        ) {

            conversationList.innerHTML =
                `
                <div
                    style="
                    color:#999;
                    font-size:12px;
                    text-align:center;
                    padding:20px;
                    "
                >
                    مفيش محادثات محفوظة لسه.
                </div>
                `;

            return;

        }


        data.conversations.forEach(
            function (conversation) {

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
                        currentConversationId
                    )
                ) {

                    item.classList.add(
                        "active"
                    );

                }


                const title =
                    document.createElement(
                        "div"
                    );

                title.className =
                    "conversation-title";

                title.textContent =
                    conversation.title;


                const deleteButton =
                    document.createElement(
                        "button"
                    );

                deleteButton.className =
                    "delete-conversation";

                deleteButton.textContent =
                    "🗑️";


                deleteButton.addEventListener(
                    "click",
                    async function (event) {

                        event.stopPropagation();

                        await deleteConversation(
                            conversation.id
                        );

                    }
                );


                item.appendChild(
                    title
                );

                item.appendChild(
                    deleteButton
                );


                item.addEventListener(
                    "click",
                    function () {

                        openConversation(
                            conversation.id
                        );

                    }
                );


                conversationList.appendChild(
                    item
                );

            }
        );


    } catch (error) {

        console.error(
            "LOAD CONVERSATIONS:",
            error
        );

    }

}


/* =========================================================
   CREATE CONVERSATION
========================================================= */

async function createConversation(
    title = "محادثة جديدة"
) {

    const response =
        await fetch(
            "/api/conversations",
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({
                    title
                })
            }
        );


    const data =
        await response.json();


    if (!response.ok) {

        throw new Error(
            data.error ||
            "تعذر إنشاء المحادثة."
        );

    }


    currentConversationId =
        data.conversation.id;


    conversationHistory =
        [];


    chat.innerHTML =
        `
        <div class="welcome">

            <div class="welcome-icon">
                ⚛️
            </div>

            <h1>
                محادثة جديدة 👋
            </h1>

            <p>
                اسأل Physics AI عن الفيزياء.
            </p>

        </div>
        `;


    await loadConversations();

}


/* =========================================================
   OPEN CONVERSATION
========================================================= */

async function openConversation(
    conversationId
) {

    try {

        const response =
            await fetch(
                `/api/conversations/${conversationId}`
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
            conversationId;


        conversationHistory =
            data.messages
                .map(
                    function (message) {

                        return {

                            role:
                                message.role,

                            content:
                                message.content

                        };

                    }
                );


        chat.innerHTML =
            "";


        data.messages.forEach(
            function (message) {

                addMessageToUI(
                    message.content,
                    message.role ===
                        "user"
                        ? "user"
                        : "bot",
                    message.image
                );

            }
        );


        await loadConversations();


    } catch (error) {

        console.error(
            error
        );

        alert(
            error.message
        );

    }

}


/* =========================================================
   DELETE CONVERSATION
========================================================= */

async function deleteConversation(
    conversationId
) {

    const confirmed =
        confirm(
            "تحب تحذف المحادثة دي؟"
        );


    if (!confirmed) {
        return;
    }


    try {

        const response =
            await fetch(
                `/api/conversations/${conversationId}`,
                {
                    method: "DELETE"
                }
            );


        if (!response.ok) {

            const data =
                await response.json();

            throw new Error(
                data.error ||
                "تعذر الحذف."
            );

        }


        if (
            Number(
                currentConversationId
            ) ===
            Number(
                conversationId
            )
        ) {

            currentConversationId =
                null;

            conversationHistory =
                [];

            chat.innerHTML =
                `
                <div class="welcome">

                    <div class="welcome-icon">
                        ⚛️
                    </div>

                    <h1>
                        أهلًا بيك 👋
                    </h1>

                    <p>
                        ابدأ محادثة جديدة مع Physics AI.
                    </p>

                </div>
                `;

        }


        await loadConversations();


    } catch (error) {

        alert(
            error.message
        );

    }

}


/* =========================================================
   ADD MESSAGE UI
========================================================= */

function addMessageToUI(
    text,
    type,
    image = null
) {

    const message =
        document.createElement(
            "div"
        );

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
        document.createElement(
            "div"
        );

    avatarElement.className =
        "avatar";

    avatarElement.textContent =
        avatar;


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
        name;


    const paragraph =
        document.createElement(
            "p"
        );

    paragraph.textContent =
        text;


    bubble.appendChild(
        strong
    );


    if (image) {

        const img =
            document.createElement(
                "img"
            );

        img.className =
            "message-image";

        img.src =
            image;

        img.alt =
            "صورة المسألة";

        bubble.appendChild(
            img
        );

    }


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


/* =========================================================
   SEND MESSAGE
========================================================= */

async function sendMessage() {

    const text =
        messageInput.value.trim();


    if (
        !text &&
        !selectedImage
    ) {

        return;

    }


    if (
        !currentConversationId
    ) {

        try {

            const title =
                text
                    ? text.slice(
                        0,
                        50
                    )
                    : "مسألة بالصورة";


            await createConversation(
                title
            );


        } catch (error) {

            alert(
                error.message
            );

            return;

        }

    }


    const imageToSend =
        selectedImage;


    addMessageToUI(
        text ||
            "حل المسألة الموجودة في الصورة.",
        "user",
        imageToSend
    );


    messageInput.value =
        "";

    messageInput.style.height =
        "auto";


    removeSelectedImage();


    sendButton.disabled =
        true;

    sendButton.textContent =
        "…";


    try {

        await saveMessage(
            "user",
            text ||
                "حل المسألة الموجودة في الصورة.",
            imageToSend
        );


        const response =
            await fetch(
                "/api/chat",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body: JSON.stringify({

                        message:
                            text ||
                            "حل المسألة الموجودة في الصورة.",

                        history:
                            conversationHistory,

                        image:
                            imageToSend,

                        grade,

                        subject,

                        unit,

                        lesson,

                        mode

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


        addMessageToUI(
            data.answer,
            "bot"
        );


        conversationHistory.push({

            role:
                "user",

            content:
                text ||
                "حل المسألة الموجودة في الصورة."

        });


        conversationHistory.push({

            role:
                "assistant",

            content:
                data.answer

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


        await saveMessage(
            "assistant",
            data.answer
        );


        await loadConversations();


    } catch (error) {

        console.error(
            "SEND ERROR:",
            error
        );


        addMessageToUI(
            "حصلت مشكلة وأنا بحاول أجيب الإجابة. جرّب تاني.",
            "bot"
        );

    } finally {

        sendButton.disabled =
            false;

        sendButton.textContent =
            "↑";

        messageInput.focus();

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
        !currentConversationId
    ) {

        return;

    }


    const response =
        await fetch(
            `/api/conversations/${currentConversationId}/messages`,
            {
                method: "POST",

                headers: {
                    "Content-Type":
                        "application/json"
                },

                body: JSON.stringify({

                    role,

                    content,

                    image

                })

            }
        );


    if (!response.ok) {

        console.warn(
            "MESSAGE WAS NOT SAVED"
        );

    }

}


/* =========================================================
   IMAGE
========================================================= */

uploadButton.addEventListener(
    "click",
    function () {

        imageInput.click();

    }
);


imageInput.addEventListener(
    "change",
    function () {

        const file =
            this.files[0];


        if (!file) {
            return;
        }


        processImage(
            file
        );

    }
);


cameraInput.addEventListener(
    "change",
    function () {

        const file =
            this.files[0];


        if (!file) {
            return;
        }


        processImage(
            file
        );

    }
);


function processImage(
    file
) {

    if (
        !file.type.startsWith(
            "image/"
        )
    ) {

        alert(
            "اختار صورة فقط."
        );

        return;

    }


    if (
        file.size >
        10 * 1024 * 1024
    ) {

        alert(
            "الصورة كبيرة جدًا. الحد الأقصى 10MB."
        );

        return;

    }


    const reader =
        new FileReader();


    reader.onload =
        function () {

            selectedImage =
                reader.result;


            previewImage.src =
                selectedImage;


            imagePreview.classList.remove(
                "hidden"
            );

        };


    reader.readAsDataURL(
        file
    );

}


function removeSelectedImage() {

    selectedImage =
        null;


    previewImage.src =
        "";


    imagePreview.classList.add(
        "hidden"
    );


    imageInput.value =
        "";

    cameraInput.value =
        "";

}


removeImageButton.addEventListener(
    "click",
    removeSelectedImage
);


/* =========================================================
   CAMERA
========================================================= */

cameraButton.addEventListener(
    "click",
    async function () {

        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {

            cameraInput.click();

            return;

        }


        cameraError.textContent =
            "";


        cameraModal.classList.remove(
            "hidden"
        );


        try {

            cameraStream =
                await navigator.mediaDevices.getUserMedia({

                    video: {
                        facingMode:
                            {
                                ideal:
                                    "environment"
                            },

                        width: {
                            ideal: 1280
                        },

                        height: {
                            ideal: 720
                        }

                    },

                    audio: false

                });


            cameraVideo.srcObject =
                cameraStream;


        } catch (error) {

            console.error(
                error
            );

            cameraError.textContent =
                "مش قادر أوصل للكاميرا. اسمح للمتصفح باستخدام الكاميرا أو استخدم رفع صورة.";

        }

    }
);


takePhotoButton.addEventListener(
    "click",
    function () {

        if (
            !cameraStream
        ) {
            return;
        }


        const width =
            cameraVideo.videoWidth;

        const height =
            cameraVideo.videoHeight;


        cameraCanvas.width =
            width;

        cameraCanvas.height =
            height;


        const context =
            cameraCanvas.getContext(
                "2d"
            );


        context.drawImage(
            cameraVideo,
            0,
            0,
            width,
            height
        );


        selectedImage =
            cameraCanvas.toDataURL(
                "image/jpeg",
                0.82
            );


        previewImage.src =
            selectedImage;


        imagePreview.classList.remove(
            "hidden"
        );


        closeCamera();

    }
);


closeCameraButton.addEventListener(
    "click",
    closeCamera
);


function closeCamera() {

    if (
        cameraStream
    ) {

        cameraStream
            .getTracks()
            .forEach(
                function (track) {

                    track.stop();

                }
            );

        cameraStream =
            null;

    }


    cameraVideo.srcObject =
        null;


    cameraModal.classList.add(
        "hidden"
    );

}


/* =========================================================
   VOICE
========================================================= */

voiceButton.addEventListener(
    "click",
    async function () {

        if (
            mediaRecorder &&
            mediaRecorder.state ===
                "recording"
        ) {

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

        voiceStatus.textContent =
            "المتصفح مش بيدعم تسجيل الصوت.";

        return;

    }


    try {

        const stream =
            await navigator.mediaDevices.getUserMedia(
                {
                    audio: true
                }
            );


        audioChunks =
            [];


        let options = {};


        if (
            MediaRecorder.isTypeSupported(
                "audio/webm;codecs=opus"
            )
        ) {

            options.mimeType =
                "audio/webm;codecs=opus";

        }


        mediaRecorder =
            new MediaRecorder(
                stream,
                options
            );


        mediaRecorder.ondataavailable =
            function (event) {

                if (
                    event.data &&
                    event.data.size > 0
                ) {

                    audioChunks.push(
                        event.data
                    );

                }

            };


        mediaRecorder.onstop =
            async function () {

                stream
                    .getTracks()
                    .forEach(
                        function (track) {
                            track.stop();
                        }
                    );


                await transcribeAudio();

            };


        mediaRecorder.start();


        voiceButton.classList.add(
            "recording"
        );


        voiceStatus.textContent =
            "🎙️ بيسجل... اضغط تاني لما تخلص.";


    } catch (error) {

        console.error(
            error
        );

        voiceStatus.textContent =
            "مش قادر أوصل للميكروفون. اسمح للمتصفح باستخدام الميكروفون.";

    }

}


function stopRecording() {

    if (
        mediaRecorder &&
        mediaRecorder.state ===
            "recording"
    ) {

        mediaRecorder.stop();

    }


    voiceButton.classList.remove(
        "recording"
    );


    voiceStatus.textContent =
        "جاري تحويل الصوت إلى نص...";

}


async function transcribeAudio() {

    try {

        const blob =
            new Blob(
                audioChunks,
                {
                    type:
                        "audio/webm"
                }
            );


        if (
            blob.size === 0
        ) {

            throw new Error(
                "التسجيل فارغ."
            );

        }


        const formData =
            new FormData();


        formData.append(
            "audio",
            blob,
            "recording.webm"
        );


        const response =
            await fetch(
                "/api/transcribe",
                {
                    method: "POST",
                    body: formData
                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            throw new Error(
                data.error ||
                "تعذر تحويل الصوت."
            );

        }


        const text =
            String(
                data.text || ""
            ).trim();


        if (!text) {

            voiceStatus.textContent =
                "ملقتش كلام واضح في التسجيل.";

            return;

        }


        messageInput.value =
            text;


        autoResize();


        voiceStatus.textContent =
            "✅ تم تحويل الصوت. راجع الكلام واضغط إرسال.";


        messageInput.focus();


    } catch (error) {

        console.error(
            "VOICE ERROR:",
            error
        );

        voiceStatus.textContent =
            "حصلت مشكلة في تحويل التسجيل.";

    }

}


/* =========================================================
   TEXTAREA
========================================================= */

function autoResize() {

    messageInput.style.height =
        "auto";


    messageInput.style.height =
        Math.min(
            messageInput.scrollHeight,
            150
        ) +
        "px";

}


messageInput.addEventListener(
    "input",
    autoResize
);


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


sendButton.addEventListener(
    "click",
    sendMessage
);


/* =========================================================
   NEW CHAT
========================================================= */

newChatButton.addEventListener(
    "click",
    async function () {

        try {

            await createConversation();

        } catch (error) {

            alert(
                error.message
            );

        }

    }
);


/* =========================================================
   LOGOUT
========================================================= */

logoutButton.addEventListener(
    "click",
    async function () {

        try {

            await fetch(
                "/api/auth/logout",
                {
                    method: "POST"
                }
            );

            window.location.href =
                "/login.html";


        } catch (error) {

            console.error(
                error
            );

        }

    }
);


/* =========================================================
   INIT
========================================================= */

async function init() {

    const loggedIn =
        await loadUser();


    if (!loggedIn) {
        return;
    }


    await loadConversations();

}


init();