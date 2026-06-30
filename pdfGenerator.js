const PDFDocument = require('pdfkit');

/**
 * Helper to draw a mock barcode in the top right corner
 */
function drawMockBarcode(doc, x, y, width, height) {
    doc.save();
    let currentX = x;
    const endX = x + width;
    
    // Draw a series of random thin/thick black lines to look like a barcode
    while (currentX < endX) {
        const lineWidth = Math.random() * 2 + 0.8; // 0.8 to 2.8 pixels wide
        const spacing = Math.random() * 3 + 1.2;   // 1.2 to 4.2 pixels spacing
        
        if (currentX + lineWidth > endX) break;
        
        doc.rect(currentX, y, lineWidth, height).fill('#000000');
        currentX += lineWidth + spacing;
    }
    doc.restore();
}

/**
 * Fetch image buffer from URL safely
 */
async function fetchImageBuffer(url) {
    if (!url) return null;
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        const arrayBuffer = await response.arrayBuffer();
        return Buffer.from(arrayBuffer);
    } catch (err) {
        console.error(`Failed to fetch image from ${url}:`, err.message);
        return null;
    }
}

/**
 * Generates a PDF invoice matching the user's custom layout.
 * @param {Object} orderData - The Shopify order payload
 * @returns {Promise<Buffer>} - A promise that resolves to a Buffer containing the PDF data
 */
