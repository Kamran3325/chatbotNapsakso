// public/main.js (Reaksiya funksiyası SİLİNMİŞ versiya)
document.addEventListener('DOMContentLoaded', () => {
    const username = localStorage.getItem('username');
    if (!username && window.location.pathname.includes('chat.html')) {
        window.location.href = '/index.html';
        return;
    }
    if (!username) return;

    const socket = io('https://seidnapsakso.onrender.com');

    const dom = {
        userList: document.getElementById('user-list'),
        messagesList: document.getElementById('messages-list'),
        messagesContainer: document.getElementById('messages-container'),
        form: document.getElementById('chat-form'),
        input: document.getElementById('message-input'),
        menuToggleBtn: document.getElementById('menu-toggle-btn'),
        sidebar: document.getElementById('sidebar'),
        fileUploadBtn: document.getElementById('file-upload-btn'),
        fileInput: document.getElementById('file-input'),
        replyPreview: document.getElementById('reply-preview'),
        replyUsername: document.getElementById('reply-username'),
        replyText: document.getElementById('reply-text'),
        cancelReplyBtn: document.getElementById('cancel-reply-btn'),
        typingIndicator: document.getElementById('typing-indicator'),
    };

    let state = {
        currentUserId: null,
        replyingTo: null,
        typingUsers: new Set(),
        typingTimeout: null,
        messages: [],
    };
    
    function renderUserList(users) {
        dom.userList.innerHTML = users.map(user => `
            <li class="flex items-center space-x-3 p-2 rounded-md hover:bg-gray-800 cursor-pointer">
                <img src="https://ui-avatars.com/api/?name=${user.name.replace(/ /g, "+")}&background=random&color=fff" class="w-8 h-8 rounded-full flex-shrink-0">
                <span class="truncate ${user.id === state.currentUserId ? 'text-blue-400 font-bold' : 'text-gray-300'}">${user.name}</span>
            </li>
        `).join('');
    }

    function renderMessage(msg) {
        if (!dom.messagesList) return;
        
        const isMyMessage = msg.user && msg.user.id === state.currentUserId;
        
        if (msg.type === 'system') {
            const li = document.createElement('li');
            li.className = 'text-center text-xs text-gray-500 my-3 py-1 bg-gray-800 rounded-full w-fit mx-auto px-3';
            li.textContent = msg.content;
            dom.messagesList.appendChild(li);
        } else {
            const prevMsg = state.messages.length > 0 ? state.messages[state.messages.length - 1] : null;
            const isGrouped = prevMsg && prevMsg.user && prevMsg.user.id === msg.user.id && (new Date(msg.timestamp) - new Date(prevMsg.timestamp)) < 60000;
            
            const li = document.createElement('li');
            li.dataset.id = msg.id;
            li.className = `message-slide-in group flex items-end gap-3 ${isMyMessage ? 'justify-end' : 'justify-start'} ${isGrouped ? 'mt-1' : 'mt-4'}`;
            
            const avatar = `<img src="https://ui-avatars.com/api/?name=${msg.user.name.replace(/ /g, "+")}&background=random&color=fff" class="w-8 h-8 rounded-full flex-shrink-0">`;
            const replyHTML = msg.replyTo ? `<div class="mb-2 p-2 bg-black/20 rounded-lg border-l-2 border-blue-400"><p class="text-xs font-bold text-blue-400">${msg.replyTo.user.name}</p><p class="text-sm text-gray-300 truncate">${msg.replyTo.type === 'image' ? 'Şəkil' : msg.replyTo.content}</p></div>` : '';
            const contentHTML = msg.type === 'image' ? `<img src="${msg.content}" class="max-w-xs md:max-w-md rounded-lg cursor-pointer" alt="yüklənmiş şəkil">` : `<p class="text-white break-words">${msg.content.replace(/\n/g, '<br>')}</p>`;
            
            // --- REAKSİYA DÜYMƏLƏRİ SİLİNDİ ---
            const actionsHTML = `<div class="absolute -top-4 ${isMyMessage ? 'left-0' : 'right-0'} hidden group-hover:flex items-center bg-gray-800 border border-gray-700 rounded-full shadow-lg">
                <button data-action="reply" class="p-2 hover:bg-gray-700 rounded-l-full">↩️</button>
                <button data-action="copy" class="p-2 hover:bg-gray-700 rounded-r-full">📋</button>
            </div>`;

            li.innerHTML = `
                ${!isMyMessage && !isGrouped ? avatar : `<div class="w-8 flex-shrink-0"></div>`}
                <div class="relative max-w-xs md:max-w-md">
                    ${!isGrouped ? `<p class="text-sm font-bold mb-1 ${isMyMessage ? 'text-right text-white' : 'text-left text-blue-400'}">${msg.user.name}</p>` : ''}
                    <div class="message-body p-3 rounded-2xl ${isMyMessage ? 'bg-gradient-to-br from-blue-500 to-purple-600 rounded-br-none' : 'bg-gray-700 rounded-bl-none'}">
                        ${replyHTML}
                        ${contentHTML}
                    </div>
                    <p class="text-xs text-gray-500 mt-1 ${isMyMessage ? 'text-right' : 'text-left'}">${new Date(msg.timestamp).toLocaleTimeString('az-AZ', {hour:'2-digit', minute:'2-digit'})}</p>
                </div>
                ${isMyMessage && !isGrouped ? avatar : `<div class="w-8 flex-shrink-0"></div>`}
                ${actionsHTML}
            `;
            dom.messagesList.appendChild(li);
        }
        dom.messagesContainer.scrollTop = dom.messagesContainer.scrollHeight;
    }
    
    function handleFormSubmit() {
        const content = dom.input.value.trim();
        if (content) {
            socket.emit('yeni-mesaj', { type: 'text', content, replyTo: state.replyingTo });
            dom.input.value = '';
            dom.input.style.height = 'auto';
            socket.emit('yazma_dayandi');
            cancelReply();
        }
    }
    
    function showReplyPreview() {
        dom.replyUsername.textContent = `${state.replyingTo.user.name}-ə cavab verilir`;
        dom.replyText.textContent = state.replyingTo.type === 'image' ? 'Şəkil' : state.replyingTo.content;
        dom.replyPreview.classList.remove('hidden');
        dom.replyPreview.classList.add('flex');
        dom.input.focus();
    }
    
    function cancelReply() {
        state.replyingTo = null;
        dom.replyPreview.classList.add('hidden');
        dom.replyPreview.classList.remove('flex');
    }

    function updateTypingIndicator() {
        if (state.typingUsers.size === 0) dom.typingIndicator.innerHTML = '';
        else {
            const names = Array.from(state.typingUsers).join(', ');
            dom.typingIndicator.innerHTML = `<div class="flex items-center gap-2 text-sm text-gray-400"><div class="typing-dot w-2 h-2 bg-gray-400 rounded-full"></div><div class="typing-dot w-2 h-2 bg-gray-400 rounded-full"></div><div class="typing-dot w-2 h-2 bg-gray-400 rounded-full"></div><span class="ml-1">${names} yazır...</span></div>`;
        }
    }
    
    // --- Hadisə Dinləyiciləri ---
    dom.form.addEventListener('submit', (e) => { e.preventDefault(); handleFormSubmit(); });
    dom.input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleFormSubmit(); } });
    dom.input.addEventListener('input', () => {
        dom.input.style.height = 'auto'; dom.input.style.height = (dom.input.scrollHeight) + 'px';
        if (!state.typingTimeout) socket.emit('yaziram');
        clearTimeout(state.typingTimeout);
        state.typingTimeout = setTimeout(() => { socket.emit('yazma_dayandi'); state.typingTimeout = null; }, 2000);
    });
    
    dom.messagesList.addEventListener('click', (e) => {
        const target = e.target.closest('[data-action]');
        const msgEl = e.target.closest('.message-wrapper');
        if (!target || !msgEl) return;
        
        const messageId = msgEl.dataset.id;
        const action = target.dataset.action;
        const msg = state.messages.find(m => m.id === messageId);
        if (!msg) return;

        if (action === 'copy') {
            const contentToCopy = msg.type === 'image' ? msg.content : msg.content;
            navigator.clipboard.writeText(contentToCopy);
        } else if (action === 'reply') { 
            state.replyingTo = msg; 
            showReplyPreview(); 
        } 
        // --- REAKSİYA İLƏ BAĞLI HİSSƏ SİLİNDİ ---
    });

    dom.cancelReplyBtn.addEventListener('click', cancelReply);
    dom.menuToggleBtn.addEventListener('click', () => dom.sidebar.classList.toggle('-translate-x-full'));
    dom.fileUploadBtn.addEventListener('click', () => dom.fileInput.click());
    dom.fileInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const formData = new FormData();
        formData.append('image', file);
        try {
            const res = await fetch('https://seidnapsakso.onrender.com/upload', { method: 'POST', body: formData });
            if (!res.ok) throw new Error('Yükləmə xətası');
            const { secure_url } = await res.json();
            socket.emit('yeni-mesaj', { type: 'image', content: secure_url, replyTo: state.replyingTo });
            cancelReply();
        } catch (error) { alert('Şəkil yüklənə bilmədi.'); }
        e.target.value = '';
    });
    
    // --- Socket Hadisələri ---
    socket.on('connect', () => { state.currentUserId = socket.id; socket.emit('yeni-istifadeci-qosuldu', username); });
    socket.on('chat-tarixcesi', (history) => { state.messages = history; dom.messagesList.innerHTML = ''; state.messages.forEach((msg) => renderMessage(msg)); });
    socket.on('mesaj-geldi', (msg) => { state.messages.push(msg); renderMessage(msg); });
    socket.on('sistem-mesaji', (msg) => renderMessage({type: 'system', content: msg}));
    // --- 'mesaj-yenilendi' SİQNALI SİLİNDİ ---
    socket.on('istifadeci_siyahisi_yenilendi', renderUserList);
    socket.on('kimse_yazir', (user) => { if (user && user.id !== state.currentUserId) state.typingUsers.add(user.name); updateTypingIndicator(); });
    socket.on('yazma_dayandi', (user) => { if (user) state.typingUsers.delete(user.name); updateTypingIndicator(); });
});
