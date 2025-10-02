// ===================================
// MQTT CONFIGURATION
// ===================================

const MQTT_CONFIG = {
    broker: 'wss://broker.hivemq.com:8884/mqtt',
    clientId: 'SmartPrint_Web_' + Math.random().toString(16).substr(2, 8),
    topic: 'senai/iot/pedidos'
};

let mqttClient = null;
let orderCounter = 1;
let currentItems = [];
let recentOrders = [];

// ===================================
// MQTT CONNECTION
// ===================================

function connectMQTT() {
    try {
        mqttClient = mqtt.connect(MQTT_CONFIG.broker, {
            clientId: MQTT_CONFIG.clientId,
            clean: true,
            reconnectPeriod: 1000,
        });

        mqttClient.on('connect', () => {
            console.log('✓ Conectado ao MQTT Broker');
            updateConnectionStatus(true);
            showToast('Conectado ao servidor MQTT', 'Pronto para enviar pedidos', 'success');
        });

        mqttClient.on('error', (error) => {
            console.error('✗ Erro MQTT:', error);
            updateConnectionStatus(false);
            showToast('Erro de conexão', 'Não foi possível conectar ao servidor MQTT', 'error');
        });

        mqttClient.on('offline', () => {
            console.log('⚠ MQTT offline');
            updateConnectionStatus(false);
        });

        mqttClient.on('reconnect', () => {
            console.log('🔄 Reconectando ao MQTT...');
        });

    } catch (error) {
        console.error('Erro ao conectar MQTT:', error);
        updateConnectionStatus(false);
    }
}

function updateConnectionStatus(connected) {
    const statusElement = document.getElementById('connectionStatus');
    const statusText = statusElement.querySelector('.status-text');
    
    if (connected) {
        statusElement.classList.add('connected');
        statusText.textContent = 'Conectado';
    } else {
        statusElement.classList.remove('connected');
        statusText.textContent = 'Desconectado';
    }
}

// ===================================
// ORDER MANAGEMENT
// ===================================

function addItem(nome, quantidade, preco) {
    const item = {
        id: Date.now(),
        nome: nome,
        quantidade: parseInt(quantidade),
        preco: parseFloat(preco)
    };
    
    currentItems.push(item);
    renderItems();
    updateTotal();
    closeModal();
    
    showToast('Item adicionado', `${quantidade}x ${nome}`, 'success');
}

function removeItem(itemId) {
    const item = currentItems.find(i => i.id === itemId);
    currentItems = currentItems.filter(i => i.id !== itemId);
    renderItems();
    updateTotal();
    
    if (item) {
        showToast('Item removido', item.nome, 'warning');
    }
}

function renderItems() {
    const itemsList = document.getElementById('itemsList');
    const emptyState = document.getElementById('emptyState');
    
    if (currentItems.length === 0) {
        itemsList.style.display = 'none';
        emptyState.style.display = 'block';
        return;
    }
    
    itemsList.style.display = 'flex';
    emptyState.style.display = 'none';
    
    itemsList.innerHTML = currentItems.map(item => `
        <div class="item-card">
            <div class="item-info">
                <div class="item-name">${escapeHtml(item.nome)}</div>
                <div class="item-details">
                    <span>Qtd: ${item.quantidade}</span>
                    <span>Unit: R$ ${item.preco.toFixed(2)}</span>
                </div>
            </div>
            <div class="item-price">R$ ${(item.quantidade * item.preco).toFixed(2)}</div>
            <button type="button" class="item-remove" onclick="removeItem(${item.id})" title="Remover item">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                    <line x1="10" y1="11" x2="10" y2="17"/>
                    <line x1="14" y1="11" x2="14" y2="17"/>
                </svg>
            </button>
        </div>
    `).join('');
}

function updateTotal() {
    const total = currentItems.reduce((sum, item) => sum + (item.quantidade * item.preco), 0);
    document.getElementById('totalValue').textContent = `R$ ${total.toFixed(2)}`;
}

