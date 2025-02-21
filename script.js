import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const supabaseUrl = 'https://zpjrivjogqljxnodmtbj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwanJpdmpvZ3Fsanhub2RtdGJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk4NzgxNDUsImV4cCI6MjA1NTQ1NDE0NX0.FQ_ru6GJAOBvjJVTw6qr0RdntCDHh8KmUAUfCxxGROA';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

document.addEventListener('DOMContentLoaded', () => {
    const dashboardSection = document.querySelector('.dashboard-section');
    const invoicesSection = document.querySelector('.invoices-section');
    const clientsGrid = document.getElementById('clientsGrid');
    const invoicesGrid = document.getElementById('invoicesGrid');
    const recentInvoicesBody = document.getElementById('recentInvoicesBody');
    const addClientBtn = document.querySelector('.add-client-btn');
    const addInvoiceModal = document.getElementById('addInvoiceModal');
    const addInvoiceForm = document.getElementById('addInvoiceForm');
    const clientForm = document.getElementById('clientForm');
    const itemsTable = document.getElementById('itemsTable');
    const itemRowTemplate = document.getElementById('itemRowTemplate');
    const addItemBtn = document.getElementById('addItemBtn');
    const toAddress = document.getElementById('toAddress');
    const navItems = document.querySelectorAll('.nav-item');

    let selectedClientId = null;
    let currentInvoiceId = null;

    // Navigation
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            const section = item.dataset.section;
            if (section === 'dashboard') {
                dashboardSection.style.display = 'block';
                invoicesSection.style.display = 'none';
                fetchDashboardData();
            } else if (section === 'invoices') {
                dashboardSection.style.display = 'none';
                invoicesSection.style.display = 'block';
                fetchAllInvoices();
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

            if (error) {
                console.error('Error fetching highest invoice number:', error);
                throw error;
            }

            if (!data || data.length === 0) return 'INV-300';

            const highestNumber = data[0].invoice_number.replace('INV-', '');
            const nextNumber = Math.max(parseInt(highestNumber, 10) + 1, 300);
            return `INV-${nextNumber}`;
        } catch (error) {
            console.error('Error in getNextInvoiceNumber:', error);
            return 'INV-300';
        }
    }

    async function fetchDashboardData() {
        try {
            // Fetch income (sum of paid invoice totals from Supabase)
            const { data: invoices, error: invoiceError } = await supabase
                .from('invoices')
                .select('total')
                .eq('status', 'Paid');

            if (invoiceError) throw invoiceError;

            const totalIncome = invoices.reduce((sum, invoice) => sum + (invoice.total || 0), 0);
            document.querySelector('.income-card').textContent = `Income: ₹${totalIncome.toFixed(2)}`;

            // Fetch and display all clients in cards
            const { data: clients, error: clientError } = await supabase
                .from('clients')
                .select('*')
                .order('name', { ascending: true });

            if (clientError) throw clientError;

            clientsGrid.innerHTML = '';
            clients.forEach(client => {
                const card = document.createElement('div');
                card.className = 'client-card';
                card.innerHTML = `
                    <h3>${client.name}</h3>
                    <p>Email: ${client.email}</p>
                    <p>Address: ${client.address}</p>
                    <button class="create-invoice-btn" data-client-id="${client.id}">Create Invoice</button>
                `;
                clientsGrid.appendChild(card);
            });

            // Add event listener for "Create Invoice" buttons
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
                    try {
                        const nextInvoiceNumber = await getNextInvoiceNumber();
                        document.querySelector('#addInvoiceModal .modal-body .col-md-6.text-end p:nth-child(1)').textContent = `Invoice No.: ${nextInvoiceNumber}`;
                        document.querySelector('#addInvoiceModal .modal-body .col-md-6.text-end p:nth-child(2)').innerHTML = `<strong>Date:</strong> <input type="date" id="date" required style="display: inline; margin-left: 5px;">`;
                        document.querySelector('#addInvoiceModal .modal-body .col-md-6.text-end p:nth-child(3)').innerHTML = `<strong>Invoice Due:</strong> <input type="date" id="dueDate" required style="display: inline; margin-left: 5px;">`;
                    } catch (error) {
                        console.error('Error setting invoice number:', error);
                    }
                });
            });

            // Fetch and display recent invoices
            await fetchRecentInvoices();
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
                .order('invoice_date', { ascending: false })
                .limit(5); // Show the 5 most recent invoices

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

            // Add event listeners for status updates, edit, and view PDF
            document.querySelectorAll('.status-select').forEach(select => {
                select.addEventListener('change', async (e) => {
                    const invoiceId = e.target.dataset.invoiceId;
                    const newStatus = e.target.value;
                    await updateInvoiceStatus(invoiceId, newStatus);
                    fetchRecentInvoices(); // Refresh recent invoices
                });
            });

            document.querySelectorAll('.edit-invoice, .view-pdf').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const invoiceId = e.target.dataset.invoiceId;
                    if (e.target.classList.contains('edit-invoice')) {
                        currentInvoiceId = invoiceId;
                        await editInvoice(invoiceId);
                    } else if (e.target.classList.contains('view-pdf')) {
                        await generateInvoicePDF(invoiceId);
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
                .order('invoice_date', { ascending: false });

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

            // Add event listeners for status updates, edit, and view PDF
            document.querySelectorAll('.status-select').forEach(select => {
                select.addEventListener('change', async (e) => {
                    const invoiceId = e.target.dataset.invoiceId;
                    const newStatus = e.target.value;
                    await updateInvoiceStatus(invoiceId, newStatus);
                    fetchAllInvoices(); // Refresh all invoices
                });
            });

            document.querySelectorAll('.edit-invoice, .view-pdf').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const invoiceId = e.target.dataset.invoiceId;
                    if (e.target.classList.contains('edit-invoice')) {
                        currentInvoiceId = invoiceId;
                        await editInvoice(invoiceId);
                    } else if (e.target.classList.contains('view-pdf')) {
                        await generateInvoicePDF(invoiceId);
                    }
                });
            });
        } catch (error) {
            console.error('Error fetching invoices:', error);
            invoicesGrid.innerHTML = '<div class="invoice-card text-danger">Failed to load invoices: ' + (error.message || 'Unknown error') + '</div>';
        }
    }

    async function updateInvoiceStatus(invoiceId, newStatus) {
        try {
            const { error } = await supabase
                .from('invoices')
                .update({ status: newStatus })
                .eq('id', invoiceId);

            if (error) {
                console.error('Error updating invoice status:', error);
                throw error;
            }
        } catch (error) {
            console.error('Failed to update invoice status:', error);
            alert('Failed to update invoice status: ' + (error.message || 'Unknown error'));
        }
    }

    async function editInvoice(invoiceId) {
        try {
            const { data: invoice, error } = await supabase
                .from('invoices')
                .select('*, clients(name, email, address)')
                .eq('id', invoiceId)
                .single();

            if (error) {
                console.error('Error fetching invoice:', error);
                throw error;
            }

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

            function updateEditTotals() {
                let subTotalAmount = 0;
                document.querySelectorAll('#editItemsTable tbody tr:not(#editItemRowTemplate)').forEach(row => {
                    const quantity = parseFloat(row.querySelector('.item-quantity').value) || 0;
                    const rate = parseFloat(row.querySelector('.item-rate').value) || 0;
                    const amount = quantity * rate;
                    row.querySelector('.item-amount').textContent = `INR ${amount.toFixed(2)}`;
                    subTotalAmount += amount;
                });
                
                const TAX_RATE = 0.09;
                const cgstAmount = subTotalAmount * TAX_RATE;
                const sgstAmount = subTotalAmount * TAX_RATE;
                const taxTotalAmount = cgstAmount + sgstAmount;
                const totalAmount = subTotalAmount + taxTotalAmount;
                const balanceAmount = totalAmount;

                editTotalsContainer.innerHTML = `
                    <div class="total-row"><span class="label">Sub Total:</span><span class="amount">INR ${subTotalAmount.toFixed(2)}</span></div>
                    <div class="total-row"><span class="label">CGST (9%):</span><span class="amount">INR ${cgstAmount.toFixed(2)}</span></div>
                    <div class="total-row"><span class="label">SGST (9%):</span><span class="amount">INR ${sgstAmount.toFixed(2)}</span></div>
                    <div class="total-row"><span class="label">Tax Total:</span><span class="amount">INR ${taxTotalAmount.toFixed(2)}</span></div>
                    <div class="total-row"><span class="label">Total:</span><span class="amount">INR ${totalAmount.toFixed(2)}</span></div>
                    <div class="total-row"><span class="label">Balance:</span><span class="amount red">INR ${balanceAmount.toFixed(2)}</span></div>
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

                    const subTotalAmount = parseFloat(document.querySelector('#editTotalsContainer .total-row:first-child .amount').textContent.replace('INR ', '')) || 0;
                    const TAX_RATE = 0.09;
                    const cgstAmount = subTotalAmount * TAX_RATE;
                    const sgstAmount = subTotalAmount * TAX_RATE;
                    const taxTotalAmount = cgstAmount + sgstAmount;
                    const totalAmount = subTotalAmount + taxTotalAmount;
                    const balanceAmount = totalAmount;

                    const { error } = await supabase
                        .from('invoices')
                        .update({
                            invoice_date: date,
                            due_date: dueDate,
                            items,
                            sub_total: subTotalAmount,
                            cgst: cgstAmount,
                            sgst: sgstAmount,
                            tax_total: taxTotalAmount,
                            total: totalAmount,
                            balance: balanceAmount
                        })
                        .eq('id', currentInvoiceId);

                    if (error) throw error;

                    $('#editInvoiceModal').modal('hide');
                    fetchAllInvoices();
                    fetchRecentInvoices(); // Refresh recent invoices
                    document.body.removeChild(editModal); // Clean up the modal
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

    async function generateInvoicePDF(invoiceId) {
        try {
            const { data: invoice, error } = await supabase
                .from('invoices')
                .select('*, clients(name, email, address)')
                .eq('id', invoiceId)
                .single();

            if (error) {
                console.error('Error fetching invoice for PDF:', error);
                throw error;
            }

            const subTotalAmount = invoice.items.reduce((sum, item) => sum + item.amount, 0);
            const TAX_RATE = 0.09;
            const cgstAmount = subTotalAmount * TAX_RATE;
            const sgstAmount = subTotalAmount * TAX_RATE;
            const taxTotalAmount = cgstAmount + sgstAmount;
            const totalAmount = subTotalAmount + taxTotalAmount;

            const docDefinition = {
                content: [
                    {
                        columns: [
                            { text: 'Invoice', style: 'header' },
                            {
                                text: 'GRAFIKOS - Cos we create',
                                style: 'companyName',
                                alignment: 'right'
                            }
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
                                { text: `Invoice No.: ${invoice.invoice_number}`, bold: true },
                                { text: `Date: ${new Date(invoice.invoice_date).toLocaleDateString()}`, bold: true },
                                { text: `Invoice Due: ${new Date(invoice.due_date).toLocaleDateString()}`, bold: true }
                            ]
                        ],
                        columnGap: 20,
                        margin: [0, 0, 0, 20]
                    },
                    {
                        ul: [
                            { text: `To: ${invoice.clients.name}`, bold: true },
                            { text: invoice.clients.email },
                            { text: invoice.clients.address }
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
                                ...invoice.items.map(item => [
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
                                [{ text: 'CGST (9%):', bold: true, alignment: 'left' }, { text: `INR ${cgstAmount.toFixed(2)}`, alignment: 'right' }],
                                [{ text: 'SGST (9%):', bold: true, alignment: 'left' }, { text: `INR ${sgstAmount.toFixed(2)}`, alignment: 'right' }],
                                [{ text: 'Tax Total:', bold: true, alignment: 'left' }, { text: `INR ${taxTotalAmount.toFixed(2)}`, alignment: 'right' }],
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
            console.error('Failed to fetch invoice for PDF:', error);
            alert('Failed to fetch invoice details: ' + (error.message || 'Unknown error'));
        }
    }

    function addItemRow() {
        const newRow = itemRowTemplate.cloneNode(true);
        newRow.removeAttribute('id');
        newRow.style.display = '';
        newRow.querySelector('.remove-item').addEventListener('click', () => {
            newRow.remove();
            updateTotals();
        });
        newRow.querySelectorAll('input').forEach(input => {
            input.addEventListener('input', updateTotals);
        });
        itemsTable.querySelector('tbody').appendChild(newRow);
    }

    function updateTotals() {
        let subTotalAmount = 0;
        document.querySelectorAll('#itemsTable tbody tr:not(#itemRowTemplate)').forEach(row => {
            const quantity = parseFloat(row.querySelector('.item-quantity').value) || 0;
            const rate = parseFloat(row.querySelector('.item-rate').value) || 0;
            const amount = quantity * rate;
            row.querySelector('.item-amount').textContent = `INR ${amount.toFixed(2)}`;
            subTotalAmount += amount;
        });
        
        const TAX_RATE = 0.09;
        const cgstAmount = subTotalAmount * TAX_RATE;
        const sgstAmount = subTotalAmount * TAX_RATE;
        const taxTotalAmount = cgstAmount + sgstAmount;
        const totalAmount = subTotalAmount + taxTotalAmount;
        const balanceAmount = totalAmount;

        const totalsContainer = document.querySelector('#totalsContainer');
        totalsContainer.innerHTML = `
            <div class="total-row"><span class="label">Sub Total:</span><span class="amount">INR ${subTotalAmount.toFixed(2)}</span></div>
            <div class="total-row"><span class="label">CGST (9%):</span><span class="amount">INR ${cgstAmount.toFixed(2)}</span></div>
            <div class="total-row"><span class="label">SGST (9%):</span><span class="amount">INR ${sgstAmount.toFixed(2)}</span></div>
            <div class="total-row"><span class="label">Tax Total:</span><span class="amount">INR ${taxTotalAmount.toFixed(2)}</span></div>
            <div class="total-row"><span class="label">Total:</span><span class="amount">INR ${totalAmount.toFixed(2)}</span></div>
            <div class="total-row"><span class="label">Balance:</span><span class="amount red">INR ${balanceAmount.toFixed(2)}</span></div>
        `;
    }

    addItemBtn.addEventListener('click', addItemRow);

    addInvoiceForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
            const date = document.getElementById('date').value;
            const dueDate = document.getElementById('dueDate').value;
            
            if (!date || !dueDate) {
                alert('Please ensure both Date and Due Date are selected.');
                return;
            }
        
            let items = [];
            let allItemsValid = true;
            document.querySelectorAll('#itemsTable tbody tr:not(#itemRowTemplate)').forEach(row => {
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
        
            if (!selectedClientId) {
                alert('Please select a client before submitting the invoice.');
                return;
            }

            const invoiceNumber = await getNextInvoiceNumber();
            const subTotalAmount = parseFloat(document.querySelector('#totalsContainer .total-row:first-child .amount').textContent.replace('INR ', '')) || 0;
            const TAX_RATE = 0.09;
            const cgstAmount = subTotalAmount * TAX_RATE;
            const sgstAmount = subTotalAmount * TAX_RATE;
            const taxTotalAmount = cgstAmount + sgstAmount;
            const totalAmount = subTotalAmount + taxTotalAmount;
            const balanceAmount = totalAmount;

            const { error } = await supabase
                .from('invoices')
                .insert([{
                    client_id: selectedClientId,
                    invoice_number: invoiceNumber,
                    invoice_date: date,
                    due_date: dueDate,
                    items,
                    sub_total: subTotalAmount,
                    cgst: cgstAmount,
                    sgst: sgstAmount,
                    tax_total: taxTotalAmount,
                    total: totalAmount,
                    balance: balanceAmount,
                    status: 'Pending'
                }]);

            if (error) throw error;

            $('#addInvoiceModal').modal('hide');
            fetchAllInvoices();
            fetchRecentInvoices(); // Refresh recent invoices after adding
        } catch (error) {
            console.error('Failed to add invoice:', error);
            alert('An error occurred while adding the invoice: ' + (error.message || 'Unknown error'));
        }
    });

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

            if (error) {
                console.error('Error adding client:', error);
                throw error;
            }

            await fetchDashboardData(); // Refresh clients
            clientNameInput.value = '';
            clientEmailInput.value = '';
            clientAddressInput.value = '';
            $('#addClientModal').modal('hide');
        } catch (error) {
            console.error('Failed to add client:', error);
            alert('An error occurred while adding the client: ' + (error.message || 'Unknown error'));
        }
    });

    // Initialize with Dashboard view
    async function initialize() {
        try {
            dashboardSection.style.display = 'block';
            invoicesSection.style.display = 'none';
            await fetchDashboardData();
        } catch (error) {
            console.error('Initialization error:', error);
            clientsGrid.innerHTML = '<div class="client-card text-danger">Failed to load dashboard: ' + (error.message || 'Unknown error') + '</div>';
        }
    }

    initialize();
});