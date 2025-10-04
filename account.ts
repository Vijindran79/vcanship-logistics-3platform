// ⚠️  READ-ONLY — DO NOT EDIT — SERVICE LOCKED ⚠️
import { DOMElements } from './dom';
import { State } from './state';
import { showToast } from './ui';

// Mock Data - In a real app, this would come from an API
let mockAddressBook = [
    { id: 1, label: 'My Office', name: 'John Doe', company: 'Vcanship', street: '123 Global Logistics Ave', city: 'Shipping City', postcode: '12345', country: 'USA', isDefault: true },
    { id: 2, label: 'Warehouse A', name: 'Receiving Dept', company: 'Supplier Inc.', street: '456 Supplier St', city: 'Factory Town', postcode: '54321', country: 'China', isDefault: false },
];

// --- ADDRESS BOOK ---

export function renderAddressBook() {
    const page = DOMElements.pageAddressBook;
    if (!page) return;

    const addressesHtml = mockAddressBook.length > 0
        ? mockAddressBook.map(addr => `
            <div class="address-card">
                <div class="address-card-header">
                    <h4>${addr.label} ${addr.isDefault ? '<span class="default-badge">Default</span>' : ''}</h4>
                    <div class="address-card-actions">
                        <button class="secondary-btn edit-address-btn" data-id="${addr.id}">Edit</button>
                        <button class="secondary-btn delete-address-btn" data-id="${addr.id}">Delete</button>
                    </div>
                </div>
                <div class="address-card-body">
                    <p>${addr.name}</p>
                    <p>${addr.street}, ${addr.city}, ${addr.postcode}</p>
                    <p>${addr.country}</p>
                </div>
            </div>
        `).join('')
        : `
        <div class="address-empty-state-card">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="empty-state-icon">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
            </svg>
            <h3>Your Address Book is Empty</h3>
            <p>Save addresses here to make booking your future shipments even faster.</p>
            <button id="add-address-from-empty-btn" class="main-submit-btn">Add Your First Address</button>
        </div>
        `;

    page.innerHTML = `
        <div class="service-page-header">
            <h2>Address Book</h2>
            <p class="subtitle">Manage your saved addresses for faster bookings.</p>
        </div>
        <div class="account-grid">
            <div class="address-list">
                ${addressesHtml}
            </div>
            <div class="form-container">
                <h3 id="address-form-title">Add New Address</h3>
                <form id="address-form">
                    <input type="hidden" id="address-id">
                    <div class="input-wrapper"><label for="address-label">Label (e.g., Home, Office)</label><input type="text" id="address-label" required></div>
                    <div class="input-wrapper"><label for="address-name">Full Name</label><input type="text" id="address-name" required></div>
                    <div class="input-wrapper"><label for="address-street">Street</label><input type="text" id="address-street" required></div>
                    <div class="input-wrapper"><label for="address-city">City</label><input type="text" id="address-city" required></div>
                    <div class="input-wrapper"><label for="address-country">Country</label><input type="text" id="address-country" required></div>
                    <div class="form-actions">
                        <button type="button" id="cancel-edit-btn" class="secondary-btn hidden">Cancel</button>
                        <button type="submit" class="main-submit-btn">Save Address</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    attachAddressBookListeners();
}

function handleAddressFormSubmit(e: Event) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const id = parseInt((form.querySelector('#address-id') as HTMLInputElement).value, 10);
    
    const newAddress = {
        id: id || Date.now(),
        label: (form.querySelector('#address-label') as HTMLInputElement).value,
        name: (form.querySelector('#address-name') as HTMLInputElement).value,
        street: (form.querySelector('#address-street') as HTMLInputElement).value,
        city: (form.querySelector('#address-city') as HTMLInputElement).value,
        country: (form.querySelector('#address-country') as HTMLInputElement).value,
        company: '', // Placeholder
        postcode: '', // Placeholder
        isDefault: id ? mockAddressBook.find(a => a.id === id)!.isDefault : false,
    };

    if (id) { // Editing existing
        mockAddressBook = mockAddressBook.map(addr => addr.id === id ? newAddress : addr);
        showToast('Address updated successfully!', 'success');
    } else { // Adding new
        mockAddressBook.push(newAddress);
        showToast('Address added successfully!', 'success');
    }
    
    renderAddressBook(); // Re-render the whole page
}

function handleEditAddress(id: number) {
    const address = mockAddressBook.find(addr => addr.id === id);
    if (!address) return;

    const form = document.getElementById('address-form') as HTMLFormElement;
    (form.querySelector('#address-id') as HTMLInputElement).value = String(id);
    (form.querySelector('#address-label') as HTMLInputElement).value = address.label;
    (form.querySelector('#address-name') as HTMLInputElement).value = address.name;
    (form.querySelector('#address-street') as HTMLInputElement).value = address.street;
    (form.querySelector('#address-city') as HTMLInputElement).value = address.city;
    (form.querySelector('#address-country') as HTMLInputElement).value = address.country;
    
    (document.getElementById('address-form-title') as HTMLElement).textContent = 'Edit Address';
    (document.getElementById('cancel-edit-btn') as HTMLElement).classList.remove('hidden');
    form.scrollIntoView({ behavior: 'smooth' });
}

function handleDeleteAddress(id: number) {
    if (confirm('Are you sure you want to delete this address?')) {
        mockAddressBook = mockAddressBook.filter(addr => addr.id !== id);
        showToast('Address deleted.', 'success');
        renderAddressBook();
    }
}

function cancelEdit() {
    (document.getElementById('address-form') as HTMLFormElement).reset();
    (document.getElementById('address-id') as HTMLInputElement).value = '';
    (document.getElementById('address-form-title') as HTMLElement).textContent = 'Add New Address';
    (document.getElementById('cancel-edit-btn') as HTMLElement).classList.add('hidden');
}


function attachAddressBookListeners() {
    document.getElementById('address-form')?.addEventListener('submit', handleAddressFormSubmit);
    document.querySelectorAll('.edit-address-btn').forEach(btn => {
        btn.addEventListener('click', (e) => handleEditAddress(Number((e.currentTarget as HTMLElement).dataset.id)));
    });
    document.querySelectorAll('.delete-address-btn').forEach(btn => {
        btn.addEventListener('click', (e) => handleDeleteAddress(Number((e.currentTarget as HTMLElement).dataset.id)));
    });
    document.getElementById('cancel-edit-btn')?.addEventListener('click', cancelEdit);
    document.getElementById('add-address-from-empty-btn')?.addEventListener('click', () => {
        const form = document.getElementById('address-form');
        const firstInput = document.getElementById('address-label');
        if (form) {
            form.scrollIntoView({ behavior: 'smooth' });
            firstInput?.focus();
        }
    });
}


// --- ACCOUNT SETTINGS ---

export function renderAccountSettings() {
    const page = DOMElements.pageSettings;
    if (!page || !State.currentUser) return;
    
    page.innerHTML = `
         <div class="service-page-header">
            <h2>Account Settings</h2>
            <p class="subtitle">Manage your profile and communication preferences.</p>
        </div>
        <div class="form-container">
            <form id="settings-form">
                <div class="form-section">
                    <h3>Profile Information</h3>
                    <div class="input-wrapper">
                        <label for="settings-name">Full Name</label>
                        <input type="text" id="settings-name" value="${State.currentUser.name}" required>
                    </div>
                     <div class="input-wrapper">
                        <label for="settings-email">Email Address</label>
                        <input type="email" id="settings-email" value="${State.currentUser.email}" required>
                    </div>
                </div>
                 <div class="form-section">
                    <h3>Change Password</h3>
                    <div class="input-wrapper"><label for="current-password">Current Password</label><input type="password" id="current-password"></div>
                    <div class="input-wrapper"><label for="new-password">New Password</label><input type="password" id="new-password"></div>
                </div>
                <div class="form-actions">
                    <button type="submit" class="main-submit-btn">Save Changes</button>
                </div>
            </form>
        </div>
    `;

    document.getElementById('settings-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        showToast('Account settings saved!', 'success');
    });
}


// --- INITIALIZATION ---

export function initializeAccountPages() {
    const pageObservers = [
        { el: DOMElements.pageAddressBook, renderFn: renderAddressBook },
        { el: DOMElements.pageSettings, renderFn: renderAccountSettings }
    ];

    pageObservers.forEach(({ el, renderFn }) => {
        if (el) {
            const observer = new MutationObserver((mutations) => {
                if (mutations.some(m => m.attributeName === 'class' && (m.target as HTMLElement).classList.contains('active'))) {
                    if (State.isLoggedIn) {
                        renderFn();
                    } else {
                        el.innerHTML = `<div class="form-container"><p>Please log in to manage your account.</p></div>`;
                    }
                }
            });
            observer.observe(el, { attributes: true });
        }
    });
}