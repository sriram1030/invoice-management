// js/invoicesList.js
import { supabase } from './config.js';
import { clientsGrid, dashboardGrid, recentInvoicesBody, toAddress } from './main.js';
import { fetchRecentInvoices } from './invoices.js';
import { getNextInvoiceNumber } from './utils.js';
import { setSelectedClientId, selectedClientId } from './main.js';

export async function fetchDashboardData() {
    console.log('Fetching dashboard data...');
    try {
        const dashboardSection = document.querySelector('.dashboard-section');
        if (!dashboardSection) {
            console.error('Dashboard section not found in DOM');
            return;
        }

        // Fetch total clients
        const { data: clients, error: clientsError } = await supabase
            .from('clients')
            .select('*')
            .order('name', { ascending: true });
        if (clientsError) {
            console.error('Client data error:', clientsError);
            throw clientsError;
        }
        const totalClients = clients.length;

        // Fetch total invoices and calculate totals, filtering for outstanding amount
        const { data: invoices, error: invoicesError } = await supabase
            .from('invoices')
            .select('total, balance, status');
        if (invoicesError) {
            console.error('Invoices data error:', invoicesError);
            throw invoicesError;
        }
        const totalInvoices = invoices.length;
        const totalAmount = invoices.reduce((sum, invoice) => sum + (invoice.total || 0), 0);

        // Calculate outstanding amount: sum of balance for invoices with status "Pending" or "Overdue"
        const outstandingAmount = invoices
            .filter(invoice => invoice.status === 'Pending' || invoice.status === 'Overdue')
            .reduce((sum, invoice) => sum + (invoice.balance || 0), 0);

        // Display metric cards in dashboardGrid
        if (dashboardGrid) {
            dashboardGrid.innerHTML = `
                <div class="metric-card">
                    <h3>${totalClients}</h3>
                    <p>Total Clients</p>
                </div>
                <div class="metric-card">
                    <h3>${totalInvoices}</h3>
                    <p>Total Invoices</p>
                </div>
                <div class="metric-card">
                    <h3>INR ${totalAmount.toFixed(2)}</h3>
                    <p>Total Amount</p>
                </div>
                <div class="metric-card">
                    <h3>INR ${outstandingAmount.toFixed(2)}</h3>
                    <p>Outstanding Amount</p>
                </div>
            `;
        } else {
            console.error('dashboardGrid not found in DOM');
        }

        // Fetch and display clients (kept for consistency with navigation, now separate from dashboard metrics)
        if (clientsGrid) {
            if (!clients || clients.length === 0) {
                clientsGrid.innerHTML = '<div class="client-card text-warning">No clients found. Add a client to get started.</div>';
            } else {
                clientsGrid.innerHTML = '';
                clients.forEach(client => {
                    const card = document.createElement('div');
                    card.className = 'client-card';
                    card.innerHTML = `
                        <h3>${client.name}</h3>
                        <p>Email: ${client.email}</p>
                        <p>Address: ${client.address}</p>
                        <button class="btn btn-primary edit-client-btn" data-client-id="${client.id}">Edit Client</button>
                    `;
                    clientsGrid.appendChild(card);
                });

                // Add event listener for Edit buttons in Dashboard
                document.querySelectorAll('.edit-client-btn').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const clientId = btn.dataset.clientId;
                        await editClient(clientId);
                    });
                });
            }
        } else {
            console.error('clientsGrid not found in DOM');
        }

        // Populate client dropdown in report form
        const clientSelect = document.getElementById('client');
        if (clientSelect) {
            clientSelect.innerHTML = '<option value="all_clients">All Clients</option>';
            clients.forEach(client => {
                const option = document.createElement('option');
                option.value = client.id;
                option.textContent = client.name;
                clientSelect.appendChild(option);
            });
        } else {
            console.error('client dropdown not found in DOM');
        }
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        if (dashboardGrid) {
            dashboardGrid.innerHTML = '<div class="metric-card text-danger">Failed to load dashboard metrics: ' + (error.message || 'Unknown error') + '</div>';
        } else {
            console.error('dashboardGrid not found in DOM');
        }
        if (clientsGrid) {
            clientsGrid.innerHTML = '<div class="client-card text-danger">Failed to load clients: ' + (error.message || 'Unknown error') + '</div>';
        } else {
            console.error('clientsGrid not found in DOM');
        }
    }
}