const generateInvoicePDF = async (orderData) => {
    return new Promise(async (resolve, reject) => {
        try {
            const doc = new PDFDocument({ margin: 40, size: 'A4' });
            let buffers = [];

            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => {
                const pdfData = Buffer.concat(buffers);
                resolve(pdfData);
            });

            // Colors
            const primaryColor = '#1e293b'; // Slate dark gray
            const textColor = '#334155';
            const lightGray = '#cbd5e1';
            const rowAltColor = '#f8fafc';

            // --- 1. TITLE & BARCODE ---
            // Title (Left)
            const isQuote = orderData.gateway === 'Request Quote' || orderData.payment_gateway_names?.includes('Request Quote');
            const titleText = isQuote ? 'Request Quote' : 'Invoice';
            
            doc.fontSize(28)
               .font('Helvetica-Bold')
               .fillColor(primaryColor)
               .text(titleText, 40, 40);

            // Barcode (Right)
            drawMockBarcode(doc, 380, 40, 175, 40);
            doc.moveDown(2);

            // --- 2. LOGO & FROM DETAILS ---
            const fromY = 110;
            
            // Logo (Left)
            let logoLoaded = false;
            const fs = require('fs');
            const path = require('path');
            const localLogoPath = path.join(__dirname, 'logo.png');

            if (fs.existsSync(localLogoPath)) {
                try {
                    doc.image(localLogoPath, 40, fromY, { width: 130 });
                    logoLoaded = true;
                } catch (e) {
                    console.error('Error rendering local logo image:', e);
                }
            }

            if (!logoLoaded) {
                const logoUrl = process.env.SHOP_LOGO_URL;
                const logoBuffer = await fetchImageBuffer(logoUrl);
                if (logoBuffer) {
                    try {
                        doc.image(logoBuffer, 40, fromY, { width: 130 });
                        logoLoaded = true;
                    } catch (e) {
                        console.error('Error rendering logo image from URL:', e);
                    }
                }
            }

            if (!logoLoaded) {
                // Stylish text fallback if image is missing
                doc.fontSize(20)
                   .font('Helvetica-Bold')
                   .fillColor('#db2777') // Pink accent
                   .text('RAY AARI SHOP', 40, fromY);
            }

            // From Address (Right)
            doc.fontSize(10)
               .font('Helvetica-Bold')
               .fillColor(primaryColor)
               .text('From', 380, fromY)
               .font('Helvetica')
               .fillColor(textColor)
               .text('Ray Aari Shop', 380, fromY + 15)
               .text('Sivanatham Salai', 380, fromY + 28)
               .text('Arappalayam Cross Rd, Near : Madura Coats pvt', 380, fromY + 41, { width: 175 })
               .text('Madurai 625016', 380, fromY + 67)
               .text('Tamil Nadu, India', 380, fromY + 80)
               .text('9994333548', 380, fromY + 93);

            // --- 3. BILL TO & ORDER DETAILS ---
            const detailsY = 240;

            // Bill To (Left)
            const billing = orderData.billing_address || {};
            doc.fontSize(11)
               .font('Helvetica-Bold')
               .fillColor(primaryColor)
               .text('Bill to', 40, detailsY);

            doc.fontSize(10)
               .font('Helvetica')
               .fillColor(textColor);
            
            let billTextY = detailsY + 18;
            if (billing.first_name || billing.last_name) {
                doc.text(`${billing.first_name || ''} ${billing.last_name || ''}`, 40, billTextY);
                billTextY += 13;
            }
            if (billing.address1) {
                doc.text(billing.address1, 40, billTextY);
                billTextY += 13;
            }
            if (billing.address2) {
                doc.text(billing.address2, 40, billTextY);
                billTextY += 13;
            }
            if (billing.city || billing.province || billing.zip) {
                doc.text(`${billing.city || ''} ${billing.province || ''} ${billing.zip || ''}`, 40, billTextY);
                billTextY += 13;
            }
            if (billing.country) {
                doc.text(billing.country, 40, billTextY);
                billTextY += 13;
            }
            if (orderData.email || orderData.contact_email) {
                doc.text(orderData.email || orderData.contact_email, 40, billTextY);
                billTextY += 13;
            }
            if (billing.phone || orderData.phone) {
                doc.text(billing.phone || orderData.phone, 40, billTextY);
            }

            // Order Details (Right)
            const orderDateStr = new Date(orderData.created_at).toLocaleDateString('en-GB'); // DD-MM-YYYY
            const gatewayName = orderData.gateway || 'Request Quote';

            doc.fontSize(14)
               .font('Helvetica-Bold')
               .fillColor(primaryColor)
               .text(`Order no:  ${orderData.order_number}`, 380, detailsY)
               .fontSize(10)
               .font('Helvetica-Bold')
               .text('Order date: ', 380, detailsY + 22, { continued: true })
               .font('Helvetica')
               .fillColor(textColor)
               .text(orderDateStr)
               .font('Helvetica-Bold')
               .fillColor(primaryColor)
               .text('Payment method: ', 380, detailsY + 37, { continued: true })
               .font('Helvetica')
               .fillColor(textColor)
               .text(gatewayName);

            // --- 4. PRODUCT TABLE ---
            let tableY = 380;

            // Table Headers
            doc.fontSize(9)
               .font('Helvetica-Bold')
               .fillColor(primaryColor);

            doc.text('S.No', 40, tableY, { width: 35 });
            doc.text('Product', 85, tableY, { width: 270 });
            doc.text('Quantity', 365, tableY, { width: 50, align: 'right' });
            doc.text('Unit price', 425, tableY, { width: 60, align: 'right' });
            doc.text('Total price', 495, tableY, { width: 60, align: 'right' });

            // Line below header
            doc.moveTo(40, tableY + 12)
               .lineTo(555, tableY + 12)
               .lineWidth(0.8)
               .strokeColor(lightGray)
               .stroke();

            tableY += 20;

            // Currency formatting symbol
            const currencySymbol = orderData.currency === 'INR' ? 'Rs. ' : `${orderData.currency} `;

            // Table Rows
            if (orderData.line_items && orderData.line_items.length > 0) {
                for (let i = 0; i < orderData.line_items.length; i++) {
                    const item = orderData.line_items[i];

                    // Check if we need to start a new page before drawing this row (A4 page height is 842)
                    if (tableY > 710) {
                        // Draw bottom border line for the current page
                        doc.moveTo(40, tableY - 6)
                           .lineTo(555, tableY - 6)
                           .lineWidth(0.5)
                           .strokeColor('#f1f5f9')
                           .stroke();

                        doc.addPage();
                        tableY = 50;

                        // Redraw headers on new page
                        doc.fontSize(9)
                           .font('Helvetica-Bold')
                           .fillColor(primaryColor);

                        doc.text('S.No', 40, tableY, { width: 35 });
                        doc.text('Product', 85, tableY, { width: 270 });
                        doc.text('Quantity', 365, tableY, { width: 50, align: 'right' });
                        doc.text('Unit price', 425, tableY, { width: 60, align: 'right' });
                        doc.text('Total price', 495, tableY, { width: 60, align: 'right' });

                        // Line below headers
                        doc.moveTo(40, tableY + 12)
                           .lineTo(555, tableY + 12)
                           .lineWidth(0.8)
                           .strokeColor(lightGray)
                           .stroke();

                        tableY += 25;
                    }
                    
                    // Background color for alternating rows (slightly taller: 46 height)
                    if (i % 2 === 1) {
                        doc.rect(40, tableY - 6, 515, 46).fill(rowAltColor);
                    }

                    doc.fontSize(9)
                       .font('Helvetica')
                       .fillColor(textColor);

                    // S.No
                    doc.text((i + 1).toString(), 40, tableY + 10);

                    // Handle product image
                    let textX = 85;
                    let textWidth = 270;
                    if (item.image_url) {
                        const imgBuffer = await fetchImageBuffer(item.image_url);
                        if (imgBuffer) {
                            try {
                                doc.image(imgBuffer, 85, tableY - 2, { fit: [35, 35] });
                                textX = 130;
                                textWidth = 225;
                            } catch (e) {
                                console.error('Error rendering line item image:', e);
                            }
                        }
                    }

                    // Product Name and Variant/Quantity details
                    const productText = item.title || item.name;
                    doc.text(productText, textX, tableY, { width: textWidth, height: 15, ellipsis: true });
                    
                    // Display quantity/variant info if available
                    if (item.variant_title) {
                        doc.fontSize(8)
                           .fillColor('#64748b')
                           .text(item.variant_title, textX, tableY + 14, { width: textWidth });
                    }

                    // Reset font size
                    doc.fontSize(9).fillColor(textColor);

                    // Quantity
                    doc.text(item.quantity.toString(), 365, tableY + 10, { width: 50, align: 'right' });

                    // Unit Price
                    const unitPrice = parseFloat(item.price).toFixed(2);
                    doc.text(`${currencySymbol}${unitPrice}`, 425, tableY + 10, { width: 60, align: 'right' });

                    // Total Price
                    const totalPrice = (parseFloat(item.price) * item.quantity).toFixed(2);
                    doc.text(`${currencySymbol}${totalPrice}`, 495, tableY + 10, { width: 60, align: 'right' });

                    // Divider Line
                    doc.moveTo(40, tableY + 38)
                       .lineTo(555, tableY + 38)
                       .lineWidth(0.5)
                       .strokeColor('#f1f5f9')
                       .stroke();

                    tableY += 44;
                }
            }

            // --- 5. TOTALS SECTION ---
            if (tableY > 730) {
                doc.addPage();
                tableY = 50;
            }
            tableY += 10;

            doc.fontSize(10)
               .font('Helvetica')
               .fillColor(textColor);

            // Subtotal
            doc.text('Subtotal', 365, tableY, { width: 100, align: 'right' });
            doc.font('Helvetica-Bold')
               .text(`${currencySymbol}${parseFloat(orderData.subtotal_price).toFixed(2)}`, 480, tableY, { width: 75, align: 'right' });
            
            // Divider
            doc.moveTo(365, tableY + 15)
               .lineTo(555, tableY + 15)
               .lineWidth(0.5)
               .strokeColor(lightGray)
               .stroke();

            tableY += 22;

            // Total
            doc.fontSize(11)
               .font('Helvetica-Bold')
               .fillColor(primaryColor);
            
            doc.text('Total', 365, tableY, { width: 100, align: 'right' });
            doc.text(`${currencySymbol}${parseFloat(orderData.total_price).toFixed(2)}`, 480, tableY, { width: 75, align: 'right' });

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
};

module.exports = { generateInvoicePDF };
