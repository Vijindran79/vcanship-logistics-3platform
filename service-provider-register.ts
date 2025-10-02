// ⚠️  READ-ONLY — DO NOT EDIT — SERVICE LOCKED ⚠️

import { DOMElements } from './dom';
import { setState } from './state';
import { switchPage, showToast, toggleLoading } from './ui';

const SERVICES = [
  { id: "parcel", label: "Parcel" },
  { id: "air_freight", label: "Air Freight" },
  { id: "baggage", label: "Baggage" },
  { id: "fcl", label: "FCL" },
  { id: "lcl", label: "LCL" },
  { id: "vehicle_shipping", label: "Vehicle Shipping" },
  { id: "railway_freight", label: "Railway Freight" },
  { id: "bulk_charter", label: "Bulk Charter" },
  { id: "river_barge_tug", label: "River Barge / Tug" },
  { id: "warehousing", label: "Warehousing" },
  { id: "schedule_trade_lanes", label: "Schedule Trade Lanes" },
  { id: "trade_finance", label: "Trade Finance" },
];

const REGIONS = [
  { id: "africa", label: "Africa" },
  { id: "asia", label: "Asia" },
  { id: "europe", label: "Europe" },
  { id: "north_america", label: "North America" },
  { id: "south_america", label: "South America" },
  { id: "oceania", label: "Oceania" },
  { id: "middle_east", label: "Middle East" },
  { id: "global", label: "Global" },
];

const PROVIDER_TYPES = [
  { id: "freight_forwarder", label: "Freight Forwarder" },
  { id: "carrier", label: "Carrier (Ocean/Air/Land)" },
  { id: "warehouse_operator", label: "Warehouse Operator" },
  { id: "customs_broker", label: "Customs Broker" },
  { id: "trucking_company", label: "Trucking Company" },
  { id: "3pl", label: "Third-Party Logistics (3PL)" },
];


