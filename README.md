# Shopify Invoice Email Plugin

This is a custom Node.js Express server that listens for Shopify `orders/create` webhooks. When an order is created, it dynamically generates a PDF invoice and sends an email to the customer with the PDF attached.

## Prerequisites

- Node.js (v14 or higher)
- A Shopify Store
- An Email Account (e.g., Gmail, SendGrid) to send emails via SMTP.

## Setup

1. **Install Dependencies**
   Navigate to the directory and run:
   ```bash
   npm install
   ```

2. **Environment Variables**
   Copy `.env.example` to a new file named `.env`:
   ```bash
   cp .env.example .env
   ```
   Fill in your configuration in the `.env` file:
   - `SHOPIFY_WEBHOOK_SECRET`: The webhook secret key from your Shopify Admin panel.
   - `SMTP_*`: Your email provider's SMTP settings. (If using Gmail, use an App Password).

3. **Start the Server**
   ```bash
   node server.js
   ```

## Shopify Configuration

1. Log in to your Shopify Admin.
2. Go to **Settings** > **Notifications**.
3. Scroll down to **Webhooks** and click **Create webhook**.
4. Set the **Event** to `Order creation`.
5. Set the **Format** to `JSON`.
6. Set the **URL** to your server's endpoint (e.g., `https://your-domain.com/webhooks/orders/create`).
   *(Note: You will need a tool like ngrok to test locally).*
7. Set the **Webhook API version** to the latest version.
8. Save the webhook.

At the bottom of the Webhooks section in Shopify, you'll see a message saying "All your webhooks will be signed with xxx...". Use that secret string as your `SHOPIFY_WEBHOOK_SECRET` in the `.env` file.

## Testing Locally

If you are developing locally, you can use `ngrok` to expose your local port 3000 to the internet:
```bash
ngrok http 3000
```
Use the `https` ngrok URL in your Shopify webhook configuration.
