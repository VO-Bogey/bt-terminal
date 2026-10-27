/**
 * 百变终端卡片 · SillyTavern 扩展
 *
 * 职责：
 * 1. 用扩展 CSS 接管卡片样式（不再依赖消息内 <style> 注入）
 * 2. 生成过程中隐藏未完成的卡片，显示「终端扫描中」，避免 details 吞正文
 * 3. 清理残留的 BT-CARD 注释标记
 *
 * 不负责：改世界书、改 prompt、编号自增（后续版本再加）。
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

    on('GENERATION_STARTED', () => setGenerating(true));
    on('GENERATION_ENDED', () => setGenerating(false));
    on('GENERATION_STOPPED', () => setGenerating(false));
    on('MESSAGE_RENDERED', onMessageRendered);
    on('MESSAGE_UPDATED', onMessageRendered);
    on('MESSAGE_SWIPED', onMessageRendered);
    on('CHAT_CHANGED', () => {
        setGenerating(false);
        document.querySelectorAll('.mes_text').forEach(cleanupComments);
    });

    document.querySelectorAll('.mes_text').forEach(cleanupComments);

    document.addEventListener('click', (event) => {
        const head = event.target?.closest?.('[data-bt="hd"]');
        if (!head) return;
        const card = head.closest('[data-bt="card"]');
        if (!card) return;
        card.classList.toggle('bt-collapsed');
    });

    console.log('[bt-terminal] 百变终端卡片已启用');
}

bind();
