// ⚠️  READ-ONLY — DO NOT EDIT — SERVICE LOCKED ⚠️
import { t } from './i18n';
import { Service } from './state';

export function initializeSidebar() {
    const sidebarEl = document.getElementById('app-sidebar');
    if (!sidebarEl) return;

    const mainButtons = [
        { id: 'landing', name: t('sidebar.services'), icon: 'fa-solid fa-box-open', active: true },
        { id: 'api-hub', name: t('sidebar.apiHub'), icon: 'fa-solid fa-code' },
        { id: 'help', name: t('sidebar.helpCenter'), icon: 'fa-solid fa-question-circle' }
    ];

    const serviceButtons: { id: Service, name: string, icon: string }[] = [
        { id: 'secure-trade', name: 'Secure Trade', icon: 'fa-solid fa-shield-halved' },
        { id: 'vehicle', name: t('sidebar.vehicle'), icon: 'fa-solid fa-truck-fast' },
        { id: 'railway', name: t('sidebar.railway'), icon: 'fa-solid fa-train-subway' },
        { id: 'inland', name: t('sidebar.inland'), icon: 'fa-solid fa-truck' },
        { id: 'bulk', name: t('sidebar.bulk'), icon: 'fa-solid fa-anchor' },
        { id: 'rivertug', name: t('sidebar.rivertug'), icon: 'fa-solid fa-ship' },
        { id: 'warehouse', name: t('sidebar.warehouse'), icon: 'fa-solid fa-warehouse' },
        { id: 'schedules', name: t('sidebar.schedules'), icon: 'fa-solid fa-calendar-days' },
        { id: 'register', name: t('sidebar.tradeFinance'), icon: 'fa-solid fa-money-check-dollar' },
        { id: 'service-provider-register', name: t('sidebar.partner'), icon: 'fa-solid fa-handshake' }
    ];
    
    const createMainButton = (btn: {id: string, name: string, icon: string, active?: boolean}) => 
        `<button class="sidebar-btn static-link ${btn.active ? 'active' : ''}" data-page="${btn.id}"><i class="${btn.icon}"></i> ${btn.name}</button>`;
    
    const createServiceButton = (btn: {id: Service, name: string, icon: string}) => 
        `<button class="sidebar-btn-service" data-service="${btn.id}"><i class="${btn.icon}"></i> ${btn.name}</button>`;

    sidebarEl.innerHTML = `
        <div class="sidebar-section">
            ${mainButtons.map(createMainButton).join('')}
        </div>
        <div class="sidebar-section">
            ${serviceButtons.map(createServiceButton).join('')}
        </div>
    `;
}