import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

// Initialize Supabase client
const supabaseUrl = 'https://zpjrivjogqljxnodmtbj.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpwanJpdmpvZ3Fsanhub2RtdGJqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Mzk4NzgxNDUsImV4cCI6MjA1NTQ1NDE0NX0.FQ_ru6GJAOBvjJVTw6qr0RdntCDHh8KmUAUfCxxGROA';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

document.addEventListener('DOMContentLoaded', () => {
    const addClientBtn = document.getElementById('addClientBtn');
    const clientsList = document.getElementById('clientsList');
    const invoicesTableBody = document.getElementById('invoicesTableBody');
    const addInvoiceBtn = document.getElementById('addInvoiceBtn');
    const showAllInvoicesBtn = document.getElementById('showAllInvoicesBtn');
    const clientForm = document.getElementById('clientForm');
    const invoiceForm = document.getElementById('addInvoiceModal');
    const itemsTable = document.getElementById('itemsTable');
    const itemRowTemplate = document.getElementById('itemRowTemplate');
    const addItemBtn = document.getElementById('addItemBtn');
    const subTotal = document.getElementById('subTotal');
    const cgst = document.getElementById('cgst');
    const sgst = document.getElementById('sgst');
    const taxTotal = document.getElementById('taxTotal');
    const total = document.getElementById('total');
    const balance = document.getElementById('balance');
    const toAddress = document.getElementById('toAddress');
    const totalClients = document.getElementById('totalClients');
    const totalInvoices = document.getElementById('totalInvoices');

    // Edit Invoice Elements
    const editInvoiceForm = document.getElementById('editInvoiceForm');
    const editItemsTable = document.getElementById('editItemsTable');
    const editItemRowTemplate = document.getElementById('editItemRowTemplate');
    const editAddItemBtn = document.getElementById('editAddItemBtn');
    const editSubTotal = document.getElementById('editSubTotal');
    const editCgst = document.getElementById('editCgst');
    const editSgst = document.getElementById('editSgst');
    const editTaxTotal = document.getElementById('editTaxTotal');
    const editTotal = document.getElementById('editTotal');
    const editBalance = document.getElementById('editBalance');
    const editToAddress = document.getElementById('editToAddress');

    let selectedClientId = null;
    let currentInvoiceId = null;

    // Function to get the next invoice number
    async function getNextInvoiceNumber() {
        const { data, error } = await supabase
            .from('invoices')
            .select('invoice_number')
            .order('invoice_number', { ascending: false })
            .limit(1);

        if (error) {
            console.error('Error fetching highest invoice number:', error);
            return 'INV-300';
        }

        if (!data || data.length === 0) {
            return 'INV-300';
        }

        const highestNumber = data[0].invoice_number.replace('INV-', '');
        const nextNumber = Math.max(parseInt(highestNumber, 10) + 1, 300);
        return `INV-${nextNumber}`;
    }

    // Fetch and display total counts
    async function updateCounts() {
        const { count: clientCount, error: clientError } = await supabase
            .from('clients')
            .select('*', { count: 'exact', head: true });

        if (clientError) {
            console.error('Error fetching client count:', clientError);
            totalClients.textContent = 'Total Clients - Error';
        } else {
            totalClients.textContent = `Total Clients - ${clientCount}`;
        }

        const { count: invoiceCount, error: invoiceError } = await supabase
            .from('invoices')
            .select('*', { count: 'exact', head: true });

        if (invoiceError) {
            console.error('Error fetching invoice count:', invoiceError);
            totalInvoices.textContent = 'Total Invoices - Error';
        } else {
            totalInvoices.textContent = `Total Invoices - ${invoiceCount}`;
        }
    }

    // Fetch and display clients
    async function fetchClients() {
        const { data, error } = await supabase.from('clients').select('*');
        if (error) {
            console.error('Error fetching clients:', error);
            alert('An error occurred while fetching clients.');
            return;
        }
        clientsList.innerHTML = '';
        data.forEach(client => {
            const listItem = document.createElement('li');
            listItem.className = 'list-group-item';
            listItem.textContent = `${client.name} (${client.email})`;
            listItem.dataset.id = client.id;
            listItem.addEventListener('click', () => selectClient(client.id, client.name, client.email, client.address));
            clientsList.appendChild(listItem);
        });
    }

    // Select a client and fetch their invoices
    function selectClient(id, name, email, address) {
        document.querySelectorAll('#clientsList .list-group-item').forEach(item => item.classList.remove('active'));
        document.querySelector(`#clientsList .list-group-item[data-id="${id}"]`).classList.add('active');
        selectedClientId = id;
        toAddress.textContent = `${name}\n${email}\n${address}`;
        editToAddress.textContent = `${name}\n${email}\n${address}`;
        addInvoiceBtn.disabled = false;
        fetchInvoicesForClient(id);
    }

    // Fetch and display all invoices (default view)
    async function fetchAllInvoices() {
        const { data: invoices, error } = await supabase
            .from('invoices')
            .select('*, clients(name)')
            .order('invoice_date', { ascending: false });

        if (error) {
            console.error('Error fetching all invoices:', error);
            alert('An error occurred while fetching invoices.');
            return;
        }

        invoicesTableBody.innerHTML = '';
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
            invoicesTableBody.appendChild(row);
        });

        selectedClientId = null;
        toAddress.textContent = '';
        editToAddress.textContent = '';
        addInvoiceBtn.disabled = true;
    }

    // Fetch and display invoices for a specific client
    async function fetchInvoicesForClient(clientId) {
        const { data: invoices, error } = await supabase
            .from('invoices')
            .select('*, clients(name)')
            .eq('client_id', clientId)
            .order('invoice_date', { ascending: false });

        if (error) {
            console.error('Error fetching invoices:', error);
            alert('An error occurred while fetching invoices.');
            return;
        }

        invoicesTableBody.innerHTML = '';
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
            invoicesTableBody.appendChild(row);
        });
    }

    // Update invoice status
    async function updateInvoiceStatus(invoiceId, newStatus) {
        const { error } = await supabase
            .from('invoices')
            .update({ status: newStatus })
            .eq('id', invoiceId);

        if (error) {
            console.error('Error updating invoice status:', error);
            alert('Failed to update invoice status.');
        }
    }

    // Add a new client
    async function addClient() {
        const clientNameInput = document.getElementById('clientName');
        const clientEmailInput = document.getElementById('clientEmail');
        const clientAddressInput = document.getElementById('clientAddress');
        
        const name = clientNameInput.value;
        const email = clientEmailInput.value;
        const address = clientAddressInput.value;

        if (name && email && address) {
            const { error } = await supabase
                .from('clients')
                .insert([{ name, email, address }]);
            if (error) {
                console.error('Error adding client:', error);
                alert('An error occurred while adding the client.');
            } else {
                fetchClients();
                updateCounts();
                clientNameInput.value = '';
                clientEmailInput.value = '';
                clientAddressInput.value = '';
                $('#addClientModal').modal('hide');
                fetchAllInvoices();
            }
        } else {
            alert('Please enter name, email, and address for the client.');
        }
    }

    // Add item row (Add Invoice)
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

    // Add item row (Edit Invoice)
    function addEditItemRow() {
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
    }

    // Calculate and update totals (Add Invoice)
    function updateTotals() {
        let subTotalAmount = 0;
        document.querySelectorAll('#itemsTable tbody tr:not(#itemRowTemplate)').forEach(row => {
            const quantity = parseFloat(row.querySelector('.item-quantity').value) || 0;
            const rate = parseFloat(row.querySelector('.item-rate').value) || 0;
            const amount = quantity * rate;
            row.querySelector('.item-amount').textContent = `INR ${amount.toFixed(2)}`;
            subTotalAmount += amount;
        });
        
        const TAX_RATE = 0.09; // 9% for each GST component
        const cgstAmount = subTotalAmount * TAX_RATE;
        const sgstAmount = subTotalAmount * TAX_RATE;
        const taxTotalAmount = cgstAmount + sgstAmount;
        const totalAmount = subTotalAmount + taxTotalAmount;
        const balanceAmount = totalAmount;

        // Single column layout: labels left-aligned, amounts right-aligned
        const totalsContainer = document.createElement('div');
        totalsContainer.className = 'totals-container';
        totalsContainer.innerHTML = `
            <div><span>Sub Total:</span><span style="float: right;">INR ${subTotalAmount.toFixed(2)}</span></div>
            <div><span>CGST (9%):</span><span style="float: right;">INR ${cgstAmount.toFixed(2)}</span></div>
            <div><span>SGST (9%):</span><span style="float: right;">INR ${sgstAmount.toFixed(2)}</span></div>
            <div><span>Tax Total:</span><span style="float: right;">INR ${taxTotalAmount.toFixed(2)}</span></div>
            <div><span>Total:</span><span style="float: right;">INR ${totalAmount.toFixed(2)}</span></div>
            <div><span>Balance:</span><span style="float: right; color: red;">INR ${balanceAmount.toFixed(2)}</span></div>
        `;
        // Replace the existing content in the totals section
        document.querySelector('.col-md-6.offset-md-6.text-end').innerHTML = '';
        document.querySelector('.col-md-6.offset-md-6.text-end').appendChild(totalsContainer);
    }

    // Calculate and update totals (Edit Invoice)
    function updateEditTotals() {
        let subTotalAmount = 0;
        document.querySelectorAll('#editItemsTable tbody tr:not(#editItemRowTemplate)').forEach(row => {
            const quantity = parseFloat(row.querySelector('.item-quantity').value) || 0;
            const rate = parseFloat(row.querySelector('.item-rate').value) || 0;
            const amount = quantity * rate;
            row.querySelector('.item-amount').textContent = `INR ${amount.toFixed(2)}`;
            subTotalAmount += amount;
        });
        
        const TAX_RATE = 0.09; // 9% for each GST component
        const cgstAmount = subTotalAmount * TAX_RATE;
        const sgstAmount = subTotalAmount * TAX_RATE;
        const taxTotalAmount = cgstAmount + sgstAmount;
        const totalAmount = subTotalAmount + taxTotalAmount;
        const balanceAmount = totalAmount;

        // Single column layout: labels left-aligned, amounts right-aligned
        const totalsContainer = document.createElement('div');
        totalsContainer.className = 'totals-container';
        totalsContainer.innerHTML = `
            <div><span>Sub Total:</span><span style="float: right;">INR ${subTotalAmount.toFixed(2)}</span></div>
            <div><span>CGST (9%):</span><span style="float: right;">INR ${cgstAmount.toFixed(2)}</span></div>
            <div><span>SGST (9%):</span><span style="float: right;">INR ${sgstAmount.toFixed(2)}</span></div>
            <div><span>Tax Total:</span><span style="float: right;">INR ${taxTotalAmount.toFixed(2)}</span></div>
            <div><span>Total:</span><span style="float: right;">INR ${totalAmount.toFixed(2)}</span></div>
            <div><span>Balance:</span><span style="float: right; color: red;">INR ${balanceAmount.toFixed(2)}</span></div>
        `;
        // Replace the existing content in the totals section
        document.querySelector('#editInvoiceModal .col-md-6.offset-md-6.text-end').innerHTML = '';
        document.querySelector('#editInvoiceModal .col-md-6.offset-md-6.text-end').appendChild(totalsContainer);
    }

    // Event listeners
    addClientBtn.addEventListener('click', () => $('#addClientModal').modal('show'));

    addInvoiceBtn.addEventListener('click', async () => {
        if (!selectedClientId) {
            alert('Please select a client first.');
            return;
        }
        $('#addInvoiceModal').modal('show');
        const nextInvoiceNumber = await getNextInvoiceNumber();
        document.getElementById('invoiceNumber').textContent = nextInvoiceNumber;
    });

    showAllInvoicesBtn.addEventListener('click', () => {
        fetchAllInvoices();
        document.querySelectorAll('#clientsList .list-group-item').forEach(item => item.classList.remove('active'));
    });

    clientForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await addClient();
    });

    addItemBtn.addEventListener('click', addItemRow);

    editAddItemBtn.addEventListener('click', addEditItemRow);

    invoicesTableBody.addEventListener('change', async function(e) {
        if (e.target.classList.contains('status-select')) {
            const invoiceId = e.target.dataset.invoiceId;
            const newStatus = e.target.value;
            await updateInvoiceStatus(invoiceId, newStatus);
            if (selectedClientId) {
                fetchInvoicesForClient(selectedClientId);
            } else {
                fetchAllInvoices();
            }
        }
    });

    // Edit invoice and View PDF
    invoicesTableBody.addEventListener('click', async function(e) {
        if (e.target.classList.contains('edit-invoice')) {
            currentInvoiceId = e.target.dataset.invoiceId;
            const { data: invoice, error } = await supabase
                .from('invoices')
                .select('*, clients(name, email, address)')
                .eq('id', currentInvoiceId)
                .single();

            if (error) {
                console.error('Error fetching invoice:', error);
                alert('Failed to fetch invoice details.');
                return;
            }

            document.getElementById('editInvoiceNumber').textContent = invoice.invoice_number;
            document.getElementById('editDate').value = invoice.invoice_date;
            document.getElementById('editDueDate').value = invoice.due_date;
            editToAddress.textContent = `${invoice.clients.name}\n${invoice.clients.email}\n${invoice.clients.address}`;

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

            updateEditTotals();
            $('#editInvoiceModal').modal('show');
        }

        if (e.target.classList.contains('view-pdf')) {
            const invoiceId = e.target.dataset.invoiceId;
            const { data: invoice, error } = await supabase
                .from('invoices')
                .select('*, clients(name, email, address)')
                .eq('id', invoiceId)
                .single();

            if (error) {
                console.error('Error fetching invoice for PDF:', error);
                alert('Failed to fetch invoice details.');
                return;
            }

            const subTotalAmount = invoice.items.reduce((sum, item) => sum + item.amount, 0);
            const TAX_RATE = 0.09;
            const cgstAmount = subTotalAmount * TAX_RATE;
            const sgstAmount = subTotalAmount * TAX_RATE;
            const taxTotalAmount = cgstAmount + sgstAmount;
            const totalAmount = subTotalAmount + taxTotalAmount;

            const docDefinition = {
                content: [
                    // Header
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

                    // From and Invoice Details
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
                                { text: 'Invoice No.:', bold: true },
                                invoice.invoice_number,
                                { text: 'Date:', bold: true },
                                new Date(invoice.invoice_date).toLocaleDateString(),
                                { text: 'Invoice Due:', bold: true },
                                new Date(invoice.due_date).toLocaleDateString()
                            ]
                        ],
                        columnGap: 20,
                        margin: [0, 0, 0, 20]
                    },

                    // Client Details
                    {
                        text: `To: ${invoice.clients.name}\n${invoice.clients.email}\n${invoice.clients.address}`,
                        style: 'clientInfo',
                        margin: [0, 0, 0, 20]
                    },

                    // Items Table
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

                    // Totals (single column: labels left-aligned, amounts right-aligned)
                    {
                        table: {
                            widths: ['*', 'auto'],
                            body: [
                                [{ text: 'Sub Total:', bold: true, alignment: 'left' }, { text: `INR ${subTotalAmount.toFixed(2)}`, alignment: 'right' }],
                                [{ text: 'CGST (9%):', bold: true, alignment: 'left' }, { text: `INR ${cgstAmount.toFixed(2)}`, alignment: 'right' }],
                                [{ text: 'SGST (9%):', bold: true, alignment: 'left' }, { text: 'INR', alignment: 'right' }],
                                [{ text: 'Tax Total:', bold: true, alignment: 'left' }, { text: `INR ${taxTotalAmount.toFixed(2)}`, alignment: 'right' }],
                                [{ text: 'Total:', bold: true, alignment: 'left' }, { text: `INR ${totalAmount.toFixed(2)}`, alignment: 'right' }],
                                [{ text: 'Balance:', bold: true, color: 'red', alignment: 'left' }, { text: `INR ${totalAmount.toFixed(2)}`, alignment: 'right' }]
                            ]
                        },
                        margin: [0, 0, 0, 20]
                    },

                    // Bank Details
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
                    
                    // Footer
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
        }
    });

    // Add Invoice submission
    invoiceForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        
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

        const invoiceNumber = document.getElementById('invoiceNumber').textContent;
        const subTotalAmount = parseFloat(document.querySelector('.totals-container div:first-child span:last-child').textContent.replace('INR ', '')) || 0;
        const TAX_RATE = 0.09; // 9% for each GST component
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

        if (error) {
            console.error('Error adding invoice:', error);
            alert('An error occurred while adding the invoice.');
        } else {
            $('#addInvoiceModal').modal('hide');
            if (selectedClientId) {
                fetchInvoicesForClient(selectedClientId);
            } else {
                fetchAllInvoices();
            }
            updateCounts();
        }
    });

    // Edit Invoice submission
    editInvoiceForm.addEventListener('submit', async (event) => {
        event.preventDefault();

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

        const subTotalAmount = parseFloat(document.querySelector('#editInvoiceModal .totals-container div:first-child span:last-child').textContent.replace('INR ', '')) || 0;
        const TAX_RATE = 0.09; // 9% for each GST component
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

        if (error) {
            console.error('Error updating invoice:', error);
            alert('An error occurred while updating the invoice.');
        } else {
            $('#editInvoiceModal').modal('hide');
            if (selectedClientId) {
                fetchInvoicesForClient(selectedClientId);
            } else {
                fetchAllInvoices();
            }
            updateCounts();
        }
    });

    // Initial fetch of clients and all invoices
    fetchClients();
    fetchAllInvoices();
    updateCounts();
});