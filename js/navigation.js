// js/navigation.js
import { fetchDashboardData } from './invoicesList.js';
import { fetchRecentInvoices } from './invoices.js';
import { fetchClients } from './invoicesList.js';
import { supabase } from './config.js'; // Import supabase from config.js

export function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const sections = {
        dashboard: document.querySelector('.dashboard-section'),
        invoices: document.querySelector('.invoices-section'),
        clients: document.querySelector('.clients-section'),
        reports: document.querySelector('.reports-section'),
        settings: document.querySelector('.settings-section')
    };

    // Log sections to debug
    console.log('Initialized sections:', sections);

    navItems.forEach(item => {
        item.addEventListener('click', async () => {
            console.log(`Navigating to ${item.dataset.section}`);
            // Remove active class from all nav items
            navItems.forEach(nav => nav.classList.remove('active'));
            // Add active class to clicked item
            item.classList.add('active');

            // Hide all sections and log them
            Object.values(sections).forEach(section => {
                if (section) {
                    console.log(`Hiding section: ${section.className}`);
                    section.style.display = 'none';
                } else {
                    console.error(`Section for ${section} not found in DOM`);
                }
            });

            // Show the selected section
            const section = sections[item.dataset.section];
            if (section) {
                console.log(`Showing ${item.dataset.section} section`);
                section.style.display = 'block';

                // Fetch data for specific sections
                if (item.dataset.section === 'dashboard') {
                    console.log('Fetching dashboard data...');
                    await fetchDashboardData();
                } else if (item.dataset.section === 'invoices') {
                    console.log('Fetching recent invoices...');
                    await fetchRecentInvoices();
                } else if (item.dataset.section === 'clients') {
                    console.log('Fetching clients...');
                    await fetchClients();
                } else if (item.dataset.section === 'reports') {
                    console.log('Reports section activated (showing inline form)');
                    // No modal or additional fetch needed; the inline form is already in the section
                    setupReportForm(); // Call a new function to initialize the inline report form
                } else if (item.dataset.section === 'settings') {
                    console.log('Settings section activated (no fetch needed)');
                    // No additional fetch needed here, handled in settings.js
                }
            } else {
                console.error(`Section ${item.dataset.section} not found in DOM`);
            }
        });
    });

    // Set initial active state to Dashboard
    console.log('Initializing navigation with Dashboard');
    if (sections.dashboard) {
        sections.dashboard.style.display = 'block';
        navItems[0].classList.add('active');
        fetchDashboardData(); // Initial load for Dashboard
    } else {
        console.error('Dashboard section not found in DOM');
    }
}

// New function to initialize the inline report form
function setupReportForm() {
    const reportForm = document.getElementById('reportForm');
    const periodSelect = document.getElementById('period');
    const customPeriod = document.getElementById('customPeriod');
    const startDate = document.getElementById('startDate');
    const endDate = document.getElementById('endDate');
    const clientSelect = document.getElementById('client');

    if (reportForm && periodSelect && customPeriod && clientSelect) {
        // Handle period selection to show/hide custom date fields
        periodSelect.addEventListener('change', (e) => {
            if (e.target.value === 'custom') {
                customPeriod.style.display = 'block';
            } else {
                customPeriod.style.display = 'none';
            }
        });

        // Populate client dropdown dynamically
        fetchClientsForReport();

        // Handle report generation
        reportForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            console.log('Generating report...');
            try {
                const reportType = document.getElementById('reportType').value;
                const period = document.getElementById('period').value;
                const status = document.getElementById('status').value;
                const currency = document.getElementById('currency').value;
                const clientId = document.getElementById('client').value;

                let query = supabase.from('invoices').select('*, clients(name)');
                if (period === 'custom' && startDate.value && endDate.value) {
                    query = query.gte('invoice_date', startDate.value).lte('invoice_date', endDate.value);
                } else if (period === 'this_month') {
                    const now = new Date();
                    const start = new Date(now.getFullYear(), now.getMonth(), 1);
                    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                    query = query.gte('invoice_date', start.toISOString().split('T')[0]).lte('invoice_date', end.toISOString().split('T')[0]);
                } else if (period === 'last_month') {
                    const now = new Date();
                    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    const end = new Date(now.getFullYear(), now.getMonth(), 0);
                    query = query.gte('invoice_date', start.toISOString().split('T')[0]).lte('invoice_date', end.toISOString().split('T')[0]);
                }

                if (status !== 'all') {
                    query = query.eq('status', status);
                }

                if (clientId !== 'all_clients') {
                    query = query.eq('client_id', clientId);
                }

                const { data, error } = await query;
                if (error) throw error;

                console.log('Report data:', data);
                generateReportPDF(data, reportType, period, status, currency, clientId);
            } catch (error) {
                console.error('Failed to generate report:', error);
                alert('An error occurred while generating the report: ' + (error.message || 'Unknown error'));
            }
        });
    } else {
        console.error('Report form or related elements not found in DOM');
    }
}

// Function to fetch and populate clients in the report form
async function fetchClientsForReport() {
    try {
        const { data: clients, error } = await supabase
            .from('clients')
            .select('*')
            .order('name', { ascending: true });
        if (error) {
            console.error('Error fetching clients for report:', error);
            throw error;
        }

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
            console.error('client dropdown not found in DOM for report');
        }
    } catch (error) {
        console.error('Failed to populate client list for report:', error);
        alert('An error occurred while loading clients: ' + (error.message || 'Unknown error'));
    }
}