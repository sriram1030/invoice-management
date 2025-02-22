// js/main.js
import { setupNavigation } from './navigation.js';
import { fetchDashboardData, fetchInvoicesList, fetchClients } from './invoicesList.js';
import { fetchRecentInvoices, fetchAllInvoices, addItemRow, updateTotals, setupInvoiceDiscountToggle, setupInvoiceRecurrenceToggle, addInvoiceFormSubmit, populateClientFilter, setupInvoiceFilters } from './invoices.js';
import { setupReportGeneration } from './reports.js';
import { setupSettings } from './settings.js';
import { initialize } from './utils.js';
import { supabase } from './config.js';

// Import DOM elements and global variables
export const dashboardSection = document.querySelector('.dashboard-section');
export const invoicesSection = document.querySelector('.invoices-section');
export const reportsSection = document.querySelector('.reports-section');
export const clientsSection = document.querySelector('.clients-section');
export const dashboardGrid = document.getElementById('dashboardGrid');
export const clientsGrid = document.getElementById('clientsGrid');
export const invoicesGrid = document.getElementById('invoicesGrid');
export const recentInvoicesBody = document.getElementById('recentInvoicesBody');
export const addClientBtn = document.querySelector('.add-client-btn');
export const addInvoiceBtn = document.querySelector('.add-invoice-btn');
export const addInvoiceModal = document.getElementById('addInvoiceModal');
export const addInvoiceForm = document.getElementById('addInvoiceForm');
export const clientForm = document.getElementById('clientForm');
export const itemsTable = document.getElementById('itemsTable');
export const itemRowTemplate = document.getElementById('itemRowTemplate');
export const addItemBtn = document.getElementById('addItemBtn');
export const toAddress = document.getElementById('toAddress');
export const navItems = document.querySelectorAll('.nav-item');
export const clientSelect = document.getElementById('clientSelect');
export const clientDetails = document.getElementById('clientDetails');
export const searchInvoiceId = document.querySelector('.search-invoice-id');
export const filterClient = document.querySelector('.filter-client');
export const filterStatus = document.querySelector('.filter-status');

export let selectedClientId = null;

// Add setter function to update selectedClientId
export function setSelectedClientId(id) {
    selectedClientId = id;
    console.log('selectedClientId updated via setter:', selectedClientId); // Debugging
}

