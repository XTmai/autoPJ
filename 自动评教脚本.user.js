// ==UserScript==
// @name         自动评教脚本
// @namespace    http://tampermonkey.net/
// @version      4.0
// @description  高校教务系统自动评教脚本 — Apple 风格界面，支持自动/手动提交、自定义评教内容、速度调节、快速模式，含页面检测与错误日志
// @author       满满.
// @match        http://kjjw.ctgu.edu.cn/*
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_notification
// @run-at       document-end
// ==/UserScript==

(function() {
    'use strict';

    let autoSubmit = false;
    let isProcessing = false;
    let countdownInterval = null;
    let shouldStop = false;
    let allTimers = [];

    let q14Text = GM_getValue('q14Text', '无');
    let q15Text = GM_getValue('q15Text', '老师教学认真负责，课程内容充实，讲解清晰易懂。');
    
    let completedCount = 0;
    let totalCount = 0;
    let errorLogs = GM_getValue('errorLogs', []);
    let settingsClickCount = 0;
    let settingsClickTimer = null;
    let isMinimized = true;

    let countdownTime = GM_getValue('countdownTime', 3);
    let fastMode = GM_getValue('fastMode', false);

    const COLORS = {
        blue: '#007AFF',
        blueLight: '#E8F1FF',
        blueDark: '#0056CC',
        text: '#1C1C1E',
        textSecondary: '#8E8E93',
        textTertiary: '#C7C7CC',
        bg: '#F2F2F7',
        white: 'rgba(255,255,255,0.75)',
        border: 'rgba(0,0,0,0.05)',
        green: '#34C759',
        red: '#FF3B30',
    };

    GM_addStyle(`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap');

        .ae-apple-blur {
            background: ${COLORS.white};
            backdrop-filter: saturate(200%) blur(30px);
            -webkit-backdrop-filter: saturate(200%) blur(30px);
            border: 0.5px solid ${COLORS.border};
        }

        .ae-no-scrollbar::-webkit-scrollbar { display: none; }

        .ae-progress-transition { transition: width 0.6s cubic-bezier(0.33, 1, 0.68, 1); }

        .ae-active-pulse { animation: aePulse 2s infinite; }
        @keyframes aePulse {
            0% { box-shadow: 0 0 0 0 rgba(0,122,255,0.25); }
            70% { box-shadow: 0 0 0 14px rgba(0,122,255,0); }
            100% { box-shadow: 0 0 0 0 rgba(0,122,255,0); }
        }

        @keyframes aeFadeIn {
            from { opacity: 0; transform: scale(0.94) translateY(8px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes aeFadeOut {
            from { opacity: 1; transform: scale(1) translateY(0); }
            to { opacity: 0; transform: scale(0.94) translateY(8px); }
        }
        @keyframes aeSlideUp {
            from { opacity: 0; transform: translateY(12px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @keyframes aeSlideRight {
            from { opacity: 0; transform: translateX(16px); }
            to { opacity: 1; transform: translateX(0); }
        }

        /* ===== 悬浮球 ===== */
        #ae-ball {
            position: fixed;
            bottom: 32px;
            right: 32px;
            z-index: 99999;
            cursor: pointer;
            transition: transform 0.35s cubic-bezier(0.33, 1, 0.68, 1);
            -webkit-user-select: none;
            user-select: none;
        }
        #ae-ball:hover { transform: scale(1.06); }
        #ae-ball:active { transform: scale(0.94); }

        #ae-ball-inner {
            width: 60px;
            height: 60px;
            border-radius: 50%;
            background: ${COLORS.blue};
            box-shadow: 0 6px 24px rgba(0,122,255,0.35), 0 2px 6px rgba(0,122,255,0.2);
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            position: relative;
            transition: box-shadow 0.3s ease;
        }
        #ae-ball:hover #ae-ball-inner {
            box-shadow: 0 8px 32px rgba(0,122,255,0.45), 0 2px 8px rgba(0,122,255,0.25);
        }

        #ae-ball-icon {
            font-size: 16px;
            line-height: 1;
            margin-bottom: 1px;
            filter: drop-shadow(0 1px 2px rgba(0,0,0,0.1));
        }
        #ae-ball-text {
            font-size: 10px;
            font-weight: 700;
            color: #fff;
            letter-spacing: 0.3px;
            line-height: 1;
        }

        #ae-ball-ring {
            position: absolute;
            top: -3px;
            left: -3px;
            width: 66px;
            height: 66px;
            transform: rotate(-90deg);
        }
        #ae-ball-ring-bg {
            fill: none;
            stroke: rgba(255,255,255,0.2);
            stroke-width: 3;
        }
        #ae-ball-ring-fill {
            fill: none;
            stroke: #fff;
            stroke-width: 3;
            stroke-linecap: round;
            stroke-dasharray: 197.92;
            stroke-dashoffset: 197.92;
            transition: stroke-dashoffset 0.6s cubic-bezier(0.33, 1, 0.68, 1);
            filter: drop-shadow(0 0 4px rgba(255,255,255,0.4));
        }

        /* ===== 主面板 ===== */
        #ae-panel {
            position: fixed;
            bottom: 32px;
            right: 32px;
            z-index: 99999;
            width: 320px;
            background: ${COLORS.white};
            backdrop-filter: saturate(200%) blur(30px);
            -webkit-backdrop-filter: saturate(200%) blur(30px);
            border: 0.5px solid ${COLORS.border};
            border-radius: 2rem;
            box-shadow: 0 20px 50px rgba(0,0,0,0.1), 0 0 0 0.5px rgba(0,0,0,0.03);
            overflow: hidden;
            transition: opacity 0.35s cubic-bezier(0.33, 1, 0.68, 1), transform 0.35s cubic-bezier(0.33, 1, 0.68, 1);
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            -webkit-user-select: none;
            user-select: none;
            will-change: transform;
        }
        #ae-panel.ae-hidden {
            opacity: 0;
            transform: scale(0.92) translateY(12px);
            pointer-events: none;
        }
        #ae-panel.ae-dragging {
            transition: opacity 0.35s cubic-bezier(0.33, 1, 0.68, 1);
        }

        /* ===== 面板头部 ===== */
        #ae-header {
            padding: 24px 28px 12px 28px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            cursor: move;
        }
        #ae-header-left {
            display: flex;
            flex-direction: column;
            gap: 2px;
        }
        #ae-header-suptitle {
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.15em;
            color: ${COLORS.blue};
            text-transform: uppercase;
        }
        #ae-header-title {
            font-size: 22px;
            font-weight: 600;
            color: ${COLORS.text};
            line-height: 1.2;
        }
        #ae-header-actions {
            display: flex;
            gap: 6px;
            flex-shrink: 0;
        }
        .ae-header-btn {
            width: 36px;
            height: 36px;
            border-radius: 50%;
            background: rgba(142,142,147,0.08);
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
            color: ${COLORS.textSecondary};
            padding: 0;
        }
        .ae-header-btn:hover {
            background: rgba(142,142,147,0.15);
            color: ${COLORS.text};
        }
        .ae-header-btn:active {
            transform: scale(0.88);
        }
        .ae-header-btn svg {
            width: 18px;
            height: 18px;
        }

        /* ===== 状态卡片 ===== */
        #ae-status-card {
            margin: 8px 20px 4px 20px;
            background: rgba(255,255,255,0.5);
            border-radius: 1.6rem;
            padding: 18px 20px;
            border: 0.5px solid rgba(255,255,255,0.6);
            box-shadow: 0 1px 4px rgba(0,0,0,0.02);
        }
        #ae-status-card-top {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-bottom: 10px;
        }
        #ae-status-label {
            font-size: 11px;
            font-weight: 500;
            color: ${COLORS.textSecondary};
        }
        #ae-status-percent {
            font-size: 26px;
            font-weight: 300;
            color: ${COLORS.text};
            line-height: 1;
        }
        #ae-status-percent span {
            font-size: 13px;
            margin-left: 1px;
            font-weight: 400;
        }
        #ae-progress-track {
            height: 5px;
            width: 100%;
            background: rgba(142,142,147,0.15);
            border-radius: 3px;
            overflow: hidden;
        }
        #ae-progress-fill {
            height: 100%;
            background: ${COLORS.blue};
            border-radius: 3px;
            width: 0%;
            box-shadow: 0 0 10px rgba(0,122,255,0.4);
            transition: width 0.6s cubic-bezier(0.33, 1, 0.68, 1);
        }
        #ae-status-current {
            margin-top: 10px;
            display: flex;
            align-items: center;
            gap: 7px;
        }
        #ae-status-dot {
            width: 7px;
            height: 7px;
            border-radius: 50%;
            background: ${COLORS.green};
            flex-shrink: 0;
        }
        #ae-status-dot.idle {
            background: ${COLORS.textTertiary};
        }
        #ae-status-dot.error {
            background: ${COLORS.red};
        }
        #ae-status-dot.working {
            animation: aePulse 1.5s infinite;
        }
        #ae-status-msg {
            font-size: 11px;
            font-weight: 500;
            color: ${COLORS.textSecondary};
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        /* ===== 主体内容 ===== */
        #ae-body {
            padding: 12px 24px 20px 24px;
        }
        .ae-body-section {
            margin-bottom: 16px;
        }
        .ae-body-section:last-child {
            margin-bottom: 0;
        }

        /* 开关行 */
        .ae-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
        }
        .ae-row-left {
            display: flex;
            flex-direction: column;
            gap: 1px;
        }
        .ae-row-label {
            font-size: 14px;
            font-weight: 500;
            color: ${COLORS.text};
        }
        .ae-row-hint {
            font-size: 10px;
            color: ${COLORS.textSecondary};
        }

        .ae-toggle {
            position: relative;
            display: inline-block;
            width: 44px;
            height: 24px;
            flex-shrink: 0;
        }
        .ae-toggle input {
            opacity: 0;
            width: 0;
            height: 0;
        }
        .ae-toggle-track {
            position: absolute;
            inset: 0;
            background: #e9e9ea;
            border-radius: 12px;
            transition: background 0.25s ease;
            cursor: pointer;
        }
        .ae-toggle-track::after {
            content: '';
            position: absolute;
            top: 2px;
            left: 2px;
            width: 20px;
            height: 20px;
            background: #fff;
            border-radius: 50%;
            transition: transform 0.25s cubic-bezier(0.33, 1, 0.68, 1);
            box-shadow: 0 1px 3px rgba(0,0,0,0.15);
        }
        .ae-toggle input:checked + .ae-toggle-track {
            background: ${COLORS.blue};
        }
        .ae-toggle input:checked + .ae-toggle-track::after {
            transform: translateX(20px);
        }

        /* 按钮行 */
        .ae-btn-row {
            display: flex;
            gap: 10px;
        }
        .ae-btn {
            flex: 1;
            height: 52px;
            border: none;
            border-radius: 14px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s cubic-bezier(0.33, 1, 0.68, 1);
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            padding: 0 16px;
        }
        .ae-btn:active {
            transform: scale(0.96);
        }
        .ae-btn-primary {
            background: ${COLORS.text};
            color: #fff;
            box-shadow: 0 4px 14px rgba(0,0,0,0.12);
        }
        .ae-btn-primary:hover {
            background: #000;
            box-shadow: 0 6px 20px rgba(0,0,0,0.16);
        }
        .ae-btn-primary:disabled {
            background: #d1d1d6;
            box-shadow: none;
            cursor: not-allowed;
            transform: none;
        }
        .ae-btn-secondary {
            background: ${COLORS.blueLight};
            color: ${COLORS.blue};
        }
        .ae-btn-secondary:hover {
            background: #d6e8ff;
        }
        .ae-btn-secondary:disabled {
            background: #f2f2f7;
            color: #c7c7cc;
            cursor: not-allowed;
            transform: none;
        }
        .ae-btn-danger {
            background: rgba(255,59,48,0.1);
            color: ${COLORS.red};
        }
        .ae-btn-danger:hover {
            background: rgba(255,59,48,0.15);
        }

        /* 倒计时 */
        #ae-countdown {
            display: none;
            align-items: center;
            justify-content: space-between;
            padding: 10px 14px;
            background: ${COLORS.blueLight};
            border-radius: 12px;
            animation: aeSlideUp 0.25s ease;
        }
        #ae-countdown-text {
            font-size: 13px;
            font-weight: 600;
            color: ${COLORS.blueDark};
        }
        #ae-countdown-cancel {
            font-size: 12px;
            font-weight: 500;
            color: ${COLORS.blue};
            background: none;
            border: none;
            cursor: pointer;
            padding: 4px 10px;
            border-radius: 8px;
            transition: background 0.2s ease;
        }
        #ae-countdown-cancel:hover {
            background: rgba(0,122,255,0.1);
        }

        /* ===== 底部日志区域 ===== */
        #ae-footer {
            padding: 12px 24px 18px 24px;
            background: rgba(142,142,147,0.04);
            border-top: 0.5px solid rgba(0,0,0,0.04);
        }
        #ae-footer-top {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        #ae-footer-label {
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.12em;
            color: ${COLORS.textTertiary};
            text-transform: uppercase;
        }
        #ae-footer-detail {
            font-size: 10px;
            font-weight: 600;
            color: ${COLORS.blue};
            cursor: pointer;
            background: none;
            border: none;
            padding: 2px 4px;
            transition: opacity 0.2s ease;
        }
        #ae-footer-detail:hover {
            opacity: 0.7;
        }

        /* ===== 设置弹窗 ===== */
        #ae-overlay {
            position: fixed;
            inset: 0;
            background: rgba(0,0,0,0.3);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            z-index: 100000;
            display: none;
            align-items: center;
            justify-content: center;
            animation: aeFadeIn 0.3s ease;
        }
        #ae-overlay.ae-show {
            display: flex;
        }
        #ae-overlay.ae-hiding {
            animation: aeFadeOut 0.2s ease forwards;
        }

        #ae-modal {
            width: 380px;
            max-height: 85vh;
            background: #fff;
            border-radius: 1.8rem;
            box-shadow: 0 20px 60px rgba(0,0,0,0.2);
            overflow: hidden;
            display: flex;
            flex-direction: column;
            animation: aeFadeIn 0.35s ease;
        }
        #ae-modal.ae-hiding {
            animation: aeFadeOut 0.2s ease forwards;
        }
        #ae-modal-header {
            padding: 20px 22px 14px 22px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        #ae-modal-title {
            font-size: 17px;
            font-weight: 600;
            color: ${COLORS.text};
        }
        #ae-modal-close {
            width: 30px;
            height: 30px;
            border-radius: 50%;
            background: rgba(142,142,147,0.1);
            border: none;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 18px;
            color: ${COLORS.textSecondary};
            transition: all 0.2s ease;
            padding: 0;
            line-height: 1;
        }
        #ae-modal-close:hover {
            background: rgba(142,142,147,0.2);
        }
        #ae-modal-body {
            padding: 4px 22px 16px 22px;
            overflow-y: auto;
            flex: 1;
        }
        #ae-modal-body::-webkit-scrollbar { width: 4px; }
        #ae-modal-body::-webkit-scrollbar-track { background: transparent; }
        #ae-modal-body::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 2px; }
        #ae-modal-footer {
            padding: 12px 22px 18px 22px;
            border-top: 0.5px solid rgba(0,0,0,0.06);
            display: flex;
            gap: 10px;
            justify-content: flex-end;
        }
        #ae-modal-footer .ae-btn {
            flex: none;
            min-width: 90px;
            height: 40px;
            font-size: 13px;
        }

        .ae-field-group {
            margin-bottom: 18px;
        }
        .ae-field-group:last-child {
            margin-bottom: 0;
        }
        .ae-field-label {
            display: block;
            font-size: 13px;
            font-weight: 600;
            color: ${COLORS.text};
            margin-bottom: 6px;
        }
        .ae-field-textarea {
            width: 100%;
            padding: 10px 12px;
            border: 1.5px solid #e5e5ea;
            border-radius: 12px;
            font-size: 13px;
            font-family: 'Inter', -apple-system, sans-serif;
            color: ${COLORS.text};
            background: #fafafa;
            resize: vertical;
            outline: none;
            transition: border-color 0.2s ease, box-shadow 0.2s ease;
            box-sizing: border-box;
        }
        .ae-field-textarea:focus {
            border-color: ${COLORS.blue};
            box-shadow: 0 0 0 3px rgba(0,122,255,0.12);
            background: #fff;
        }
        .ae-field-textarea::placeholder {
            color: ${COLORS.textTertiary};
        }

        .ae-slider-row {
            display: flex;
            align-items: center;
            gap: 14px;
        }
        .ae-slider-row input[type="range"] {
            flex: 1;
            -webkit-appearance: none;
            appearance: none;
            height: 4px;
            background: #e5e5ea;
            border-radius: 2px;
            outline: none;
        }
        .ae-slider-row input[type="range"]::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: #fff;
            border: 0.5px solid rgba(0,0,0,0.08);
            box-shadow: 0 2px 8px rgba(0,0,0,0.12);
            cursor: pointer;
            transition: box-shadow 0.2s ease;
        }
        .ae-slider-row input[type="range"]::-webkit-slider-thumb:hover {
            box-shadow: 0 2px 12px rgba(0,0,0,0.18);
        }
        .ae-slider-row input[type="range"]::-moz-range-thumb {
            width: 20px;
            height: 20px;
            border-radius: 50%;
            background: #fff;
            border: 0.5px solid rgba(0,0,0,0.08);
            box-shadow: 0 2px 8px rgba(0,0,0,0.12);
            cursor: pointer;
        }
        .ae-slider-value {
            font-size: 15px;
            font-weight: 600;
            color: ${COLORS.text};
            min-width: 32px;
            text-align: center;
        }
        .ae-slider-labels {
            display: flex;
            justify-content: space-between;
            font-size: 10px;
            color: ${COLORS.textTertiary};
            margin-top: 4px;
        }

        .ae-switch-field {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 8px 0;
        }
        .ae-switch-field-label {
            font-size: 14px;
            font-weight: 500;
            color: ${COLORS.text};
        }

        /* ===== Toast ===== */
        #ae-toast {
            position: fixed;
            bottom: 40px;
            left: 50%;
            transform: translateX(-50%) translateY(16px);
            padding: 10px 22px;
            background: rgba(0,0,0,0.78);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            color: #fff;
            font-size: 13px;
            font-weight: 500;
            font-family: 'Inter', -apple-system, sans-serif;
            border-radius: 999px;
            box-shadow: 0 8px 30px rgba(0,0,0,0.2);
            z-index: 100001;
            opacity: 0;
            transition: opacity 0.35s ease, transform 0.35s cubic-bezier(0.33, 1, 0.68, 1);
            pointer-events: none;
            white-space: nowrap;
        }
        #ae-toast.ae-show {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
        }

        /* ===== 庆祝动画 ===== */
        #ae-celebration {
            position: fixed;
            inset: 0;
            z-index: 1000000;
            pointer-events: none;
            overflow: hidden;
        }
        #ae-celebration-bg {
            position: absolute;
            inset: 0;
            background: radial-gradient(ellipse at center, rgba(0,122,255,0.08) 0%, transparent 60%);
            animation: aeBgPulse 3s ease-in-out infinite;
        }
        @keyframes aeBgPulse {
            0%, 100% { opacity: 0.5; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.08); }
        }
        #ae-celebration-content {
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            text-align: center;
            z-index: 2;
            padding: 40px 60px;
        }
        #ae-celebration-icon {
            font-size: 72px;
            line-height: 1;
            margin-bottom: 20px;
            animation: aeIconBounce 2s ease-in-out infinite;
            filter: drop-shadow(0 8px 24px rgba(0,122,255,0.3));
        }
        @keyframes aeIconBounce {
            0%, 100% { transform: translateY(0) scale(1); }
            50% { transform: translateY(-8px) scale(1.05); }
        }
        #ae-celebration-title {
            font-size: 48px;
            font-weight: 800;
            letter-spacing: 2px;
            color: ${COLORS.text};
            margin-bottom: 6px;
        }
        #ae-celebration-title .ae-char {
            display: inline-block;
            opacity: 0;
            animation: aeCharReveal 0.5s ease-out forwards;
        }
        @keyframes aeCharReveal {
            0% { opacity: 0; transform: translateY(16px) scale(0.9); }
            100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        #ae-celebration-sub {
            font-size: 14px;
            font-weight: 500;
            color: ${COLORS.textSecondary};
            letter-spacing: 4px;
            text-transform: uppercase;
            margin-bottom: 28px;
            opacity: 0;
            animation: aeSlideUp 0.6s ease 1s forwards;
        }
        #ae-celebration-stats {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 40px;
            opacity: 0;
            animation: aeSlideUp 0.6s ease 1.3s forwards;
        }
        .ae-cele-stat-val {
            font-size: 36px;
            font-weight: 700;
            color: ${COLORS.blue};
            line-height: 1;
        }
        .ae-cele-stat-lbl {
            font-size: 11px;
            color: ${COLORS.textSecondary};
            font-weight: 500;
            letter-spacing: 1px;
            margin-top: 4px;
        }
        .ae-cele-stat-div {
            width: 1px;
            height: 36px;
            background: rgba(0,0,0,0.08);
        }
        #ae-celebration-canvas {
            position: absolute;
            inset: 0;
            z-index: 1;
        }

        /* ===== 阻止页面原有滚动干扰 ===== */
        .ae-log-content {
            max-height: 280px;
            overflow-y: auto;
        }
        .ae-log-content::-webkit-scrollbar { width: 4px; }
        .ae-log-content::-webkit-scrollbar-track { background: transparent; }
        .ae-log-content::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 2px; }

        .ae-log-empty {
            text-align: center;
            padding: 30px 0;
            color: ${COLORS.textTertiary};
            font-size: 13px;
        }
        .ae-log-item {
            background: #f8f8fa;
            border-radius: 10px;
            padding: 10px 12px;
            margin-bottom: 8px;
            border: 0.5px solid rgba(0,0,0,0.04);
        }
        .ae-log-time {
            font-size: 10px;
            color: ${COLORS.textTertiary};
            margin-bottom: 2px;
        }
        .ae-log-msg {
            font-size: 12px;
            font-weight: 500;
            color: ${COLORS.text};
            margin-bottom: 4px;
            line-height: 1.4;
            word-break: break-word;
        }
        .ae-log-url {
            font-size: 10px;
            color: ${COLORS.textSecondary};
            word-break: break-all;
            font-family: 'SF Mono', monospace;
        }

        .ae-from-btn {
            width: 100%;
            height: 44px;
            border: none;
            border-radius: 12px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            margin-bottom: 10px;
        }
        .ae-from-btn:active { transform: scale(0.97); }

        /* ===== 推广引流 ===== */
        .ae-promo {
            padding: 10px 24px 4px 24px;
            text-align: center;
        }
        .ae-promo-btn {
            font-size: 11px;
            font-weight: 600;
            color: ${COLORS.blue};
            cursor: pointer;
            background: none;
            border: none;
            padding: 6px 14px;
            border-radius: 8px;
            transition: all 0.25s ease;
            letter-spacing: 0.3px;
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }
        .ae-promo-btn:hover {
            background: ${COLORS.blueLight};
        }
        .ae-promo-btn:active { transform: scale(0.95); }
    `);

    function showToast(msg) {
        let el = document.getElementById('ae-toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'ae-toast';
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.classList.add('ae-show');
        clearTimeout(el._hide);
        el._hide = setTimeout(() => el.classList.remove('ae-show'), 2200);
    }

    function showCelebration() {
        const wrap = document.createElement('div');
        wrap.id = 'ae-celebration';
        wrap.innerHTML = `
            <div id="ae-celebration-bg"></div>
            <canvas id="ae-celebration-canvas"></canvas>
            <div id="ae-celebration-content">
                <div id="ae-celebration-icon">🎯</div>
                <div id="ae-celebration-title">
                    ${'评教完成'.split('').map((c,i) => `<span class="ae-char" style="animation-delay:${i*0.12}s">${c}</span>`).join('')}
                </div>
                <div id="ae-celebration-sub">All Done</div>
                <div id="ae-celebration-stats">
                    <div><div class="ae-cele-stat-val">${completedCount}</div><div class="ae-cele-stat-lbl">已评教</div></div>
                    <div class="ae-cele-stat-div"></div>
                    <div><div class="ae-cele-stat-val">100%</div><div class="ae-cele-stat-lbl">完成度</div></div>
                </div>
            </div>
        `;
        document.body.appendChild(wrap);

        const canvas = wrap.querySelector('#ae-celebration-canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const colors = ['#007AFF', '#34C759', '#FF9500', '#FF3B30', '#AF52DE', '#5856D6', '#FF2D55', '#5AC8FA'];
        const particles = [];
        for (let i = 0; i < 180; i++) {
            particles.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height - canvas.height,
                s: Math.random() * 10 + 3,
                c: colors[Math.floor(Math.random() * colors.length)],
                vy: Math.random() * 3.5 + 1.8,
                vx: Math.random() * 2.5 - 1.25,
                r: Math.random() * 360,
                rs: Math.random() * 10 - 5,
                o: Math.random() * 0.4 + 0.4
            });
        }

        let frame;
        function draw() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            particles.forEach(p => {
                p.y += p.vy;
                p.x += p.vx + Math.sin(p.y * 0.008) * 0.4;
                p.r += p.rs;
                if (p.y > canvas.height) { p.y = -12; p.x = Math.random() * canvas.width; }
                ctx.save();
                ctx.globalAlpha = p.o;
                ctx.translate(p.x, p.y);
                ctx.rotate(p.r * Math.PI / 180);
                ctx.fillStyle = p.c;
                if (p.s > 7) {
                    ctx.beginPath();
                    ctx.moveTo(0, -p.s/2);
                    ctx.lineTo(p.s/2, 0);
                    ctx.lineTo(0, p.s/2);
                    ctx.lineTo(-p.s/2, 0);
                    ctx.closePath();
                    ctx.fill();
                } else {
                    ctx.fillRect(-p.s/2, -p.s/2, p.s, p.s * 0.6);
                }
                ctx.restore();
            });
            frame = requestAnimationFrame(draw);
        }
        draw();

        setTimeout(() => {
            cancelAnimationFrame(frame);
            wrap.remove();
        }, 5000);
    }

    function createControlPanel() {
        const root = document.createElement('div');
        root.id = 'ae-root';
        root.innerHTML = `
            <div id="ae-ball">
                <svg id="ae-ball-ring" viewBox="0 0 66 66">
                    <circle id="ae-ball-ring-bg" cx="33" cy="33" r="31.5"/>
                    <circle id="ae-ball-ring-fill" cx="33" cy="33" r="31.5"/>
                </svg>
                <div id="ae-ball-inner">
                    <span id="ae-ball-icon">📋</span>
                    <span id="ae-ball-text">0/0</span>
                </div>
            </div>

            <div id="ae-panel" class="ae-hidden">
                <div id="ae-header">
                    <div id="ae-header-left">
                        <span id="ae-header-suptitle">Automated System</span>
                        <h1 id="ae-header-title">评教控制台</h1>
                    </div>
                    <div id="ae-header-actions">
                        <button class="ae-header-btn" id="ae-btn-minimize" title="最小化">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4"/></svg>
                        </button>
                        <button class="ae-header-btn" id="ae-btn-settings" title="设置">
                            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                        </button>
                    </div>
                </div>

                <div id="ae-status-card">
                    <div id="ae-status-card-top">
                        <span id="ae-status-label">总体进度</span>
                        <div id="ae-status-percent">0<span>%</span></div>
                    </div>
                    <div id="ae-progress-track">
                        <div id="ae-progress-fill" style="width:0%"></div>
                    </div>
                    <div id="ae-status-current">
                        <span id="ae-status-dot" class="idle"></span>
                        <span id="ae-status-msg">就绪</span>
                    </div>
                </div>

                <div id="ae-body">
                    <div class="ae-body-section">
                        <div class="ae-row">
                            <div class="ae-row-left">
                                <span class="ae-row-label">自动提交</span>
                                <span class="ae-row-hint">完成后自动跳转下一位</span>
                            </div>
                            <label class="ae-toggle">
                                <input type="checkbox" id="ae-toggle-auto">
                                <span class="ae-toggle-track"></span>
                            </label>
                        </div>
                    </div>

                    <div class="ae-body-section">
                        <div class="ae-btn-row">
                            <button class="ae-btn ae-btn-primary" id="ae-btn-start">
                                <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                开始评教
                            </button>
                            <button class="ae-btn ae-btn-secondary" id="ae-btn-stop" disabled>
                                <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                停止
                            </button>
                        </div>
                    </div>

                    <div class="ae-body-section" id="ae-countdown">
                        <span id="ae-countdown-text">提交倒计时: 3秒</span>
                        <button id="ae-countdown-cancel">取消</button>
                    </div>
                </div>

                <div class="ae-promo">
                    <button class="ae-promo-btn" id="ae-promo-trigger">✨ 云端评教平台已上线 →</button>
                </div>

                <div id="ae-footer">
                    <div id="ae-footer-top">
                        <span id="ae-footer-label">系统日志</span>
                        <button id="ae-footer-detail">查看详情</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(root);

        /* ===== 事件绑定 ===== */
        const ball = document.getElementById('ae-ball');
        const panel = document.getElementById('ae-panel');
        const toggle = document.getElementById('ae-toggle-auto');
        const btnStart = document.getElementById('ae-btn-start');
        const btnStop = document.getElementById('ae-btn-stop');

        function showPanel() {
            panel.classList.remove('ae-hidden');
            ball.style.display = 'none';
            isMinimized = false;
        }
        function hidePanel() {
            panel.classList.add('ae-hidden');
            ball.style.display = 'block';
            isMinimized = true;
        }

        ball.addEventListener('click', showPanel);

        document.getElementById('ae-btn-minimize').addEventListener('click', hidePanel);

        document.getElementById('ae-btn-settings').addEventListener('click', function() {
            settingsClickCount++;
            if (settingsClickCount === 1) {
                settingsClickTimer = setTimeout(() => {
                    settingsClickCount = 0;
                    openSettingsPopup();
                }, 300);
            } else if (settingsClickCount === 2) {
                clearTimeout(settingsClickTimer);
                settingsClickCount = 0;
                openTestBackdoor();
            }
        });

        document.getElementById('ae-footer-detail').addEventListener('click', openLogPopup);

        document.getElementById('ae-promo-trigger').addEventListener('click', function() {
            window.open('http://b.xxiaomai.cn', '_blank');
        });

        toggle.addEventListener('change', function() {
            if (isProcessing) {
                this.checked = !this.checked;
                showToast('评教运行中，请先停止');
                return;
            }
            autoSubmit = this.checked;
            appendLog(autoSubmit ? '自动提交已开启' : '自动提交已关闭');
            updateUIStatus();
        });

        btnStart.addEventListener('click', startEvaluation);
        btnStop.addEventListener('click', stopEvaluation);

        makeDraggable(panel);
    }

    function makeDraggable(el) {
        const header = document.getElementById('ae-header');
        let isDragging = false;
        let hasMoved = false;
        let startX, startY, origX = 0, origY = 0;

        function getTransform() {
            const m = el.style.transform;
            if (!m || m === 'none') return { x: 0, y: 0 };
            const match = m.match(/translate\(([-\d.]+)px,\s*([-\d.]+)px\)/);
            return match ? { x: parseFloat(match[1]), y: parseFloat(match[2]) } : { x: 0, y: 0 };
        }

        header.addEventListener('mousedown', e => {
            if (e.target.closest('.ae-header-btn')) return;
            hasMoved = false;
            const t = getTransform();
            origX = t.x; origY = t.y;
            startX = e.clientX;
            startY = e.clientY;
            isDragging = true;
            el.classList.add('ae-dragging');
        });

        document.addEventListener('mousemove', e => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved = true;
            el.style.transform = `translate(${origX + dx}px, ${origY + dy}px)`;
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                el.classList.remove('ae-dragging');
            }
            isDragging = false;
        });
    }

    function appendLog(msg) {
        console.log(`[评教] ${msg}`);
    }

    function updateUIStatus(msg) {
        const dot = document.getElementById('ae-status-dot');
        const label = document.getElementById('ae-status-msg');
        if (!dot || !label) return;
        if (msg) {
            label.textContent = msg;
            if (msg.includes('完成') || msg.includes('就绪')) {
                dot.className = '';
                dot.classList.add('idle');
            } else if (msg.includes('错误') || msg.includes('失败') || msg.includes('⚠️')) {
                dot.className = '';
                dot.classList.add('error');
            } else {
                dot.className = '';
                dot.classList.add('working');
            }
        }
        updateProgress();
    }

    function updateProgress() {
        const fill = document.getElementById('ae-progress-fill');
        const pct = document.getElementById('ae-status-percent');
        const ballText = document.getElementById('ae-ball-text');
        const ringFill = document.getElementById('ae-ball-ring-fill');

        const percent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

        if (fill) fill.style.width = `${percent}%`;
        if (pct) pct.innerHTML = `${percent}<span>%</span>`;
        if (ballText) ballText.textContent = `${completedCount}/${totalCount}`;

        if (ringFill) {
            const circ = 197.92;
            ringFill.style.strokeDashoffset = circ - (percent / 100) * circ;
        }

        const btnStart = document.getElementById('ae-btn-start');
        if (percent === 100 && totalCount > 0 && btnStart && !btnStart.disabled) {
            // all done, but don't auto-trigger
        }
    }

    /* ===== 设置弹窗 ===== */
    function openSettingsPopup() {
        const existing = document.getElementById('ae-overlay');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'ae-overlay';
        overlay.className = 'ae-show';
        overlay.innerHTML = `
            <div id="ae-modal">
                <div id="ae-modal-header">
                    <span id="ae-modal-title">评教设置</span>
                    <button id="ae-modal-close">✕</button>
                </div>
                <div id="ae-modal-body">
                    <div class="ae-field-group">
                        <label class="ae-field-label">Q14 改进建议</label>
                        <textarea class="ae-field-textarea" id="ae-f-q14" rows="3" placeholder="请输入Q14的改进建议">${q14Text}</textarea>
                    </div>
                    <div class="ae-field-group">
                        <label class="ae-field-label">Q15 优点评价</label>
                        <textarea class="ae-field-textarea" id="ae-f-q15" rows="3" placeholder="请输入Q15的优点评价">${q15Text}</textarea>
                    </div>
                    <div class="ae-field-group">
                        <label class="ae-field-label" id="ae-speed-label">评教速度调节（${countdownTime}秒）</label>
                        <div class="ae-slider-row">
                            <input type="range" id="ae-f-speed" min="1" max="10" value="${countdownTime}">
                            <span class="ae-slider-value" id="ae-speed-val">${countdownTime}</span>
                        </div>
                        <div class="ae-slider-labels"><span>1秒</span><span>10秒</span></div>
                    </div>
                    <div class="ae-field-group">
                        <div class="ae-switch-field">
                            <span class="ae-switch-field-label">快速模式（跳过倒计时）</span>
                            <label class="ae-toggle">
                                <input type="checkbox" id="ae-f-fast" ${fastMode ? 'checked' : ''}>
                                <span class="ae-toggle-track"></span>
                            </label>
                        </div>
                    </div>
                </div>
                <div id="ae-modal-footer">
                    <button class="ae-btn ae-btn-danger" id="ae-f-reset">恢复默认</button>
                    <button class="ae-btn ae-btn-primary" id="ae-f-save" style="background:${COLORS.blue};color:#fff">保存设置</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const close = () => { overlay.remove(); };

        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
        document.getElementById('ae-modal-close').addEventListener('click', close);

        const speedInput = document.getElementById('ae-f-speed');
        const speedVal = document.getElementById('ae-speed-val');
        const speedLabel = document.getElementById('ae-speed-label');
        speedInput.addEventListener('input', function() {
            speedVal.textContent = this.value;
            speedLabel.textContent = `评教速度调节（${this.value}秒）`;
        });

        document.getElementById('ae-f-save').addEventListener('click', function() {
            q14Text = document.getElementById('ae-f-q14').value.trim();
            q15Text = document.getElementById('ae-f-q15').value.trim();
            countdownTime = parseInt(document.getElementById('ae-f-speed').value);
            fastMode = document.getElementById('ae-f-fast').checked;

            GM_setValue('q14Text', q14Text);
            GM_setValue('q15Text', q15Text);
            GM_setValue('countdownTime', countdownTime);
            GM_setValue('fastMode', fastMode);

            showToast('设置已保存');
            appendLog('设置已更新');
            close();
            setTimeout(() => updateUIStatus('就绪'), 2000);
        });

        document.getElementById('ae-f-reset').addEventListener('click', function() {
            q14Text = '无';
            q15Text = '老师教学认真负责，课程内容充实，讲解清晰易懂。';
            countdownTime = 3;
            fastMode = false;

            document.getElementById('ae-f-q14').value = q14Text;
            document.getElementById('ae-f-q15').value = q15Text;
            document.getElementById('ae-f-speed').value = countdownTime;
            document.getElementById('ae-f-fast').checked = false;
            speedVal.textContent = countdownTime;
            speedLabel.textContent = `评教速度调节（${countdownTime}秒）`;

            GM_setValue('q14Text', q14Text);
            GM_setValue('q15Text', q15Text);
            GM_setValue('countdownTime', countdownTime);
            GM_setValue('fastMode', fastMode);

            showToast('已恢复默认设置');
            appendLog('设置已重置为默认');
        });
    }

    /* ===== 测试后门 ===== */
    function openTestBackdoor() {
        const overlay = document.createElement('div');
        overlay.id = 'ae-overlay';
        overlay.className = 'ae-show';
        overlay.innerHTML = `
            <div id="ae-modal" style="max-width:360px">
                <div id="ae-modal-header">
                    <span id="ae-modal-title">🔧 测试后门</span>
                    <button id="ae-modal-close">✕</button>
                </div>
                <div id="ae-modal-body">
                    <p style="font-size:12px;color:#8E8E93;margin-bottom:16px;line-height:1.6">开发者调试工具 — 双击设置按钮进入</p>
                    <button class="ae-from-btn" style="background:${COLORS.blueLight};color:${COLORS.blue}" id="ae-test-notify">🔔 测试通知</button>
                    <button class="ae-from-btn" style="background:${COLORS.blueLight};color:${COLORS.blue}" id="ae-test-celeb">🎉 测试庆祝特效</button>
                    <button class="ae-from-btn" style="background:rgba(255,59,48,0.08);color:${COLORS.red}" id="ae-test-log">📋 查看错误日志</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
        overlay.querySelector('#ae-modal-close').addEventListener('click', () => overlay.remove());

        overlay.querySelector('#ae-test-notify').addEventListener('click', () => {
            showToast('通知功能正常工作 ✓');
            GM_notification({ title: '测试通知', text: '这是一个测试通知，通知功能正常工作！', timeout: 3000 });
        });
        overlay.querySelector('#ae-test-celeb').addEventListener('click', () => {
            overlay.remove();
            showCelebration();
        });
        overlay.querySelector('#ae-test-log').addEventListener('click', () => {
            overlay.remove();
            openLogPopup();
        });
    }

    /* ===== 日志弹窗 ===== */
    function openLogPopup() {
        const overlay = document.createElement('div');
        overlay.id = 'ae-overlay';
        overlay.className = 'ae-show';
        overlay.innerHTML = `
            <div id="ae-modal" style="max-width:400px">
                <div id="ae-modal-header">
                    <span id="ae-modal-title">错误日志</span>
                    <button id="ae-modal-close">✕</button>
                </div>
                <div id="ae-modal-body">
                    <div class="ae-log-content" id="ae-log-list">
                        ${errorLogs.length === 0 ? '<div class="ae-log-empty">暂无错误日志</div>' : ''}
                    </div>
                </div>
                <div id="ae-modal-footer">
                    <button class="ae-btn ae-btn-danger" id="ae-log-clear">清空日志</button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        const list = document.getElementById('ae-log-list');
        errorLogs.forEach(log => {
            const item = document.createElement('div');
            item.className = 'ae-log-item';
            item.innerHTML = `<div class="ae-log-time">${log.time}</div><div class="ae-log-msg">${log.message}</div><div class="ae-log-url">${log.url}</div>`;
            list.appendChild(item);
        });

        overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
        overlay.querySelector('#ae-modal-close').addEventListener('click', () => overlay.remove());
        overlay.querySelector('#ae-log-clear').addEventListener('click', function() {
            errorLogs = [];
            GM_setValue('errorLogs', errorLogs);
            list.innerHTML = '<div class="ae-log-empty">暂无错误日志</div>';
            showToast('日志已清空');
        });
    }

    /* ===== 功能函数（保持原逻辑不变） ===== */
    function isEvaluationPage() {
        return document.querySelector('footer.saveBtn') !== null;
    }

    function isListPage() {
        const url = window.location.href;
        return url.includes('/jwapp/sys/wspjyyapp/') && url.includes('#/xspj') && 
               (document.querySelector('.pj-card') !== null || 
                document.querySelector('img[src*="no_plan.png"]') !== null);
    }

    function fillEvaluationForm() {
        appendLog('正在填写评教表单...');

        const radioGroups = document.querySelectorAll('.bh-radio-group-h');
        radioGroups.forEach(group => {
            const firstRadio = group.querySelector('input[type="radio"]');
            if (firstRadio) {
                firstRadio.checked = true;
            }
        });

        const q14Container = document.querySelector('.textareaContainter[data-x-zbdm="cc325d778b824abcb8d8c97d08511766"]');
        if (q14Container) {
            const q14Textarea = q14Container.querySelector('textarea[name="YLCS"]');
            if (q14Textarea) {
                q14Textarea.value = q14Text;
            }
        }

        const q15Container = document.querySelector('.textareaContainter[data-x-zbdm="3c5353b039594a3eb0df69dab191bb6e"]');
        if (q15Container) {
            const q15Textarea = q15Container.querySelector('textarea[name="YLCS"]');
            if (q15Textarea) {
                q15Textarea.value = q15Text;
            }
        }

        appendLog('表单填写完成');
        return true;
    }

    function submitEvaluation() {
        const submitBtn = document.querySelector('footer.saveBtn a[data-action="提交"]');
        if (submitBtn) {
            submitBtn.click();
            return true;
        }
        return false;
    }

    function returnToList() {
        const backBtn = document.querySelector('.back-img');
        if (backBtn) {
            backBtn.click();
            return true;
        }
        return false;
    }

    function clickNextTeacher() {
        const firstEvalBtn = document.querySelector('.card-btn[data-action="gcpj立即评教"]');
        if (firstEvalBtn) {
            firstEvalBtn.click();
            return true;
        }
        return false;
    }

    function getPendingTeacherCount() {
        const noPlanImage = document.querySelector('img[src*="no_plan.png"]');
        if (noPlanImage) {
            return 0;
        }
        
        const cards = document.querySelectorAll('.pj-card');
        return cards.length;
    }

    function logError(message) {
        const errorLog = {
            time: new Date().toLocaleString(),
            message: message,
            url: window.location.href
        };
        
        errorLogs.push(errorLog);
        GM_setValue('errorLogs', errorLogs);
        
        GM_notification({
            title: '评教错误',
            text: message,
            timeout: 5000
        });
    }

    async function startEvaluation() {
        if (isProcessing) return;
        
        if (!isListPage()) {
            appendLog('⚠️ 请先前往待评教老师列表页面');
            updateUIStatus('⚠️ 请前往列表页面');
            showToast('请先前往待评教列表页面');
            return;
        }
        
        shouldStop = false;
        isProcessing = true;
        completedCount = 0;
        totalCount = 0;
        document.getElementById('ae-btn-start').disabled = true;
        document.getElementById('ae-btn-stop').disabled = false;

        try {
            if (isEvaluationPage()) {
                await processEvaluationPage();
            } else if (isListPage()) {
                await processListPage();
            } else {
                appendLog('当前页面不是评教页面或列表页面');
                stopEvaluation();
            }
        } catch (error) {
            appendLog(`错误: ${error.message}`);
            stopEvaluation();
        }
    }

    async function processEvaluationPage() {
        if (shouldStop) return;
        
        appendLog('正在处理评教页面...');
        
        try {
            fillEvaluationForm();
            
            if (autoSubmit) {
                await startCountdownAndSubmit();
            } else {
                updateUIStatus('表单已填写，请手动提交');
            }
        } catch (error) {
            logError(`评教页面处理失败: ${error.message}`);
            stopEvaluation();
        }
    }

    async function startCountdownAndSubmit() {
        if (fastMode) {
            appendLog('快速模式：直接提交...');
            submitWithConfirm();
            return;
        }

        return new Promise((resolve) => {
            const countdownRow = document.getElementById('ae-countdown');
            const countdownText = document.getElementById('ae-countdown-text');
            const cancelBtn = document.getElementById('ae-countdown-cancel');
            let seconds = countdownTime;
            shouldStop = false;

            countdownRow.style.display = 'flex';
            countdownText.textContent = `提交倒计时: ${seconds}秒`;

            countdownInterval = setInterval(() => {
                seconds--;
                countdownText.textContent = `提交倒计时: ${seconds}秒`;

                if (shouldStop) {
                    clearInterval(countdownInterval);
                    countdownRow.style.display = 'none';
                    appendLog('已取消提交');
                    stopEvaluation();
                    resolve();
                    return;
                }

                if (seconds <= 0) {
                    clearInterval(countdownInterval);
                    countdownRow.style.display = 'none';
                    submitWithConfirm();
                    resolve();
                }
            }, 1000);

            cancelBtn.onclick = function() {
                shouldStop = true;
            };
        });
    }

    async function submitWithConfirm() {
        appendLog('正在提交评教...');
        
        if (submitEvaluation()) {
            updateUIStatus('等待确认弹窗...');
            await waitForConfirmDialog();
        } else {
            logError('提交失败，无法找到提交按钮');
            appendLog('提交失败，请手动提交');
        }
    }

    async function waitForConfirmDialog() {
        return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 50;
            
            const checkInterval = setInterval(() => {
                if (shouldStop) {
                    clearInterval(checkInterval);
                    appendLog('已停止');
                    resolve();
                    return;
                }
                
                attempts++;
                
                if (attempts >= maxAttempts) {
                    clearInterval(checkInterval);
                    logError('等待确认弹窗超时');
                    stopEvaluation();
                    resolve();
                    return;
                }
                
                const confirmBtn = document.querySelector('.bh-dialog-btn.bh-bg-primary');
                if (confirmBtn && confirmBtn.textContent.trim() === '确认') {
                    clearInterval(checkInterval);
                    appendLog('点击确认按钮...');
                    confirmBtn.click();
                    
                    const timer1 = setTimeout(() => {
                        if (shouldStop) return;
                        appendLog('等待页面刷新...');
                        const timer2 = setTimeout(() => {
                            if (shouldStop) return;
                            if (isListPage()) {
                                appendLog('页面已刷新，继续下一位...');
                                completedCount++;
                                updateProgress();
                                const timer3 = setTimeout(() => {
                                    if (!shouldStop) processListPage();
                                }, 1000);
                                allTimers.push(timer3);
                            } else {
                                appendLog('等待中...');
                            }
                        }, 3000);
                        allTimers.push(timer2);
                    }, 500);
                    allTimers.push(timer1);
                }
            }, 200);
            allTimers.push(checkInterval);

            const timer = setTimeout(() => {
                clearInterval(checkInterval);
            }, 10000);
            allTimers.push(timer);
        });
    }

    async function processListPage() {
        if (shouldStop) return;
        
        const count = getPendingTeacherCount();
        
        if (totalCount === 0) {
            totalCount = count;
            updateProgress();
        }
        
        if (count === 0) {
            appendLog('所有评教已完成！');
            updateUIStatus('评教完成 🎉');
            showCelebration();
            GM_notification({ title: '评教完成', text: '所有老师评教已完成', timeout: 5000 });
            stopEvaluation();
            return;
        }

        appendLog(`发现 ${count} 位待评教老师，正在进入第一位...`);
        
        try {
            await sleep(1000);
            
            if (shouldStop) return;
            
            if (clickNextTeacher()) {
                await sleep(2000);
                
                if (shouldStop) return;
                
                if (isEvaluationPage()) {
                    await processEvaluationPage();
                } else {
                    logError('无法进入评教页面');
                    stopEvaluation();
                }
            } else {
                const noPlanImage = document.querySelector('img[src*="no_plan.png"]');
                if (noPlanImage) {
                    appendLog('所有评教已完成！');
                    updateUIStatus('评教完成 🎉');
                    showCelebration();
                    GM_notification({ title: '评教完成', text: '所有老师评教已完成', timeout: 5000 });
                    stopEvaluation();
                } else {
                    logError('无法点击进入评教页面');
                    appendLog('无法进入评教页面');
                    stopEvaluation();
                }
            }
        } catch (error) {
            logError(`列表页面处理失败: ${error.message}`);
            stopEvaluation();
        }
    }

    function stopEvaluation() {
        isProcessing = false;
        shouldStop = true;
        
        clearInterval(countdownInterval);
        countdownInterval = null;
        
        allTimers.forEach(timer => {
            clearTimeout(timer);
            clearInterval(timer);
        });
        allTimers = [];
        
        const countdownRow = document.getElementById('ae-countdown');
        if (countdownRow) countdownRow.style.display = 'none';
        
        const btnStart = document.getElementById('ae-btn-start');
        const btnStop = document.getElementById('ae-btn-stop');
        if (btnStart) btnStart.disabled = false;
        if (btnStop) btnStop.disabled = true;
        
        appendLog('已停止');
        updateUIStatus('已停止');
    }

    function sleep(ms) {
        return new Promise(resolve => {
            const timer = setTimeout(() => {
                allTimers = allTimers.filter(t => t !== timer);
                if (!shouldStop) resolve();
            }, ms);
            allTimers.push(timer);
        });
    }

    function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', createControlPanel);
        } else {
            createControlPanel();
        }

        if (isEvaluationPage()) {
            appendLog('检测到评教页面');
        } else if (isListPage()) {
            const count = getPendingTeacherCount();
            totalCount = count;
            updateProgress();
            appendLog(`检测到 ${count} 位待评教老师`);
            if (count > 0) updateUIStatus(`待评教: ${count} 位`);
            else updateUIStatus('所有评教已完成 ✓');
        } else {
            appendLog('⚠️ 请前往待评教列表页面');
            updateUIStatus('⚠️ 请前往列表页面');
        }
    }

    init();
})();
