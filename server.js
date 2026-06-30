require('dotenv').config({ override: true });
const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const { generateInvoicePDF } = require('./pdfGenerator');
const { generateShippingLabelPDF } = require('./shippingLabelGenerator');
const { sendEmailWithAttachment } = require('./mailer');

const app = express();
app.use(cors()); // Allow frontend Shopify store to call this server
const PORT = process.env.PORT || 3000;

// Middleware to capture raw body for Shopify webhook HMAC verification
app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));

// Function to verify Shopify Webhook
const verifyShopifyWebhook = (req, res, next) => {
    const hmacHeader = req.get('X-Shopify-Hmac-Sha256');
    const body = req.rawBody;
    const secret = process.env.SHOPIFY_WEBHOOK_SECRET;

    if (!hmacHeader || !body || !secret) {
        return res.status(401).send('Webhook verification failed: Missing headers or secret.');
    }

    const generatedHash = crypto
        .createHmac('sha256', secret)
        .update(body, 'utf8')
        .digest('base64');

    if (generatedHash !== hmacHeader) {
        return res.status(401).send('Webhook verification failed: Invalid HMAC.');
    }

    next();
};

// Webhook endpoint for Order Creation
app.post('/webhooks/orders/create', verifyShopifyWebhook, async (req, res) => {
    const fs = require('fs');
    const logMessage = `[${new Date().toISOString()}] Received webhook request\n`;
    fs.appendFileSync('webhook.log', logMessage);

    // Acknowledge receipt of the webhook immediately
    res.status(200).send('Webhook received');

    try {
        const orderData = req.body;
        const processMessage = `[${new Date().toISOString()}] Processing Order ${orderData.order_number}\n`;
        fs.appendFileSync('webhook.log', processMessage);

        // Fetch product images (reads from line item properties if passed, otherwise fetches from Shopify Admin API)
        if (orderData.line_items && orderData.line_items.length > 0) {
            await Promise.all(orderData.line_items.map(async (item) => {
                // Check if the image was passed as a line item property from checkout
                if (item.properties) {
                    if (Array.isArray(item.properties)) {
                        const imgProp = item.properties.find(p => p.name === '_product_image');
                        if (imgProp && imgProp.value) {
                            item.image_url = imgProp.value;
                            return;
                        }
                    } else if (typeof item.properties === 'object') {
                        if (item.properties['_product_image']) {
                            item.image_url = item.properties['_product_image'];
                            return;
                        }
                    }
                }

                if (!item.product_id) return;
                try {
                    const shopifyUrl = `https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/products/${item.product_id}.json`;
                    const response = await fetch(shopifyUrl, {
                        headers: {
                            'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_API_TOKEN
                        }
                    });
                    if (response.ok) {
                        const data = await response.json();
                        const product = data.product;
                        if (product) {
                            // Find variant-specific image
                            let imgUrl = null;
                            if (item.variant_id && product.variants) {
                                const variant = product.variants.find(v => v.id === item.variant_id);
                                if (variant && variant.image_id && product.images) {
                                    const variantImg = product.images.find(img => img.id === variant.image_id);
                                    if (variantImg) imgUrl = variantImg.src;
                                }
                            }
                            // Fallback to main product image
                            item.image_url = imgUrl || product.image?.src || (product.images && product.images[0]?.src) || null;
                        }
                    } else {
                        const errText = await response.text();
                        console.error(`Shopify API error fetching product ${item.product_id}: Status ${response.status} - ${errText}`);
                    }
                } catch (err) {
                    console.error(`Failed to fetch image for product ${item.product_id}:`, err);
                }
            }));
        }

        // 1. Generate the PDF invoice and shipping label in parallel
        const [pdfBuffer, shippingLabelBuffer] = await Promise.all([
            generateInvoicePDF(orderData),
            generateShippingLabelPDF(orderData)
        ]);

        // 2. Send the email with the attached PDFs
        const customerEmail = orderData.email || orderData.contact_email;
        if (!customerEmail) {
            const errorMsg = `[${new Date().toISOString()}] Order ${orderData.order_number} has no email address associated.\n`;
            fs.appendFileSync('webhook.log', errorMsg);
            return;
        }

        await sendEmailWithAttachment(
            customerEmail,
            orderData,
            pdfBuffer,
            shippingLabelBuffer
        );

        const successMsg = `[${new Date().toISOString()}] Successfully processed and sent email for Order ${orderData.order_number}\n`;
        fs.appendFileSync('webhook.log', successMsg);

    } catch (error) {
        const errorMsg = `[${new Date().toISOString()}] Error processing order webhook: ${error.stack}\n`;
        fs.appendFileSync('webhook.log', errorMsg);
        console.error('Error processing order webhook:', error);
    }
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Shopify Invoice Email Plugin running on port ${PORT}`);
});

// Endpoint to create order from custom checkout frontend
app.post('/create-order', async (req, res) => {
    try {
        const { customerData, cartItems } = req.body;

        const line_items = cartItems.map(item => {
            const properties = [];
            const imgUrl = item.image || (item.featured_image && (item.featured_image.url || item.featured_image));
            if (imgUrl && typeof imgUrl === 'string') {
                properties.push({
                    name: '_product_image',
                    value: imgUrl
                });
            }
            return {
                variant_id: item.variant_id || item.id,
                quantity: item.quantity,
                price: (item.price / 100).toFixed(2),
                properties: properties
            };
        });

        const orderPayload = {
            order: {
                line_items: line_items,
                customer: {
                    first_name: customerData.first_name,
                    last_name: customerData.last_name,
                    email: customerData.email,
                    phone: customerData.phone
                },
                billing_address: {
                    first_name: customerData.first_name,
                    last_name: customerData.last_name,
                    address1: customerData.address1,
                    address2: customerData.address2,
                    city: customerData.city,
                    province: customerData.province,
                    zip: customerData.zip,
                    country: "India",
                    phone: customerData.phone
                },
                shipping_address: {
                    first_name: customerData.first_name,
                    last_name: customerData.last_name,
                    address1: customerData.address1,
                    address2: customerData.address2,
                    city: customerData.city,
                    province: customerData.province,
                    zip: customerData.zip,
                    country: "India",
                    phone: customerData.phone
                },
                email: customerData.email,
                tags: "custom_checkout",
                financial_status: "pending", // Payment to be done on WhatsApp
                shipping_lines: [
                    {
                        title: customerData.courier || "Standard Courier",
                        price: "0.00" // Update this if shipping has logic
                    }
                ]
            }
        };

        const shopifyResponse = await fetch(`https://${process.env.SHOPIFY_STORE_DOMAIN}/admin/api/2024-01/orders.json`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Shopify-Access-Token': process.env.SHOPIFY_ADMIN_API_TOKEN
            },
            body: JSON.stringify(orderPayload)
        });

        const data = await shopifyResponse.json();

        if (!shopifyResponse.ok) {
            console.error("Shopify Order Creation Failed:", JSON.stringify(data, null, 2));
            return res.status(400).json({ error: 'Failed to create order', details: data });
        }

        res.status(200).json({ success: true, order: data.order });
    } catch (error) {
        console.error("Error creating order:", error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});
