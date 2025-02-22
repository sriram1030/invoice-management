// js/invoices.js
import { supabase } from './config.js';
import { invoicesGrid, recentInvoicesBody, toAddress, itemsTable, itemRowTemplate, addInvoiceForm, setSelectedClientId, selectedClientId, clientSelect, searchInvoiceId, filterClient, filterStatus } from './main.js';
import { updateInvoiceStatus } from './utils.js';
import { generateInvoicePDF } from './utils.js';
import { getNextInvoiceNumber } from './utils.js';
import { fetchDashboardData } from './invoicesList.js'; // Import to refresh Dashboard metrics

export let currentInvoiceId = null;

export async function fetchRecentInvoices(searchQuery = '', clientFilter = '', statusFilter = '') {
    console.log('Fetching recent invoices with filters...', { searchQuery, clientFilter, statusFilter });
    try {
        let query = supabase
            .from('invoices')
            .select('*, clients(name)')
            .order('invoice_number', { ascending: false })
            .limit(5);

        // Apply search by invoice_number (ID)
        if (searchQuery) {
            query = query.ilike('invoice_number', `%${searchQuery}%`);
        }

        // Apply filter by client name
        if (clientFilter) {
            query = query.eq('client_id', clientFilter);
        }

        // Apply filter by status
        if (statusFilter) {
            // Map "Unpaid" to "Pending" or "Overdue" for consistency
            if (statusFilter === 'Unpaid') {
                query = query.or('status.eq.Pending,status.eq.Overdue');
            } else {
                query = query.eq('status', statusFilter);
            }
        }

        const { data: invoices, error } = await query;
        if (error) {
            console.error('Error fetching recent invoices:', error);
            throw error;
        }
        console.log('Recent invoices data:', invoices);

        recentInvoicesBody.innerHTML = '';
        if (!invoices || invoices.length === 0) {
            console.log('No recent invoices found in Supabase with current filters');
            recentInvoicesBody.innerHTML = '<tr><td colspan="5">No recent invoices found</td></tr>';
            return;
        }

        // Log each invoice to debug data structure
        invoices.forEach(invoice => {
            console.log('Processing invoice:', invoice);
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${invoice.invoice_number || 'N/A'}</td>
                <td>${invoice.clients?.name || 'No Client Name'}</td>
                <td>${invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString() : 'N/A'}</td>
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

        // Add event listeners after populating rows
        document.querySelectorAll('.status-select').forEach(select => {
            select.addEventListener('change', async (e) => {
                const invoiceId = e.target.dataset.invoiceId;
                const newStatus = e.target.value;
                await updateInvoiceStatus(invoiceId, newStatus);
                fetchRecentInvoices(searchQuery, clientFilter, statusFilter); // Refresh with current filters
                fetchDashboardData(); // Refresh Dashboard metrics, including Outstanding Amount
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
        if (recentInvoicesBody) {
            recentInvoicesBody.innerHTML = '<tr><td colspan="5" class="text-danger">Failed to load recent invoices: ' + (error.message || 'Unknown error') + '</td></tr>';
        } else {
            console.error('recentInvoicesBody not found in DOM');
        }
    }
}

export async function fetchAllInvoices() {
    console.log('Fetching all invoices...');
    try {
        const { data: invoices, error } = await supabase
            .from('invoices')
            .select('*, clients(name)')
            .order('invoice_number', { ascending: false });

        if (error) {
            console.error('Error fetching all invoices:', error);
            throw error;
        }
        console.log('All invoices data:', invoices);

        // No longer displaying invoices grid, so this can be left empty or removed if not needed
        // invoicesGrid.innerHTML = '';
        // if (!invoices || invoices.length === 0) {
        //     invoicesGrid.innerHTML = '<div class="invoice-card">No invoices found</div>';
        //     return;
        // }
    } catch (error) {
        console.error('Error fetching all invoices:', error);
        // invoicesGrid.innerHTML = '<div class="invoice-card text-danger">Failed to load invoices: ' + (error.message || 'Unknown error') + '</div>';
    }
}

export async function editInvoice(invoiceId) {
    console.log(`Editing invoice with ID: ${invoiceId}`);
    try {
        const { data: invoice, error } = await supabase
            .from('invoices')
            .select('*, clients(name, email, address)')
            .eq('id', invoiceId)
            .single();

        if (error) {
            console.error('Error fetching invoice for editing:', error);
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
                        <form id="editInvoiceForm" novalidate>
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
                                        <label for="editClientSelect" class="form-label">Select Client</label>
                                        <select class="form-control" id="editClientSelect" required>
                                            <option value="">Select a Client</option>
                                            <!-- Options will be populated dynamically via JavaScript -->
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div class="row mt-3">
                                <div class="col-md-12">
                                    <div class="mb-3" id="editClientDetails" style="display: none;">
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
                                                    <td><input type="text" class="form-control item-description" required></td>
                                                    <td><input type="number" class="form-control item-quantity" required></td>
                                                    <td><input type="number" step="0.01" class="form-control item-rate" required></td>
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
                                    <div class="totals-container">
                                        <div class="total-row"><span class="label">Sub Total:</span><span class="amount">INR 0.00</span></div>
                                        <div class="total-row"><span class="label">CGST (9%):</span><span class="amount">INR 0.00</span></div>
                                        <div class="total-row"><span class="label">SGST (9%):</span><span class="amount">INR 0.00</span></div>
                                        <div class="total-row"><span class="label">Total Tax:</span><span class="amount">INR 0.00</span></div>
                                        <div class="total-row"><span class="label">Total:</span><span class="amount">INR 0.00</span></div>
                                        <div class="total-row"><span class="label">Balance:</span><span class="amount red">INR 0.00</span></div>
                                    </div>
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
        const editClientSelect = document.getElementById('editClientSelect');
        const editClientDetails = document.getElementById('editClientDetails');
        const editItemsTable = document.getElementById('editItemsTable');
        const editItemRowTemplate = document.getElementById('editItemRowTemplate');
        const editAddItemBtn = document.getElementById('editAddItemBtn');
        const editTotalsContainer = document.querySelector('#editInvoiceModal .totals-container');
        const editInvoiceForm = document.getElementById('editInvoiceForm');

        // Populate client list in edit modal
        try {
            const { data: clients, error } = await supabase
                .from('clients')
                .select('*')
                .order('name', { ascending: true });
            if (error) {
                console.error('Error fetching clients for edit invoice:', error);
                throw error;
            }

            if (editClientSelect) {
                editClientSelect.innerHTML = '<option value="">Select a Client</option>';
                clients.forEach(client => {
                    const option = document.createElement('option');
                    option.value = client.id;
                    option.textContent = client.name;
                    editClientSelect.appendChild(option);
                });

                // Pre-select the current client if available
                if (invoice.client_id) {
                    editClientSelect.value = invoice.client_id;
                    const currentClient = clients.find(c => c.id === invoice.client_id);
                    if (currentClient && editClientDetails) {
                        editClientDetails.style.display = 'block';
                        document.getElementById('editToAddress').innerHTML = `To: ${currentClient.name}<br>${currentClient.email}<br>${currentClient.address}`;
                    }
                }

                // Add event listener for client selection in edit modal
                editClientSelect.addEventListener('change', async (e) => {
                    const clientId = e.target.value;
                    if (clientId) {
                        const { data: client, error: clientError } = await supabase
                            .from('clients')
                            .select('*')
                            .eq('id', clientId)
                            .single();
                        if (clientError) {
                            console.error('Error fetching client details for edit:', clientError);
                            throw clientError;
                        }

                        // Update selectedClientId and show client details
                        setSelectedClientId(clientId);
                        if (editClientDetails) {
                            editClientDetails.style.display = 'block';
                            document.getElementById('editToAddress').innerHTML = `To: ${client.name}<br>${client.email}<br>${client.address}`;
                        } else {
                            console.error('editClientDetails not found in DOM');
                        }
                    } else {
                        // Hide client details if no client is selected
                        if (editClientDetails) {
                            editClientDetails.style.display = 'none';
                            document.getElementById('editToAddress').innerHTML = '';
                        }
                        setSelectedClientId(null);
                    }
                });
            } else {
                console.error('editClientSelect not found in DOM');
            }
        } catch (error) {
            console.error('Failed to populate client list for edit:', error);
            alert('An error occurred while loading clients: ' + (error.message || 'Unknown error'));
        }

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
            console.log('Updating edit totals...');
            let subTotalAmount = 0;
            document.querySelectorAll('#editItemsTable tbody tr:not(#editItemRowTemplate)').forEach(row => {
                const quantity = parseFloat(row.querySelector('.item-quantity').value) || 0;
                const rate = parseFloat(row.querySelector('.item-rate').value) || 0;
                const amount = quantity * rate;
                row.querySelector('.item-amount').textContent = `INR ${amount.toFixed(2)}`;
                subTotalAmount += amount;
            });

            const cgstRate = 9; // Fixed CGST rate of 9%
            const sgstRate = 9; // Fixed SGST rate of 9%
            const cgstAmount = subTotalAmount * (cgstRate / 100);
            const sgstAmount = subTotalAmount * (sgstRate / 100);
            const taxTotal = cgstAmount + sgstAmount; // Total tax (CGST + SGST)
            const totalAmount = subTotalAmount + taxTotal;

            editTotalsContainer.innerHTML = `
                <div class="total-row"><span class="label">Sub Total:</span><span class="amount">INR ${subTotalAmount.toFixed(2)}</span></div>
                <div class="total-row"><span class="label">CGST (9%):</span><span class="amount">INR ${cgstAmount.toFixed(2)}</span></div>
                <div class="total-row"><span class="label">SGST (9%):</span><span class="amount">INR ${sgstAmount.toFixed(2)}</span></div>
                <div class="total-row"><span class="label">Total Tax:</span><span class="amount">INR ${taxTotal.toFixed(2)}</span></div>
                <div class="total-row"><span class="label">Total:</span><span class="amount">INR ${totalAmount.toFixed(2)}</span></div>
                <div class="total-row"><span class="label">Balance:</span><span class="amount red">INR ${totalAmount.toFixed(2)}</span></div>
            `;
        }

        updateEditTotals();

        if (editAddItemBtn) {
            editAddItemBtn.addEventListener('click', () => {
                console.log('Adding new item to edit invoice...');
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
        } else {
            console.error('editAddItemBtn not found in edit modal');
        }

        editInvoiceForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            console.log(`Submitting edits for invoice ID: ${currentInvoiceId}`);
            try {
                const date = document.getElementById('editDate').value.trim();
                const dueDate = document.getElementById('editDueDate').value.trim();
                if (!date || !dueDate) {
                    alert('Please ensure both Date and Due Date are selected.');
                    return;
                }

                const clientId = editClientSelect.value;
                if (!clientId || clientId === '') {
                    alert('Please select a client before submitting the invoice.');
                    return;
                }

                let items = [];
                let allItemsValid = true;
                document.querySelectorAll('#editItemsTable tbody tr:not(#editItemRowTemplate)').forEach(row => {
                    const description = row.querySelector('.item-description').value.trim();
                    const quantity = row.querySelector('.item-quantity').value.trim();
                    const rate = row.querySelector('.item-rate').value.trim();
                    if (!description || !quantity || !rate || isNaN(parseFloat(quantity)) || isNaN(parseFloat(rate)) || parseFloat(quantity) <= 0 || parseFloat(rate) <= 0) {
                        allItemsValid = false;
                        row.querySelector('.item-description').style.borderColor = 'red';
                        row.querySelector('.item-quantity').style.borderColor = 'red';
                        row.querySelector('.item-rate').style.borderColor = 'red';
                        return;
                    } else {
                        row.querySelector('.item-description').style.borderColor = '';
                        row.querySelector('.item-quantity').style.borderColor = '';
                        row.querySelector('.item-rate').style.borderColor = '';
                    }
                    items.push({
                        description,
                        quantity: parseFloat(quantity),
                        rate: parseFloat(rate),
                        amount: parseFloat(row.querySelector('.item-amount').textContent.replace('INR ', ''))
                    });
                });

                if (!allItemsValid || items.length === 0) {
                    alert('Please ensure all item fields are correctly filled out and at least one item is added.');
                    return;
                }

                const subTotalAmount = parseFloat(document.querySelector('#editInvoiceModal .totals-container .total-row:first-child .amount').textContent.replace('INR ', '')) || 0;
                const cgstRate = 9; // Fixed CGST rate of 9%
                const sgstRate = 9; // Fixed SGST rate of 9%
                const cgstAmount = subTotalAmount * (cgstRate / 100);
                const sgstAmount = subTotalAmount * (sgstRate / 100);
                const taxTotal = cgstAmount + sgstAmount; // Total tax (CGST + SGST)

                const { error } = await supabase
                    .from('invoices')
                    .update({
                        client_id: clientId,
                        invoice_date: date,
                        due_date: dueDate,
                        items,
                        sub_total: subTotalAmount,
                        cgst: cgstAmount, // Update CGST
                        sgst: sgstAmount, // Update SGST
                        tax_total: taxTotal, // Update tax_total
                        total: subTotalAmount + taxTotal,
                        balance: subTotalAmount + taxTotal // Reset balance to total amount (unpaid by default)
                    })
                    .eq('id', currentInvoiceId);

                if (error) {
                    console.error('Error updating invoice:', error);
                    throw error;
                }

                $('#editInvoiceModal').modal('hide');
                fetchRecentInvoices(searchQuery, clientFilter, statusFilter); // Refresh with current filters
                fetchDashboardData(); // Refresh Dashboard metrics, including Outstanding Amount
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

export function addItemRow() {
    console.log('Adding new item row...');
    if (!itemsTable || !itemRowTemplate) {
        console.error('itemsTable or itemRowTemplate not found in DOM');
        return;
    }
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

export function updateTotals() {
    console.log('Updating totals...');
    let subTotalAmount = 0;
    document.querySelectorAll('#itemsTable tbody tr:not(#itemRowTemplate)').forEach(row => {
        const quantity = parseFloat(row.querySelector('.item-quantity').value) || 0;
        const rate = parseFloat(row.querySelector('.item-rate').value) || 0;
        const amount = quantity * rate;
        row.querySelector('.item-amount').textContent = `INR ${amount.toFixed(2)}`;
        subTotalAmount += amount;
    });

    const cgstRate = 9; // Fixed CGST rate of 9%
    const sgstRate = 9; // Fixed SGST rate of 9%
    const cgstAmount = subTotalAmount * (cgstRate / 100);
    const sgstAmount = subTotalAmount * (sgstRate / 100);
    const taxTotal = cgstAmount + sgstAmount; // Total tax (CGST + SGST)
    const totalAmount = subTotalAmount + taxTotal;

    const totalsContainer = document.querySelector('#addInvoiceModal .totals-container');
    if (totalsContainer) {
        totalsContainer.innerHTML = `
            <div class="total-row"><span class="label">Sub Total:</span><span class="amount">INR ${subTotalAmount.toFixed(2)}</span></div>
            <div class="total-row"><span class="label">CGST (9%):</span><span class="amount">INR ${cgstAmount.toFixed(2)}</span></div>
            <div class="total-row"><span class="label">SGST (9%):</span><span class="amount">INR ${sgstAmount.toFixed(2)}</span></div>
            <div class="total-row"><span class="label">Total Tax:</span><span class="amount">INR ${taxTotal.toFixed(2)}</span></div>
            <div class="total-row"><span class="label">Total:</span><span class="amount">INR ${totalAmount.toFixed(2)}</span></div>
            <div class="total-row"><span class="label">Balance:</span><span class="amount red">INR ${totalAmount.toFixed(2)}</span></div>
        `;
    } else {
        console.error('totalsContainer not found in DOM for add invoice modal');
    }
}

export function setupInvoiceDiscountToggle() {
    // Removed, as discount is no longer used
    console.log('Discount toggle removed (not applicable with current setup)');
}

export function setupInvoiceRecurrenceToggle() {
    // Removed, as recurrence is no longer used
    console.log('Recurrence toggle removed (not applicable with current setup)');
}

export function addInvoiceFormSubmit() {
    console.log('Setting up invoice form submit...');
    if (addInvoiceForm) {
        addInvoiceForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            console.log('Submitting invoice form...');
            try {
                const date = document.getElementById('date').value.trim();
                const dueDate = document.getElementById('dueDate').value.trim();
                if (!date || !dueDate) {
                    alert('Please ensure both Date and Due Date are selected.');
                    return;
                }

                const clientId = clientSelect.value;
                if (!clientId || clientId === '') {
                    alert('Please select a client before submitting the invoice.');
                    return;
                }

                let items = [];
                let allItemsValid = true;
                document.querySelectorAll('#itemsTable tbody tr:not(#itemRowTemplate)').forEach(row => {
                    const description = row.querySelector('.item-description').value.trim();
                    const quantity = row.querySelector('.item-quantity').value.trim();
                    const rate = row.querySelector('.item-rate').value.trim();
                    if (!description || !quantity || !rate || isNaN(parseFloat(quantity)) || isNaN(parseFloat(rate)) || parseFloat(quantity) <= 0 || parseFloat(rate) <= 0) {
                        allItemsValid = false;
                        row.querySelector('.item-description').style.borderColor = 'red';
                        row.querySelector('.item-quantity').style.borderColor = 'red';
                        row.querySelector('.item-rate').style.borderColor = 'red';
                        return;
                    } else {
                        row.querySelector('.item-description').style.borderColor = '';
                        row.querySelector('.item-quantity').style.borderColor = '';
                        row.querySelector('.item-rate').style.borderColor = '';
                    }
                    items.push({
                        description,
                        quantity: parseFloat(quantity),
                        rate: parseFloat(rate),
                        amount: parseFloat(row.querySelector('.item-amount').textContent.replace('INR ', ''))
                    });
                });

                if (!allItemsValid || items.length === 0) {
                    alert('Please ensure all item fields are correctly filled out and at least one item is added.');
                    return;
                }

                const subTotalAmount = parseFloat(document.querySelector('#addInvoiceModal .totals-container .total-row:first-child .amount').textContent.replace('INR ', '')) || 0;
                const cgstRate = 9; // Fixed CGST rate of 9%
                const sgstRate = 9; // Fixed SGST rate of 9%
                const cgstAmount = subTotalAmount * (cgstRate / 100);
                const sgstAmount = subTotalAmount * (sgstRate / 100);
                const taxTotal = cgstAmount + sgstAmount; // Total tax (CGST + SGST)

                const { error } = await supabase
                    .from('invoices')
                    .insert([{
                        client_id: clientId,
                        invoice_number: await getNextInvoiceNumber(),
                        invoice_date: date,
                        due_date: dueDate,
                        items,
                        sub_total: subTotalAmount,
                        cgst: cgstAmount, // Add CGST
                        sgst: sgstAmount, // Add SGST
                        tax_total: taxTotal, // Add tax_total
                        total: subTotalAmount + taxTotal,
                        balance: subTotalAmount + taxTotal, // Initial balance is the total amount (unpaid by default)
                        status: 'Pending'
                    }]);

                if (error) {
                    console.error('Failed to add invoice:', error);
                    throw error;
                }

                $('#addInvoiceModal').modal('hide');
                fetchRecentInvoices(); // Update recent invoices after adding (without filters initially)
                fetchDashboardData(); // Refresh Dashboard metrics, including Outstanding Amount
            } catch (error) {
                console.error('Failed to add invoice:', error);
                alert('An error occurred while adding the invoice: ' + (error.message || 'Unknown error'));
            }
        });
    } else {
        console.error('addInvoiceForm not found in DOM');
    }
}

export async function populateClientFilter() {
    try {
        const { data: clients, error } = await supabase
            .from('clients')
            .select('id, name')
            .order('name', { ascending: true });
        if (error) {
            console.error('Error fetching clients for filter:', error);
            throw error;
        }

        if (filterClient) {
            filterClient.innerHTML = '<option value="">All Clients</option>';
            clients.forEach(client => {
                const option = document.createElement('option');
                option.value = client.id;
                option.textContent = client.name;
                filterClient.appendChild(option);
            });
        } else {
            console.error('filterClient not found in DOM');
        }
    } catch (error) {
        console.error('Failed to populate client filter:', error);
        alert('An error occurred while loading clients for filter: ' + (error.message || 'Unknown error'));
    }
}

export function setupInvoiceFilters() {
    if (searchInvoiceId && filterClient && filterStatus) {
        const applyFilters = () => {
            const searchQuery = searchInvoiceId.value.trim();
            const clientFilter = filterClient.value;
            const statusFilter = filterStatus.value;
            fetchRecentInvoices(searchQuery, clientFilter, statusFilter);
        };

        searchInvoiceId.addEventListener('input', applyFilters);
        filterClient.addEventListener('change', applyFilters);
        filterStatus.addEventListener('change', applyFilters);
    } else {
        console.error('One or more filter elements not found in DOM');
    }
}