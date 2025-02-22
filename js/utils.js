// js/utils.js
import { supabase } from './config.js';
import { dashboardSection, invoicesSection, reportsSection, clientsGrid } from './main.js';
import { fetchDashboardData } from './invoicesList.js';

export async function updateInvoiceStatus(invoiceId, newStatus) {
    console.log(`Updating invoice ${invoiceId} status to ${newStatus}...`);
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

export async function getNextInvoiceNumber() {
    console.log('Getting next invoice number...');
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

export async function generateInvoicePDF(id, type) {
    console.log(`Generating ${type} PDF for ID: ${id}...`);
    try {
        if (type !== 'invoice') {
            console.error('Only invoices are supported for PDF generation.');
            throw new Error('Invalid document type');
        }

        const { data: documentData, error } = await supabase
            .from('invoices')
            .select('*, clients(name, email, address)')
            .eq('id', id)
            .single();
        if (error) {
            console.error(`Error fetching invoice for PDF:`, error);
            throw error;
        }

        const { data: settings } = await supabase.from('settings').select('logo_path').single();
        const subTotalAmount = documentData.items.reduce((sum, item) => sum + item.amount, 0);
        const cgstRate = 9; // Fixed CGST rate of 9%
        const sgstRate = 9; // Fixed SGST rate of 9%
        const cgstAmount = subTotalAmount * (cgstRate / 100);
        const sgstAmount = subTotalAmount * (sgstRate / 100);
        const taxTotal = cgstAmount + sgstAmount; // Total tax (CGST + SGST)
        const totalAmount = subTotalAmount + taxTotal;

        const docDefinition = {
            content: [
                settings.logo_path ? { image: settings.logo_path, width: 150, margin: [0, 0, 0, 20] } : { text: 'Grafikos', style: 'header' },
                {
                    text: 'Invoice',
                    style: 'header',
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
                            { text: `Invoice No.: ${documentData.invoice_number}`, bold: true },
                            { text: `Date: ${new Date(documentData.invoice_date).toLocaleDateString()}`, bold: true },
                            { text: `Invoice Due: ${new Date(documentData.due_date).toLocaleDateString()}`, bold: true }
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
                            [{ text: 'CGST (9%):', bold: true, alignment: 'left' }, { text: `INR ${cgstAmount.toFixed(2)}`, alignment: 'right' }],
                            [{ text: 'SGST (9%):', bold: true, alignment: 'left' }, { text: `INR ${sgstAmount.toFixed(2)}`, alignment: 'right' }],
                            [{ text: 'Total Tax:', bold: true, alignment: 'left' }, { text: `INR ${taxTotal.toFixed(2)}`, alignment: 'right' }],
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
        console.error(`Failed to generate invoice PDF:`, error);
        alert(`Failed to fetch invoice details: ' + (error.message || 'Unknown error')`);
    }
}

export async function generateReportPDF(data, reportType, period, status, currency, clientId) {
    console.log('Generating report PDF...');
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
                text: 'Report - Invoices',
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

export async function initialize() {
    console.log('Initializing application...');
    try {
        dashboardSection.style.display = 'block';
        invoicesSection.style.display = 'none';
        reportsSection.style.display = 'none';
        await fetchDashboardData();
    } catch (error) {
        console.error('Initialization error:', error);
        if (clientsGrid) {
            clientsGrid.innerHTML = '<div class="client-card text-danger">Failed to load dashboard: ' + (error.message || 'Unknown error') + '</div>';
        } else {
            console.error('clientsGrid not found in DOM');
        }
    }
}