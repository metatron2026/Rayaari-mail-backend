const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Helper to draw a clean, structured mock barcode
 */
function drawBarcode(doc, x, y, width, height, text) {
    doc.save();
    let currentX = x;
    const endX = x + width;

    // Draw barcode bars
    while (currentX < endX) {
        // Vary the bar width and spacing to make it look like a real barcode
        const isWide = Math.random() > 0.6;
        const lineWidth = isWide ? 2.2 : 0.9;
        const spacing = Math.random() > 0.4 ? 1.5 : 2.5;
        
        if (currentX + lineWidth > endX) break;
        
        doc.rect(currentX, y, lineWidth, height - 16).fill('#000000');
        currentX += lineWidth + spacing;
    }

    // Barcode number text below bars (with extra vertical gap and letter spacing)
    doc.fontSize(8.5)
       .font('Helvetica-Bold')
       .fillColor('#000000')
       .text(text, x, y + height - 11, { width: width, align: 'center', characterSpacing: 1.5 });

    doc.restore();
}

/**
 * Helper to adjust order number using ORDER_NUMBER_OFFSET
 */
const getAdjustedOrderNumber = (orderNumberOrName) => {
    if (!orderNumberOrName) return '';
    const offset = parseInt(process.env.ORDER_NUMBER_OFFSET, 10) || 0;
    const str = orderNumberOrName.toString();
    const matches = str.match(/\d+/);
    if (!matches) return str;
    const num = parseInt(matches[0], 10);
    return (num + offset).toString();
};

/**
 * Generates a professional 4x6 inch shipping label PDF.
 * @param {Object} orderData - The Shopify order payload
 * @returns {Promise<Buffer>} - A promise that resolves to a Buffer containing the PDF data
 */