function renderServiceProviderRegisterPage() {
    const page = document.getElementById('page-service-provider-register');
    if (!page) return;

    page.innerHTML = `
        <button class="back-btn">Back to Services</button>
        <div class="service-page-header">
            <h2>Register as a Service Provider</h2>
            <p class="subtitle">Join our network of logistics partners. Fill out the form below to get started.</p>
        </div>
        <div class="form-container card" style="padding: 2rem;">
            <form id="service-provider-form" noValidate>
                <div class="form-section two-column" style="gap: 2rem; align-items: flex-start;">
                    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                        <h3>Company Information</h3>
                        <div class="input-wrapper">
                            <label for="company_name">Company Name</label>
                            <input id="company_name" name="company_name" placeholder="Global Logistics Inc." required />
                            <p class="error-text hidden"></p>
                        </div>
                        <div class="input-wrapper">
                            <label for="website">Website</label>
                            <input id="website" name="website" type="url" placeholder="https://globallogistics.com" required />
                             <p class="error-text hidden"></p>
                        </div>
                        <div class="input-wrapper">
                            <label for="logo">Company Logo</label>
                            <input id="logo" name="logo" type="file" accept="image/png, image/jpeg" class="file-input-styled" />
                             <div id="logo-preview-container" class="file-preview-container"></div>
                            <p class="helper-text">PNG or JPG, max 2MB.</p>
                            <p class="error-text hidden"></p>
                        </div>
                        <div class="input-wrapper">
                            <label for="business_document">Business Registration Document</label>
                            <input id="business_document" name="business_document" type="file" accept=".pdf,.docx" class="file-input-styled" />
                            <p id="document-filename-display" class="helper-text" style="font-weight: 500;"></p>
                            <p class="helper-text">PDF or DOCX, max 5MB.</p>
                            <p class="error-text hidden"></p>
                        </div>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
                        <h3>Contact & Address</h3>
                        <div class="input-wrapper">
                            <label for="email">Primary Contact Email</label>
                            <input id="email" type="email" name="email" placeholder="contact@company.com" required />
                             <p class="error-text hidden"></p>
                        </div>
                        <div class="input-wrapper">
                            <label for="phone">Primary Contact Phone</label>
                            <input id="phone" name="phone" placeholder="+1 (555) 123-4567" required />
                             <p class="error-text hidden"></p>
                        </div>
                         <div class="input-wrapper">
                            <label for="address_street">Street Address</label>
                            <input id="address_street" name="address_street" placeholder="123 Logistics Lane" required />
                             <p class="error-text hidden"></p>
                        </div>
                         <div class="input-wrapper">
                            <label for="address_city">City</label>
                            <input id="address_city" name="address_city" placeholder="New York" required />
                             <p class="error-text hidden"></p>
                        </div>
                         <div class="input-wrapper">
                            <label for="address_country">Country</label>
                            <input id="address_country" name="address_country" placeholder="USA" required />
                             <p class="error-text hidden"></p>
                        </div>
                    </div>
                </div>

                <div class="form-section">
                    <span class="checkbox-group-label">Provider Type</span>
                    <p class="helper-text">What type of provider are you? Select all that apply.</p>
                    <div class="checkbox-grid" id="provider-type-grid">
                        ${PROVIDER_TYPES.map(item => `
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="provider-${item.id}" value="${item.id}" name="provider_type">
                                <label for="provider-${item.id}">${item.label}</label>
                            </div>
                        `).join('')}
                    </div>
                    <p class="error-text hidden" id="provider-type-error"></p>
                </div>

                <div class="form-section">
                    <span class="checkbox-group-label">Services Offered</span>
                    <p class="helper-text">Select all the services your company provides.</p>
                    <div class="checkbox-grid" id="services-grid">
                        ${SERVICES.map(item => `
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="service-${item.id}" value="${item.id}" name="services">
                                <label for="service-${item.id}">${item.label}</label>
                            </div>
                        `).join('')}
                    </div>
                    <p class="error-text hidden" id="services-error"></p>
                </div>
                
                 <div class="form-section">
                    <span class="checkbox-group-label">Coverage Regions</span>
                    <p class="helper-text">Select all regions your company operates in.</p>
                    <div class="checkbox-grid" id="regions-grid">
                         ${REGIONS.map(item => `
                            <div class="checkbox-wrapper">
                                <input type="checkbox" id="region-${item.id}" value="${item.id}" name="coverage_regions">
                                <label for="region-${item.id}">${item.label}</label>
                            </div>
                        `).join('')}
                    </div>
                     <p class="error-text hidden" id="regions-error"></p>
                </div>

                <div class="form-section">
                    <h3>Payout Information</h3>
                    <p class="helper-text">How you'll get paid. Securely provide your payout details to receive funds from your sales.</p>
                    <div class="payout-options">
                        <button type="button" id="stripe-connect-btn" class="main-submit-btn">
                            <i class="fa-brands fa-stripe-s"></i> Connect with Stripe (Recommended)
                        </button>
                        <p class="helper-text" style="text-align: center; margin: 0.5rem 0;">or</p>
                        <button type="button" id="manual-payout-btn" class="link-btn">Enter Bank Details Manually</button>
                    </div>
                    <div id="manual-payout-fields" class="hidden" style="margin-top: 1.5rem; border-top: 1px solid var(--border-color); padding-top: 1.5rem;">
                        <div class="two-column" style="gap: 2rem;">
                            <div class="input-wrapper">
                                <label for="account_holder_name">Account Holder Name</label>
                                <input id="account_holder_name" name="account_holder_name" placeholder="John Doe" />
                                <p class="error-text hidden"></p>
                            </div>
                            <div class="input-wrapper">
                                <label for="bank_name">Bank Name</label>
                                <input id="bank_name" name="bank_name" placeholder="Global Bank Inc." />
                                <p class="error-text hidden"></p>
                            </div>
                        </div>
                        <div class="two-column" style="gap: 2rem;">
                             <div class="input-wrapper">
                                <label for="iban">IBAN</label>
                                <input id="iban" name="iban" placeholder="DE89 3704 0044 0532 0130 00" />
                                <p class="error-text hidden"></p>
                            </div>
                            <div class="input-wrapper">
                                <label for="swift_bic">SWIFT / BIC Code</label>
                                <input id="swift_bic" name="swift_bic" placeholder="DEUTDEFF" />
                                <p class="error-text hidden"></p>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="form-actions">
                    <button type="submit" class="main-submit-btn">Submit Registration</button>
                </div>
            </form>
        </div>
    `;

    page.querySelector('.back-btn')?.addEventListener('click', () => switchPage('landing'));
}