export async function fetchInvoicesList() {
    console.log('Fetching invoices list...');
    try {
        // Fetch recent invoices for the Invoices menu
        await fetchRecentInvoices();

        // This function can be expanded later to fetch all invoices or other lists if needed
    } catch (error) {
        console.error('Error fetching invoices list:', error);
        if (recentInvoicesBody) {
            recentInvoicesBody.innerHTML = '<tr><td colspan="5" class="text-danger">Failed to load invoices: ' + (error.message || 'Unknown error') + '</td></tr>';
        } else {
            console.error('recentInvoicesBody not found in DOM');
        }
    }
}

export async function fetchClients() {
    console.log('Fetching clients...');
    try {
        const { data: clients, error } = await supabase
            .from('clients')
            .select('*')
            .order('name', { ascending: true });

        if (error) {
            console.error('Error fetching clients:', error);
            throw error;
        }
        console.log('Clients data:', clients);

        const clientsGrid = document.getElementById('clientsGrid');
        if (!clientsGrid) {
            console.error('clientsGrid not found in DOM');
            return;
        }

        if (!clients || clients.length === 0) {
            clientsGrid.innerHTML = '<div class="client-card text-warning">No clients found. Add a client to get started.</div>';
        } else {
            clientsGrid.innerHTML = '';
            clients.forEach(client => {
                const card = document.createElement('div');
                card.className = 'client-card';
                card.innerHTML = `
                    <h3>${client.name}</h3>
                    <p>Email: ${client.email}</p>
                    <p>Address: ${client.address}</p>
                    <button class="btn btn-primary edit-client-btn" data-client-id="${client.id}">Edit Client</button>
                `;
                clientsGrid.appendChild(card);
            });

            // Add event listener for Edit buttons in Clients section
            document.querySelectorAll('.edit-client-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const clientId = btn.dataset.clientId;
                    await editClient(clientId);
                });
            });
        }
    } catch (error) {
        console.error('Error fetching clients:', error);
        if (clientsGrid) {
            clientsGrid.innerHTML = '<div class="client-card text-danger">Failed to load clients: ' + (error.message || 'Unknown error') + '</div>';
        } else {
            console.error('clientsGrid not found in DOM');
        }
    }
}

async function editClient(clientId) {
    console.log(`Editing client with ID: ${clientId}`);
    try {
        const { data: client, error } = await supabase
            .from('clients')
            .select('*')
            .eq('id', clientId)
            .single();

        if (error) {
            console.error('Error fetching client for editing:', error);
            throw error;
        }

        // Use the existing #addClientModal for editing
        const clientNameInput = document.getElementById('clientName');
        const clientEmailInput = document.getElementById('clientEmail');
        const clientAddressInput = document.getElementById('clientAddress');

        if (clientNameInput && clientEmailInput && clientAddressInput) {
            clientNameInput.value = client.name;
            clientEmailInput.value = client.email;
            clientAddressInput.value = client.address;

            // Show the modal
            $('#addClientModal').modal('show');

            // Update the form submission to handle editing
            const clientForm = document.getElementById('clientForm');
            if (clientForm) {
                clientForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    try {
                        const name = clientNameInput.value.trim();
                        const email = clientEmailInput.value.trim();
                        const address = clientAddressInput.value.trim();

                        if (!name || !email || !address) {
                            alert('Please enter name, email, and address for the client.');
                            return;
                        }

                        const { error: updateError } = await supabase
                            .from('clients')
                            .update({ name, email, address })
                            .eq('id', clientId);

                        if (updateError) throw updateError;

                        $('#addClientModal').modal('hide');
                        await fetchDashboardData(); // Update Dashboard
                        await fetchClients(); // Update Clients section
                    } catch (error) {
                        console.error('Failed to update client:', error);
                        alert('An error occurred while updating the client: ' + (error.message || 'Unknown error'));
                    }
                }, { once: true }); // Ensure the submit listener is only added once per modal show
            } else {
                console.error('clientForm not found in DOM');
            }
        } else {
            console.error('Client inputs not found in DOM');
        }
    } catch (error) {
        console.error('Failed to fetch client for editing:', error);
        alert('Failed to load client details: ' + (error.message || 'Unknown error'));
    }
}