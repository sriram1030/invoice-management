// js/reports.js
import { supabase } from './config.js';
import { generateReportPDF } from './utils.js';

export function setupReportGeneration() {
    console.log('Setting up report generation...');
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