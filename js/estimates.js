// js/estimates.js
import { supabase } from './config.js';
import { estimatesGrid, estimateItemsTable, estimateItemRowTemplate, addEstimateForm } from './main.js';
import { updateEstimateStatus } from './utils.js';
import { generateInvoicePDF } from './utils.js';
import { getNextEstimateNumber } from './utils.js';

export let currentEstimateId = null;

export async function fetchAllEstimates() {
    console.log('Fetching all estimates...');
    try {
        const { data: estimates, error } = await supabase
            .from('estimates')
            .select('*')
            .order('invoice_number', { ascending: false });

        if (error) {
            console.error('Error fetching estimates:', error);
            throw error;
        }
        console.log('Estimates data:', estimates);

        estimatesGrid.innerHTML = '<button class="btn btn-primary create-estimate-btn">Create Cost Estimation</button>';

        if (!estimates || estimates.length === 0) {
            estimatesGrid.innerHTML += '<div class="estimate-card">No cost estimations found</div>';
        } else {
            estimates.forEach(estimate => {
                const card = document.createElement('div');
                card.className = 'estimate-card';
                card.innerHTML = `
                    <div class="estimate-details">
                        <p>Estimate No.: ${estimate.invoice_number}</p>
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
        }

        // Setup Create Cost Estimation button
        document.querySelectorAll('.create-estimate-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                console.log('Opening create cost estimation modal...');
                $('#addEstimateModal').modal('show');
                const nextEstimateNumber = await getNextEstimateNumber();
                document.querySelector('#estimateNumber').textContent = `Estimate No.: ${nextEstimateNumber}`;
            });
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
        estimatesGrid.innerHTML = '<div class="estimate-card text-danger">Failed to load cost estimations: ' + (error.message || 'Unknown error') + '</div>';
    }
}

export async function editEstimate(estimateId) {
    console.log(`Editing estimate with ID: ${estimateId}`);
    try {
        const { data: estimate, error } = await supabase
            .from('estimates')
            .select('*')
            .eq('id', estimateId)
            .single();

        if (error) {
            console.error('Error fetching estimate for editing:', error);
            throw error;
        }

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
                        <h5 class="modal-title" id="editEstimateModalLabel">Edit Cost Estimation</h5>
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
                                                    <td><input type="text" class="form-control estimate-item-description" required></td>
                                                    <td><input type="number" class="form-control estimate-item-quantity" required></td>
                                                    <td><input type="number" step="0.01" class="form-control estimate-item-rate" required></td>
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
            console.log('Updating edit estimate totals...');
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

        if (editAddEstimateItemBtn) {
            editAddEstimateItemBtn.addEventListener('click', () => {
                console.log('Adding new item to edit estimate...');
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
        } else {
            console.error('editAddEstimateItemBtn not found in edit modal');
        }

        editEstimateForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            console.log(`Submitting edits for estimate ID: ${currentEstimateId}`);
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

                if (error) {
                    console.error('Error updating estimate:', error);
                    throw error;
                }

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

export function addEstimateItemRow() {
    console.log('Adding new estimate item row...');
    if (!estimateItemsTable || !estimateItemRowTemplate) {
        console.error('estimateItemsTable or estimateItemRowTemplate not found in DOM');
        return;
    }
    const newRow = estimateItemRowTemplate.cloneNode(true);
    newRow.removeAttribute('id');
    newRow.style.display = '';
    newRow.querySelector('.remove-estimate-item').addEventListener('click', () => {
        newRow.remove();
        updateEstimateTotals();
    });
    newRow.querySelectorAll('input').forEach(input => {
        input.addEventListener('input', updateEstimateTotals);
    });
    estimateItemsTable.querySelector('tbody').appendChild(newRow);
}

export function updateEstimateTotals() {
    console.log('Updating estimate totals...');
    let subTotalAmount = 0;
    document.querySelectorAll('#estimateItemsTable tbody tr:not(#estimateItemRowTemplate)').forEach(row => {
        const quantity = parseFloat(row.querySelector('.estimate-item-quantity').value) || 0;
        const rate = parseFloat(row.querySelector('.estimate-item-rate').value) || 0;
        const amount = quantity * rate;
        row.querySelector('.estimate-item-amount').textContent = `INR ${amount.toFixed(2)}`;
        subTotalAmount += amount;
    });

    const taxRate = parseFloat(document.getElementById('estimateTaxRate').value) || 0;
    const discountType = document.getElementById('estimateDiscountType').value;
    const discountValue = parseFloat(document.getElementById('estimateDiscountValue').value) || 0;
    let discountAmount = 0;
    if (discountType === 'percentage') discountAmount = subTotalAmount * (discountValue / 100);
    else if (discountType === 'fixed') discountAmount = discountValue;
    const discountedSubTotal = subTotalAmount - discountAmount;
    const taxAmount = discountedSubTotal * (taxRate / 100);
    const shippingCharge = parseFloat(document.getElementById('estimateShippingCharge').value) || 0;
    const totalBeforeShipping = discountedSubTotal + taxAmount;
    const totalAmount = totalBeforeShipping + shippingCharge;

    const totalsContainer = document.querySelector('#estimateTotalsContainer');
    if (totalsContainer) {
        totalsContainer.innerHTML = `
            <div class="total-row"><span class="label">Sub Total:</span><span class="amount">INR ${subTotalAmount.toFixed(2)}</span></div>
            <div class="total-row"><span class="label">Discount:</span><span class="amount">${discountType === 'none' ? 'None' : `INR ${discountAmount.toFixed(2)}`}</span></div>
            <div class="total-row"><span class="label">Discounted Sub Total:</span><span class="amount">INR ${discountedSubTotal.toFixed(2)}</span></div>
            <div class="total-row"><span class="label">Tax (${taxRate}%):</span><span class="amount">INR ${taxAmount.toFixed(2)}</span></div>
            <div class="total-row"><span class="label">Total Before Shipping:</span><span class="amount">INR ${totalBeforeShipping.toFixed(2)}</span></div>
            <div class="total-row"><span class="label">Shipping Charge:</span><span class="amount">INR ${shippingCharge.toFixed(2)}</span></div>
            <div class="total-row"><span class="label">Total:</span><span class="amount">INR ${totalAmount.toFixed(2)}</span></div>
            <div class="total-row"><span class="label">Balance:</span><span class="amount red">INR ${totalAmount.toFixed(2)}</span></div>
        `;
    } else {
        console.error('estimateTotalsContainer not found in DOM');
    }
}

export function setupEstimateDiscountToggle() {
    console.log('Setting up estimate discount toggle...');
    const discountType = document.getElementById('estimateDiscountType');
    if (discountType) {
        discountType.addEventListener('change', (e) => {
            const discountValueContainer = document.getElementById('estimateDiscountValueContainer');
            if (discountValueContainer) {
                discountValueContainer.style.display = e.target.value === 'none' ? 'none' : 'block';
            } else {
                console.error('estimateDiscountValueContainer not found in DOM');
            }
        });
    } else {
        console.error('estimateDiscountType not found in DOM');
    }
}

export function addEstimateFormSubmit() {
    console.log('Setting up estimate form submit...');
    if (addEstimateForm) {
        addEstimateForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            console.log('Submitting cost estimation form...');
            try {
                const date = document.getElementById('estimateDate').value;
                const dueDate = document.getElementById('estimateDueDate').value;
                if (!date || !dueDate) {
                    alert('Please ensure both Date and Due Date are selected.');
                    return;
                }

                let items = [];
                let allItemsValid = true;
                document.querySelectorAll('#estimateItemsTable tbody tr:not(#estimateItemRowTemplate)').forEach(row => {
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

                const taxRate = parseFloat(document.getElementById('estimateTaxRate').value) || 0;
                const discountType = document.getElementById('estimateDiscountType').value;
                const discountValue = discountType === 'none' ? null : parseFloat(document.getElementById('estimateDiscountValue').value) || 0;
                const shippingCharge = parseFloat(document.getElementById('estimateShippingCharge').value) || 0;
                const subTotalAmount = parseFloat(document.querySelector('#estimateTotalsContainer .total-row:first-child .amount').textContent.replace('INR ', '')) || 0;
                const discountAmount = discountType === 'percentage' ? subTotalAmount * (discountValue / 100) : (discountType === 'fixed' ? discountValue : 0);
                const discountedSubTotal = subTotalAmount - discountAmount;
                const taxAmount = discountedSubTotal * (taxRate / 100);
                const totalBeforeShipping = discountedSubTotal + taxAmount;
                const totalAmount = totalBeforeShipping + shippingCharge;

                const { error } = await supabase
                    .from('estimates')
                    .insert([{
                        invoice_number: await getNextEstimateNumber(),
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
                        status: 'Pending',
                        client_id: null // No client initially
                    }]);

                if (error) {
                    console.error('Failed to add cost estimation:', error);
                    throw error;
                }

                $('#addEstimateModal').modal('hide');
                fetchAllEstimates();
            } catch (error) {
                console.error('Failed to add cost estimation:', error);
                alert('An error occurred while adding the cost estimation: ' + (error.message || 'Unknown error'));
            }
        });
    } else {
        console.error('addEstimateForm not found in DOM');
    }
}