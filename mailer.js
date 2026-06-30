const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');


/**
 * Sends a premium custom email with the PDF attachment.
 * @param {string} toEmail - The recipient's email address
 * @param {Object} orderData - The Shopify order payload
 * @param {Buffer} pdfBuffer - The invoice PDF data buffer
 * @param {Buffer} [shippingLabelBuffer] - Optional shipping label PDF buffer
 */
const sendEmailWithAttachment = async (toEmail, orderData, pdfBuffer, shippingLabelBuffer = null) => {
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT) || 465,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
        tls: {
            rejectUnauthorized: false
        }
    });

    const orderNumber = orderData.order_number || orderData.name;
    const currencySymbol = orderData.currency === 'INR' ? 'Rs. ' : `${orderData.currency} `;

    // Check if local logo exists for CID inline attachment
    const localLogoPath = path.join(__dirname, 'logo.png');
    const logoExists = fs.existsSync(localLogoPath);
    // Use a remote URL if you have one, or stick to text fallback to avoid the "logo.png" attachment pill
    const logoImgTag = `<span style="font-family: Helvetica, Arial, sans-serif; font-size: 20px; font-weight: bold; color: #ffffff;">RAY AARI SHOP</span>`;

    // --- 1. Generate Order Summary Rows HTML ---
    let orderRowsHtml = '';
    if (orderData.line_items && orderData.line_items.length > 0) {
        orderData.line_items.forEach((item, index) => {
            const itemPrice = parseFloat(item.price).toFixed(2);
            const rowBg = index % 2 === 0 ? '#ffffff' : '#f8fafc';
            orderRowsHtml += `
                <tr style="background-color: ${rowBg};">
                    <td style="padding: 10px 12px; font-family: Helvetica, Arial, sans-serif; font-size: 13px; color: #1e293b; border: 1px solid #e2e8f0;">
                        ${item.title || item.name}
                        ${item.variant_title ? `<br/><span style="font-size: 11px; color: #64748b;">${item.variant_title}</span>` : ''}
                    </td>
                    <td style="padding: 10px 12px; text-align: center; font-family: Helvetica, Arial, sans-serif; font-size: 13px; color: #1e293b; border: 1px solid #e2e8f0; width: 80px;">
                        ${item.quantity}
                    </td>
                    <td style="padding: 10px 12px; text-align: right; font-family: Helvetica, Arial, sans-serif; font-size: 13px; color: #1e293b; border: 1px solid #e2e8f0; width: 100px;">
                        ${currencySymbol}${itemPrice}
                    </td>
                </tr>
            `;
        });
    }

    // --- 2. Calculate Totals ---
    const subtotal = parseFloat(orderData.subtotal_price).toFixed(2);
    const shipping = parseFloat(orderData.total_shipping_price_set?.shop_money?.amount || 0).toFixed(2);
    const taxes = parseFloat(orderData.total_tax || 0).toFixed(2);
    const total = parseFloat(orderData.total_price).toFixed(2);

    let taxRow = '';
    if (parseFloat(taxes) > 0) {
        taxRow = `
            <tr>
                <td style="padding: 4px 0; font-family: Helvetica, Arial, sans-serif; font-size: 13px; color: #64748b;">Taxes</td>
                <td style="padding: 4px 0; text-align: right; font-family: Helvetica, Arial, sans-serif; font-size: 13px; font-weight: bold; color: #1e293b;">${currencySymbol}${taxes}</td>
            </tr>
        `;
    }

    // --- 3. Billing Address Details HTML ---
    const billing = orderData.billing_address || {};
    let billingAddressHtml = '';
    if (billing.first_name || billing.last_name) {
        billingAddressHtml += `${billing.first_name || ''} ${billing.last_name || ''}<br/>`;
    }
    if (billing.address1) billingAddressHtml += `${billing.address1}<br/>`;
    if (billing.address2) billingAddressHtml += `${billing.address2}<br/>`;
    if (billing.city || billing.province || billing.zip) {
        billingAddressHtml += `${billing.city || ''} ${billing.province || ''} ${billing.zip || ''}<br/>`;
    }
    if (billing.country) billingAddressHtml += `${billing.country}<br/>`;
    if (billing.phone || orderData.phone) {
        billingAddressHtml += `${billing.phone || orderData.phone}`;
    }

    const paymentMethod = orderData.gateway || 'Request Quote';
    const shippingMethod = orderData.shipping_lines?.[0]?.title || 'Economy';

    // --- 4. Beautiful Responsive HTML Template ---
    const htmlTemplate = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Order Confirmation</title>
    </head>
    <body style="margin: 0; padding: 0; background-color: #f8fafc; -webkit-text-size-adjust: none; text-size-adjust: none;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; padding: 20px 10px;">
            <tr>
                <td align="center">
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -1px rgba(0, 0, 0, 0.03); overflow: hidden; padding: 30px;">
                        
                        <!-- DARK HEADER BANNER with LOGO -->
                        <tr>
                            <td style="background-color: #3d3d3d; padding: 20px 30px; border-radius: 8px 8px 0 0;">
                                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                    <tr>
                                        <td style="vertical-align: middle;">
                                            ${logoImgTag}
                                        </td>
                                        <td align="right" style="vertical-align: middle;">
                                            <h1 style="font-family: Helvetica, Arial, sans-serif; font-size: 22px; font-weight: bold; color: #ffffff; margin: 0;">New Order: #${orderNumber}</h1>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>

                        <!-- INTRO TEXT & ORDER LINK -->
                        <tr>
                            <td style="padding: 25px 0 20px 0;">
                                <p style="font-family: Helvetica, Arial, sans-serif; font-size: 14px; color: #475569; margin: 0 0 15px 0;">
                                    You've received the following order from 
                                    <strong style="color: #1e293b;">${orderData.billing_address ? `${orderData.billing_address.first_name || ''} ${orderData.billing_address.last_name || ''}`.trim() : (orderData.contact_email || 'a customer')}</strong>:
                                </p>
                                <p style="font-family: Helvetica, Arial, sans-serif; font-size: 14px; color: #475569; margin: 0;">
                                    ${orderData.order_status_url
            ? `<a href="${orderData.order_status_url}" target="_blank" style="color: #1d4ed8; font-weight: bold; text-decoration: none;">[Order #${orderNumber}]</a>`
            : `<strong>[Order #${orderNumber}]</strong>`
        }
                                    <strong> (${new Date(orderData.created_at || Date.now()).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })})</strong>
                                </p>
                            </td>
                        </tr>

                        <!-- ORDER SUMMARY TABLE with HEADER ROW -->
                        <tr>
                            <td style="padding-bottom: 20px;">
                                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="border-collapse: collapse; border: 1px solid #e2e8f0;">
                                    <!-- Table Header -->
                                    <tr style="background-color: #f1f5f9;">
                                        <td style="padding: 10px 12px; font-family: Helvetica, Arial, sans-serif; font-size: 13px; font-weight: bold; color: #1e293b; border: 1px solid #e2e8f0;">Product</td>
                                        <td style="padding: 10px 12px; text-align: center; font-family: Helvetica, Arial, sans-serif; font-size: 13px; font-weight: bold; color: #1e293b; border: 1px solid #e2e8f0; width: 80px;">Quantity</td>
                                        <td style="padding: 10px 12px; text-align: right; font-family: Helvetica, Arial, sans-serif; font-size: 13px; font-weight: bold; color: #1e293b; border: 1px solid #e2e8f0; width: 100px;">Price</td>
                                    </tr>
                                    ${orderRowsHtml}
                                </table>
                            </td>
                        </tr>

                        <!-- TOTALS CALCULATION -->
                        <tr>
                            <td style="padding: 20px 0 30px 0;">
                                <table border="0" cellpadding="0" cellspacing="0" align="right" width="240" style="width: 240px;">
                                    ${taxRow}
                                    <tr style="border-top: 1px solid #e2e8f0;">
                                        <td style="padding: 15px 0 0 0; font-family: Helvetica, Arial, sans-serif; font-size: 14px; font-weight: bold; color: #475569;">Total</td>
                                        <td style="padding: 15px 0 0 0; text-align: right; font-family: Helvetica, Arial, sans-serif; font-size: 20px; font-weight: bold; color: #1e293b;">
                                            ${currencySymbol}${total} 
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>

                        <!-- CUSTOMER INFORMATION HEADER -->
                        <tr>
                            <td style="padding-top: 20px; padding-bottom: 10px; border-bottom: 2px solid #e2e8f0;">
                                <h2 style="font-family: Helvetica, Arial, sans-serif; font-size: 15px; font-weight: bold; color: #1e293b; margin: 0; text-transform: uppercase; letter-spacing: 0.5px;">Customer informations</h2>
                            </td>
                        </tr>

                        <!-- CUSTOMER DETAILS BODY (2 COLUMNS) -->
                        <tr>
                            <td style="padding-top: 15px;">
                                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                                    <tr>
                                        <!-- Billing address column -->
                                        <td valign="top" style="width: 50%; font-family: Helvetica, Arial, sans-serif; font-size: 13px; line-height: 1.5; color: #475569; padding-right: 10px;">
                                            <strong style="color: #1e293b; display: block; margin-bottom: 5px;">Billing address</strong>
                                            ${billingAddressHtml}
                                        </td>

                                        <!-- Payment & Shipping info column -->
                                        <td valign="top" style="width: 50%; font-family: Helvetica, Arial, sans-serif; font-size: 13px; line-height: 1.5; color: #475569; padding-left: 10px;">
                                            <strong style="color: #1e293b; display: block; margin-bottom: 5px;">Payment method</strong>
                                            <span style="display: block; margin-bottom: 15px;">${paymentMethod}</span>

                                            <strong style="color: #1e293b; display: block; margin-bottom: 5px;">Shipping method</strong>
                                            <span>${shippingMethod}</span>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>

                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;

    // --- Customer attachments: Invoice PDF only ---
    const customerAttachments = [
        {
            filename: `Invoice_${orderNumber}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf'
        }
    ];

    // --- Seller attachments: Invoice PDF only ---
    const sellerAttachments = [
        {
            filename: `Invoice_${orderNumber}.pdf`,
            content: pdfBuffer,
            contentType: 'application/pdf'
        }
    ];

    try {
        // 1. Send to customer (Invoice only)
        const customerMail = await transporter.sendMail({
            from: `"${process.env.SHOP_NAME || 'Your Store'}" <${process.env.SMTP_FROM_EMAIL}>`,
            to: toEmail,
            subject: `Invoice for your order #${orderNumber}`,
            text: `Thank you for your order! Attached is the invoice for order #${orderNumber}.`,
            html: htmlTemplate,
            attachments: customerAttachments
        });
        console.log(`Customer email sent: ${customerMail.messageId}`);

        // 2. Send to seller (Invoice + Shipping Label)
        const sellerEmail = process.env.SELLER_EMAIL;
        if (sellerEmail) {
            const sellerMail = await transporter.sendMail({
                from: `"${process.env.SHOP_NAME || 'Your Store'}" <${process.env.SMTP_FROM_EMAIL}>`,
                to: sellerEmail,
                subject: `[NEW ORDER] #${orderNumber} - Invoice`,
                text: `New order #${orderNumber} received. Invoice attached.`,
                html: htmlTemplate,
                attachments: sellerAttachments
            });
            console.log(`Seller email sent: ${sellerMail.messageId}`);
        }

        return customerMail;
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
};

module.exports = { sendEmailWithAttachment };