function clearForm() {
    if (currentItems.length === 0) {
        document.getElementById('orderForm').reset();
        return;
    }
    
    if (confirm('Deseja realmente limpar todos os dados do pedido?')) {
        currentItems = [];
        renderItems();
        updateTotal();
        document.getElementById('orderForm').reset();
        showToast('Formulário limpo', 'Todos os dados foram removidos', 'warning');
    }
}

function submitOrder(event) {
    event.preventDefault();
    
    const mesa = parseInt(document.getElementById('mesa').value);
    const cliente = document.getElementById('cliente').value.trim();
    
    if (currentItems.length === 0) {
        showToast('Erro', 'Adicione pelo menos um item ao pedido', 'error');
        return;
    }
    
    if (!mqttClient || !mqttClient.connected) {
        showToast('Erro de conexão', 'Não conectado ao servidor MQTT', 'error');
        return;
    }
    
    const total = currentItems.reduce((sum, item) => sum + (item.quantidade * item.preco), 0);
    
    const order = {
        pedido_id: orderCounter++,
        mesa: mesa,
        cliente: cliente,
        itens: currentItems.map(item => ({
            nome: item.nome,
            quantidade: item.quantidade,
            preco: item.preco
        })),
        total: parseFloat(total.toFixed(2))
    };
    
    // Send to MQTT
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.classList.add('loading');
    
    try {
        mqttClient.publish(MQTT_CONFIG.topic, JSON.stringify(order), { qos: 1 }, (error) => {
            submitBtn.disabled = false;
            submitBtn.classList.remove('loading');
            
            if (error) {
                console.error('Erro ao publicar:', error);
                showToast('Erro ao enviar', 'Não foi possível enviar o pedido', 'error');
            } else {
                console.log('✓ Pedido enviado:', order);
                
                // Add to recent orders
                addToRecentOrders(order);
                
                // Clear form
                currentItems = [];
                renderItems();
                updateTotal();
                document.getElementById('orderForm').reset();
                
                showToast('Pedido enviado!', `Pedido #${order.pedido_id} - Mesa ${order.mesa}`, 'success');
            }
        });
    } catch (error) {
        submitBtn.disabled = false;
        submitBtn.classList.remove('loading');
        console.error('Erro:', error);
        showToast('Erro', 'Ocorreu um erro ao enviar o pedido', 'error');
    }
}

// ===================================
// RECENT ORDERS
// ===================================

function addToRecentOrders(order) {
    const orderWithTime = {
        ...order,
        timestamp: new Date().toISOString()
    };
    
    recentOrders.unshift(orderWithTime);
    
    // Keep only last 10 orders
    if (recentOrders.length > 10) {
        recentOrders = recentOrders.slice(0, 10);
    }
    
    renderRecentOrders();
    saveToLocalStorage();
}

