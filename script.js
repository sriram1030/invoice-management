import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://zpjrivjogqljxnodmtbj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwanJpdmpvZ3Fsanhub2RtdGJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk4NzgxNDUsImV4cCI6MjA1NTQ1NDE0NX0.FQ_ru6GJAOBvjJVTw6qr0RdntCDHh8KmUAUfCxxGROA';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

document.addEventListener('DOMContentLoaded', () => {
    const dashboardSection = document.querySelector('.dashboard-section');
    const invoicesSection = document.querySelector('.invoices-section');
    const estimatesSection = document.querySelector('.estimates-section');
    const reportsSection = document.querySelector('.reports-section');
    const clientsGrid = document.getElementById('clientsGrid');
    const invoicesGrid = document.getElementById('invoicesGrid');
    const estimatesGrid = document.getElementById('estimatesGrid');
    const recentInvoicesBody = document.getElementById('recentInvoicesBody');
    const addClientBtn = document.querySelector('.add-client-btn');
    const addInvoiceModal = document.getElementById('addInvoiceModal');
    const addInvoiceForm = document.getElementById('addInvoiceForm');
    const addEstimateModal = document.getElementById('addEstimateModal');
    const addEstimateForm = document.getElementById('addEstimateForm');
    const clientForm = document.getElementById('clientForm');
    const itemsTable = document.getElementById('itemsTable');
    const itemRowTemplate = document.getElementById('itemRowTemplate');
    const estimateItemsTable = document.getElementById('estimateItemsTable');
    const estimateItemRowTemplate = document.getElementById('estimateItemRowTemplate');
    const addItemBtn = document.getElementById('addItemBtn');
    const addEstimateItemBtn = document.getElementById('addEstimateItemBtn');
    const toAddress = document.getElementById('toAddress');
    const toAddressEstimate = document.getElementById('toAddressEstimate');
    const navItems = document.querySelectorAll('.nav-item');
    const generateReportBtn = document.querySelector('.generate-report-btn');
    const createEstimateBtn = document.querySelector('.create-estimate-btn');

    let selectedClientId = null;
    let currentInvoiceId = null;
    let currentEstimateId = null;

    // Navigation with new Estimates option
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            const section = item.dataset.section;
            if (section === 'dashboard') {
                dashboardSection.style.display = 'block';
                invoicesSection.style.display = 'none';
                estimatesSection.style.display = 'none';
                reportsSection.style.display = 'none';
                fetchDashboardData();
            } else if (section === 'invoices') {
                dashboardSection.style.display = 'none';
                invoicesSection.style.display = 'block';
                estimatesSection.style.display = 'none';
                reportsSection.style.display = 'none';
                fetchAllInvoices();
            } else if (section === 'estimates') {
                dashboardSection.style.display = 'none';
                invoicesSection.style.display = 'none';
                estimatesSection.style.display = 'block';
                reportsSection.style.display = 'none';
                fetchAllEstimates();
            } else if (section === 'reports') {
                dashboardSection.style.display = 'none';
                invoicesSection.style.display = 'none';
                estimatesSection.style.display = 'none';
                reportsSection.style.display = 'block';
                fetchDashboardData(); // Ensure data is loaded for reports
            } else if (section === 'settings') {
                $('#settingsModal').modal('show');
            }
        });
    });

    async function getNextInvoiceNumber() {
        try {
            const { data, error } = await supabase
                .from('invoices')
                .select('invoice_number')
                .order('invoice_number', { ascending: false })
                .limit(1);

            if (error) throw error;

            if (!data || data.length === 0) return 'INV-300';

            const highestNumber = data[0].invoice_number.replace('INV-', '');
            const nextNumber = Math.max(parseInt(highestNumber, 10) + 1, 300);
            return `INV-${nextNumber}`;
        } catch (error) {
            console.error('Error in getNextInvoiceNumber:', error);
            return 'INV-300';
        }
    }

    async function getNextEstimateNumber() {
        try {
            const { data, error } = await supabase
                .rpc('get_next_estimate_number'); // Use the PostgreSQL function

            if (error) throw error;

            return data;
        } catch (error) {
            console.error('Error in getNextEstimateNumber:', error);
            return 'EST-100';
        }
    }

    async function fetchDashboardData() {
        try {
            // Fetch income
            const { data: invoices, error: invoiceError } = await supabase
                .from('invoices')
                .select('total')
                .eq('status', 'Paid');
            if (invoiceError) throw invoiceError;
            const totalIncome = invoices.reduce((sum, invoice) => sum + (invoice.total || 0), 0);
            document.querySelector('.income-card').textContent = `Income: ₹${totalIncome.toFixed(2)}`;

            // Fetch client count
            const { data: clients, error: clientError } = await supabase
                .from('clients')
                .select('*', { count: 'exact' });
            if (clientError) throw clientError;
            document.querySelector('.client-count-card').textContent = `Clients: ${clients.length}`;

            // Fetch invoice status counts
            const { data: statusCounts, error: statusError } = await supabase
                .rpc('get_invoice_status_counts');
            if (statusError) throw statusError;
            const statusCard = document.querySelector('.status-count-card');
            statusCard.innerHTML = `
                <p>Pending: ${statusCounts.find(item => item.status === 'Pending')?.count || 0}</p>
                <p>Paid: ${statusCounts.find(item => item.status === 'Paid')?.count || 0}</p>
                <p>Overdue: ${statusCounts.find(item => item.status === 'Overdue')?.count || 0}</p>
                <p>Cancelled: ${statusCounts.find(item => item.status === 'Cancelled')?.count || 0}</p>
            `;

            // Fetch and display clients
            const { data: clientData, error: clientDataError } = await supabase
                .from('clients')
                .select('*')
                .order('name', { ascending: true });
            if (clientDataError) throw clientDataError;

            clientsGrid.innerHTML = '';
            clientData.forEach(client => {
                const card = document.createElement('div');
                card.className = 'client-card';
                card.innerHTML = `
                    <h3>${client.name}</h3>
                    <p>Email: ${client.email}</p>
                    <p>Address: ${client.address}</p>
                    <button class="create-invoice-btn" data-client-id="${client.id}">Create Invoice</button>
                    <button class="create-estimate-btn" data-client-id="${client.id}">Create Estimate</button>
                `;
                clientsGrid.appendChild(card);
            });

            // Populate client dropdown in report modal
            const clientSelect = document.getElementById('client');
            clientSelect.innerHTML = '<option value="all_clients">All Clients</option>';
            clientData.forEach(client => {
                const option = document.createElement('option');
                option.value = client.id;
                option.textContent = client.name;
                clientSelect.appendChild(option);
            });

            document.querySelectorAll('.create-invoice-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    selectedClientId = btn.dataset.clientId;
                    const { data: client, error } = await supabase
                        .from('clients')
                        .select('*')
                        .eq('id', selectedClientId)
                        .single();
                    if (error) throw error;

                    toAddress.innerHTML = `To: ${client.name}<br>${client.email}<br>${client.address}`;
                    $('#addInvoiceModal').modal('show');
                    const nextInvoiceNumber = await getNextInvoiceNumber();
                    document.querySelector('#invoiceNumber').textContent = `Invoice No.: ${nextInvoiceNumber}`;
                });
            });

            document.querySelectorAll('.create-estimate-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    selectedClientId = btn.dataset.clientId;
                    const { data: client, error } = await supabase
                        .from('clients')
                        .select('*')
                        .eq('id', selectedClientId)
                        .single();
                    if (error) throw error;

                    toAddressEstimate.innerHTML = `To: ${client.name}<br>${client.email}<br>${client.address}`;
                    $('#addEstimateModal').modal('show');
                    const nextEstimateNumber = await getNextEstimateNumber();
                    document.querySelector('#estimateNumber').textContent = `Estimate No.: ${nextEstimateNumber}`;
                });
            });

            await fetchRecentInvoices();
            await fetchAllEstimates();
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
            clientsGrid.innerHTML = '<div class="client-card text-danger">Failed to load clients: ' + (error.message || 'Unknown error') + '</div>';
        }
    }

    async function fetchRecentInvoices() {
        try {
            const { data: invoices, error } = await supabase
                .from('invoices')
                .select('*, clients(name)')
                .order('invoice_number', { ascending: false })
                .limit(5);

            if (error) throw error;

            recentInvoicesBody.innerHTML = '';
            if (!invoices || invoices.length === 0) {
                recentInvoicesBody.innerHTML = '<tr><td colspan="5">No recent invoices found</td></tr>';
                return;
            }

            invoices.forEach(invoice => {
                const row = document.createElement('tr');
                row.innerHTML = `
                    <td>${invoice.invoice_number}</td>
                    <td>${invoice.clients.name}</td>
                    <td>${new Date(invoice.invoice_date).toLocaleDateString()}</td>
                    <td>
                        <select class="form-control status-select" data-invoice-id="${invoice.id}">
                            <option value="Pending" ${invoice.status === 'Pending' ? 'selected' : ''}>Pending</option>
                            <option value="Paid" ${invoice.status === 'Paid' ? 'selected' : ''}>Paid</option>
                            <option value="Overdue" ${invoice.status === 'Overdue' ? 'selected' : ''}>Overdue</option>
                            <option value="Cancelled" ${invoice.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                        </select>
                    </td>
                    <td>
                        <button class="btn btn-secondary edit-invoice" data-invoice-id="${invoice.id}">Edit</button>
                        <button class="btn btn-info view-pdf" data-invoice-id="${invoice.id}">View PDF</button>
                    </td>
                `;
                recentInvoicesBody.appendChild(row);
            });

            document.querySelectorAll('.status-select').forEach(select => {
                select.addEventListener('change', async (e) => {
                    const invoiceId = e.target.dataset.invoiceId;
                    const newStatus = e.target.value;
                    await updateInvoiceStatus(invoiceId, newStatus);
                    fetchRecentInvoices();
                });
            });

            document.querySelectorAll('.edit-invoice, .view-pdf').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const invoiceId = e.target.dataset.invoiceId;
                    if (e.target.classList.contains('edit-invoice')) {
                        currentInvoiceId = invoiceId;
                        await editInvoice(invoiceId);
                    } else if (e.target.classList.contains('view-pdf')) {
                        await generateInvoicePDF(invoiceId, 'invoice');
                    }
                });
            });
        } catch (error) {
            console.error('Error fetching recent invoices:', error);
            recentInvoicesBody.innerHTML = '<tr><td colspan="5" class="text-danger">Failed to load recent invoices: ' + (error.message || 'Unknown error') + '</td></tr>';
        }
    }

    async function fetchAllInvoices() {
        try {
            const { data: invoices, error } = await supabase
                .from('invoices')
                .select('*, clients(name)')
                .order('invoice_number', { ascending: false });

            if (error) throw error;

            invoicesGrid.innerHTML = '';
            if (!invoices || invoices.length === 0) {
                invoicesGrid.innerHTML = '<div class="invoice-card">No invoices found</div>';
                return;
            }

            invoices.forEach(invoice => {
                const card = document.createElement('div');
                card.className = 'invoice-card';
                card.innerHTML = `
                    <div class="invoice-details">
                        <p>Invoice No.: ${invoice.invoice_number}</p>
                        <p>Client: ${invoice.clients.name}</p>
                        <p>Date: ${new Date(invoice.invoice_date).toLocaleDateString()}</p>
                        <p>Status: 
                            <select class="form-control status-select" data-invoice-id="${invoice.id}">
                                <option value="Pending" ${invoice.status === 'Pending' ? 'selected' : ''}>Pending</option>
                                <option value="Paid" ${invoice.status === 'Paid' ? 'selected' : ''}>Paid</option>
                                <option value="Overdue" ${invoice.status === 'Overdue' ? 'selected' : ''}>Overdue</option>
                                <option value="Cancelled" ${invoice.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                            </select>
                        </p>
                    </div>
                    <div class="actions">
                        <button class="btn btn-secondary edit-invoice" data-invoice-id="${invoice.id}">Edit</button>
                        <button class="btn btn-info view-pdf" data-invoice-id="${invoice.id}">View PDF</button>
                    </div>
                `;
                invoicesGrid.appendChild(card);
            });

            document.querySelectorAll('.status-select').forEach(select => {
                select.addEventListener('change', async (e) => {
                    const invoiceId = e.target.dataset.invoiceId;
                    const newStatus = e.target.value;
                    await updateInvoiceStatus(invoiceId, newStatus);
                    fetchAllInvoices();
                });
            });

            document.querySelectorAll('.edit-invoice, .view-pdf').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const invoiceId = e.target.dataset.invoiceId;
                    if (e.target.classList.contains('edit-invoice')) {
                        currentInvoiceId = invoiceId;
                        await editInvoice(invoiceId);
                    } else if (e.target.classList.contains('view-pdf')) {
                        await generateInvoicePDF(invoiceId, 'invoice');
                    }
                });
            });
        } catch (error) {
            console.error('Error fetching invoices:', error);
            invoicesGrid.innerHTML = '<div class="invoice-card text-danger">Failed to load invoices: ' + (error.message || 'Unknown error') + '</div>';
        }
    }

    async function fetchAllEstimates() {
        try {
            const { data: estimates, error } = await supabase
                .from('estimates')
                .select('*, clients(name)')
                .order('invoice_number', { ascending: false });

            if (error) throw error;

            estimatesGrid.innerHTML = '';
            if (!estimates || estimates.length === 0) {
                estimatesGrid.innerHTML = '<div class="estimate-card">No estimates found</div>';
                return;
            }

            estimates.forEach(estimate => {
                const card = document.createElement('div');
                card.className = 'estimate-card';
                card.innerHTML = `
                    <div class="estimate-details">
                        <p>Estimate No.: ${estimate.invoice_number}</p>
                        <p>Client: ${estimate.clients.name}</p>
                        <p>Date: ${new Date(estimate.invoice_date).toLocaleDateString()}</p>
                        <p>Status: 
                            <select class="form-control status-select" data-estimate-id="${estimate.id}">
                                <option value="Pending" ${estimate.status === 'Pending' ? 'selected' : ''}>Pending</option>
                                <option value="Accepted" ${estimate.status === 'Accepted' ? 'selected' : ''}>Accepted</option>
                                <option value="Rejected" ${estimate.status === 'Rejected' ? 'selected' : ''}>Rejected</option>
                            </select>
                        </p>
                    </div>
                    <div class="actions">
                        <button class="btn btn-secondary edit-estimate" data-estimate-id="${estimate.id}">Edit</button>
                        <button class="btn btn-info view-pdf" data-estimate-id="${estimate.id}">View PDF</button>
                    </div>
                `;
                estimatesGrid.appendChild(card);
            });

            document.querySelectorAll('.status-select').forEach(select => {
                select.addEventListener('change', async (e) => {
                    const estimateId = e.target.dataset.estimateId;
                    const newStatus = e.target.value;
                    await updateEstimateStatus(estimateId, newStatus);
                    fetchAllEstimates();
                });
            });

            document.querySelectorAll('.edit-estimate, .view-pdf').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const estimateId = e.target.dataset.estimateId;
                    if (e.target.classList.contains('edit-estimate')) {
                        currentEstimateId = estimateId;
                        await editEstimate(estimateId);
                    } else if (e.target.classList.contains('view-pdf')) {
                        await generateInvoicePDF(estimateId, 'estimate');
                    }
                });
            });
        } catch (error) {
            console.error('Error fetching estimates:', error);
            estimatesGrid.innerHTML = '<div class="estimate-card text-danger">Failed to load estimates: ' + (error.message || 'Unknown error') + '</div>';
        }
    }

    async function updateInvoiceStatus(invoiceId, newStatus) {
        try {
            const { error } = await supabase
                .from('invoices')
                .update({ status: newStatus })
                .eq('id', invoiceId);
            if (error) throw error;
        } catch (error) {
            console.error('Failed to update invoice status:', error);
            alert('Failed to update invoice status: ' + (error.message || 'Unknown error'));
        }
    }

    async function updateEstimateStatus(estimateId, newStatus) {
        try {
            const { error } = await supabase
                .from('estimates')
                .update({ status: newStatus })
                .eq('id', estimateId);
            if (error) throw error;
        } catch (error) {
            console.error('Failed to update estimate status:', error);
            alert('Failed to update estimate status: ' + (error.message || 'Unknown error'));
        }
    }

    async function editInvoice(invoiceId) {
        try {
            const { data: invoice, error } = await supabase
                .from('invoices')
                .select('*, clients(name, email, address)')
                .eq('id', invoiceId)
                .single();

            if (error) throw error;

            const editModal = document.createElement('div');
            editModal.className = 'modal fade';
            editModal.id = 'editInvoiceModal';
            editModal.setAttribute('tabindex', '-1');
            editModal.setAttribute('aria-labelledby', 'editInvoiceModalLabel');
            editModal.setAttribute('aria-hidden', 'true');
            editModal.innerHTML = `
                <div class="modal-dialog modal-xl">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="editInvoiceModalLabel">Edit Invoice</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <form id="editInvoiceForm">
                                <div class="row">
                                    <div class="col-md-6">
                                        <p><strong>From:</strong><br>
                                        Grafikos<br>
                                        Basement Plot 27, Srinivasa Nagar<br>
                                        OMR Kottivakkam<br>
                                        Chennai, Tamilnadu, 600041<br>
                                        India<br>
                                        GSTIN: 33AGXPV873G2ZB</p>
                                    </div>
                                    <div class="col-md-6 text-end">
                                        <p><strong>Invoice No.: ${invoice.invoice_number}</strong></p>
                                        <p><strong>Date:</strong> <input type="date" id="editDate" value="${invoice.invoice_date}" required style="display: inline; margin-left: 5px;"></p>
                                        <p><strong>Invoice Due:</strong> <input type="date" id="editDueDate" value="${invoice.due_date}" required style="display: inline; margin-left: 5px;"></p>
                                    </div>
                                </div>
                                <div class="row mt-3">
                                    <div class="col-md-12">
                                        <div class="mb-3">
                                            <label for="editToAddress" class="form-label">To:</label>
                                            <div id="editToAddress">${invoice.clients.name}<br>${invoice.clients.email}<br>${invoice.clients.address}</div>
                                        </div>
                                    </div>
                                </div>
                                <div class="row mt-3">
                                    <div class="col-md-12">
                                        <div class="mb-3">
                                            <label for="editItemsTable" class="form-label">Items</label>
                                            <table class="table table-bordered" id="editItemsTable">
                                                <thead>
                                                    <tr>
                                                        <th>Description</th>
                                                        <th>Quantity</th>
                                                        <th>Rate</th>
                                                        <th>Amount</th>
                                                        <th>Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr id="editItemRowTemplate" style="display: none;">
                                                        <td><input type="text" class="form-control item-description"></td>
                                                        <td><input type="number" class="form-control item-quantity"></td>
                                                        <td><input type="number" step="0.01" class="form-control item-rate"></td>
                                                        <td><span class="item-amount">INR 0.00</span></td>
                                                        <td><button type="button" class="btn btn-danger remove-item">Remove</button></td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                            <button type="button" class="btn btn-primary mb-3" id="editAddItemBtn">Add Item</button>
                                        </div>
                                    </div>
                                </div>
                                <div class="row mt-3">
                                    <div class="col-md-12">
                                        <div class="mb-3">
                                            <label for="editTaxRate" class="form-label">Tax Rate (%)</label>
                                            <input type="number" step="0.01" class="form-control" id="editTaxRate" value="${invoice.tax_rate}" required>
                                        </div>
                                        <div class="mb-3">
                                            <label for="editDiscountType" class="form-label">Discount Type</label>
                                            <select class="form-control" id="editDiscountType">
                                                <option value="none" ${invoice.discount_type === 'none' ? 'selected' : ''}>None</option>
                                                <option value="percentage" ${invoice.discount_type === 'percentage' ? 'selected' : ''}>Percentage</option>
                                                <option value="fixed" ${invoice.discount_type === 'fixed' ? 'selected' : ''}>Fixed Amount</option>
                                            </select>
                                        </div>
                                        <div class="mb-3" id="editDiscountValueContainer" style="display: ${invoice.discount_type === 'none' ? 'none' : 'block'};">
                                            <label for="editDiscountValue" class="form-label">Discount Value</label>
                                            <input type="number" step="0.01" class="form-control" id="editDiscountValue" value="${invoice.discount_value || ''}">
                                        </div>
                                        <div class="mb-3">
                                            <label for="editShippingCharge" class="form-label">Shipping Charge (INR)</label>
                                            <input type="number" step="0.01" class="form-control" id="editShippingCharge" value="${invoice.shipping_charge}">
                                        </div>
                                    </div>
                                </div>
                                <div class="row mt-3">
                                    <div class="col-md-12">
                                        <div class="mb-3">
                                            <label class="form-label">Is Recurring</label>
                                            <input type="radio" name="editIsRecurring" value="true" id="editIsRecurringYes" ${invoice.is_recurring ? 'checked' : ''}> Yes
                                            <input type="radio" name="editIsRecurring" value="false" id="editIsRecurringNo" ${!invoice.is_recurring ? 'checked' : ''}> No
                                        </div>
                                        <div class="mb-3" id="editRecurrenceDetails" style="display: ${invoice.is_recurring ? 'block' : 'none'};">
                                            <label for="editRecurrenceFrequency" class="form-label">Frequency</label>
                                            <select class="form-control" id="editRecurrenceFrequency">
                                                <option value="monthly" ${invoice.recurrence_frequency === 'monthly' ? 'selected' : ''}>Monthly</option>
                                                <option value="quarterly" ${invoice.recurrence_frequency === 'quarterly' ? 'selected' : ''}>Quarterly</option>
                                                <option value="yearly" ${invoice.recurrence_frequency === 'yearly' ? 'selected' : ''}>Yearly</option>
                                            </select>
                                            <label for="editRecurrenceStartDate" class="form-label">Start Date</label>
                                            <input type="date" class="form-control" id="editRecurrenceStartDate" value="${invoice.recurrence_start_date || ''}">
                                            <label for="editRecurrenceEndDate" class="form-label">End Date (optional)</label>
                                            <input type="date" class="form-control" id="editRecurrenceEndDate" value="${invoice.recurrence_end_date || ''}">
                                        </div>
                                    </div>
                                </div>
                                <div class="row mt-3">
                                    <div class="col-md-12">
                                        <div class="totals-container" id="editTotalsContainer"></div>
                                    </div>
                                </div>
                                <div class="row mt-3">
                                    <div class="col">
                                        <p><strong>BANK DETAILS:</strong><br>
                                        GRAFIKOS<br>
                                        A/C No. 158500202082424,<br>
                                        Tamilnad Mercantile Bank Ltd,<br>
                                        Chennai-Thiruvanmiyur Branch,<br>
                                        IFSC Code: TMBL0000158,<br>
                                        MICR Code: 600060010.</p>
                                    </div>
                                </div>
                                <div class="row mt-3">
                                    <div class="col text-center">
                                        <button type="submit" class="btn btn-primary">Save Changes</button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(editModal);
            const editItemsTable = document.getElementById('editItemsTable');
            const editItemRowTemplate = document.getElementById('editItemRowTemplate');
            const editAddItemBtn = document.getElementById('editAddItemBtn');
            const editTotalsContainer = document.getElementById('editTotalsContainer');
            const editInvoiceForm = document.getElementById('editInvoiceForm');

            // Populate items
            editItemsTable.querySelector('tbody').innerHTML = '';
            invoice.items.forEach(item => {
                const newRow = editItemRowTemplate.cloneNode(true);
                newRow.removeAttribute('id');
                newRow.style.display = '';
                newRow.querySelector('.item-description').value = item.description;
                newRow.querySelector('.item-quantity').value = item.quantity;
                newRow.querySelector('.item-rate').value = item.rate;
                newRow.querySelector('.item-amount').textContent = `INR ${item.amount.toFixed(2)}`;
                newRow.querySelector('.remove-item').addEventListener('click', () => {
                    newRow.remove();
                    updateEditTotals();
                });
                newRow.querySelectorAll('input').forEach(input => {
                    input.addEventListener('input', updateEditTotals);
                });
                editItemsTable.querySelector('tbody').appendChild(newRow);
            });

            // Toggle discount and recurrence fields
            document.getElementById('editDiscountType').addEventListener('change', (e) => {
                document.getElementById('editDiscountValueContainer').style.display = e.target.value === 'none' ? 'none' : 'block';
            });
            document.querySelectorAll('input[name="editIsRecurring"]').forEach(radio => {
                radio.addEventListener('change', (e) => {
                    document.getElementById('editRecurrenceDetails').style.display = e.target.value === 'true' ? 'block' : 'none';
                });
            });

            function updateEditTotals() {
                let subTotalAmount = 0;
                document.querySelectorAll('#editItemsTable tbody tr:not(#editItemRowTemplate)').forEach(row => {
                    const quantity = parseFloat(row.querySelector('.item-quantity').value) || 0;
                    const rate = parseFloat(row.querySelector('.item-rate').value) || 0;
                    const amount = quantity * rate;
                    row.querySelector('.item-amount').textContent = `INR ${amount.toFixed(2)}`;
                    subTotalAmount += amount;
                });

                const taxRate = parseFloat(document.getElementById('editTaxRate').value) || 0;
                const discountType = document.getElementById('editDiscountType').value;
                const discountValue = parseFloat(document.getElementById('editDiscountValue').value) || 0;
                let discountAmount = 0;
                if (discountType === 'percentage') discountAmount = subTotalAmount * (discountValue / 100);
                else if (discountType === 'fixed') discountAmount = discountValue;
                const discountedSubTotal = subTotalAmount - discountAmount;
                const taxAmount = discountedSubTotal * (taxRate / 100);
                const shippingCharge = parseFloat(document.getElementById('editShippingCharge').value) || 0;
                const totalBeforeShipping = discountedSubTotal + taxAmount;
                const totalAmount = totalBeforeShipping + shippingCharge;

                editTotalsContainer.innerHTML = `
                    <div class="total-row"><span class="label">Sub Total:</span><span class="amount">INR ${subTotalAmount.toFixed(2)}</span></div>
                    <div class="total-row"><span class="label">Discount:</span><span class="amount">${discountType === 'none' ? 'None' : `INR ${discountAmount.toFixed(2)}`}</span></div>
                    <div class="total-row"><span class="label">Discounted Sub Total:</span><span class="amount">INR ${discountedSubTotal.toFixed(2)}</span></div>
                    <div class="total-row"><span class="label">Tax (${taxRate}%):</span><span class="amount">INR ${taxAmount.toFixed(2)}</span></div>
                    <div class="total-row"><span class="label">Total Before Shipping:</span><span class="amount">INR ${totalBeforeShipping.toFixed(2)}</span></div>
                    <div class="total-row"><span class="label">Shipping Charge:</span><span class="amount">INR ${shippingCharge.toFixed(2)}</span></div>
                    <div class="total-row"><span class="label">Total:</span><span class="amount">INR ${totalAmount.toFixed(2)}</span></div>
                    <div class="total-row"><span class="label">Balance:</span><span class="amount red">INR ${totalAmount.toFixed(2)}</span></div>
                `;
            }

            updateEditTotals();

            editAddItemBtn.addEventListener('click', () => {
                const newRow = editItemRowTemplate.cloneNode(true);
                newRow.removeAttribute('id');
                newRow.style.display = '';
                newRow.querySelector('.remove-item').addEventListener('click', () => {
                    newRow.remove();
                    updateEditTotals();
                });
                newRow.querySelectorAll('input').forEach(input => {
                    input.addEventListener('input', updateEditTotals);
                });
                editItemsTable.querySelector('tbody').appendChild(newRow);
            });

            editInvoiceForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                try {
                    const date = document.getElementById('editDate').value;
                    const dueDate = document.getElementById('editDueDate').value;
                    if (!date || !dueDate) {
                        alert('Please ensure both Date and Due Date are selected.');
                        return;
                    }

                    let items = [];
                    let allItemsValid = true;
                    document.querySelectorAll('#editItemsTable tbody tr:not(#editItemRowTemplate)').forEach(row => {
                        const description = row.querySelector('.item-description').value;
                        const quantity = row.querySelector('.item-quantity').value;
                        const rate = row.querySelector('.item-rate').value;
                        if (!description || !quantity || !rate || isNaN(parseFloat(quantity)) || isNaN(parseFloat(rate)) || parseFloat(quantity) <= 0 || parseFloat(rate) <= 0) {
                            allItemsValid = false;
                            return;
                        }
                        items.push({
                            description,
                            quantity: parseFloat(quantity),
                            rate: parseFloat(rate),
                            amount: parseFloat(row.querySelector('.item-amount').textContent.replace('INR ', ''))
                        });
                    });

                    if (!allItemsValid || items.length === 0) {
                        alert('Please ensure all item fields are correctly filled out.');
                        return;
                    }

                    const taxRate = parseFloat(document.getElementById('editTaxRate').value) || 0;
                    const discountType = document.getElementById('editDiscountType').value;
                    const discountValue = discountType === 'none' ? null : parseFloat(document.getElementById('editDiscountValue').value) || 0;
                    const shippingCharge = parseFloat(document.getElementById('editShippingCharge').value) || 0;
                    const subTotalAmount = parseFloat(document.querySelector('#editTotalsContainer .total-row:first-child .amount').textContent.replace('INR ', '')) || 0;
                    const discountAmount = discountType === 'percentage' ? subTotalAmount * (discountValue / 100) : (discountType === 'fixed' ? discountValue : 0);
                    const discountedSubTotal = subTotalAmount - discountAmount;
                    const taxAmount = discountedSubTotal * (taxRate / 100);
                    const totalBeforeShipping = discountedSubTotal + taxAmount;
                    const totalAmount = totalBeforeShipping + shippingCharge;

                    const isRecurring = document.querySelector('input[name="editIsRecurring"]:checked').value === 'true';
                    const recurrenceFrequency = isRecurring ? document.getElementById('editRecurrenceFrequency').value : null;
                    const recurrenceStartDate = isRecurring ? document.getElementById('editRecurrenceStartDate').value : null;
                    const recurrenceEndDate = isRecurring ? document.getElementById('editRecurrenceEndDate').value || null : null;

                    const { error } = await supabase
                        .from('invoices')
                        .update({
                            invoice_date: date,
                            due_date: dueDate,
                            items,
                            sub_total: subTotalAmount,
                            tax_rate: taxRate,
                            discount_type: discountType,
                            discount_value: discountValue,
                            shipping_charge: shippingCharge,
                            total: totalAmount,
                            balance: totalAmount,
                            is_recurring: isRecurring,
                            recurrence_frequency: recurrenceFrequency,
                            recurrence_start_date: recurrenceStartDate,
                            recurrence_end_date: recurrenceEndDate
                        })
                        .eq('id', currentInvoiceId);

                    if (error) throw error;

                    $('#editInvoiceModal').modal('hide');
                    fetchAllInvoices();
                    fetchRecentInvoices();
                    document.body.removeChild(editModal);
                } catch (error) {
                    console.error('Failed to update invoice:', error);
                    alert('An error occurred while updating the invoice: ' + (error.message || 'Unknown error'));
                }
            });

            $('#editInvoiceModal').modal('show');
        } catch (error) {
            console.error('Failed to fetch invoice for editing:', error);
            alert('Failed to fetch invoice details: ' + (error.message || 'Unknown error'));
        }
    }

    async function editEstimate(estimateId) {
        try {
            const { data: estimate, error } = await supabase
                .from('estimates')
                .select('*, clients(name, email, address)')
                .eq('id', estimateId)
                .single();

            if (error) throw error;

            const editModal = document.createElement('div');
            editModal.className = 'modal fade';
            editModal.id = 'editEstimateModal';
            editModal.setAttribute('tabindex', '-1');
            editModal.setAttribute('aria-labelledby', 'editEstimateModalLabel');
            editModal.setAttribute('aria-hidden', 'true');
            editModal.innerHTML = `
                <div class="modal-dialog modal-xl">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title" id="editEstimateModalLabel">Edit Estimate</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <form id="editEstimateForm">
                                <div class="row">
                                    <div class="col-md-6">
                                        <p><strong>From:</strong><br>
                                        Grafikos<br>
                                        Basement Plot 27, Srinivasa Nagar<br>
                                        OMR Kottivakkam<br>
                                        Chennai, Tamilnadu, 600041<br>
                                        India<br>
                                        GSTIN: 33AGXPV873G2ZB</p>
                                    </div>
                                    <div class="col-md-6 text-end">
                                        <p><strong>Estimate No.: ${estimate.invoice_number}</strong></p>
                                        <p><strong>Date:</strong> <input type="date" id="editEstimateDate" value="${estimate.invoice_date}" required style="display: inline; margin-left: 5px;"></p>
                                        <p><strong>Estimate Due:</strong> <input type="date" id="editEstimateDueDate" value="${estimate.due_date}" required style="display: inline; margin-left: 5px;"></p>
                                    </div>
                                </div>
                                <div class="row mt-3">
                                    <div class="col-md-12">
                                        <div class="mb-3">
                                            <label for="editToAddressEstimate" class="form-label">To:</label>
                                            <div id="editToAddressEstimate">${estimate.clients.name}<br>${estimate.clients.email}<br>${estimate.clients.address}</div>
                                        </div>
                                    </div>
                                </div>
                                <div class="row mt-3">
                                    <div class="col-md-12">
                                        <div class="mb-3">
                                            <label for="editEstimateItemsTable" class="form-label">Items</label>
                                            <table class="table table-bordered" id="editEstimateItemsTable">
                                                <thead>
                                                    <tr>
                                                        <th>Description</th>
                                                        <th>Quantity</th>
                                                        <th>Rate</th>
                                                        <th>Amount</th>
                                                        <th>Action</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr id="editEstimateItemRowTemplate" style="display: none;">
                                                        <td><input type="text" class="form-control estimate-item-description"></td>
                                                        <td><input type="number" class="form-control estimate-item-quantity"></td>
                                                        <td><input type="number" step="0.01" class="form-control estimate-item-rate"></td>
                                                        <td><span class="estimate-item-amount">INR 0.00</span></td>
                                                        <td><button type="button" class="btn btn-danger remove-estimate-item">Remove</button></td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                            <button type="button" class="btn btn-primary mb-3" id="editAddEstimateItemBtn">Add Item</button>
                                        </div>
                                    </div>
                                </div>
                                <div class="row mt-3">
                                    <div class="col-md-12">
                                        <div class="mb-3">
                                            <label for="editEstimateTaxRate" class="form-label">Tax Rate (%)</label>
                                            <input type="number" step="0.01" class="form-control" id="editEstimateTaxRate" value="${estimate.tax_rate}" required>
                                        </div>
                                        <div class="mb-3">
                                            <label for="editEstimateDiscountType" class="form-label">Discount Type</label>
                                            <select class="form-control" id="editEstimateDiscountType">
                                                <option value="none" ${estimate.discount_type === 'none' ? 'selected' : ''}>None</option>
                                                <option value="percentage" ${estimate.discount_type === 'percentage' ? 'selected' : ''}>Percentage</option>
                                                <option value="fixed" ${estimate.discount_type === 'fixed' ? 'selected' : ''}>Fixed Amount</option>
                                            </select>
                                        </div>
                                        <div class="mb-3" id="editEstimateDiscountValueContainer" style="display: ${estimate.discount_type === 'none' ? 'none' : 'block'};">
                                            <label for="editEstimateDiscountValue" class="form-label">Discount Value</label>
                                            <input type="number" step="0.01" class="form-control" id="editEstimateDiscountValue" value="${estimate.discount_value || ''}">
                                        </div>
                                        <div class="mb-3">
                                            <label for="editEstimateShippingCharge" class="form-label">Shipping Charge (INR)</label>
                                            <input type="number" step="0.01" class="form-control" id="editEstimateShippingCharge" value="${estimate.shipping_charge}">
                                        </div>
                                    </div>
                                </div>
                                <div class="row mt-3">
                                    <div class="col-md-12">
                                        <div class="totals-container" id="editEstimateTotalsContainer"></div>
                                    </div>
                                </div>
                                <div class="row mt-3">
                                    <div class="col">
                                        <p><strong>BANK DETAILS:</strong><br>
                                        GRAFIKOS<br>
                                        A/C No. 158500202082424,<br>
                                        Tamilnad Mercantile Bank Ltd,<br>
                                        Chennai-Thiruvanmiyur Branch,<br>
                                        IFSC Code: TMBL0000158,<br>
                                        MICR Code: 600060010.</p>
                                    </div>
                                </div>
                                <div class="row mt-3">
                                    <div class="col text-center">
                                        <button type="submit" class="btn btn-primary">Save Changes</button>
                                    </div>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            `;

            document.body.appendChild(editModal);
            const editEstimateItemsTable = document.getElementById('editEstimateItemsTable');
            const editEstimateItemRowTemplate = document.getElementById('editEstimateItemRowTemplate');
            const editAddEstimateItemBtn = document.getElementById('editAddEstimateItemBtn');
            const editEstimateTotalsContainer = document.getElementById('editEstimateTotalsContainer');
            const editEstimateForm = document.getElementById('editEstimateForm');

            // Populate items
            editEstimateItemsTable.querySelector('tbody').innerHTML = '';
            estimate.items.forEach(item => {
                const newRow = editEstimateItemRowTemplate.cloneNode(true);
                newRow.removeAttribute('id');
                newRow.style.display = '';
                newRow.querySelector('.estimate-item-description').value = item.description;
                newRow.querySelector('.estimate-item-quantity').value = item.quantity;
                newRow.querySelector('.estimate-item-rate').value = item.rate;
                newRow.querySelector('.estimate-item-amount').textContent = `INR ${item.amount.toFixed(2)}`;
                newRow.querySelector('.remove-estimate-item').addEventListener('click', () => {
                    newRow.remove();
                    updateEditEstimateTotals();
                });
                newRow.querySelectorAll('input').forEach(input => {
                    input.addEventListener('input', updateEditEstimateTotals);
                });
                editEstimateItemsTable.querySelector('tbody').appendChild(newRow);
            });

            // Toggle discount field
            document.getElementById('editEstimateDiscountType').addEventListener('change', (e) => {
                document.getElementById('editEstimateDiscountValueContainer').style.display = e.target.value === 'none' ? 'none' : 'block';
            });

            function updateEditEstimateTotals() {
                let subTotalAmount = 0;
                document.querySelectorAll('#editEstimateItemsTable tbody tr:not(#editEstimateItemRowTemplate)').forEach(row => {
                    const quantity = parseFloat(row.querySelector('.estimate-item-quantity').value) || 0;
                    const rate = parseFloat(row.querySelector('.estimate-item-rate').value) || 0;
                    const amount = quantity * rate;
                    row.querySelector('.estimate-item-amount').textContent = `INR ${amount.toFixed(2)}`;
                    subTotalAmount += amount;
                });

                const taxRate = parseFloat(document.getElementById('editEstimateTaxRate').value) || 0;
                const discountType = document.getElementById('editEstimateDiscountType').value;
                const discountValue = parseFloat(document.getElementById('editEstimateDiscountValue').value) || 0;
                let discountAmount = 0;
                if (discountType === 'percentage') discountAmount = subTotalAmount * (discountValue / 100);
                else if (discountType === 'fixed') discountAmount = discountValue;
                const discountedSubTotal = subTotalAmount - discountAmount;
                const taxAmount = discountedSubTotal * (taxRate / 100);
                const shippingCharge = parseFloat(document.getElementById('editEstimateShippingCharge').value) || 0;
                const totalBeforeShipping = discountedSubTotal + taxAmount;
                const totalAmount = totalBeforeShipping + shippingCharge;

                editEstimateTotalsContainer.innerHTML = `
                    <div class="total-row"><span class="label">Sub Total:</span><span class="amount">INR ${subTotalAmount.toFixed(2)}</span></div>
                    <div class="total-row"><span class="label">Discount:</span><span class="amount">${discountType === 'none' ? 'None' : `INR ${discountAmount.toFixed(2)}`}</span></div>
                    <div class="total-row"><span class="label">Discounted Sub Total:</span><span class="amount">INR ${discountedSubTotal.toFixed(2)}</span></div>
                    <div class="total-row"><span class="label">Tax (${taxRate}%):</span><span class="amount">INR ${taxAmount.toFixed(2)}</span></div>
                    <div class="total-row"><span class="label">Total Before Shipping:</span><span class="amount">INR ${totalBeforeShipping.toFixed(2)}</span></div>
                    <div class="total-row"><span class="label">Shipping Charge:</span><span class="amount">INR ${shippingCharge.toFixed(2)}</span></div>
                    <div class="total-row"><span class="label">Total:</span><span class="amount">INR ${totalAmount.toFixed(2)}</span></div>
                    <div class="total-row"><span class="label">Balance:</span><span class="amount red">INR ${totalAmount.toFixed(2)}</span></div>
                `;
            }

            updateEditEstimateTotals();

            editAddEstimateItemBtn.addEventListener('click', () => {
                const newRow = editEstimateItemRowTemplate.cloneNode(true);
                newRow.removeAttribute('id');
                newRow.style.display = '';
                newRow.querySelector('.remove-estimate-item').addEventListener('click', () => {
                    newRow.remove();
                    updateEditEstimateTotals();
                });
                newRow.querySelectorAll('input').forEach(input => {
                    input.addEventListener('input', updateEditEstimateTotals);
                });
                editEstimateItemsTable.querySelector('tbody').appendChild(newRow);
            });

            editEstimateForm.addEventListener('submit', async (event) => {
                event.preventDefault();
                try {
                    const date = document.getElementById('editEstimateDate').value;
                    const dueDate = document.getElementById('editEstimateDueDate').value;
                    if (!date || !dueDate) {
                        alert('Please ensure both Date and Due Date are selected.');
                        return;
                    }

                    let items = [];
                    let allItemsValid = true;
                    document.querySelectorAll('#editEstimateItemsTable tbody tr:not(#editEstimateItemRowTemplate)').forEach(row => {
                        const description = row.querySelector('.estimate-item-description').value;
                        const quantity = row.querySelector('.estimate-item-quantity').value;
                        const rate = row.querySelector('.estimate-item-rate').value;
                        if (!description || !quantity || !rate || isNaN(parseFloat(quantity)) || isNaN(parseFloat(rate)) || parseFloat(quantity) <= 0 || parseFloat(rate) <= 0) {
                            allItemsValid = false;
                            return;
                        }
                        items.push({
                            description,
                            quantity: parseFloat(quantity),
                            rate: parseFloat(rate),
                            amount: parseFloat(row.querySelector('.estimate-item-amount').textContent.replace('INR ', ''))
                        });
                    });

                    if (!allItemsValid || items.length === 0) {
                        alert('Please ensure all item fields are correctly filled out.');
                        return;
                    }

                    const taxRate = parseFloat(document.getElementById('editEstimateTaxRate').value) || 0;
                    const discountType = document.getElementById('editEstimateDiscountType').value;
                    const discountValue = discountType === 'none' ? null : parseFloat(document.getElementById('editEstimateDiscountValue').value) || 0;
                    const shippingCharge = parseFloat(document.getElementById('editEstimateShippingCharge').value) || 0;
                    const subTotalAmount = parseFloat(document.querySelector('#editEstimateTotalsContainer .total-row:first-child .amount').textContent.replace('INR ', '')) || 0;
                    const discountAmount = discountType === 'percentage' ? subTotalAmount * (discountValue / 100) : (discountType === 'fixed' ? discountValue : 0);
                    const discountedSubTotal = subTotalAmount - discountAmount;
                    const taxAmount = discountedSubTotal * (taxRate / 100);
                    const totalBeforeShipping = discountedSubTotal + taxAmount;
                    const totalAmount = totalBeforeShipping + shippingCharge;

                    const { error } = await supabase
                        .from('estimates')
                        .update({
                            invoice_date: date,
                            due_date: dueDate,
                            items,
                            sub_total: subTotalAmount,
                            tax_rate: taxRate,
                            discount_type: discountType,
                            discount_value: discountValue,
                            shipping_charge: shippingCharge,
                            total: totalAmount,
                            balance: totalAmount
                        })
                        .eq('id', currentEstimateId);

                    if (error) throw error;

                    $('#editEstimateModal').modal('hide');
                    fetchAllEstimates();
                    document.body.removeChild(editModal);
                } catch (error) {
                    console.error('Failed to update estimate:', error);
                    alert('An error occurred while updating the estimate: ' + (error.message || 'Unknown error'));
                }
            });

            $('#editEstimateModal').modal('show');
        } catch (error) {
            console.error('Failed to fetch estimate for editing:', error);
            alert('Failed to fetch estimate details: ' + (error.message || 'Unknown error'));
        }
    }

    async function generateInvoicePDF(id, type) {
        try {
            const table = type === 'invoice' ? 'invoices' : 'estimates';
            const { data: documentData, error } = await supabase
                .from(table)
                .select('*, clients(name, email, address)')
                .eq('id', id)
                .single();
            if (error) throw error;

            const { data: settings } = await supabase.from('settings').select('logo_path').single();
            const subTotalAmount = documentData.items.reduce((sum, item) => sum + item.amount, 0);
            const discountAmount = documentData.discount_type === 'percentage' ? subTotalAmount * (documentData.discount_value / 100) : (documentData.discount_type === 'fixed' ? documentData.discount_value : 0);
            const discountedSubTotal = subTotalAmount - discountAmount;
            const taxAmount = discountedSubTotal * (documentData.tax_rate / 100);
            const totalBeforeShipping = discountedSubTotal + taxAmount;
            const totalAmount = totalBeforeShipping + documentData.shipping_charge;

            const docDefinition = {
                content: [
                    settings.logo_path ? { image: settings.logo_path, width: 150, margin: [0, 0, 0, 20] } : { text: 'Grafikos', style: 'header' },
                    {
                        columns: [
                            { text: `${type.charAt(0).toUpperCase() + type.slice(1)}`, style: 'header' },
                            { text: 'GRAFIKOS - Cos we create', style: 'companyName', alignment: 'right' }
                        ],
                        margin: [0, 0, 0, 20]
                    },
                    {
                        columns: [
                            [
                                { text: 'From:', bold: true },
                                'Grafikos',
                                'Basement Plot 27, Srinivasa Nagar',
                                'OMR Kottivakkam',
                                'Chennai, Tamilnadu, 600041',
                                'India',
                                'GSTIN: 33AGXPV873G2ZB'
                            ],
                            [
                                { text: `${type.charAt(0).toUpperCase() + type.slice(1)} No.: ${documentData.invoice_number}`, bold: true },
                                { text: `Date: ${new Date(documentData.invoice_date).toLocaleDateString()}`, bold: true },
                                { text: `${type.charAt(0).toUpperCase() + type.slice(1)} Due: ${new Date(documentData.due_date).toLocaleDateString()}`, bold: true }
                            ]
                        ],
                        columnGap: 20,
                        margin: [0, 0, 0, 20]
                    },
                    {
                        ul: [
                            { text: `To: ${documentData.clients.name}`, bold: true },
                            { text: documentData.clients.email },
                            { text: documentData.clients.address }
                        ],
                        style: 'clientInfo',
                        margin: [0, 0, 0, 20]
                    },
                    {
                        table: {
                            headerRows: 1,
                            widths: ['*', 'auto', 'auto', 'auto'],
                            body: [
                                [
                                    { text: 'Description', bold: true },
                                    { text: 'Quantity', bold: true, alignment: 'center' },
                                    { text: 'Rate', bold: true, alignment: 'right' },
                                    { text: 'Amount', bold: true, alignment: 'right' }
                                ],
                                ...documentData.items.map(item => [
                                    item.description,
                                    { text: item.quantity, alignment: 'center' },
                                    { text: `INR ${item.rate.toFixed(2)}`, alignment: 'right' },
                                    { text: `INR ${item.amount.toFixed(2)}`, alignment: 'right' }
                                ])
                            ]
                        },
                        margin: [0, 0, 0, 20]
                    },
                    {
                        table: {
                            widths: ['*', 'auto'],
                            body: [
                                [{ text: 'Sub Total:', bold: true, alignment: 'left' }, { text: `INR ${subTotalAmount.toFixed(2)}`, alignment: 'right' }],
                                [{ text: `Discount (${documentData.discount_type === 'percentage' ? `${documentData.discount_value}%` : documentData.discount_type}):`, bold: true, alignment: 'left' }, { text: `INR ${discountAmount.toFixed(2)}`, alignment: 'right' }],
                                [{ text: 'Discounted Sub Total:', bold: true, alignment: 'left' }, { text: `INR ${discountedSubTotal.toFixed(2)}`, alignment: 'right' }],
                                [{ text: `Tax (${documentData.tax_rate}%):`, bold: true, alignment: 'left' }, { text: `INR ${taxAmount.toFixed(2)}`, alignment: 'right' }],
                                [{ text: 'Total Before Shipping:', bold: true, alignment: 'left' }, { text: `INR ${totalBeforeShipping.toFixed(2)}`, alignment: 'right' }],
                                [{ text: 'Shipping Charge:', bold: true, alignment: 'left' }, { text: `INR ${documentData.shipping_charge.toFixed(2)}`, alignment: 'right' }],
                                [{ text: 'Total:', bold: true, alignment: 'left' }, { text: `INR ${totalAmount.toFixed(2)}`, alignment: 'right' }],
                                [{ text: 'Balance:', bold: true, color: 'red', alignment: 'left' }, { text: `INR ${totalAmount.toFixed(2)}`, alignment: 'right' }]
                            ]
                        },
                        margin: [0, 0, 0, 20]
                    },
                    {
                        text: 'BANK DETAILS:',
                        bold: true,
                        margin: [0, 20, 0, 5]
                    },
                    'GRAFIKOS',
                    'A/C No. 158500202082424,',
                    'Tamilnad Mercantile Bank Ltd,',
                    'Chennai-Thiruvanmiyur Branch,',
                    'IFSC Code: TMBL0000158,',
                    'MICR Code: 600060010.',
                    {
                        text: 'Email: designs@grafikos.in',
                        style: 'footer',
                        alignment: 'center',
                        margin: [0, 20, 0, 0]
                    }
                ],
                styles: {
                    header: { fontSize: 24, bold: true, color: '#333' },
                    companyName: { fontSize: 14, bold: true, color: '#0066cc' },
                    clientInfo: { fontSize: 12 },
                    footer: { fontSize: 10, color: '#666' }
                },
                defaultStyle: {
                    fontSize: 12,
                    color: '#000'
                }
            };

            pdfMake.createPdf(docDefinition).open();
        } catch (error) {
            console.error(`Failed to fetch ${type} for PDF:`, error);
            alert(`Failed to fetch ${type} details: ' + (error.message || 'Unknown error')`);
        }
    }

    // Add Client functionality
    addClientBtn.addEventListener('click', () => $('#addClientModal').modal('show'));

    clientForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
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

            const { error } = await supabase
                .from('clients')
                .insert([{ name, email, address }]);
            if (error) throw error;

            await fetchDashboardData();
            clientNameInput.value = '';
            clientEmailInput.value = '';
            clientAddressInput.value = '';
            $('#addClientModal').modal('hide');
        } catch (error) {
            console.error('Failed to add client:', error);
            alert('An error occurred while adding the client: ' + (error.message || 'Unknown error'));
        }
    });

    // Settings form submission for logo upload
    document.getElementById('settingsForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const fileInput = document.getElementById('logoUpload');
            const file = fileInput.files[0];
            if (file) {
                const { data, error } = await supabase
                    .storage
                    .from('logos')
                    .upload('logo.png', file, { upsert: true });
                if (error) throw error;
                const logoUrl = supabase.storage.from('logos').getPublicUrl(data.path).data.publicUrl;
                await supabase.from('settings').update({ logo_path: logoUrl }).eq('id', 1);
                document.querySelector('.logo').src = logoUrl;
                $('#settingsModal').modal('hide');
            }
        } catch (error) {
            console.error('Failed to upload logo:', error);
            alert('Failed to upload logo: ' + (error.message || 'Unknown error'));
        }
    });

    // New: Handle report generation
    generateReportBtn.addEventListener('click', () => {
        $('#generateReportModal').modal('show');
    });

    // New: Toggle custom period fields
    document.getElementById('period').addEventListener('change', (e) => {
        const customPeriod = document.getElementById('customPeriod');
        customPeriod.style.display = e.target.value === 'custom' ? 'block' : 'none';
    });

    document.getElementById('reportForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            const reportType = document.getElementById('reportType').value;
            const period = document.getElementById('period').value;
            const status = document.getElementById('status').value;
            const currency = document.getElementById('currency').value;
            const clientId = document.getElementById('client').value;

            let query = supabase.from(reportType === 'invoices' ? 'invoices' : 'estimates')
                .select('*')
                .order('invoice_number', { ascending: false });

            // Apply period filter
            if (period !== 'all_time') {
                const now = new Date();
                let startDate, endDate;
                if (period === 'this_month') {
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                } else if (period === 'last_month') {
                    startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                    endDate = new Date(now.getFullYear(), now.getMonth(), 0);
                } else if (period === 'custom') {
                    startDate = new Date(document.getElementById('startDate').value);
                    endDate = new Date(document.getElementById('endDate').value);
                }
                query = query.gte('invoice_date', startDate.toISOString().split('T')[0])
                    .lte('invoice_date', endDate.toISOString().split('T')[0]);
            }

            // Apply status filter
            if (status !== 'all') {
                query = query.eq('status', status);
            }

            // Apply client filter
            if (clientId !== 'all_clients') {
                query = query.eq('client_id', clientId);
            }

            const { data: reportData, error } = await query;
            if (error) throw error;

            // Generate PDF report
            await generateReportPDF(reportData, reportType, period, status, currency, clientId);
            $('#generateReportModal').modal('hide');
        } catch (error) {
            console.error('Failed to generate report:', error);
            alert('Failed to generate report: ' + (error.message || 'Unknown error'));
        }
    });

    async function generateReportPDF(data, reportType, period, status, currency, clientId) {
        const currencySymbols = {
            'inr': '₹',
            'usd': '$',
            'pound': '£'
        };
        const symbol = currencySymbols[currency] || '₹';

        const { data: settings } = await supabase.from('settings').select('logo_path').single();
        const docDefinition = {
            content: [
                settings.logo_path ? { image: settings.logo_path, width: 150, margin: [0, 0, 0, 20] } : { text: 'Grafikos', style: 'header' },
                {
                    text: `Report - ${reportType.charAt(0).toUpperCase() + reportType.slice(1)}`,
                    style: 'header',
                    margin: [0, 0, 0, 20]
                },
                {
                    text: `Filters: Period: ${period === 'custom' ? `From ${new Date(document.getElementById('startDate').value).toLocaleDateString()} to ${new Date(document.getElementById('endDate').value).toLocaleDateString()}` : period}, Status: ${status}, Currency: ${currency}, Client: ${clientId === 'all_clients' ? 'All Clients' : data[0]?.clients?.name || 'N/A'}`,
                    style: 'subheader',
                    margin: [0, 0, 0, 10]
                },
                {
                    table: {
                        headerRows: 1,
                        widths: ['auto', '*', 'auto', 'auto', 'auto'],
                        body: [
                            [
                                { text: 'ID', bold: true, alignment: 'left' },
                                { text: 'Client', bold: true, alignment: 'left' },
                                { text: 'Date', bold: true, alignment: 'center' },
                                { text: 'Status', bold: true, alignment: 'center' },
                                { text: 'Total', bold: true, alignment: 'right' }
                            ],
                            ...data.map(item => [
                                item.invoice_number || 'N/A',
                                item.clients?.name || 'N/A',
                                new Date(item.invoice_date).toLocaleDateString(),
                                item.status || 'N/A',
                                { text: `${symbol}${item.total?.toFixed(2) || '0.00'}`, alignment: 'right' }
                            ])
                        ]
                    },
                    margin: [0, 0, 0, 20]
                },
                {
                    text: 'Generated on: ' + new Date().toLocaleDateString(),
                    style: 'footer',
                    alignment: 'right',
                    margin: [0, 20, 0, 0]
                }
            ],
            styles: {
                header: { fontSize: 24, bold: true, color: '#333' },
                companyName: { fontSize: 14, bold: true, color: '#0066cc' },
                subheader: { fontSize: 14, color: '#4a5568' },
                footer: { fontSize: 10, color: '#666' }
            },
            defaultStyle: {
                fontSize: 12,
                color: '#000'
            }
        };

        pdfMake.createPdf(docDefinition).open();
    }

    // Initialize with Dashboard view
    async function initialize() {
        try {
            dashboardSection.style.display = 'block';
            invoicesSection.style.display = 'none';
            estimatesSection.style.display = 'none';
            reportsSection.style.display = 'none';
            await fetchDashboardData();
        } catch (error) {
            console.error('Initialization error:', error);
            clientsGrid.innerHTML = '<div class="client-card text-danger">Failed to load dashboard: ' + (error.message || 'Unknown error') + '</div>';
        }
    }

    initialize();
});