function validateField(input: HTMLInputElement): boolean {
    const errorEl = input.parentElement?.querySelector('.error-text');
    let valid = true;
    let message = '';

    if (input.required && !input.value.trim()) {
        valid = false;
        message = 'This field is required.';
    } else if (input.id === 'company_name' && input.value.trim().length < 2) {
        valid = false;
        message = 'Company name must be at least 2 characters.';
    } else if (input.id === 'phone' && input.value.trim().length < 10) {
        valid = false;
        message = 'Phone number must be at least 10 characters.';
    } else if (input.id === 'address_street' && input.value.trim().length < 5) {
        valid = false;
        message = 'Street address must be at least 5 characters.';
    } else if (input.id === 'address_city' && input.value.trim().length < 2) {
        valid = false;
        message = 'City must be at least 2 characters.';
    } else if (input.id === 'address_country' && input.value.trim().length < 2) {
        valid = false;
        message = 'Country must be at least 2 characters.';
    } else if (input.type === 'email' && input.value.trim() && !/^\S+@\S+\.\S+$/.test(input.value)) {
        valid = false;
        message = 'Please enter a valid email address.';
    } else if (input.type === 'url' && input.value.trim() && !/^https?:\/\/.+\..+/.test(input.value)) {
        valid = false;
        message = 'Please enter a valid URL (e.g., https://example.com).';
    } else if (input.id === 'iban' && input.value.trim() && !/^[A-Z]{2}[0-9]{2}[A-Z0-9]{1,30}$/.test(input.value.replace(/\s/g, ''))) {
        valid = false;
        message = 'Please enter a valid IBAN format.';
    } else if (input.id === 'swift_bic' && input.value.trim() && !/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(input.value)) {
        valid = false;
        message = 'Please enter a valid SWIFT/BIC code.';
    }


    if (errorEl && errorEl.classList.contains('error-text')) {
        errorEl.textContent = message;
        errorEl.classList.toggle('hidden', valid);
        input.closest('.input-wrapper')?.classList.toggle('input-error', !valid);
    }
    return valid;
}

function validateCheckboxGroup(groupName: string, errorId: string): boolean {
    const checked = document.querySelectorAll(`input[name="${groupName}"]:checked`).length > 0;
    const errorEl = document.getElementById(errorId);
    if(errorEl) {
         errorEl.classList.toggle('hidden', checked);
         if(!checked) errorEl.textContent = 'Please select at least one option.';
    }
    return checked;
}

function validateFile(input: HTMLInputElement, maxSizeMB: number, allowedTypes: string[]): boolean {
    const errorEl = input.parentElement?.querySelector('.error-text');
    const file = input.files?.[0];
    let valid = true;
    let message = '';

    if (file) {
        if (file.size > maxSizeMB * 1024 * 1024) {
            valid = false;
            message = `File size must not exceed ${maxSizeMB}MB.`;
        } else if (!allowedTypes.includes(file.type)) {
            const friendlyTypes = allowedTypes.map(t => t.split('/')[1].toUpperCase()).join(', ');
            message = `Invalid file type. Please upload one of: ${friendlyTypes}.`;
        }
    }

    if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.toggle('hidden', valid);
        input.closest('.input-wrapper')?.classList.toggle('input-error', !valid);
    }
    return valid;
}