function renderRecentOrders() {
    const container = document.getElementById('recentOrders');
    
    if (recentOrders.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <polyline points="10 9 9 9 8 9"/>
                </svg>
                <p>Nenhum pedido emitido ainda</p>
            </div>
        `;
        return;
    }
    
    container.innerHTML = recentOrders.map(order => {
        const time = new Date(order.timestamp);
        const timeStr = time.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const dateStr = time.toLocaleDateString('pt-BR');
        
        return `
            <div class="order-item">
                <div class="order-header">
                    <div class="order-id">Pedido #${order.pedido_id}</div>
                    <div class="order-status">
                        <span class="order-status-dot"></span>
                        Enviado
                    </div>
                </div>
                <div class="order-info">
                    Mesa ${order.mesa} • ${escapeHtml(order.cliente)}
                </div>
                <div class="order-info">
                    ${order.itens.length} ${order.itens.length === 1 ? 'item' : 'itens'}
                </div>
                <div class="order-total">Total: R$ ${order.total.toFixed(2)}</div>
                <div class="order-time">${timeStr} • ${dateStr}</div>
            </div>
        `;
    }).join('');
}

// ===================================
// MODAL MANAGEMENT
// ===================================

function openModal() {
    const modal = document.getElementById('addItemModal');
    modal.classList.add('active');
    document.getElementById('itemNome').focus();
}

function closeModal() {
    const modal = document.getElementById('addItemModal');
    modal.classList.remove('active');
    document.getElementById('addItemForm').reset();
}

// ===================================
// TOAST NOTIFICATIONS
// ===================================

function showToast(title, message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
        success: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>',
        error: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
        warning: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
        info: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>'
    };
    
    toast.innerHTML = `
        <div class="toast-icon">${icons[type] || icons.info}</div>
        <div class="toast-content">
            <div class="toast-title">${escapeHtml(title)}</div>
            <div class="toast-message">${escapeHtml(message)}</div>
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
        </button>
    `;
    
    container.appendChild(toast);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
        toast.style.animation = 'slideInRight 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// ===================================
// LOCAL STORAGE
// ===================================

function saveToLocalStorage() {
    try {
        localStorage.setItem('smartprint_orders', JSON.stringify(recentOrders));
        localStorage.setItem('smartprint_counter', orderCounter.toString());
    } catch (error) {
        console.error('Erro ao salvar no localStorage:', error);
    }
}

function loadFromLocalStorage() {
    try {
        const savedOrders = localStorage.getItem('smartprint_orders');
        const savedCounter = localStorage.getItem('smartprint_counter');
        
        if (savedOrders) {
            recentOrders = JSON.parse(savedOrders);
            renderRecentOrders();
        }
        
        if (savedCounter) {
            orderCounter = parseInt(savedCounter);
        }
    } catch (error) {
        console.error('Erro ao carregar do localStorage:', error);
    }
}

// ===================================
// UTILITY FUNCTIONS
// ===================================

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ===================================
// EVENT LISTENERS
// ===================================

document.addEventListener('DOMContentLoaded', () => {
    // Load data from localStorage
    loadFromLocalStorage();
    
    // Connect to MQTT
    connectMQTT();
    
    // Form submission
    document.getElementById('orderForm').addEventListener('submit', submitOrder);
    
    // Add item button
    document.getElementById('addItemBtn').addEventListener('click', openModal);
    
    // Clear button
    document.getElementById('clearBtn').addEventListener('click', clearForm);
    
    // Modal controls
    document.getElementById('modalClose').addEventListener('click', closeModal);
    document.getElementById('modalOverlay').addEventListener('click', closeModal);
    document.getElementById('cancelItemBtn').addEventListener('click', closeModal);
    
    // Add item form
    document.getElementById('addItemForm').addEventListener('submit', (e) => {
        e.preventDefault();
        
        const nome = document.getElementById('itemNome').value.trim();
        const quantidade = document.getElementById('itemQuantidade').value;
        const preco = document.getElementById('itemPreco').value;
        
        if (nome && quantidade && preco) {
            addItem(nome, quantidade, preco);
        }
    });
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // ESC to close modal
        if (e.key === 'Escape') {
            const modal = document.getElementById('addItemModal');
            if (modal.classList.contains('active')) {
                closeModal();
            }
        }
        
        // Ctrl/Cmd + N to add new item
        if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
            e.preventDefault();
            openModal();
        }
    });
    
    // Format price input
    const precoInput = document.getElementById('itemPreco');
    precoInput.addEventListener('input', (e) => {
        let value = e.target.value;
        // Remove non-numeric characters except dot
        value = value.replace(/[^\d.]/g, '');
        // Ensure only one dot
        const parts = value.split('.');
        if (parts.length > 2) {
            value = parts[0] + '.' + parts.slice(1).join('');
        }
        e.target.value = value;
    });
    
    console.log('✓ Smart Print inicializado');
});

// ===================================
// SERVICE WORKER (Optional - for PWA)
// ===================================

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Uncomment to enable PWA features
        // navigator.serviceWorker.register('/sw.js')
        //     .then(reg => console.log('Service Worker registrado'))
        //     .catch(err => console.log('Erro ao registrar Service Worker:', err));
    });
}