const generateShippingLabelPDF = async (orderData) => {
    return new Promise(async (resolve, reject) => {
        try {
            // 4x6 inch = 288 x 432 points (1 inch = 72 points)
            const doc = new PDFDocument({
                margin: 0,
                size: [288, 432]
            });

            let buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));

            const W = 288;
            const H = 432;
            const PAD = 16;

            // --- BACKGROUND ---
            doc.rect(0, 0, W, H).fill('#ffffff');

            // --- OUTER BORDER (Thicker, professional frame) ---
            doc.rect(6, 6, W - 12, H - 12)
               .lineWidth(2)
               .strokeColor('#1e293b')
               .stroke();

            // ============================================================
            // SECTION 1: HEADER STRIP (FROM shop info)
            // ============================================================
            const headerY = 6;
            const headerH = 58;
            doc.rect(6, headerY, W - 12, headerH).fill('#1e293b');

            // Load local logo if it exists
            const localLogoPath = path.join(__dirname, 'logo.png');
            let logoLoaded = false;
            if (fs.existsSync(localLogoPath)) {
                try {
                    doc.image(localLogoPath, PAD, headerY + 9, { height: 40 });
                    logoLoaded = true;
                } catch (e) { /* silent fail */ }
            }

            // Shop name text (right side of header)
            doc.fontSize(12.5)
               .font('Helvetica-Bold')
               .fillColor('#ffffff')
               .text('RAY AARI SHOP', logoLoaded ? 95 : PAD, headerY + 13, { width: W - (logoLoaded ? 111 : PAD * 2) });

            doc.fontSize(7.5)
               .font('Helvetica')
               .fillColor('#cbd5e1')
               .text('Sivanatham Salai, Arappalayam Cross Rd,', logoLoaded ? 95 : PAD, headerY + 28, { width: W - (logoLoaded ? 111 : PAD * 2) })
               .text('Madurai 625016, Tamil Nadu, India | Ph: 9994333548', logoLoaded ? 95 : PAD, headerY + 38, { width: W - (logoLoaded ? 111 : PAD * 2) });

            // ============================================================
            // SECTION 2: ORDER INFO STRIP (Left-Right Aligned)
            // ============================================================
            const orderStripY = headerY + headerH;
            const orderStripH = 30;
            doc.rect(6, orderStripY, W - 12, orderStripH).fill('#f1f5f9');

            const orderNumber = getAdjustedOrderNumber(orderData.order_number || orderData.name);
            const orderDate = new Date(orderData.created_at || Date.now()).toLocaleDateString('en-GB');
            const shippingMethod = orderData.shipping_lines?.[0]?.title || 'Standard Courier';

            // Order Number on Left
            doc.fontSize(9.5)
               .font('Helvetica-Bold')
               .fillColor('#0f172a')
               .text(`ORDER: #${orderNumber}`, PAD, orderStripY + 10);

            // Date | Courier Method on Right
            doc.fontSize(8)
               .font('Helvetica-Bold')
               .fillColor('#475569')
               .text(`${orderDate}  |  ${shippingMethod}`, PAD, orderStripY + 11, { width: W - PAD * 2, align: 'right' });

            // ============================================================
            // SECTION 3: SHIP TO SECTION
            // ============================================================
            const shipToLabelY = orderStripY + orderStripH;
            const shipToLabelH = 18;
            doc.rect(6, shipToLabelY, W - 12, shipToLabelH).fill('#0f172a');
            
            doc.fontSize(8.5)
               .font('Helvetica-Bold')
               .fillColor('#ffffff')
               .text('SHIP TO', PAD, shipToLabelY + 5, { width: W - PAD * 2, align: 'center' });

            // ============================================================
            // SECTION 4: CUSTOMER ADDRESS (Clean typesetting)
            // ============================================================
            const addressStartY = shipToLabelY + shipToLabelH + 12;
            const shipping = orderData.shipping_address || orderData.billing_address || {};

            const toName = `${shipping.first_name || ''} ${shipping.last_name || ''}`.trim() || 'Customer';
            const toPhone = shipping.phone || orderData.phone || orderData.billing_address?.phone || '';
            const toAddr1 = shipping.address1 || '';
            const toAddr2 = shipping.address2 || '';
            const toCity = shipping.city || '';
            const toProvince = shipping.province || '';
            const toZip = shipping.zip || '';
            const toCountry = shipping.country || 'India';

            // Customer Name
            doc.fontSize(14)
               .font('Helvetica-Bold')
               .fillColor('#0f172a')
               .text(toName, PAD, addressStartY, { width: W - PAD * 2 });

            let currentY = addressStartY + 18;

            // Customer Phone (Clean phone icon fallback)
            if (toPhone) {
                doc.fontSize(9.5)
                   .font('Helvetica-Bold')
                   .fillColor('#0f172a')
                   .text(`Phone: ${toPhone}`, PAD, currentY, { width: W - PAD * 2 });
                currentY += 14;
            }

            // Customer Address lines combined with consistent spacing
            const addressParts = [];
            if (toAddr1) addressParts.push(toAddr1);
            if (toAddr2) addressParts.push(toAddr2);
            
            if (toCity || toProvince || toZip) {
                const parts = [];
                if (toCity) parts.push(toCity);
                if (toProvince) parts.push(toProvince);
                const cityState = parts.join(', ');
                addressParts.push(cityState + (toZip ? ' - ' + toZip : ''));
            }
            addressParts.push(toCountry);

            const addressText = addressParts.join('\n');

            doc.fontSize(9.5)
               .font('Helvetica')
               .fillColor('#334155')
               .text(addressText, PAD, currentY, { width: W - PAD * 2, lineGap: 3.5 });

            // Calculate height of the address block to dynamically place the separator
            const addressHeight = doc.heightOfString(addressText, { width: W - PAD * 2, lineGap: 3.5 });
            currentY += addressHeight + 10;

            // Ensure the separator doesn't overflow if address is short or long
            const minSeparatorY = 250;
            const sepY = Math.max(currentY, minSeparatorY);

            // ============================================================
            // SECTION 5: HORIZONTAL SEPARATOR
            // ============================================================
            doc.moveTo(PAD, sepY)
               .lineTo(W - PAD, sepY)
               .lineWidth(1)
               .strokeColor('#cbd5e1')
               .stroke();

            // ============================================================
            // SECTION 6: FROM ADDRESS (Ray Aari Shop - Return address)
            // ============================================================
            const fromY = sepY + 10;
            
            doc.fontSize(7.5)
               .font('Helvetica-Bold')
               .fillColor('#64748b')
               .text('FROM / SENDER:', PAD, fromY);

            doc.fontSize(9)
               .font('Helvetica-Bold')
               .fillColor('#1e293b')
               .text('Ray Aari Shop', PAD, fromY + 12);

            const shopAddressText = [
                'Sivanatham Salai, Arappalayam Cross Rd, Near Madura Coats pvt',
                'Madurai 625016, Tamil Nadu, India  |  Ph: 9994333548'
            ].join('\n');

            doc.fontSize(7.5)
               .font('Helvetica')
               .fillColor('#475569')
               .text(shopAddressText, PAD, fromY + 24, { width: W - PAD * 2, lineGap: 2 });

            // ============================================================
            // SECTION 7: BARCODE STRIP (Locked to Bottom)
            // ============================================================
            const barcodeAreaY = H - 75;
            doc.rect(6, barcodeAreaY, W - 12, 1).fill('#cbd5e1');

            const barcodeText = `RA${orderNumber}IN`;
            drawBarcode(doc, PAD + 15, barcodeAreaY + 12, W - PAD * 2 - 30, 52, barcodeText);

            doc.end();
        } catch (error) {
            reject(error);
        }
    });
};

module.exports = { generateShippingLabelPDF };
