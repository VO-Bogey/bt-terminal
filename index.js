/**
 * 百变终端卡片 · SillyTavern 扩展 v0.3
 *
 * 职责：
 * 1. 用扩展 CSS 接管卡片样式（不再依赖消息内 <style> 注入）
 * 2. 只有本次生成真的出现卡面标记时，才显示「终端扫描中」占位
 * 3. 历史楼层的卡片自动归档成一条，点击可展开；最新楼层完整显示
 * 4. 清理残留的 BT-CARD 注释标记
 *
 * 不负责：改世界书、改 prompt、MVU 变量读写（交给世界书 + MVU）。
 */

const PENDING_CLASS = 'bt-generating';

function getContext() {
    try {
        return window.SillyTavern?.getContext?.() ?? null;
    } catch (error) {
        console.warn('[bt-terminal] getContext failed', error);
        return null;
    }
}

function cleanupComments(root) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
    const found = [];
    while (walker.nextNode()) {
        const value = walker.currentNode.nodeValue || '';
        if (value.includes('BT-CARD')) found.push(walker.currentNode);
    }
    for (const node of found) node.remove();
}

function onMessageRendered(messageId) {
    const selector = (messageId === undefined || messageId === null)
        ? '.mes_text'
        : `.mes[mesid="${messageId}"] .mes_text`;
    document.querySelectorAll(selector).forEach(cleanupComments);
}

function setGenerating(on) {
    document.body.classList.toggle(PENDING_CLASS, Boolean(on));
}

function getLastMessageText() {
    const ctx = getContext();
    const chat = ctx?.chat;
    if (!Array.isArray(chat) || chat.length === 0) return '';
    const last = chat[chat.length - 1];
    return typeof last?.mes === 'string' ? last.mes : '';
}

function hasCardMarker(text) {
    return /<!--BT-CARD-->|<div\s+data-bt="card"/i.test(text || '');
}

function refreshGeneratingState() {
    setGenerating(hasCardMarker(getLastMessageText()));
}

function markArchived() {
    const mesList = Array.from(document.querySelectorAll('#chat .mes'));
    const last = mesList[mesList.length - 1];
    for (const mes of mesList) {
        const isLast = mes === last;
        for (const card of mes.querySelectorAll('[data-bt="card"]')) {
            if (isLast) {
                card.classList.remove('bt-archived', 'bt-archived-open');
            } else {
                card.classList.add('bt-archived');
                card.classList.remove('bt-archived-open');
            }
        }
    }
}

async function bind() {
    let eventSource = null;
    let eventTypes = null;

    const ctx = getContext();
    if (ctx?.eventSource && ctx?.eventTypes) {
        eventSource = ctx.eventSource;
        eventTypes = ctx.eventTypes;
    } else {
        try {
            const mod = await import('../../../../script.js');
            eventSource = mod.eventSource;
            eventTypes = mod.event_types;
        } catch (error) {
            console.warn('[bt-terminal] 无法获取 SillyTavern 事件系统，扩展未启用', error);
            return;
        }
    }

    if (!eventSource || !eventTypes) {
        console.warn('[bt-terminal] 事件系统为空，扩展未启用');
        return;
    }

    const on = (name, handler) => {
        const type = eventTypes[name];
        if (type) eventSource.on(type, handler);
    };

    on('GENERATION_STARTED', () => setGenerating(false));
    on('GENERATION_ENDED', () => {
        setGenerating(false);
        markArchived();
    });
    on('GENERATION_STOPPED', () => {
        setGenerating(false);
        markArchived();
    });
    on('MESSAGE_RENDERED', (messageId) => {
        onMessageRendered(messageId);
        markArchived();
    });
    on('MESSAGE_UPDATED', (messageId) => {
        onMessageRendered(messageId);
        refreshGeneratingState();
    });
    on('MESSAGE_SWIPED', () => {
        refreshGeneratingState();
        markArchived();
    });
    on('MESSAGE_RECEIVED', () => {
        refreshGeneratingState();
        markArchived();
    });
    on('STREAM_TOKEN_RECEIVED', refreshGeneratingState);
    on('CHAT_CHANGED', () => {
        setGenerating(false);
        document.querySelectorAll('.mes_text').forEach(cleanupComments);
        markArchived();
    });

    document.querySelectorAll('.mes_text').forEach(cleanupComments);
    markArchived();

    document.addEventListener('click', (event) => {
        const head = event.target?.closest?.('[data-bt="hd"]');
        if (!head) return;
        const card = head.closest('[data-bt="card"]');
        if (!card) return;
        if (card.classList.contains('bt-archived')) {
            card.classList.toggle('bt-archived-open');
        } else {
            card.classList.toggle('bt-collapsed');
        }
    });

    console.log('[bt-terminal] 百变终端卡片已启用');
}

bind();
