require('dotenv').config({ override: true });
const nodemailer = require('nodemailer');
const { generateShippingLabelPDF } = require('./shippingLabelGenerator');

async function sendTestShippingLabelEmail() {
    try {
        console.log('Generating dummy Shipping Label...');
        const dummyOrder = {
            name: '#9999',
            order_number: 9999,
            created_at: new Date().toISOString(),
            currency: 'INR',
            subtotal_price: '660.00',
            total_tax: '0.00',
            total_price: '660.00',
            gateway: 'Request Quote',
            shipping_lines: [{ title: 'Delhivery Courier' }],
            billing_address: {
                first_name: 'Alagu', last_name: 'Raj',
                address1: 'South Street', address2: 'Near Temple',
                city: 'Tuticorin', province: 'Tamil Nadu', zip: '628304',
                country: 'India', phone: '7871207631'
            },
            shipping_address: {
                first_name: 'Alagu', last_name: 'Raj',
                address1: 'South Street', address2: 'Near Temple',
                city: 'Tuticorin', province: 'Tamil Nadu', zip: '628304',
                country: 'India', phone: '7871207631'
            },
            email: process.env.SMTP_USER,
            line_items: [
                { name: 'Flat Bangle 4 Cut - Each Box', quantity: 1, price: '130.00', image_url: 'https://picsum.photos/200' },
                { name: 'Glue Stick pencil - 1 piece', quantity: 3, price: '35.00', image_url: 'https://picsum.photos/200' },
                { name: 'E-8000 - 50ML - 1 Piece', quantity: 2, price: '60.00', image_url: 'https://picsum.photos/200' }
            ]
        };

        const shippingLabelBuffer = await generateShippingLabelPDF(dummyOrder);
        console.log('Shipping Label PDF generated successfully.');
        const fs = require('fs');
        fs.writeFileSync('shipping-label-test.pdf', shippingLabelBuffer);
        console.log('Saved shipping-label-test.pdf to disk.');

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

        const targetEmail = process.env.SMTP_USER;
        console.log(`Sending email with shipping label attached to ${targetEmail}...`);

        const mailInfo = await transporter.sendMail({
            from: `"${process.env.SHOP_NAME || 'Your Store'}" <${process.env.SMTP_FROM_EMAIL}>`,
            to: targetEmail,
            subject: `Test Shipping Label - Order #9999`,
            text: `Hello, this is a test email with the generated Shipping Label PDF attached.`,
            attachments: [
                {
                    filename: `ShippingLabel_9999.pdf`,
                    content: shippingLabelBuffer,
                    contentType: 'application/pdf'
                }
            ]
        });

        console.log(`Success! Test email sent: ${mailInfo.messageId}`);
    } catch (error) {
        console.error('Error sending test shipping label email:', error);
    }
}

sendTestShippingLabelEmail();
