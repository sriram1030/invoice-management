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

    let selectedClientId = null;

    // Function to fetch and display clients
    async function fetchClients() {
        console.log("Fetching clients...");
        const { data, error } = await supabase.from('clients').select('*');
        console.log("Data received:", data);
        if (error) {
            console.error('Error fetching clients:', error);
            alert('An error occurred while fetching clients. Please try again.');
            return;
        }
        console.log("Updating UI with client data...");
        clientsList.innerHTML = ''; // Clear the list
        data.forEach(client => {
            const listItem = document.createElement('li');
            listItem.className = 'list-group-item';
            listItem.textContent = `${client.name} (${client.email})`; // Display name and email
            listItem.dataset.id = client.id;
            listItem.addEventListener('click', () => selectClient(client.id, client.name, client.email, client.address));
            clientsList.appendChild(listItem);
        });
    }

    // Function to select a client and fetch their invoices
    function selectClient(id, name, email, address) {
        document.querySelectorAll('#clientsList .list-group-item').forEach(item => {
            item.classList.remove('active');
        });
        document.querySelector(`#clientsList .list-group-item[data-id="${id}"]`).classList.add('active');
        selectedClientId = id;
        toAddress.textContent = `${name}\n${email}\n${address}`; // Update the To address in the invoice form
        addInvoiceBtn.disabled = false;

        // Fetch invoices for the selected client
        fetchInvoicesForClient(id);
    }

    // New function to fetch and display invoices for a client
    async function fetchInvoicesForClient(clientId) {
        const { data: invoices, error } = await supabase
            .from('invoices')
            .select('*')
            .eq('client_id', clientId)
            .order('invoice_date', { ascending: false }); // Optional: sort by date

        if (error) {
            console.error('Error fetching invoices:', error);
            alert('An error occurred while fetching invoices. Please try again.');
            return;
        }

        // Clear existing invoices from the table
        invoicesTableBody.innerHTML = '';

        // Populate the invoices table with the fetched data
        invoices.forEach(invoice => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${invoice.id}</td>
                <td>${invoice.invoice_number}</td>
                <td>${new Date(invoice.invoice_date).toLocaleDateString()}</td>
                <td><a href="${invoice.pdf_url || '#'}" target="_blank">${invoice.pdf_url ? 'View PDF' : 'PDF Not Available'}</a></td>
                <td>
                    <select class="form-control status-select" data-invoice-id="${invoice.id}">
                        <option value="Pending" ${invoice.status === 'Pending' ? 'selected' : ''}>Pending</option>
                        <option value="Paid" ${invoice.status === 'Paid' ? 'selected' : ''}>Paid</option>
                        <option value="Overdue" ${invoice.status === 'Overdue' ? 'selected' : ''}>Overdue</option>
                        <option value="Cancelled" ${invoice.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                    </select>
                </td>
            `;
            invoicesTableBody.appendChild(row);
        });
    }

    // Function to update invoice status
    async function updateInvoiceStatus(invoiceId, newStatus) {
        const { error } = await supabase
            .from('invoices')
            .update({ status: newStatus })
            .eq('id', invoiceId);

        if (error) {
            console.error('Error updating invoice status:', error);
            alert('Failed to update invoice status. Please try again.');
        } else {
            console.log('Invoice status updated successfully');
            // Optionally, refresh the invoices here
        }
    }

    // Function to add a new client
    async function addClient() {
        const clientNameInput = document.getElementById('clientName');
        const clientEmailInput = document.getElementById('clientEmail'); // New field
        const clientAddressInput = document.getElementById('clientAddress');
        
        const name = clientNameInput.value;
        const email = clientEmailInput.value; // New field
        const address = clientAddressInput.value;

        if (name && email && address) {
            const { data, error } = await supabase
                .from('clients')
                .insert([{ name: name, email: email, address: address }]);
            if (error) {
                console.error('Error adding client:', error);
                alert('An error occurred while adding the client. Please try again.');
            } else {
                fetchClients(); // Refresh the list
                clientNameInput.value = ''; // Clear form
                clientEmailInput.value = ''; // Clear new field
                clientAddressInput.value = '';
                $('#addClientModal').modal('hide'); // Close modal after adding client
            }
        } else {
            alert('Please enter name, email, and address for the client.');
        }
    }

    // Function to add an item row
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

    // Function to calculate and update totals
    function updateTotals() {
        let subTotalAmount = 0;
        document.querySelectorAll('#itemsTable tbody tr').forEach(row => {
            const quantity = parseFloat(row.querySelector('.item-quantity').value) || 0;
            const rate = parseFloat(row.querySelector('.item-rate').value) || 0;
            const amount = quantity * rate;
            row.querySelector('.item-amount').textContent = `INR ${amount.toFixed(2)}`;
            subTotalAmount += amount;
        });
        
        subTotal.textContent = `INR ${subTotalAmount.toFixed(2)}`;
        cgst.textContent = `INR 180.00`;  // Constant CGST
        sgst.textContent = `INR 180.00`;  // Constant SGST
        taxTotal.textContent = `INR 360.00`; // Total tax
        const totalAmount = subTotalAmount + 360; // Adding constant tax to sub-total
        total.textContent = `INR ${totalAmount.toFixed(2)}`;
        balance.textContent = `INR ${totalAmount.toFixed(2)}`;
    }

    // Event listeners
    addClientBtn.addEventListener('click', () => {
        $('#addClientModal').modal('show');
    });

    addInvoiceBtn.addEventListener('click', () => {
        if (!selectedClientId) {
            alert('Please select a client first.');
            return;
        }
        $('#addInvoiceModal').modal('show');
        // Auto-generate Invoice Number
        document.getElementById('invoiceNumber').textContent = 'INV-' + Date.now();
    });

    // Form submission for adding client
    clientForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await addClient();
    });

    // Event listener for adding item
    addItemBtn.addEventListener('click', addItemRow);

    // Event listener for status change in the invoice table
    document.getElementById('invoicesTableBody').addEventListener('change', async function(e) {
        if(e.target.classList.contains('status-select')) {
            const invoiceId = e.target.dataset.invoiceId;
            const newStatus = e.target.value;
            await updateInvoiceStatus(invoiceId, newStatus);
        }
    });

    // Invoice form submission
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
                alert('Please ensure all item fields are correctly filled out. Description cannot be empty, and Quantity and Rate must be positive numbers.');
                return; // This will exit the forEach loop early if any item is invalid
            }
            
            items.push({
                description: description,
                quantity: parseFloat(quantity),
                rate: parseFloat(rate),
                amount: parseFloat(row.querySelector('.item-amount').textContent.replace('INR ', ''))
            });
        });
    
        if (!allItemsValid || items.length === 0) {
            return;
        }
    
        if (!selectedClientId) {
            alert('Please select a client before submitting the invoice.');
            return;
        }

        // Check if PDFMake is loaded
    if (typeof pdfMake === 'undefined') {
        console.error('PDFMake is not loaded yet.');
        alert('Failed to generate PDF. Please try again.');
        return;
    }

    // Define the document structure for PDFMake
    const docDefinition = {
        content: [
            { text: 'Invoice', style: 'header' },
            { text: `Invoice Number: ${document.getElementById('invoiceNumber').textContent}` },
            { text: `Client: ${toAddress.textContent}`, style: 'subheader' },
            '\n',
            // Items Table
            {
                table: {
                    headerRows: 1,
                    widths: ['*', 'auto', 'auto', 'auto'],
                    body: [
                        ['Description', 'Quantity', 'Rate', 'Amount'],
                        ...items.map(item => [item.description, item.quantity, `INR ${item.rate.toFixed(2)}`, `INR ${item.amount.toFixed(2)}`])
                    ]
                }
            },
            '\n',
            { text: `Sub Total: ${subTotal.textContent}`, style: 'totals' },
            { text: `CGST: ${cgst.textContent}`, style: 'totals' },
            { text: `SGST: ${sgst.textContent}`, style: 'totals' },
            { text: `Total: ${total.textContent}`, style: 'totals' }
        ],
        styles: {
            header: {
                fontSize: 18,
                bold: true,
                margin: [0, 0, 0, 10]
            },
            subheader: {
                fontSize: 14,
                bold: true,
                margin: [0, 10, 0, 5]
            },
            totals: {
                fontSize: 12,
                bold: true,
                margin: [0, 5, 0, 5]
            },
            tableHeader: {
                bold: true,
                fontSize: 13,
                color: 'black'
            }
        },
        defaultStyle: {
            // Default style for all text elements
            fontSize: 12
        }
    };

    // Generate PDF
    try {
        const pdfDocGenerator = pdfMake.createPdf(docDefinition);
        pdfDocGenerator.getBlob(async (blob) => {
            // Upload PDF to Supabase Storage
            const fileName = `${document.getElementById('invoiceNumber').textContent}.pdf`;
            const { data: uploadData, error: uploadError } = await supabase
                .storage
                .from('invoices')
                .upload(fileName, blob);

            if (uploadError) {
                console.error('Error uploading PDF:', uploadError);
                alert('Failed to upload the invoice PDF. Please try again.');
                return;
            }

            // Get the URL for the uploaded file
            const { data: urlData, error: urlError } = await supabase
                .storage
                .from('invoices')
                .getPublicUrl(fileName);

            if (urlError) {
                console.error('Error getting PDF URL:', urlError);
                alert('Failed to get PDF URL. Please try again.');
                return;
            }

            // Insert invoice data including PDF URL
            // After generating and uploading the PDF, when inserting the invoice data
const { data, error } = await supabase
.from('invoices')
.insert([{
    client_id: selectedClientId,
    invoice_number: document.getElementById('invoiceNumber').textContent,
    invoice_date: date,
    due_date: dueDate,
    items: items,
    sub_total: parseFloat(subTotal.textContent.replace('INR ', '')),
    cgst: 180.00,
    sgst: 180.00,
    tax_total: 360.00,
    total: parseFloat(total.textContent.replace('INR ', '')),
    balance: parseFloat(balance.textContent.replace('INR ', '')),
    pdf_url: urlData.publicUrl // This line should now work since pdf_url exists
}]);

if (error) {
console.error('Error adding invoice:', error);
alert('An error occurred while adding the invoice. Error details: ' + error.message);
} else {
console.log('Invoice added successfully:', data);
$('#addInvoiceModal').modal('hide');
fetchInvoicesForClient(selectedClientId); // Refresh invoices list after adding new one
}
        });
    } catch (error) {
        console.error('Error generating PDF:', error);
        alert('An error occurred while generating the PDF: ' + error.message);
    }
});

    // Initial fetch of clients
    fetchClients();
});