console.log('Main.js loaded');

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded triggered');

    // Setup global variables and event listeners
    try {
        setupNavigation();
        setupReportGeneration();
        setupSettings();

        // Setup invoice-specific functionality
        if (addItemBtn) {
            console.log('Setting up addItemBtn:', addItemBtn);
            addItemBtn.addEventListener('click', addItemRow);
        } else {
            console.error('addItemBtn not found in the DOM');
        }
        setupInvoiceDiscountToggle();
        setupInvoiceRecurrenceToggle();
        addInvoiceFormSubmit();

        // Populate client filter and setup filters for invoices
        if (populateClientFilter && setupInvoiceFilters) {
            populateClientFilter(); // Populate the client filter dropdown
            setupInvoiceFilters(); // Set up event listeners for filters
        } else {
            console.error('populateClientFilter or setupInvoiceFilters not defined');
        }

        // Add client functionality
        if (addClientBtn) {
            console.log('Setting up addClientBtn');
            addClientBtn.addEventListener('click', () => {
                const modalTitle = document.getElementById('addClientModalLabel');
                const submitBtn = document.getElementById('clientSubmitBtn');
                const clientIdInput = document.getElementById('clientId');
                const clientNameInput = document.getElementById('clientName');
                const clientEmailInput = document.getElementById('clientEmail');
                const clientAddressInput = document.getElementById('clientAddress');

                if (modalTitle && submitBtn && clientIdInput && clientNameInput && clientEmailInput && clientAddressInput) {
                    modalTitle.textContent = 'Add Client';
                    submitBtn.textContent = 'Add Client';
                    clientIdInput.value = ''; // Clear client ID for adding
                    clientNameInput.value = '';
                    clientEmailInput.value = '';
                    clientAddressInput.value = '';
                }
                $('#addClientModal').modal('show');
            });
        }

        if (clientForm) {
            console.log('Setting up clientForm');
            clientForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                try {
                    const clientIdInput = document.getElementById('clientId');
                    const clientNameInput = document.getElementById('clientName');
                    const clientEmailInput = document.getElementById('clientEmail');
                    const clientAddressInput = document.getElementById('clientAddress');
                    const name = clientNameInput.value.trim();
                    const email = clientEmailInput.value.trim();
                    const address = clientAddressInput.value.trim();

                    if (!name || !email || !address) {
                        alert('Please enter name, email, and address for the client.');
                        return;
                    }

                    if (clientIdInput.value) {
                        // Update existing client
                        const { error: updateError } = await supabase
                            .from('clients')
                            .update({ name, email, address })
                            .eq('id', clientIdInput.value);
                        if (updateError) throw updateError;
                    } else {
                        // Add new client
                        const { error } = await supabase
                            .from('clients')
                            .insert([{ name, email, address }]);
                        if (error) throw error;
                    }

                    await fetchDashboardData();
                    await fetchClients(); // Update Clients section after adding/editing a client
                    populateClientFilter(); // Update client filter dropdown after adding/editing a client
                    clientNameInput.value = '';
                    clientEmailInput.value = '';
                    clientAddressInput.value = '';
                    clientIdInput.value = '';
                    $('#addClientModal').modal('hide');
                } catch (error) {
                    console.error('Failed to add/edit client:', error);
                    alert('An error occurred while adding/editing the client: ' + (error.message || 'Unknown error'));
                }
            });
        }

        // Add Invoice button functionality in Invoices section
        if (addInvoiceBtn) {
            console.log('Setting up addInvoiceBtn');
            addInvoiceBtn.addEventListener('click', async () => {
                console.log('Opening Add Invoice modal');
                $('#addInvoiceModal').modal('show');

                // Fetch and populate client list in the modal
                try {
                    const { data: clients, error } = await supabase
                        .from('clients')
                        .select('*')
                        .order('name', { ascending: true });
                    if (error) {
                        console.error('Error fetching clients for invoice:', error);
                        throw error;
                    }

                    if (clientSelect) {
                        clientSelect.innerHTML = '<option value="">Select a Client</option>';
                        clients.forEach(client => {
                            const option = document.createElement('option');
                            option.value = client.id;
                            option.textContent = client.name;
                            clientSelect.appendChild(option);
                        });

                        // Add event listener for client selection
                        clientSelect.addEventListener('change', async (e) => {
                            const clientId = e.target.value;
                            if (clientId) {
                                const { data: client, error: clientError } = await supabase
                                    .from('clients')
                                    .select('*')
                                    .eq('id', clientId)
                                    .single();
                                if (clientError) {
                                    console.error('Error fetching client details:', clientError);
                                    throw clientError;
                                }

                                // Update selectedClientId and show client details
                                setSelectedClientId(clientId);
                                if (clientDetails) {
                                    clientDetails.style.display = 'block';
                                    toAddress.innerHTML = `To: ${client.name}<br>${client.email}<br>${client.address}`;
                                } else {
                                    console.error('clientDetails not found in DOM');
                                }
                            } else {
                                // Hide client details if no client is selected
                                if (clientDetails) {
                                    clientDetails.style.display = 'none';
                                    toAddress.innerHTML = '';
                                }
                                setSelectedClientId(null);
                            }
                        });
                    } else {
                        console.error('clientSelect not found in DOM');
                    }
                } catch (error) {
                    console.error('Failed to populate client list:', error);
                    alert('An error occurred while loading clients: ' + (error.message || 'Unknown error'));
                }
            });
        }

        // Initialize with Dashboard view
        console.log('Initializing...');
        initialize();
    } catch (error) {
        console.error('Error in main.js initialization:', error);
    }
})