async function handleFormSubmit(e: Event) {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    
    let isFormValid = true;
    
    form.querySelectorAll<HTMLInputElement>('input[required], input[type="url"], input[type="email"]').forEach(input => {
        if (!validateField(input)) {
            isFormValid = false;
        }
    });

    const logoInput = document.getElementById('logo') as HTMLInputElement;
    const docInput = document.getElementById('business_document') as HTMLInputElement;

    if (!validateFile(logoInput, 2, ['image/png', 'image/jpeg'])) isFormValid = false;
    if (!validateFile(docInput, 5, ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])) isFormValid = false;

    if (!validateCheckboxGroup('provider_type', 'provider-type-error')) isFormValid = false;
    if (!validateCheckboxGroup('services', 'services-error')) isFormValid = false;
    if (!validateCheckboxGroup('coverage_regions', 'regions-error')) isFormValid = false;

    const manualPayoutFields = document.getElementById('manual-payout-fields');
    if (manualPayoutFields && !manualPayoutFields.classList.contains('hidden')) {
        form.querySelectorAll<HTMLInputElement>('#manual-payout-fields input').forEach(input => {
            // Only validate if user has typed something, since this section is optional
            if (input.value.trim() !== '') {
                 if (!validateField(input)) {
                    isFormValid = false;
                }
            }
        });
    }
    
    if (!isFormValid) {
        showToast('Please correct the errors in the form.', 'error');
        return;
    }

    toggleLoading(true, "Submitting registration...");
    
    // In a real app, you would get the values and send to backend.
    const payoutData = {
        accountHolder: (document.getElementById('account_holder_name') as HTMLInputElement).value,
        bankName: (document.getElementById('bank_name') as HTMLInputElement).value,
        iban: (document.getElementById('iban') as HTMLInputElement).value,
        swiftBic: (document.getElementById('swift_bic') as HTMLInputElement).value,
    };
    console.log("Captured Payout Data (demo):", payoutData);

    showToast("This is a demo. Form submission is not connected to a live database.", "info");
    
    setTimeout(() => {
        toggleLoading(false);
        showToast("Registration Submitted! (Demo)", "success");
        form.reset();
        const logoPreviewContainer = document.getElementById('logo-preview-container');
        if (logoPreviewContainer) logoPreviewContainer.innerHTML = '';
        const docFilenameDisplay = document.getElementById('document-filename-display');
        if (docFilenameDisplay) docFilenameDisplay.textContent = '';
        const manualPayoutFields = document.getElementById('manual-payout-fields');
        if (manualPayoutFields) manualPayoutFields.classList.add('hidden');
    }, 1500);
}

function attachEventListeners() {
    const form = document.getElementById('service-provider-form');
    form?.addEventListener('submit', handleFormSubmit);

    const logoInput = document.getElementById('logo') as HTMLInputElement;
    const logoPreviewContainer = document.getElementById('logo-preview-container') as HTMLDivElement;
    logoInput?.addEventListener('change', () => {
        const file = logoInput.files?.[0];
        logoPreviewContainer.innerHTML = ''; 
        if (file) {
            if (!validateFile(logoInput, 2, ['image/png', 'image/jpeg'])) return;

            const reader = new FileReader();
            reader.onloadend = () => {
                const img = document.createElement('img');
                img.src = reader.result as string;
                img.alt = "Logo preview";
                logoPreviewContainer.appendChild(img);
            };
            reader.readAsDataURL(file);
        }
    });

    const docInput = document.getElementById('business_document') as HTMLInputElement;
    const docFilenameDisplay = document.getElementById('document-filename-display') as HTMLParagraphElement;
    docInput?.addEventListener('change', () => {
        const file = docInput.files?.[0];
        if (file) {
            if (!validateFile(docInput, 5, ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])) {
                docFilenameDisplay.textContent = '';
                return;
            }
            docFilenameDisplay.textContent = `Selected: ${file.name}`;
        } else {
            docFilenameDisplay.textContent = '';
        }
    });

    const stripeConnectBtn = document.getElementById('stripe-connect-btn');
    const manualPayoutBtn = document.getElementById('manual-payout-btn');
    const manualPayoutFields = document.getElementById('manual-payout-fields');

    stripeConnectBtn?.addEventListener('click', () => {
        showToast('In a real app, this would redirect to Stripe for secure onboarding.', 'info');
        if (manualPayoutFields) manualPayoutFields.classList.add('hidden');
    });

    manualPayoutBtn?.addEventListener('click', () => {
        if (manualPayoutFields) {
            manualPayoutFields.classList.toggle('hidden');
        }
    });
}


export function startServiceProviderRegister() {
    setState({ currentService: 'service-provider-register' });
    renderServiceProviderRegisterPage();
    switchPage('service-provider-register');
    attachEventListeners();
}