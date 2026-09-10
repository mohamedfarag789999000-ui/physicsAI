<!DOCTYPE html>
<html lang="ar" dir="rtl">

<head>
    <meta charset="UTF-8">

    <meta
        name="viewport"
        content="width=device-width, initial-scale=1.0, viewport-fit=cover"
    >

    <meta
        name="theme-color"
        content="#0b0d12"
    >

    <title>Physics AI</title>

    <style>
        /* =========================================================
           ROOT
        ========================================================= */

        :root {
            --bg: #0b0d12;
            --bg-soft: #10141b;

            --sidebar: #11151c;
            --panel: #161b24;
            --panel-2: #1c222c;

            --border: rgba(255, 255, 255, 0.08);

            --text: #f5f7fb;
            --muted: #929cab;

            --accent: #7658ff;
            --accent-hover: #6547ee;

            --user: #292f3b;

            --danger: #ff5667;
            --success: #53d69b;

            --shadow:
                0 20px 60px rgba(0, 0, 0, 0.35);
        }

        body.light {
            --bg: #f5f7fb;
            --bg-soft: #eef1f6;

            --sidebar: #ffffff;
            --panel: #ffffff;
            --panel-2: #eef1f6;

            --border: rgba(15, 23, 42, 0.08);

            --text: #18202a;
            --muted: #667085;

            --accent: #6847ff;
            --accent-hover: #5737e8;

            --user: #ece8ff;

            --shadow:
                0 20px 60px rgba(15, 23, 42, 0.10);
        }

        /* =========================================================
           RESET
        ========================================================= */

        * {
            box-sizing: border-box;
        }

        html,
        body {
            width: 100%;
            height: 100%;
            margin: 0;
            padding: 0;
        }

        body {
            font-family:
                "Segoe UI",
                Tahoma,
                Arial,
                sans-serif;

            background: var(--bg);
            color: var(--text);

            overflow: hidden;
        }

        button,
        textarea,
        input,
        select {
            font: inherit;
        }

        button {
            border: 0;
            outline: none;
            cursor: pointer;
        }

        a {
            color: inherit;
        }

        /* =========================================================
           APP
        ========================================================= */

        .app {
            width: 100%;
            height: 100dvh;

            display: flex;

            background: var(--bg);
        }

        /* =========================================================
           SIDEBAR
        ========================================================= */

        .sidebar {
            width: 290px;
            min-width: 290px;
            height: 100dvh;

            display: flex;
            flex-direction: column;

            background: var(--sidebar);

            border-left: 1px solid var(--border);

            transition:
                width 0.25s ease,
                min-width 0.25s ease,
                transform 0.25s ease;

            position: relative;
            z-index: 100;
        }

        .sidebar.collapsed {
            width: 0;
            min-width: 0;
            overflow: hidden;
            border-left: 0;
        }

        .sidebar-header {
            padding: 18px 15px;
            border-bottom: 1px solid var(--border);
        }

        .brand {
            display: flex;
            align-items: center;
            gap: 10px;
        }

        .brand-logo {
            width: 44px;
            height: 44px;

            display: grid;
            place-items: center;

            border-radius: 14px;

            color: #ffffff;
            font-size: 21px;
            font-weight: 900;

            background:
                linear-gradient(
                    135deg,
                    var(--accent),
                    #a48dff
                );

            box-shadow:
                0 12px 30px rgba(118, 88, 255, 0.25);
        }

        .brand-title {
            font-size: 15px;
            font-weight: 800;
        }

        .brand-subtitle {
            margin-top: 3px;
            color: var(--muted);
            font-size: 11px;
        }

        .new-chat {
            width: 100%;
            height: 44px;

            margin-top: 15px;

            border-radius: 12px;

            background: var(--accent);
            color: #ffffff;

            font-size: 13px;
            font-weight: 800;

            transition:
                transform 0.2s ease,
                background 0.2s ease;
        }

        .new-chat:hover {
            background: var(--accent-hover);
            transform: translateY(-1px);
        }

        .sidebar-title {
            padding: 14px 15px 8px;

            color: var(--muted);

            font-size: 11px;
            font-weight: 800;
        }

        .conversation-list {
            flex: 1;

            overflow-y: auto;

            padding:
                0 10px 14px;
        }

        .conversation-list::-webkit-scrollbar,
        .chat::-webkit-scrollbar {
            width: 6px;
        }

        .conversation-list::-webkit-scrollbar-thumb,
        .chat::-webkit-scrollbar-thumb {
            background: rgba(127, 127, 127, 0.25);
            border-radius: 20px;
        }

        .conversation-item {
            width: 100%;

            display: block;

            padding: 11px 12px;
            margin-bottom: 4px;

            text-align: right;

            border-radius: 11px;

            background: transparent;
            color: var(--text);

            transition: background 0.15s ease;
        }

        .conversation-item:hover,
        .conversation-item.active {
            background: var(--panel-2);
        }

        .conversation-item-title {
            overflow: hidden;

            text-overflow: ellipsis;

            white-space: nowrap;

            font-size: 13px;
            font-weight: 600;
        }

        .conversation-item-date {
            margin-top: 4px;

            color: var(--muted);

            font-size: 10px;
        }

        .study-link {
            display: block;

            margin:
                0 12px 14px;

            padding: 12px;

            border:
                1px solid var(--border);

            border-radius: 11px;

            background: var(--panel);

            color: var(--text);

            text-decoration: none;

            font-size: 12px;
            font-weight: 700;

            transition:
                background 0.15s ease;
        }

        .study-link:hover {
            background: var(--panel-2);
        }

        /* =========================================================
           MAIN
        ========================================================= */

        .main {
            position: relative;

            flex: 1;

            min-width: 0;
            height: 100dvh;

            display: flex;
            flex-direction: column;

            background: var(--bg);
        }

        /* =========================================================
           TOPBAR
        ========================================================= */

        .topbar {
            height: 62px;
            min-height: 62px;

            display: flex;
            align-items: center;
            justify-content: space-between;

            padding: 0 13px;

            border-bottom:
                1px solid var(--border);

            background:
                rgba(22, 27, 36, 0.75);

            backdrop-filter: blur(18px);

            position: relative;
            z-index: 20;
        }

        body.light .topbar {
            background:
                rgba(255, 255, 255, 0.80);
        }

        .topbar-left,
        .topbar-right {
            display: flex;
            align-items: center;
            gap: 8px;

            min-width: 0;
        }

        .icon-button {
            width: 40px;
            height: 40px;

            display: grid;
            place-items: center;

            border-radius: 11px;

            background: transparent;

            color: var(--text);

            font-size: 18px;

            transition:
                background 0.15s ease;
        }

        .icon-button:hover {
            background: var(--panel-2);
        }

        .page-info {
            min-width: 0;
        }

        .page-title {
            max-width: 45vw;

            overflow: hidden;

            text-overflow: ellipsis;

            white-space: nowrap;

            font-size: 14px;
            font-weight: 800;
        }

        .online {
            margin-top: 2px;

            color: var(--success);

            font-size: 10px;
        }

        #userName {
            max-width: 150px;

            overflow: hidden;

            text-overflow: ellipsis;

            white-space: nowrap;

            color: var(--muted);

            font-size: 11px;
        }

        /* =========================================================
           LESSON BAR
        ========================================================= */

        .lesson-bar {
            display: flex;
            align-items: center;
            justify-content: space-between;

            gap: 15px;

            padding: 11px 16px;

            border-bottom:
                1px solid var(--border);

            background: var(--bg-soft);
        }

        .lesson-main {
            min-width: 0;
        }

        .lesson-badge {
            display: inline-flex;
            align-items: center;

            gap: 6px;

            padding: 5px 9px;

            border-radius: 999px;

            background:
                rgba(118, 88, 255, 0.12);

            color: var(--accent);

            font-size: 10px;
            font-weight: 800;
        }

        #lessonName {
            margin: 5px 0 2px;

            font-size: 16px;

            overflow: hidden;

            text-overflow: ellipsis;

            white-space: nowrap;
        }

        #lessonDescription {
            margin: 0;

            color: var(--muted);

            font-size: 11px;

            overflow: hidden;

            text-overflow: ellipsis;

            white-space: nowrap;
        }

        /* =========================================================
           CHAT
        ========================================================= */

        .chat-wrapper {
            position: relative;

            flex: 1;

            min-height: 0;
        }

        .chat {
            width: 100%;
            height: 100%;

            overflow-y: auto;

            padding:
                26px 16px 170px;
        }

        /* =========================================================
           WELCOME
        ========================================================= */

        .welcome {
            width: min(720px, 100%);

            margin: 55px auto;

            text-align: center;
        }

        .welcome-icon {
            width: 70px;
            height: 70px;

            margin:
                0 auto 18px;

            display: grid;
            place-items: center;

            border-radius: 21px;

            background:
                linear-gradient(
                    135deg,
                    var(--accent),
                    #a48dff
                );

            color: #ffffff;

            font-size: 30px;

            box-shadow:
                0 16px 40px
                rgba(118, 88, 255, 0.23);
        }

        .welcome h1 {
            margin: 0;

            font-size:
                clamp(25px, 5vw, 37px);

            line-height: 1.2;
        }

        .welcome p {
            width: min(600px, 100%);

            margin:
                12px auto 0;

            color: var(--muted);

            font-size: 13px;

            line-height: 1.9;
        }

        /* =========================================================
           MESSAGES
        ========================================================= */

        .message {
            width: min(900px, 100%);

            display: flex;
            align-items: flex-start;

            gap: 10px;

            margin:
                0 auto 18px;
        }

        .avatar {
            width: 34px;
            height: 34px;

            flex:
                0 0 34px;

            display: grid;
            place-items: center;

            border-radius: 10px;

            background:
                linear-gradient(
                    135deg,
                    var(--accent),
                    #a48dff
                );

            color: #ffffff;

            font-size: 12px;
            font-weight: 800;
        }

        .message.user .avatar {
            background: #667085;
        }

        .bubble {
            min-width: 0;

            max-width:
                min(82%, 760px);

            padding: 3px 0;

            color: var(--text);

            font-size: 14px;

            line-height: 1.9;

            overflow-wrap: anywhere;
        }

        .message.user .bubble {
            padding:
                11px 14px;

            background: var(--user);

            border-radius:
                16px 6px 16px 16px;
        }

        .bubble strong {
            display: block;

            margin-bottom: 4px;

            color: var(--muted);

            font-size: 10px;
        }

        .bubble p {
            margin: 0;

            white-space: pre-wrap;
        }

        .bubble img {
            display: block;

            width: min(380px, 100%);

            max-height: 320px;

            margin-top: 12px;

            object-fit: cover;

            border-radius: 13px;

            border:
                1px solid var(--border);

            box-shadow: var(--shadow);
        }

        /* =========================================================
           IMAGE PREVIEW
        ========================================================= */

        .image-preview {
            position: absolute;

            right: 0;
            left: 0;
            bottom: 102px;

            width:
                min(900px, calc(100% - 24px));

            margin: 0 auto;

            z-index: 11;
        }

        .image-preview.hidden {
            display: none;
        }

        .image-preview img {
            width: 92px;
            height: 72px;

            display: block;

            object-fit: cover;

            border-radius: 11px;

            border:
                1px solid var(--border);

            box-shadow: var(--shadow);
        }

        #removeImageButton {
            position: absolute;

            top: -7px;
            right: 70px;

            width: 22px;
            height: 22px;

            display: grid;
            place-items: center;

            border-radius: 50%;

            background: var(--danger);

            color: #ffffff;

            font-size: 15px;
            line-height: 1;
        }

        /* =========================================================
           COMPOSER
        ========================================================= */

        .composer-area {
            position: absolute;

            right: 0;
            left: 0;
            bottom: 0;

            padding:
                12px 12px
                calc(12px + env(safe-area-inset-bottom));

            background:
                linear-gradient(
                    to bottom,
                    transparent,
                    var(--bg) 35%
                );

            z-index: 10;
        }

        .input-wrapper {
            width:
                min(900px, 100%);

            min-height: 56px;

            margin: 0 auto;

            display: flex;
            align-items: flex-end;

            gap: 7px;

            padding: 7px;

            border:
                1px solid var(--border);

            border-radius: 18px;

            background:
                var(--panel);

            box-shadow:
                var(--shadow);
        }

        .tools {
            display: flex;
            align-items: center;

            gap: 5px;
        }

        .tool-button,
        .send-button {
            width: 42px;
            height: 42px;

            flex:
                0 0 42px;

            display: grid;
            place-items: center;

            border-radius: 12px;

            background:
                var(--panel-2);

            color: var(--text);

            font-size: 17px;

            transition:
                transform 0.15s ease,
                background 0.15s ease;
        }

        .tool-button:hover {
            transform: translateY(-1px);
        }

        .send-button {
            background: var(--accent);

            color: #ffffff;

            font-size: 20px;
        }

        .send-button:hover {
            background: var(--accent-hover);
        }

        .send-button:disabled {
            opacity: 0.45;
            cursor: not-allowed;
        }

        #messageInput {
            flex: 1;

            min-width: 0;
            min-height: 42px;
            max-height: 150px;

            resize: none;

            border: 0;
            outline: none;

            background: transparent;

            color: var(--text);

            padding:
                10px 9px;

            line-height: 1.6;

            font-size: 14px;
        }

        #messageInput::placeholder {
            color: var(--muted);
        }

        .input-hint {
            width:
                min(900px, 100%);

            margin:
                5px auto 0;

            text-align: center;

            color: var(--muted);

            font-size: 9px;
        }

        .voice-status {
            width:
                min(900px, 100%);

            margin:
                3px auto 0;

            min-height: 14px;

            text-align: center;

            color: var(--accent);

            font-size: 10px;
        }

        /* =========================================================
           CAMERA MODAL
        ========================================================= */

        .modal {
            position: fixed;

            inset: 0;

            display: flex;
            align-items: center;
            justify-content: center;

            padding: 20px;

            background:
                rgba(0, 0, 0, 0.65);

            z-index: 300;
        }

        .modal.hidden {
            display: none;
        }

        .modal-card {
            width:
                min(600px, 100%);

            padding: 16px;

            border:
                1px solid var(--border);

            border-radius: 18px;

            background:
                var(--panel);

            box-shadow:
                var(--shadow);
        }

        .modal-header {
            display: flex;
            align-items: center;
            justify-content: space-between;

            gap: 12px;

            margin-bottom: 12px;
        }

        .modal-header h3 {
            margin: 0;

            font-size: 15px;
        }

        #closeCameraButton {
            width: 36px;
            height: 36px;

            display: grid;
            place-items: center;

            border-radius: 50%;

            background: var(--panel-2);

            color: var(--text);

            font-size: 20px;
        }

        #cameraVideo {
            width: 100%;

            max-height: 60vh;

            display: block;

            object-fit: cover;

            background: #000;

            border-radius: 14px;
        }

        #cameraCanvas {
            display: none;
        }

        .capture-button {
            width: 100%;

            margin-top: 12px;

            padding: 13px;

            border-radius: 12px;

            background: var(--accent);

            color: #fff;

            font-size: 13px;
            font-weight: 800;
        }

        #cameraError {
            min-height: 18px;

            margin:
                8px 0 0;

            text-align: center;

            color: var(--danger);

            font-size: 11px;
        }

        /* =========================================================
           MOBILE OVERLAY
        ========================================================= */

        .mobile-overlay {
            display: none;

            position: fixed;

            inset: 0;

            background:
                rgba(0, 0, 0, 0.55);

            z-index: 90;
        }

        .mobile-overlay.show {
            display: block;
        }

        /* =========================================================
           MOBILE
        ========================================================= */

        @media (max-width: 900px) {

            .sidebar {
                position: fixed;

                top: 0;
                right: 0;
                bottom: 0;

                width: min(88vw, 320px);
                min-width: min(88vw, 320px);

                transform:
                    translateX(105%);

                box-shadow:
                    -18px 0 45px
                    rgba(0, 0, 0, 0.30);
            }

            .sidebar.mobile-open {
                transform:
                    translateX(0);
            }

            .topbar {
                height: 58px;
                min-height: 58px;

                padding: 0 8px;
            }

            .chat {
                padding:
                    20px 10px 155px;
            }

            .lesson-bar {
                padding:
                    9px 10px;
            }

            #lessonName {
                font-size: 14px;
            }

            #lessonDescription {
                font-size: 10px;
            }

            .message {
                gap: 8px;
            }

            .bubble {
                max-width:
                    calc(100% - 42px);

                font-size: 13px;
            }

            .welcome {
                margin:
                    28px auto;
            }
        }

        /* =========================================================
           SMALL PHONE
        ========================================================= */

        @media (max-width: 600px) {

            .topbar {
                height: 56px;
                min-height: 56px;

                padding: 0 6px;
            }

            .icon-button {
                width: 38px;
                height: 38px;
            }

            .page-title {
                max-width: 44vw;
                font-size: 13px;
            }

            .online {
                display: none;
            }

            #userName {
                display: none;
            }

            .lesson-bar {
                min-height: 44px;
            }

            .lesson-badge {
                font-size: 9px;
            }

            #lessonName {
                font-size: 13px;
            }

            #lessonDescription {
                display: none;
            }

            .welcome {
                margin:
                    20px auto;
            }

            .welcome-icon {
                width: 57px;
                height: 57px;

                border-radius: 17px;

                font-size: 24px;
            }

            .welcome h1 {
                font-size: 25px;
            }

            .welcome p {
                font-size: 12px;
            }

            .message {
                margin-bottom: 15px;
            }

            .avatar {
                width: 29px;
                height: 29px;

                flex-basis: 29px;

                border-radius: 9px;

                font-size: 9px;
            }

            .bubble {
                max-width:
                    calc(100% - 37px);

                font-size: 12.5px;

                line-height: 1.8;
            }

            .message.user .bubble {
                padding:
                    9px 11px;
            }

            .composer-area {
                padding:
                    6px 6px
                    calc(6px + env(safe-area-inset-bottom));
            }

            .input-wrapper {
                border-radius: 16px;

                padding: 6px;

                gap: 5px;
            }

            .tools {
                gap: 4px;
            }

            .tool-button,
            .send-button {
                width: 39px;
                height: 39px;

                flex-basis: 39px;

                border-radius: 10px;
            }

            #messageInput {
                min-height: 39px;

                padding:
                    9px 7px;

                font-size: 13px;
            }

            .input-hint {
                display: none;
            }

            .image-preview {
                bottom: 91px;
            }
        }

        /* =========================================================
           VERY SMALL PHONE
        ========================================================= */

        @media (max-width: 390px) {

            .tool-button,
            .send-button {
                width: 36px;
                height: 36px;

                flex-basis: 36px;

                font-size: 15px;
            }

            #messageInput {
                font-size: 12px;
            }
        }
    </style>
