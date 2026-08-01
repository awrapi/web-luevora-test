import prisma from '../../config/database.js';

export const orderFormService = {
  // Get or create a form in 'collecting' status for this customer
  async getOrCreateForm(tenantId, phone, customerName = null) {
    let form = await prisma.orderForm.findFirst({
      where: { tenant_id: tenantId, phone, status: { in: ['collecting', 'pending_confirm'] } },
      orderBy: { updated_at: 'desc' },
    });
    if (!form) {
      form = await prisma.orderForm.create({
        data: { tenant_id: tenantId, phone, customer_name: customerName, form_data: '{}', status: 'collecting' },
      });
    }
    return form;
  },

  // Update specific fields in the form. fieldUpdates = { key: value, ... }
  async updateFormField(tenantId, phone, fieldUpdates) {
    // Guard: AI sometimes sends field_updates as string or null
    if (!fieldUpdates) throw new Error('field_updates is required');
    if (typeof fieldUpdates === 'string') {
      try { fieldUpdates = JSON.parse(fieldUpdates); } catch { throw new Error('field_updates is not valid JSON'); }
    }
    if (typeof fieldUpdates !== 'object' || Array.isArray(fieldUpdates)) {
      throw new Error('field_updates must be an object');
    }

    const form = await this.getOrCreateForm(tenantId, phone);
    const currentData = JSON.parse(form.form_data || '{}');
    const updatedData = { ...currentData, ...fieldUpdates };

    // If 'nama' or 'name' field is updated, also update customer_name
    const nameField = fieldUpdates.customer_name || fieldUpdates.nama || fieldUpdates.name || fieldUpdates.nama_lengkap;
    // Check for email
    const emailField = fieldUpdates.email || fieldUpdates.email_address;

    const formUpdate = await prisma.orderForm.update({
      where: { id: form.id },
      data: {
        form_data: JSON.stringify(updatedData),
        updated_at: new Date(),
        ...(nameField ? { customer_name: nameField } : {}),
      },
    });

    // ── SYNC TO LEAD (CRM Database) ────────────────────────────
    // When AI captures name/email via order form, sync to Lead so CRM views update
    const leadUpdate = {};
    if (nameField) {
      leadUpdate.saved_name = nameField;
      // Split into first/last name
      const nameParts = nameField.trim().split(/\s+/);
      leadUpdate.first_name = nameParts[0];
      leadUpdate.last_name = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null;
    }
    if (emailField) {
      leadUpdate.email = emailField;
    }

    if (Object.keys(leadUpdate).length > 0) {
      leadUpdate.updated_at = new Date();
      prisma.lead.updateMany({
        where: { tenant_id: tenantId, phone: phone },
        data: leadUpdate,
      }).then(() => {
        console.log(`[OrderForm→Lead] Synced to Lead:`, Object.keys(leadUpdate).filter(k => k !== 'updated_at').join(', '));
      }).catch(err => console.error('[OrderForm→Lead] Sync error:', err.message));

      // Also sync name to CustomerManagement and CentralInfoRequest
      if (nameField) {
        prisma.customerManagement.updateMany({
          where: { tenant_id: tenantId, phone: phone },
          data: { customer_name: nameField },
        }).catch(() => {});
        prisma.centralInfoRequest.updateMany({
          where: { tenant_id: tenantId, phone: phone, status: { in: ['pending', 'instructed'] } },
          data: { customer_name: nameField },
        }).catch(() => {});
      }
    }

    return formUpdate;
  },

  // Set form status
  async setFormStatus(tenantId, phone, status) {
    const form = await this.getOrCreateForm(tenantId, phone);
    const updateData = { status, updated_at: new Date() };
    if (status === 'confirmed') updateData.confirmed_at = new Date();
    if (status === 'processed') updateData.processed_at = new Date();
    return prisma.orderForm.update({ where: { id: form.id }, data: updateData });
  },

  // Get form summary text for WhatsApp confirmation
  async getFormSummary(tenantId, phone) {
    const form = await prisma.orderForm.findFirst({
      where: { tenant_id: tenantId, phone, status: { in: ['collecting', 'pending_confirm'] } },
    });
    if (!form) return null;

    const configs = await prisma.orderFormConfig.findMany({
      where: { tenant_id: tenantId },
      orderBy: { sort_order: 'asc' },
    });

    const data = JSON.parse(form.form_data || '{}');
    let summary = '📋 *Ringkasan Data Pesanan*\n\n';
    configs.forEach((cfg) => {
      const val = data[cfg.field_key] || '_(belum diisi)_';
      summary += `*${cfg.field_label}:* ${val}\n`;
    });
    return summary;
  },

  // Process confirmed form → create TravelBooking + Transaction + Invoice
  async processConfirmedForm(tenantId, phone, forceApprove = false) {
    const form = await prisma.orderForm.findFirst({
      where: { tenant_id: tenantId, phone, status: 'pending_confirm' },
    });
    if (!form) {
      console.error('[OrderForm] No pending_confirm form found for', phone);
      return null;
    }

    const formData = JSON.parse(form.form_data || '{}');
    const customerName = form.customer_name || formData.nama || formData.name || phone;

    // Try to find matching package
    const packageName = formData.paket || formData.paket_yang_diambil || formData.package || null;
    let travelPackage = null;
    if (packageName) {
      travelPackage = await prisma.travelPackage.findFirst({
        where: { tenant_id: tenantId, package_name: { contains: packageName } },
      });
      // Also try advanced packages
      if (!travelPackage) {
        const advPkg = await prisma.advancedTravelPackage.findFirst({
          where: { tenant_id: tenantId, title: { contains: packageName } },
        });
        if (advPkg) {
          travelPackage = { id: advPkg.id, package_name: advPkg.title, price: advPkg.price, transaction_mode: advPkg.transaction_mode };
        }
      }
    }

    const paxCount = parseInt(formData.jumlah_orang || formData.pax || formData.jumlah_peserta || '1') || 1;
    const totalPrice = travelPackage ? parseFloat(travelPackage.price || 0) * paxCount : 0;

    // Check transaction mode
    const transactionMode = travelPackage?.transaction_mode || 'auto';

    if (transactionMode === 'manual' && !forceApprove) {
      // For manual mode, do not create booking/transaction/invoice automatically.
      // Set status to awaiting_admin.
      await prisma.orderForm.update({
        where: { id: form.id },
        data: {
          status: 'awaiting_admin',
          updated_at: new Date(),
        },
      });
      console.log(`[OrderForm] Form #${form.id} moved to awaiting_admin (Manual Mode)`);
      return { form, isManual: true };
    }

    const bookingCode = 'BK-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();
    const orderId = 'TRX-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();

    // Create TravelBooking
    const booking = await prisma.travelBooking.create({
      data: {
        tenant_id: tenantId,
        phone,
        customer_name: customerName,
        travel_package_id: travelPackage?.id || null,
        package_name: packageName || 'Custom',
        pax_count: paxCount,
        total_price: totalPrice,
        status: 'pending',
        payment_status: 'unpaid',
        booking_code: bookingCode,
        booking_source: 'ai_form',
        customer_email: formData.email || null,
        special_request: formData.catatan || formData.request || formData.catatan_khusus || null,
        notes: `Auto-created from AI Order Form #${form.id}`,
      },
    });

    // Create Transaction
    const transaction = await prisma.transaction.create({
      data: {
        tenant_id: tenantId,
        order_id: orderId,
        user_phone: phone,
        customer_name: customerName,
        destination: formData.destinasi || formData.tujuan || packageName || null,
        pax_count: paxCount,
        total_price: totalPrice,
        status: 'pending',
        form_filled: 1,
        form_data: form.form_data,
        booking_id: booking.id,
      },
    });

    // Create Invoice
    const invoiceNumber = 'INV-' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 5).toUpperCase();
    const invoice = await prisma.invoice.create({
      data: {
        tenant_id: tenantId,
        travel_booking_id: booking.id,
        invoice_number: invoiceNumber,
        status: 'generated',
        amount: totalPrice,
        customer_name: customerName,
        customer_phone: phone,
        type: 'invoice',
      },
    });

    // Update form status
    await prisma.orderForm.update({
      where: { id: form.id },
      data: {
        status: 'processed',
        processed_at: new Date(),
        booking_id: booking.id,
        transaction_id: transaction.id,
        updated_at: new Date(),
      },
    });

    // Update lead label to 'customer'
    try {
      await prisma.lead.updateMany({
        where: { tenant_id: tenantId, phone },
        data: { label: 'customer', status: 'deal', updated_at: new Date() },
      });
    } catch (err) {
      console.error('[OrderForm] Failed to update lead:', err.message);
    }

    console.log(`[OrderForm] PROCESSED form #${form.id} → Booking #${booking.id} (${bookingCode}), Transaction #${transaction.id} (${orderId}), Invoice #${invoice.id} (${invoiceNumber})`);

    return { form, booking, transaction, invoice };
  },
  // Approve a manual form -> change status to pending_confirm and call processConfirmedForm
  async approveManualForm(tenantId, formId) {
    const form = await prisma.orderForm.findFirst({
      where: { id: formId, tenant_id: tenantId, status: 'awaiting_admin' },
    });
    if (!form) throw new Error('Form not found or not awaiting admin');

    // Temporarily set to pending_confirm to bypass the block
    await prisma.orderForm.update({
      where: { id: form.id },
      data: { status: 'pending_confirm' },
    });

    return this.processConfirmedForm(tenantId, form.phone, true);
  },

  // Reject a manual form -> change status to rejected, update AI context to send message
  async rejectManualForm(tenantId, formId, reason) {
    const form = await prisma.orderForm.findFirst({
      where: { id: formId, tenant_id: tenantId, status: 'awaiting_admin' },
    });
    if (!form) throw new Error('Form not found or not awaiting admin');

    const updated = await prisma.orderForm.update({
      where: { id: form.id },
      data: {
        status: 'rejected',
        ai_notes: reason,
        updated_at: new Date(),
      },
    });

    // We inject a message to the chat history so the AI will read it and send a rejection message
    // Actually we can create a system prompt or directly send a WhatsApp message,
    // but the easiest is just saving a CustomerRequest or triggering an AI event.
    // We can just create a CustomerRequest with rejected status to let AI know.
    const formData = JSON.parse(form.form_data || '{}');
    const packageName = formData.paket || formData.package || 'Pesanan';
    
    await prisma.customerRequest.create({
      data: {
        tenant_id: tenantId,
        phone: form.phone,
        request_type: 'Order Form Rejection',
        package_name: packageName,
        request_detail: `Customer order rejected by Admin. Reason: ${reason}`,
        ai_context: reason,
        status: 'rejected'
      }
    });

    return updated;
  },

  // Cancel form
  async cancelForm(tenantId, phone) {
    const form = await prisma.orderForm.findFirst({
      where: { tenant_id: tenantId, phone, status: { in: ['collecting', 'pending_confirm'] } },
    });
    if (!form) return null;
    return prisma.orderForm.update({
      where: { id: form.id },
      data: { status: 'cancelled', updated_at: new Date() },
    });
  },

  // Get all forms for dashboard display
  async getAllForms(tenantId, status = null) {
    const where = { tenant_id: tenantId };
    if (status) where.status = status;
    return prisma.orderForm.findMany({
      where,
      orderBy: { updated_at: 'desc' },
    });
  },
};