</head>

<body>

<div class="app">

    <!-- =========================================================
         MOBILE OVERLAY
    ========================================================== -->

    <div
        id="mobileOverlay"
        class="mobile-overlay"
    ></div>


    <!-- =========================================================
         SIDEBAR
    ========================================================== -->

    <aside
        id="sidebar"
        class="sidebar"
    >

        <div class="sidebar-header">

            <div class="brand">

                <div class="brand-logo">
                    Φ
                </div>

                <div>

                    <div class="brand-title">
                        Physics AI
                    </div>

                    <div class="brand-subtitle">
                        مدرسك الذكي في الفيزياء
                    </div>

                </div>

            </div>


            <button
                id="newChatButton"
                class="new-chat"
                type="button"
            >
                ＋ محادثة جديدة
            </button>

        </div>


        <div class="sidebar-title">
            المحادثات
        </div>


        <div
            id="conversationList"
            class="conversation-list"
        ></div>


        <a
            href="/study.html"
            class="study-link"
        >
            📚 المناهج والموسوعة
        </a>

    </aside>


    <!-- =========================================================
         MAIN
    ========================================================== -->

    <main class="main">


        <!-- =====================================================
             TOPBAR
        ====================================================== -->

        <header class="topbar">

            <div class="topbar-right">

                <button
                    id="sidebarButton"
                    class="icon-button"
                    type="button"
                    title="إظهار أو إخفاء المحادثات"
                    aria-label="إظهار أو إخفاء المحادثات"
                >
                    ☰
                </button>


                <div class="page-info">

                    <div
                        id="chatTitle"
                        class="page-title"
                    >
                        Physics AI
                    </div>

                    <div class="online">
                        ● متصل
                    </div>

                </div>

            </div>


            <div class="topbar-left">

                <span id="userName"></span>

                <button
                    id="themeButton"
                    class="icon-button"
                    type="button"
                    title="تغيير المظهر"
                    aria-label="تغيير المظهر"
                >
                    ☀
                </button>


                <button
                    id="logoutButton"
                    class="icon-button"
                    type="button"
                    title="تسجيل الخروج"
                    aria-label="تسجيل الخروج"
                >
                    ⎋
                </button>

            </div>

        </header>


        <!-- =====================================================
             LESSON BAR
        ====================================================== -->

        <section
            id="lessonBar"
            class="lesson-bar"
        >

            <div class="lesson-main">

                <div class="lesson-badge">
                    ⚛️ Physics AI
                </div>

                <h2 id="lessonName">
                    الفيزياء
                </h2>

                <p id="lessonDescription">
                    اسأل أي سؤال في الفيزياء وسأساعدك في الحل والفهم.
                </p>

            </div>

            <div
                id="chatMode"
                style="
                    color:var(--muted);
                    font-size:10px;
                    white-space:nowrap;
                "
            >
                دردشة عامة
            </div>

        </section>


        <!-- =====================================================
             CHAT
        ====================================================== -->

        <div class="chat-wrapper">

            <div
                id="chat"
                class="chat"
            >

                <div class="welcome">

                    <div class="welcome-icon">
                        ⚛️
                    </div>

                    <h1>
                        أهلاً بيك في Physics AI 👋
                    </h1>

                    <p>
                        اكتب سؤالك أو ارفع صورة المسألة
                        وأنا هساعدك تفهمها وتحلها خطوة بخطوة.
                    </p>

                </div>

            </div>


            <!-- =================================================
                 IMAGE PREVIEW
            ================================================== -->

            <div
                id="imagePreview"
                class="image-preview hidden"
            >

                <img
                    id="previewImage"
                    alt="الصورة المرفقة"
                >

                <button
                    id="removeImageButton"
                    type="button"
                    aria-label="إزالة الصورة"
                    title="إزالة الصورة"
                >
                    ×
                </button>

            </div>


            <!-- =================================================
                 COMPOSER
            ================================================== -->

            <div class="composer-area">

                <div class="input-wrapper">

                    <div class="tools">

                        <button
                            id="uploadButton"
                            class="tool-button"
                            type="button"
                            title="رفع صورة"
                            aria-label="رفع صورة"
                        >
                            🖼️
                        </button>


                        <button
                            id="cameraButton"
                            class="tool-button"
                            type="button"
                            title="الكاميرا"
                            aria-label="الكاميرا"
                        >
                            📷
                        </button>


                        <button
                            id="voiceButton"
                            class="tool-button"
                            type="button"
                            title="تسجيل صوت"
                            aria-label="تسجيل صوت"
                        >
                            🎙️
                        </button>


                        <input
                            type="file"
                            id="imageInput"
                            accept="image/*"
                            hidden
                        >


                        <input
                            type="file"
                            id="cameraInput"
                            accept="image/*"
                            capture="environment"
                            hidden
                        >

                    </div>


                    <textarea
                        id="messageInput"
                        rows="1"
                        placeholder="اكتب سؤالك هنا..."
                        aria-label="اكتب سؤالك هنا"
                    ></textarea>


                    <button
                        id="sendButton"
                        class="send-button"
                        type="button"
                        aria-label="إرسال"
                        title="إرسال"
                    >
                        ↑
                    </button>

                </div>


                <div
                    id="voiceStatus"
                    class="voice-status"
                    aria-live="polite"
                ></div>


                <div class="input-hint">
                    Enter للإرسال
                    <span>•</span>
                    Shift + Enter لسطر جديد
                </div>

            </div>

        </div>

    </main>

</div>


<!-- =========================================================
     CAMERA MODAL
========================================================= -->

<div
    id="cameraModal"
    class="modal hidden"
>

    <div class="modal-card">

        <div class="modal-header">

            <h3>
                تصوير المسألة
            </h3>

            <button
                id="closeCameraButton"
                type="button"
                aria-label="إغلاق"
                title="إغلاق"
            >
                ×
            </button>

        </div>


        <video
            id="cameraVideo"
            autoplay
            playsinline
        ></video>


        <canvas
            id="cameraCanvas"
            hidden
        ></canvas>


        <button
            id="takePhotoButton"
            class="capture-button"
            type="button"
        >
            📷 التقاط الصورة
        </button>


        <p
            id="cameraError"
        ></p>

    </div>

</div>


<!-- =========================================================
     IMPORTANT:
     chat.js فقط
========================================================= -->

<script src="chat.js"></script>

</body>

</html>
